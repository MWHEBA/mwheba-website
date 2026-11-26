import { sql } from '@payloadcms/db-postgres';
import type { Payload, PayloadRequest } from 'payload';
import { getInventoryTransaction } from '@/modules/inventory/services/inventoryService';

export type OrderTransaction = { transactionID: NonNullable<PayloadRequest['transactionID']> };

export async function lockOrderRow(payload: Payload, req: Pick<PayloadRequest, 'transactionID'>, orderId: number) {
  if (!Number.isSafeInteger(orderId) || orderId < 1 || orderId > 2_147_483_647) return;
  const tx = await getInventoryTransaction(payload, req);
  await tx.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`);
}

export async function withOrderTransaction<T>(
  payload: Payload,
  orderIds: number | readonly number[],
  run: (req: OrderTransaction) => Promise<T>,
) {
  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) throw new Error('ORDER_TRANSACTION_REQUIRED: Could not begin an order transaction.');
  const req = { transactionID };
  try {
    const sortedOrderIds = typeof orderIds === 'number' ? [orderIds] : [...new Set(orderIds)].sort((a, b) => a - b);
    for (const orderId of sortedOrderIds) await lockOrderRow(payload, req, orderId);
    const result = await run(req);
    await payload.db.commitTransaction(transactionID);
    return result;
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined);
    throw error;
  }
}
