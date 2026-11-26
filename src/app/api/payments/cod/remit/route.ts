import { handleCodRequest } from '@/modules/payments/codHttp';
import { getCourierRemittanceStatus, reconcileCourierRemittanceBatch } from '@/modules/payments/services/codSettlementService';

export async function GET(req: Request) {
  return handleCodRequest(req, (payload, actor) => getCourierRemittanceStatus(payload, actor));
}

export async function POST(req: Request) {
  return handleCodRequest(req, (payload, actor, body) => reconcileCourierRemittanceBatch(payload, {
    batchId: body.batchId,
    courierCompany: body.courierCompany,
    orderIds: body.orderIds,
    grossCollectedAmount: body.grossCollectedAmount,
    courierFeeDeductions: body.courierFeeDeductions,
    otherDeductions: body.otherDeductions,
    netDepositAmount: body.netDepositAmount,
    depositSlipReference: body.depositSlipReference,
    depositDate: body.depositDate,
    varianceApproved: body.varianceApproved,
    varianceNotes: body.varianceNotes,
    actor,
  }));
}
