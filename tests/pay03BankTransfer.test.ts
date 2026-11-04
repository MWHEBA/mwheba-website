import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import React from 'react';
import { renderToString } from 'react-dom/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import {
  submitBankTransfer,
  verifyBankTransfer,
} from '@/modules/payments/services/bankTransferService';
import { POST as submitRoute } from '@/app/api/payments/bank-transfer/submit/route';
import { POST as verifyRoute } from '@/app/api/payments/bank-transfer/verify/route';
import { FinanceVerificationPanel } from '@/modules/payments/ui/FinanceVerificationPanel';

describe('PAY-03: Bank Transfer Submission & Finance Verification Gate', () => {
  let payload: any;
  let customerUser1: any;
  let customerToken1: string;
  let customerUser2: any;
  let customerToken2: string;
  let opsUser: any;
  let opsToken: string;
  let financeUser: any;
  let financeToken: string;
  let superAdminUser: any;
  let superAdminToken: string;
  let physicalProduct: any;
  let cust1Asset: any;
  let cust2Asset: any;

  const cleanup = {
    users: [] as any[],
    orders: [] as any[],
    carts: [] as any[],
    products: [] as any[],
    transfers: [] as any[],
    assets: [] as any[],
  };

  const unique = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const loginToken = async (email: string, password: string) => {
    const res = await payload.login({ collection: 'users', data: { email, password } });
    return res.token as string;
  };

  const asReq = (url: string, token: string | null, body?: any) =>
    new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `JWT ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  // Helper to place a real Bank Transfer order for a specific customer
  const createTestBankTransferOrder = async (customer: any) => {
    const cart = await getOrCreateCart(payload);
    cleanup.carts.push(cart.id);
    await payload.update({
      collection: 'carts',
      id: cart.id,
      data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
    });

    const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });

    const result = await createOrderFromCart(payload, {
      cartId: cart.id,
      guestSecret: cart.secret,
      user: customer,
      customer: {
        email: customer.email,
        companyName: 'Corporate Client LLC',
        contactPerson: 'CFO Office',
        phone: '+201022334455',
      },
      delivery: {
        method: 'shipping',
        shippingAddress: { governorate: 'Cairo', city: 'Cairo', streetAddress: '20 Tahrir Sq' },
        expectedShippingFee: quote.shippingFee,
      },
      paymentMethod: 'bank_transfer',
      expectedGrandTotal: quote.grandTotal,
      idempotencyKey: `idemp_bt_${unique()}`,
    });

    const order = await payload.findByID({
      collection: 'orders',
      id: result.order.id,
    });
    order.total = Number(order.amount ?? order.total);
    cleanup.orders.push(order.id);
    return order;
  };

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
    const password = 'Password2026!';

    // 1. Create Customer 1
    customerUser1 = await payload.create({
      collection: 'users',
      data: { email: `cust1_bt_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(customerUser1.id);
    customerToken1 = await loginToken(customerUser1.email, password);

    // 2. Create Customer 2 (victim / competitor)
    customerUser2 = await payload.create({
      collection: 'users',
      data: { email: `cust2_bt_${unique()}@mwheba.test`, password, roles: ['customer'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(customerUser2.id);
    customerToken2 = await loginToken(customerUser2.email, password);

    // 3. Create Operations User
    opsUser = await payload.create({
      collection: 'users',
      data: { email: `ops_bt_${unique()}@mwheba.test`, password, roles: ['operations'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(opsUser.id);
    opsToken = await loginToken(opsUser.email, password);

    // 4. Create Finance User
    financeUser = await payload.create({
      collection: 'users',
      data: { email: `fin_bt_${unique()}@mwheba.test`, password, roles: ['finance'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(financeUser.id);
    financeToken = await loginToken(financeUser.email, password);

    // 5. Create Super Admin User
    superAdminUser = await payload.create({
      collection: 'users',
      data: { email: `admin_bt_${unique()}@mwheba.test`, password, roles: ['super_admin'] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(superAdminUser.id);
    superAdminToken = await loginToken(superAdminUser.email, password);

    // 6. Create Merchandise Product
    physicalProduct = await payload.create({
      collection: 'products',
      data: {
        title: 'PAY-03 Corporate Pen Set',
        slug: `pay03-pen-${unique()}`,
        itemType: 'physical',
        basePrice: 200,
        minOrderQuantity: 10,
        allowArtworkUpload: false,
        _status: 'published',
      },
    });
    cleanup.products.push(physicalProduct.id);

    // 7. Create Uploaded Receipt Asset for Customer 1
    cust1Asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: `receipts/2026/cust1_receipt_${unique()}.pdf`,
        originalFilename: 'cust1_cib_slip.pdf',
        uploader: customerUser1.id,
      },
      context: { isTrustedUpload: true },
    });
    cleanup.assets.push(cust1Asset.id);

    // 8. Create Uploaded Receipt Asset for Customer 2
    cust2Asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: `receipts/2026/cust2_receipt_${unique()}.pdf`,
        originalFilename: 'cust2_cib_slip.pdf',
        uploader: customerUser2.id,
      },
      context: { isTrustedUpload: true },
    });
    cleanup.assets.push(cust2Asset.id);
  });

  afterAll(async () => {
    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {
        // best effort
      }
    };

    for (const tId of cleanup.transfers) await del('bank-transfers', tId);

    for (const orderId of cleanup.orders) {
      const jobs = await payload
        .find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, limit: 50, depth: 0 })
        .catch(() => ({ docs: [] }));
      for (const j of jobs.docs as any[]) await del('fulfillment-jobs', j.id);
      await del('orders', orderId);
    }

    for (const aId of cleanup.assets) await del('artwork-assets', aId, { isTrustedUpload: true });
    for (const id of cleanup.users) await del('users', id);
    for (const id of cleanup.products) await del('products', id);
    for (const id of cleanup.carts) await del('carts', id);
  });

  // ===========================================================================
  // 1. Customer Bank Transfer Submission
  // ===========================================================================
  describe('1. Customer Bank Transfer Submission', () => {
    it('rejects bank transfer submission when unauthenticated (401)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);

      await expect(
        submitBankTransfer(payload, {
          orderId: order.id,
          claimedAmount: order.total,
          bankReferenceCode: 'WIRE-123456',
          customer: { id: '', roles: [] },
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('rejects submission for an order with paymentMethod !== bank_transfer (422 INVALID_ORDER_PAYMENT_METHOD)', async () => {
      // Create COD order
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 10 }] },
      });
      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'shipping', governorate: 'Cairo' });
      const codRes = await createOrderFromCart(payload, {
        cartId: cart.id,
        guestSecret: cart.secret,
        user: customerUser1,
        customer: {
          email: customerUser1.email,
          companyName: 'Corporate Client LLC',
          contactPerson: 'Purchasing Officer',
          phone: '+201011223344',
        },
        delivery: {
          method: 'shipping',
          shippingAddress: { governorate: 'Cairo', city: 'Cairo', streetAddress: '20 Tahrir Sq' },
          expectedShippingFee: quote.shippingFee,
        },
        paymentMethod: 'cod',
        expectedGrandTotal: quote.grandTotal,
        idempotencyKey: `cod_order_${unique()}`,
      });
      cleanup.orders.push(codRes.order.id);

      await expect(
        submitBankTransfer(payload, {
          orderId: codRes.order.id,
          claimedAmount: quote.grandTotal,
          bankReferenceCode: 'WIRE-COD-FAIL',
          customer: { id: customerUser1.id, roles: customerUser1.roles },
        })
      ).rejects.toThrow('INVALID_ORDER_PAYMENT_METHOD');
    });

    it('rejects customer submitting bank transfer for an order owned by another customer (403 ORDER_OWNERSHIP_MISMATCH)', async () => {
      const order1 = await createTestBankTransferOrder(customerUser1);

      // Customer 2 attempts to submit for Customer 1's order
      await expect(
        submitBankTransfer(payload, {
          orderId: order1.id,
          claimedAmount: order1.total,
          bankReferenceCode: 'WIRE-HIJACK',
          customer: { id: customerUser2.id, roles: customerUser2.roles },
        })
      ).rejects.toThrow('ORDER_OWNERSHIP_MISMATCH');
    });

    it('rejects bank transfer submission referencing a non-existent receiptStorageKey (404 RECEIPT_KEY_NOT_FOUND)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      await expect(
        submitBankTransfer(payload, {
          orderId: order.id,
          claimedAmount: order.total,
          bankReferenceCode: `WIRE_FAKE_${unique()}`,
          receiptStorageKey: 'receipts/non_existent_fake_slip.pdf',
          customer: { id: customerUser1.id, roles: customerUser1.roles },
        })
      ).rejects.toThrow('RECEIPT_KEY_NOT_FOUND');
    });

    it('rejects customer submitting another user\'s private receiptStorageKey (403 RECEIPT_OWNERSHIP_MISMATCH)', async () => {
      const order2 = await createTestBankTransferOrder(customerUser2);
      // Customer 2 tries to submit Customer 1's uploaded receipt
      await expect(
        submitBankTransfer(payload, {
          orderId: order2.id,
          claimedAmount: order2.total,
          bankReferenceCode: `WIRE_STOLEN_${unique()}`,
          receiptStorageKey: cust1Asset.storageKey,
          customer: { id: customerUser2.id, roles: customerUser2.roles },
        })
      ).rejects.toThrow('RECEIPT_OWNERSHIP_MISMATCH');
    });

    it('rejects customer submitting another user\'s receiptFileId (403 RECEIPT_OWNERSHIP_MISMATCH)', async () => {
      const order2 = await createTestBankTransferOrder(customerUser2);
      // Customer 2 tries to submit Customer 1's asset ID
      await expect(
        submitBankTransfer(payload, {
          orderId: order2.id,
          claimedAmount: order2.total,
          bankReferenceCode: `WIRE_STOLEN_ID_${unique()}`,
          receiptFileId: cust1Asset.id,
          customer: { id: customerUser2.id, roles: customerUser2.roles },
        })
      ).rejects.toThrow('RECEIPT_OWNERSHIP_MISMATCH');
    });

    it('successfully submits bank transfer: creates record in pending_verification and updates order to pending_verification', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const wireRef = `CIB_WIRE_${unique()}`;

      const res = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: wireRef,
        receiptStorageKey: cust1Asset.storageKey,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });

      expect(res.status).toBe('SUBMITTED');
      expect(res.transferStatus).toBe('pending_verification');
      cleanup.transfers.push(res.transferId);

      // Check bank transfer doc in DB
      const transferDoc = await payload.findByID({ collection: 'bank-transfers', id: res.transferId });
      expect(transferDoc.status).toBe('pending_verification');
      expect(transferDoc.claimedAmount).toBe(order.total);
      expect(transferDoc.bankReferenceCode).toBe(wireRef);
      expect(transferDoc.receiptStorageKey).toBe(cust1Asset.storageKey);

      // Check order in DB
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).toBe('pending_verification');
    });
  });

  // ===========================================================================
  // 2. Finance Verification Gate & Penny-Perfect Matching
  // ===========================================================================
  describe('2. Finance Verification Gate & Penny-Perfect Matching', () => {
    it('rejects non-finance users (operations, customer) from approving or rejecting bank transfers with 403 FORBIDDEN', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      // Operations user attempts approval
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: `REC_${unique()}`,
          confirmedAmount: order.total,
          actor: { id: opsUser.id, roles: opsUser.roles },
        })
      ).rejects.toThrow('FORBIDDEN');

      // Customer attempts approval
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: `REC_${unique()}`,
          confirmedAmount: order.total,
          actor: { id: customerUser1.id, roles: customerUser1.roles },
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('rejects approval when internalReconciliationCode or confirmedAmount is missing (400)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      // Missing reconciliation code
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: '',
          confirmedAmount: order.total,
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('RECONCILIATION_CODE_REQUIRED');

      // Missing confirmed amount
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: `REC_${unique()}`,
          confirmedAmount: undefined,
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('CONFIRMED_AMOUNT_REQUIRED');
    });

    it('rejects approval when confirmedAmount does not match order grand total with exact integer piastres (422 BANK_TRANSFER_AMOUNT_MISMATCH)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      // Confirmed deposit short by 10 EGP
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: `REC_FAIL_${unique()}`,
          confirmedAmount: Number(order.total) - 10,
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('BANK_TRANSFER_AMOUNT_MISMATCH');
    });

    it('rejects double-reconciliation when the same internalReconciliationCode is reused across transfers (RECONCILIATION_CODE_ALREADY_USED)', async () => {
      const sharedRecCode = `CIB_STMT_ROW_${unique()}`;

      // Order 1 approved with sharedRecCode
      const order1 = await createTestBankTransferOrder(customerUser1);
      const sub1 = await submitBankTransfer(payload, {
        orderId: order1.id,
        claimedAmount: order1.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(sub1.transferId);

      await verifyBankTransfer(payload, {
        transferId: sub1.transferId,
        action: 'approve',
        internalReconciliationCode: sharedRecCode,
        confirmedAmount: order1.total,
        actor: { id: financeUser.id, roles: financeUser.roles },
      });

      // Order 2 submitted
      const order2 = await createTestBankTransferOrder(customerUser1);
      const sub2 = await submitBankTransfer(payload, {
        orderId: order2.id,
        claimedAmount: order2.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(sub2.transferId);

      // Attempt to reuse sharedRecCode on Order 2
      await expect(
        verifyBankTransfer(payload, {
          transferId: sub2.transferId,
          action: 'approve',
          internalReconciliationCode: sharedRecCode, // duplicate!
          confirmedAmount: order2.total,
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('RECONCILIATION_CODE_ALREADY_USED');
    });

    it('successfully approves bank transfer: marks transfer approved, updates order to paid, and logs full audit trail', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const recCode = `STMT_VALID_${unique()}`;

      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      const verifyRes = await verifyBankTransfer(payload, {
        transferId: subRes.transferId,
        action: 'approve',
        internalReconciliationCode: recCode,
        confirmedAmount: order.total,
        actor: { id: financeUser.id, roles: financeUser.roles },
      });

      expect(verifyRes.status).toBe('APPROVED');
      expect(verifyRes.orderPaymentStatus).toBe('paid');

      // Check transfer in DB
      const transferDoc = await payload.findByID({ collection: 'bank-transfers', id: subRes.transferId });
      expect(transferDoc.status).toBe('approved');
      expect(transferDoc.internalReconciliationCode).toBe(recCode);
      expect(transferDoc.confirmedAmount).toBe(order.total);
      expect(transferDoc.verifiedAt).toBeDefined();

      // Check order in DB
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).toBe('paid');
      expect(freshOrder.paidAt).toBeDefined();
      expect(freshOrder.auditLog?.some((log: any) => log.entry.includes(recCode))).toBe(true);

      // Attempting to re-approve must fail
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: `ANOTHER_CODE_${unique()}`,
          confirmedAmount: order.total,
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('BANK_TRANSFER_ALREADY_APPROVED');

      // Attempting to delete approved transfer must fail
      await expect(
        payload.delete({
          collection: 'bank-transfers',
          id: subRes.transferId,
        })
      ).rejects.toThrow('BANK_TRANSFER_DELETION_FORBIDDEN_AFTER_APPROVAL');
    });

    it('rolls back bank transfer approval if order update fails, leaving transfer in pending_verification', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const recCode = `STMT_ROLLBACK_${unique()}`;

      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_ROLL_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      // Verify with simulated order update failure
      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'approve',
          internalReconciliationCode: recCode,
          confirmedAmount: order.total,
          actor: { id: financeUser.id, roles: financeUser.roles },
          simulateOrderUpdateFailure: true,
        })
      ).rejects.toThrow('SIMULATED_ORDER_UPDATE_FAILURE');

      // Verify PostgreSQL transaction rolled back: transfer doc must NOT be approved
      const transferDoc = await payload.findByID({ collection: 'bank-transfers', id: subRes.transferId });
      expect(transferDoc.status).toBe('pending_verification');
      expect(transferDoc.internalReconciliationCode).toBeFalsy();

      // Order must NOT be marked paid
      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).not.toBe('paid');
    });

    it('strictly forbids modifying the linked order on an existing bank transfer (BANK_TRANSFER_ORDER_IMMUTABLE)', async () => {
      const order1 = await createTestBankTransferOrder(customerUser1);
      const order2 = await createTestBankTransferOrder(customerUser1);

      const subRes = await submitBankTransfer(payload, {
        orderId: order1.id,
        claimedAmount: order1.total,
        bankReferenceCode: `WIRE_IMM_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      // Attempt to reassign transfer to order2
      await expect(
        payload.update({
          collection: 'bank-transfers',
          id: subRes.transferId,
          data: {
            order: order2.id,
          },
          user: financeUser,
          overrideAccess: true,
        })
      ).rejects.toThrow('BANK_TRANSFER_ORDER_IMMUTABLE');
    });

    it('rejects approving a bank transfer for an order that is already paid (ORDER_ALREADY_PAID)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const recCode1 = `STMT_PAID1_${unique()}`;

      // Submit Transfer 1 while order is unpaid
      const sub1 = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_PAID1_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(sub1.transferId);

      // Submit Transfer 2 while order is still pending_verification
      const sub2 = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_PAID2_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(sub2.transferId);

      // Now approve Transfer 1 -> sets order to paid
      await verifyBankTransfer(payload, {
        transferId: sub1.transferId,
        action: 'approve',
        internalReconciliationCode: recCode1,
        confirmedAmount: order.total,
        actor: { id: financeUser.id, roles: financeUser.roles },
      });

      // Attempt to approve Transfer 2 on the now paid order -> MUST FAIL with ORDER_ALREADY_PAID
      const recCode2 = `STMT_PAID2_${unique()}`;
      await expect(
        verifyBankTransfer(payload, {
          transferId: sub2.transferId,
          action: 'approve',
          internalReconciliationCode: recCode2,
          confirmedAmount: order.total,
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('ORDER_ALREADY_PAID');
    });

    it('returns bankDetails in checkout quote reflecting CommerceSettings status', async () => {
      const cart = await getOrCreateCart(payload);
      cleanup.carts.push(cart.id);
      await payload.update({
        collection: 'carts',
        id: cart.id,
        data: { items: [{ product: physicalProduct.id, quantity: 1 }] },
      });

      const quote = await buildCheckoutQuote(payload, cart.id, { method: 'pickup' });
      expect(quote.bankDetails).toBeDefined();
      expect(['pending_configuration', 'active']).toContain(quote.bankDetails?.status);
    });
  });

  // ===========================================================================
  // 3. Bank Transfer Rejection & Failure Handling
  // ===========================================================================
  describe('3. Bank Transfer Rejection & Failure Handling', () => {
    it('rejects rejection call without a mandatory documented rejectionReason (400 REJECTION_REASON_REQUIRED)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      await expect(
        verifyBankTransfer(payload, {
          transferId: subRes.transferId,
          action: 'reject',
          rejectionReason: '',
          actor: { id: financeUser.id, roles: financeUser.roles },
        })
      ).rejects.toThrow('REJECTION_REASON_REQUIRED');
    });

    it('successfully rejects bank transfer: updates transfer to rejected, updates order to failed, and logs rejection reason', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_BAD_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      const rejectReason = 'Invalid receipt: wire transfer reversed by sending bank.';
      const res = await verifyBankTransfer(payload, {
        transferId: subRes.transferId,
        action: 'reject',
        rejectionReason: rejectReason,
        actor: { id: financeUser.id, roles: financeUser.roles },
      });

      expect(res.status).toBe('REJECTED');
      expect(res.rejectionReason).toBe(rejectReason);
      expect(res.orderPaymentStatus).toBe('failed');

      // Check DB
      const transferDoc = await payload.findByID({ collection: 'bank-transfers', id: subRes.transferId });
      expect(transferDoc.status).toBe('rejected');
      expect(transferDoc.rejectionReason).toBe(rejectReason);

      const freshOrder = await payload.findByID({ collection: 'orders', id: order.id });
      expect(freshOrder.paymentStatus).toBe('failed');
      expect(freshOrder.auditLog?.some((log: any) => log.entry.includes(rejectReason))).toBe(true);
    });
  });

  // ===========================================================================
  // 4. Direct Mutation & Escalation Defense on Orders
  // ===========================================================================
  describe('4. Direct Mutation & Escalation Defense on Orders', () => {
    it('strictly blocks direct manual mutation of bank transfer order to paid without an approved bank transfer (MISSING_APPROVED_BANK_TRANSFER)', async () => {
      const order = await createTestBankTransferOrder(customerUser1);

      // Attempt to directly set paymentStatus = 'paid' without an approved bank transfer record
      await expect(
        payload.update({
          collection: 'orders',
          id: order.id,
          data: {
            paymentStatus: 'paid',
          },
          overrideAccess: true,
        })
      ).rejects.toThrow('DIRECT_BANK_TRANSFER_PAYMENT_STATUS_MUTATION_FORBIDDEN');
    });
  });

  // ===========================================================================
  // 5. HTTP Endpoints Integration (/api/payments/bank-transfer/*)
  // ===========================================================================
  describe('5. HTTP Endpoints Integration (/api/payments/bank-transfer/*)', () => {
    it('submits bank transfer via POST /api/payments/bank-transfer/submit with customer JWT auth', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const wireRef = `HTTP_WIRE_${unique()}`;

      // 1. Unauthenticated -> 401
      const unauthReq = asReq('http://localhost:3000/api/payments/bank-transfer/submit', null, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: wireRef,
      });
      const unauthRes = await submitRoute(unauthReq);
      expect(unauthRes.status).toBe(401);

      // 2. Authenticated customer -> 200
      const authReq = asReq('http://localhost:3000/api/payments/bank-transfer/submit', customerToken1, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: wireRef,
      });
      const authRes = await submitRoute(authReq);
      expect(authRes.status).toBe(200);
      const body = await authRes.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe('SUBMITTED');
      expect(body.transferStatus).toBe('pending_verification');
      cleanup.transfers.push(body.transferId);
    });

    it('verifies bank transfer via POST /api/payments/bank-transfer/verify with finance JWT auth', async () => {
      const order = await createTestBankTransferOrder(customerUser1);
      const subRes = await submitBankTransfer(payload, {
        orderId: order.id,
        claimedAmount: order.total,
        bankReferenceCode: `WIRE_HTTP_${unique()}`,
        customer: { id: customerUser1.id, roles: customerUser1.roles },
      });
      cleanup.transfers.push(subRes.transferId);

      const recCode = `HTTP_REC_${unique()}`;

      // Customer attempt -> 403
      const custReq = asReq('http://localhost:3000/api/payments/bank-transfer/verify', customerToken1, {
        transferId: subRes.transferId,
        action: 'approve',
        internalReconciliationCode: recCode,
        confirmedAmount: order.total,
      });
      const custRes = await verifyRoute(custReq);
      expect(custRes.status).toBe(403);

      // Finance attempt -> 200
      const finReq = asReq('http://localhost:3000/api/payments/bank-transfer/verify', financeToken, {
        transferId: subRes.transferId,
        action: 'approve',
        internalReconciliationCode: recCode,
        confirmedAmount: order.total,
      });
      const finRes = await verifyRoute(finReq);
      expect(finRes.status).toBe(200);
      const body = await finRes.json();
      expect(body.success).toBe(true);
      expect(body.status).toBe('APPROVED');
      expect(body.orderPaymentStatus).toBe('paid');
    });
  });

  // ===========================================================================
  // 6. UI & Finance Verification Panel Component Rendering
  // ===========================================================================
  describe('6. UI & Finance Verification Panel Component Rendering', () => {
    it('renders FinanceVerificationPanel with pending bank transfer details, claimed amount, and reconciliation controls', () => {
      const mockTransfers: any[] = [
        {
          id: 101,
          orderId: 505,
          orderNumber: 'ORD-2026-505',
          orderTotal: 2500,
          claimedAmount: 2500,
          bankReferenceCode: 'CIB-TXN-998877',
          receiptStorageKey: 'receipts/2026/deposit_slip_505.pdf',
          status: 'pending_verification',
        },
      ];

      const html = renderToString(
        React.createElement(FinanceVerificationPanel, {
          transfers: mockTransfers,
          locale: 'ar',
        })
      );

      expect(html).toContain('CIB-TXN-998877');
      expect(html).toContain('505');
      expect(html).toContain('receipts/2026/deposit_slip_505.pdf');
      expect(html).toContain('كود مطابقة كشف الحساب البنكي الداخلي');
    });

    it('renders FinanceVerificationPanel in English locale', () => {
      const mockTransfers: any[] = [
        {
          id: 102,
          orderId: 506,
          orderNumber: 'ORD-2026-506',
          orderTotal: 1800,
          claimedAmount: 1800,
          bankReferenceCode: 'HSBC-WIRE-443322',
          status: 'pending_verification',
        },
      ];

      const html = renderToString(
        React.createElement(FinanceVerificationPanel, {
          transfers: mockTransfers,
          locale: 'en',
        })
      );

      expect(html).toContain('HSBC-WIRE-443322');
      expect(html).toContain('Corporate Bank Wire Finance Verification');
      expect(html).toContain('Approve &amp; Settle');
    });
  });
});
