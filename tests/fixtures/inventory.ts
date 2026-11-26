import { randomUUID } from 'node:crypto';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';
import { adjustInventoryStock } from '@/modules/inventory/services/inventoryService';
import { transitionJob } from '@/modules/fulfillment/services/fulfillmentService';

const fixtureStaff = new WeakMap<Payload, Promise<User>>();

export async function openFixtureStock(payload: Payload, kind: 'product' | 'variant', id: number) {
  const target = kind === 'product'
    ? await payload.findByID({ collection: 'products', id, depth: 0 })
    : await payload.findByID({ collection: 'variants', id, depth: 0 });
  if (!target.sku) throw new Error(`Missing SKU on ${kind} fixture ${id}`);

  let staff = fixtureStaff.get(payload);
  if (!staff) {
    staff = payload.create({
      collection: 'users',
      data: { email: `stock-fixture-${randomUUID()}@example.test`, password: randomUUID(), roles: ['operations'] },
      context: { isSystemSeed: true },
    });
    fixtureStaff.set(payload, staff);
  }
  await adjustInventoryStock(payload, {
    actor: await staff,
    sku: target.sku,
    kind: 'opening',
    quantity: 1_000,
    operationKey: randomUUID(),
    reason: 'Synthetic opening balance for checkout regression fixtures',
  });
}

export async function shipFixtureOrder(payload: Payload, orderId: number, actor: User) {
  const { docs } = await payload.find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, depth: 0 });
  for (const job of docs) {
    for (const to of ['in_printing', 'quality_check', 'shipped'] as const) {
      await transitionJob(payload, { jobId: job.id, to, user: actor });
    }
  }
}
