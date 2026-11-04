import { NextRequest } from 'next/server';
import { handlePaymentRequest } from '@/modules/payments/http';
import { recordCodCollection } from '@/modules/payments/services/codSettlementService';

/** POST /api/payments/cod/collect - operations, finance, or super_admin */
export async function POST(req: NextRequest) {
  return handlePaymentRequest(req, async ({ payload, user, body }) => {
    if (!user) {
      const err = new Error('UNAUTHORIZED: Authentication required to record cash collection.');
      (err as any).statusCode = 401;
      throw err;
    }
    const result = await recordCodCollection(payload, {
      orderId: body.orderId,
      collectedAmount: Number(body.collectedAmount),
      collectorType: body.collectorType,
      collectorName: body.collectorName,
      receiptReference: body.receiptReference,
      collectedAt: body.collectedAt,
      actor: {
        id: user.id,
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
    });
    return result;
  });
}
