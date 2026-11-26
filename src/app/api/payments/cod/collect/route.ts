import { handleCodRequest } from '@/modules/payments/codHttp';
import { getCodOrderSettlement, recordCodCollection } from '@/modules/payments/services/codSettlementService';

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get('orderId');
  return handleCodRequest(req, (payload, actor) => getCodOrderSettlement(payload, orderId, actor));
}

export async function POST(req: Request) {
  return handleCodRequest(req, (payload, actor, body) => recordCodCollection(payload, {
    orderId: body.orderId,
    collectedAmount: body.collectedAmount,
    currency: body.currency,
    collectorType: body.collectorType,
    collectorName: body.collectorName,
    receiptReference: body.receiptReference,
    collectedAt: body.collectedAt,
    actor,
  }));
}
