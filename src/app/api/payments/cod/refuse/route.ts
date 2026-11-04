import { NextRequest } from 'next/server';
import { handlePaymentRequest } from '@/modules/payments/http';
import { recordDeliveryRefusal } from '@/modules/payments/services/codSettlementService';

/** POST /api/payments/cod/refuse - operations, finance, or super_admin */
export async function POST(req: NextRequest) {
  return handlePaymentRequest(req, async ({ payload, user, body }) => {
    if (!user) {
      const err = new Error('UNAUTHORIZED: Authentication required to record delivery refusal.');
      (err as any).statusCode = 401;
      throw err;
    }
    const result = await recordDeliveryRefusal(payload, {
      orderId: body.orderId,
      refusalReason: body.refusalReason,
      actor: {
        id: user.id,
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
    });
    return result;
  });
}
