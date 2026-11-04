/**
 * MWHEBA 2.0 | Corporate Bank Transfer Workflow & Finance Verification Gate (PAY-03)
 *
 * Implements:
 * 1. Customer Bank Transfer Submission with order ownership verification, receipt linking, and claimed amount validation.
 * 2. Finance Verification Action restricted strictly to 'finance' and 'super_admin' roles.
 * 3. Exact integer piastre matching against order grand total before approval.
 * 4. Internal bank statement reconciliation code uniqueness (prevents double reconciliation of deposits).
 * 5. Permanent immutability of approved bank transfers.
 * 6. Order paymentStatus updates ('pending_verification' -> 'paid' on approve, 'failed' on reject).
 */

import type { Payload } from 'payload';
import { hasRole } from '@/modules/identity/access/roles';
import { toIntegerPiastres } from '@/modules/orders/logic/orderSnapshotEngine';

export interface SubmitBankTransferParams {
  orderId: string | number;
  claimedAmount: number;
  bankReferenceCode: string;
  receiptFileId?: string | number;
  receiptStorageKey?: string;
  customer: {
    id: string | number;
    roles: string[];
  };
}

export interface VerifyBankTransferParams {
  transferId: string | number;
  action: 'approve' | 'reject';
  internalReconciliationCode?: string;
  confirmedAmount?: number;
  rejectionReason?: string;
  actor: {
    id: string | number;
    roles: string[];
  };
}

/**
 * 1. Submit Corporate Bank Transfer Receipt
 */
export async function submitBankTransfer(
  payload: Payload,
  params: SubmitBankTransferParams
) {
  const { orderId, claimedAmount, bankReferenceCode, receiptFileId, receiptStorageKey, customer } = params;

  if (!customer || !customer.id) {
    const err = new Error('UNAUTHORIZED: Authentication required to submit bank transfer.');
    (err as any).statusCode = 401;
    throw err;
  }

  if (!bankReferenceCode || !bankReferenceCode.trim()) {
    const err = new Error('INVALID_BANK_REFERENCE: Bank reference / transaction code is required.');
    (err as any).statusCode = 400;
    throw err;
  }

  // Validate claimed amount using integer piastres
  toIntegerPiastres(claimedAmount, 'Claimed deposit amount');

  // Verify linked order
  const order = (await payload.findByID({
    collection: 'orders' as any,
    id: orderId,
  })) as any;

  if (!order) {
    const err = new Error(`ORDER_NOT_FOUND: Linked order #${orderId} does not exist.`);
    (err as any).statusCode = 404;
    throw err;
  }

  if (order.paymentMethod !== 'bank_transfer') {
    const err = new Error(
      `INVALID_ORDER_PAYMENT_METHOD: Cannot submit bank transfer for order #${orderId} with paymentMethod '${order.paymentMethod}'. Only 'bank_transfer' orders accept bank receipts.`
    );
    (err as any).statusCode = 422;
    throw err;
  }

  if (order.paymentStatus === 'paid') {
    const err = new Error(`ORDER_ALREADY_PAID: Cannot submit bank transfer for order #${orderId} because it is already paid.`);
    (err as any).statusCode = 422;
    throw err;
  }

  // Check ownership
  const isPrivileged = hasRole(customer, ['super_admin', 'finance']);
  const orderCustomerId =
    typeof order.customer === 'object' && order.customer !== null ? order.customer.id : order.customer;

  if (!isPrivileged && String(orderCustomerId) !== String(customer.id)) {
    const err = new Error('ORDER_OWNERSHIP_MISMATCH: Forbidden: You cannot submit a bank transfer for an order that belongs to another customer.');
    (err as any).statusCode = 403;
    throw err;
  }

  // Create bank transfer submission record (user context passed to trigger hooks)
  const transfer = (await payload.create({
    collection: 'bank-transfers' as any,
    data: {
      order: order.id,
      claimedAmount,
      bankReferenceCode,
      receiptFile: receiptFileId || undefined,
      receiptStorageKey: receiptStorageKey || undefined,
    },
    user: customer as any,
    overrideAccess: true,
  })) as any;

  // Update order status to pending_verification
  await payload.update({
    collection: 'orders' as any,
    id: order.id,
    data: {
      paymentStatus: 'pending_verification',
    },
    overrideAccess: true,
  });

  return {
    status: 'SUBMITTED',
    transferId: transfer.id,
    orderId: order.id,
    claimedAmount,
    bankReferenceCode,
    transferStatus: transfer.status,
  };
}

/**
 * 2. Finance Verification Action (Approve / Reject)
 */
export async function verifyBankTransfer(
  payload: Payload,
  params: VerifyBankTransferParams
) {
  const { transferId, action, internalReconciliationCode, confirmedAmount, rejectionReason, actor } = params;

  // RBAC: finance or super_admin only
  if (!actor || !hasRole(actor, ['super_admin', 'finance'])) {
    const err = new Error('FORBIDDEN: Only finance officers can verify corporate bank transfers.');
    (err as any).statusCode = 403;
    throw err;
  }

  if (action !== 'approve' && action !== 'reject') {
    const err = new Error("INVALID_ACTION: Verification action must be either 'approve' or 'reject'.");
    (err as any).statusCode = 400;
    throw err;
  }

  const transfer = (await payload.findByID({
    collection: 'bank-transfers' as any,
    id: transferId,
  })) as any;

  if (!transfer) {
    const err = new Error(`TRANSFER_NOT_FOUND: Bank transfer #${transferId} not found.`);
    (err as any).statusCode = 404;
    throw err;
  }

  if (transfer.status === 'approved') {
    const err = new Error(`BANK_TRANSFER_ALREADY_APPROVED: Bank transfer #${transferId} has already been approved and reconciled.`);
    (err as any).statusCode = 422;
    throw err;
  }

  if (action === 'approve') {
    const recCode = String(internalReconciliationCode || '').trim();
    if (!recCode) {
      const err = new Error('RECONCILIATION_CODE_REQUIRED: An internal bank statement reconciliation code is required to approve a bank transfer.');
      (err as any).statusCode = 400;
      throw err;
    }

    if (confirmedAmount === undefined || confirmedAmount === null) {
      const err = new Error('CONFIRMED_AMOUNT_REQUIRED: A valid confirmed deposit amount must be explicitly recorded by finance.');
      (err as any).statusCode = 400;
      throw err;
    }

    const updated = (await payload.update({
      collection: 'bank-transfers' as any,
      id: transferId,
      data: {
        status: 'approved',
        internalReconciliationCode: recCode,
        confirmedAmount,
      },
      user: actor as any,
      overrideAccess: true,
    })) as any;

    const orderId =
      typeof updated.order === 'object' && updated.order !== null ? updated.order.id : updated.order;
    const freshOrder = (await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
    })) as any;

    return {
      status: 'APPROVED',
      transferId: updated.id,
      orderId,
      confirmedAmount: updated.confirmedAmount,
      internalReconciliationCode: updated.internalReconciliationCode,
      orderPaymentStatus: freshOrder.paymentStatus,
    };
  } else {
    // action === 'reject'
    const reason = String(rejectionReason || '').trim();
    if (!reason) {
      const err = new Error('REJECTION_REASON_REQUIRED: A documented rejection reason is mandatory when rejecting a bank transfer.');
      (err as any).statusCode = 400;
      throw err;
    }

    const updated = (await payload.update({
      collection: 'bank-transfers' as any,
      id: transferId,
      data: {
        status: 'rejected',
        rejectionReason: reason,
      },
      user: actor as any,
      overrideAccess: true,
    })) as any;

    const orderId =
      typeof updated.order === 'object' && updated.order !== null ? updated.order.id : updated.order;
    const freshOrder = (await payload.findByID({
      collection: 'orders' as any,
      id: orderId,
    })) as any;

    return {
      status: 'REJECTED',
      transferId: updated.id,
      orderId,
      rejectionReason: updated.rejectionReason,
      orderPaymentStatus: freshOrder.paymentStatus,
    };
  }
}
