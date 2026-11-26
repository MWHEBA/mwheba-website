import { handleCodRequest } from '@/modules/payments/codHttp';
import { recordDeliveryRefusal } from '@/modules/payments/services/codSettlementService';

export async function POST(req: Request) {
  return handleCodRequest(req, (payload, actor, body) => recordDeliveryRefusal(payload, {
    orderId: body.orderId, refusalReason: body.refusalReason, actor,
  }));
}
