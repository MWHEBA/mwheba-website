import { NextRequest } from 'next/server';
import { handlePaymentRequest } from '@/modules/payments/http';
import { reconcileCourierRemittanceBatch } from '@/modules/payments/services/codSettlementService';

/** POST /api/payments/cod/remit - finance or super_admin only */
export async function POST(req: NextRequest) {
  return handlePaymentRequest(req, async ({ payload, user, body }) => {
    if (!user) {
      const err = new Error('UNAUTHORIZED: Authentication required to reconcile courier remittance.');
      (err as any).statusCode = 401;
      throw err;
    }
    const result = await reconcileCourierRemittanceBatch(payload, {
      batchId: body.batchId,
      courierCompany: body.courierCompany,
      orderIds: Array.isArray(body.orderIds) ? body.orderIds : [],
      grossCollectedAmount: Number(body.grossCollectedAmount),
      courierFeeDeductions: body.courierFeeDeductions !== undefined ? Number(body.courierFeeDeductions) : 0,
      otherDeductions: body.otherDeductions !== undefined ? Number(body.otherDeductions) : 0,
      netDepositAmount: Number(body.netDepositAmount),
      depositSlipReference: body.depositSlipReference,
      depositDate: body.depositDate,
      actor: {
        id: user.id,
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
      varianceApproved: Boolean(body.varianceApproved),
      varianceNotes: body.varianceNotes,
    });
    return result;
  });
}
