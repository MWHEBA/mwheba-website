/**
 * MWHEBA 2.0 Manual Corporate Bank Transfer Engine
 * Enforces strict role-based access control (RBAC) and audit trails.
 */

import { OrderSnapshot } from './orderSnapshotEngine';

export interface UserSession {
  id: string;
  email: string;
  roles: string[];
}

export interface BankTransferSubmission {
  id: string;
  orderId: string;
  receiptAssetId: string;
  claimedAmount: number;
  bankReferenceCode: string;
  status: 'pending_verification' | 'approved' | 'rejected';
  reconciliationCode?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface AuditRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorEmail: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export class BankTransferEngine {
  private submissions: Map<string, BankTransferSubmission> = new Map();
  private auditLog: AuditRecord[] = [];

  submitReceipt(
    order: OrderSnapshot,
    receiptAssetId: string,
    claimedAmount: number,
    bankReferenceCode: string
  ): BankTransferSubmission {
    const submissionId = `sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const submission: BankTransferSubmission = {
      id: submissionId,
      orderId: order.orderId,
      receiptAssetId,
      claimedAmount,
      bankReferenceCode,
      status: 'pending_verification',
    };
    this.submissions.set(order.orderId, submission);

    this.auditLog.push({
      id: `aud_${Date.now()}`,
      entityType: 'bank_transfer',
      entityId: submissionId,
      action: 'SUBMITTED',
      actorId: order.customer.email,
      actorEmail: order.customer.email,
      timestamp: new Date().toISOString(),
      details: { claimedAmount, bankReferenceCode, orderId: order.orderId },
    });

    return submission;
  }

  getSubmission(orderId: string): BankTransferSubmission | undefined {
    return this.submissions.get(orderId);
  }

  getAuditLog(): AuditRecord[] {
    return [...this.auditLog];
  }

  approveTransfer(
    order: OrderSnapshot,
    user: UserSession,
    reconciliationCode: string
  ): { order: OrderSnapshot; submission: BankTransferSubmission } {
    // 1. RBAC Guard: Only finance and admin roles are authorized
    const isAuthorized = user.roles.includes('finance') || user.roles.includes('admin');
    if (!isAuthorized) {
      const error: any = new Error('Forbidden: Only finance officers or administrators can approve bank transfers.');
      error.status = 403;
      error.statusCode = 403;
      throw error;
    }

    if (!reconciliationCode || reconciliationCode.trim().length === 0) {
      const error: any = new Error('Bad Request: Bank statement reconciliation code is required for approval.');
      error.status = 400;
      error.statusCode = 400;
      throw error;
    }

    const submission = this.submissions.get(order.orderId);
    if (!submission) {
      throw new Error(`Submission not found for order ${order.orderId}`);
    }

    // 2. State transition
    submission.status = 'approved';
    submission.reconciliationCode = reconciliationCode;
    submission.verifiedBy = user.id;
    submission.verifiedAt = new Date().toISOString();

    order.paymentStatus = 'paid';
    order.orderStatus = 'confirmed';

    // 3. Immutable audit trail
    this.auditLog.push({
      id: `aud_${Date.now()}`,
      entityType: 'order',
      entityId: order.orderId,
      action: 'BANK_TRANSFER_APPROVED',
      actorId: user.id,
      actorEmail: user.email,
      timestamp: new Date().toISOString(),
      details: {
        reconciliationCode,
        submissionId: submission.id,
        previousPaymentStatus: 'pending_verification',
        newPaymentStatus: 'paid',
      },
    });

    return { order, submission };
  }

  rejectTransfer(
    order: OrderSnapshot,
    user: UserSession,
    reason: string
  ): { order: OrderSnapshot; submission: BankTransferSubmission } {
    const isAuthorized = user.roles.includes('finance') || user.roles.includes('admin');
    if (!isAuthorized) {
      const error: any = new Error('Forbidden: Only finance officers or administrators can reject bank transfers.');
      error.status = 403;
      error.statusCode = 403;
      throw error;
    }

    const submission = this.submissions.get(order.orderId);
    if (!submission) {
      throw new Error(`Submission not found for order ${order.orderId}`);
    }

    submission.status = 'rejected';
    submission.rejectionReason = reason;
    submission.verifiedBy = user.id;
    submission.verifiedAt = new Date().toISOString();

    order.paymentStatus = 'failed';
    order.orderStatus = 'cancelled';

    this.auditLog.push({
      id: `aud_${Date.now()}`,
      entityType: 'order',
      entityId: order.orderId,
      action: 'BANK_TRANSFER_REJECTED',
      actorId: user.id,
      actorEmail: user.email,
      timestamp: new Date().toISOString(),
      details: {
        reason,
        submissionId: submission.id,
        previousPaymentStatus: 'pending_verification',
        newPaymentStatus: 'failed',
      },
    });

    return { order, submission };
  }
}
