/**
 * Standalone Worker Process for Cross-Process Concurrency Testing
 * Runs in an isolated Node.js OS process with zero shared in-memory state.
 */

import configPromise from '../../src/payload.config';
import { getPayload } from 'payload';
import { calculatePaymobHmac, processPaymobWebhook, PaymobTransactionObj } from '../../src/logic/paymobEngine';

async function main() {
  const args = process.argv.slice(2);
  const orderId = Number(args[0]);
  const attemptId = Number(args[1]);
  const txnId = Number(args[2]);
  const gatewayOrderId = String(args[3]);
  const mockHmacSecret = args[4] || 'sec_sandbox_test_hmac_secret_key_mwheba_2026';

  if (!orderId || !attemptId || !txnId) {
    console.error('Usage: tsx standaloneWorker.ts <orderId> <attemptId> <txnId> <gatewayOrderId> [hmacSecret]');
    process.exit(1);
  }

  const payload = await getPayload({ config: configPromise });

  const obj: PaymobTransactionObj = {
    id: txnId,
    pending: false,
    amount_cents: 300000,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 12345,
    order: {
      id: Number(gatewayOrderId),
      merchant_order_id: String(orderId),
    },
    created_at: new Date().toISOString(),
    currency: 'EGP',
    error_occured: false,
    has_parent_transaction: false,
    owner: 9999,
    source_data: {
      type: 'card',
      pan: '4242',
      sub_type: 'Visa',
    },
    txn_response_code: 'APPROVED',
  };

  const signature = calculatePaymobHmac(obj, mockHmacSecret);

  try {
    const result = await processPaymobWebhook({
      payload,
      body: { type: 'TRANSACTION', obj },
      signature,
      hmacSecret: mockHmacSecret,
      orderId,
      attemptId,
    });

    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (err: any) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
