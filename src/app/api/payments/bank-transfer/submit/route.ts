import { NextRequest } from 'next/server';
import { handlePaymentRequest } from '@/modules/payments/http';
import { submitBankTransfer } from '@/modules/payments/services/bankTransferService';

/** POST /api/payments/bank-transfer/submit - authenticated customer */
export async function POST(req: NextRequest) {
  return handlePaymentRequest(req, async ({ payload, user, body }) => {
    if (!user) {
      const err = new Error('UNAUTHORIZED: Authentication required to submit a bank transfer.');
      (err as any).statusCode = 401;
      throw err;
    }

    const result = await submitBankTransfer(payload, {
      orderId: body.orderId,
      claimedAmount: Number(body.claimedAmount),
      bankReferenceCode: body.bankReferenceCode,
      receiptFileId: body.receiptFileId,
      receiptStorageKey: body.receiptStorageKey,
      customer: {
        id: user.id,
        roles: Array.isArray(user.roles) ? user.roles : [],
      },
    });

    return result;
  });
}
