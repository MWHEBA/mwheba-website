import { NextRequest } from 'next/server';
import { handlePaymentRequest } from '@/modules/payments/http';
import { verifyBankTransfer } from '@/modules/payments/services/bankTransferService';

/** POST /api/payments/bank-transfer/verify - finance or super_admin only */
export async function POST(req: NextRequest) {
  return handlePaymentRequest(req, async ({ payload, user, body }) => {
    if (!user) {
      const err = new Error('UNAUTHORIZED: Authentication required to verify bank transfer.');
      (err as any).statusCode = 401;
      throw err;
    }

    const result = await verifyBankTransfer(payload, {
      transferId: body.transferId,
      action: body.action,
      internalReconciliationCode: body.internalReconciliationCode,
      confirmedAmount: body.confirmedAmount !== undefined ? Number(body.confirmedAmount) : undefined,
      rejectionReason: body.rejectionReason,
      actor: {
        id: user.id,
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
    });

    return result;
  });
}
