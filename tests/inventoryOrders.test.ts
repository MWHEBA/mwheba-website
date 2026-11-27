import { randomUUID } from 'node:crypto';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { NextRequest } from 'next/server';
import { getPayload, handleEndpoints, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config from '@/payload.config';
import { POST as checkout } from '@/app/api/checkout/create-order/route';
import { POST as quote } from '@/app/api/checkout/quote/route';
import { signCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME, getOrCreateCart, type CartItem } from '@/modules/cart-checkout/services/cartStorage';
import { transitionJob } from '@/modules/fulfillment/services/fulfillmentService';
import { adjustInventoryStock } from '@/modules/inventory/services/inventoryService';
import type { CheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import type { Cart, User } from '@/payload-types';
import { confirmedTestDelivery, setTestPilotFulfillment } from './fixtures/pilotFulfillment';

const origin = 'http://localhost:3000';
const shippingAddress = { governorate: 'EG-C', city: 'Cairo', streetAddress: '3 Synthetic Test Street' };

describe('Inventory and order consistency on PostgreSQL', () => {
  let payload: Payload;
  let db: PostgresAdapter['drizzle'];
  let restoreFulfillment: (() => Promise<void>) | undefined;
  let operator: User;
  let operatorToken: string;
  let financeToken: string;
  let customerToken: string;
  let catalogToken: string;

  async function createActor(role: NonNullable<User['roles']>[number]) {
    const email = `inventory-${role}-${randomUUID()}@example.test`;
    const password = `Fixture-${randomUUID()}`;
    const user = await payload.create({ collection: 'users', data: { email, password, roles: [role] }, context: { isSystemSeed: true } });
    const session = await payload.login({ collection: 'users', data: { email, password } });
    if (!session.token) throw new Error(`Could not sign in as fixture role ${role}`);
    return { user, token: session.token };
  }

  beforeAll(async () => {
    payload = await getPayload({ config });
    db = (payload.db as unknown as PostgresAdapter).drizzle;
    restoreFulfillment = await setTestPilotFulfillment(payload, { bankTransfer: true });
    ({ user: operator, token: operatorToken } = await createActor('operations'));
    ({ token: financeToken } = await createActor('finance'));
    ({ token: catalogToken } = await createActor('catalog_manager'));
    ({ token: customerToken } = await createActor('customer'));
  });

  afterAll(async () => { await restoreFulfillment?.(); });

  async function product(kind: 'simple' | 'variable' | 'service' = 'simple') {
    const suffix = randomUUID();
    const isService = kind === 'service';
    return payload.create({
      collection: 'products',
      data: {
        title: `Inventory fixture ${kind}`,
        slug: `inventory-${kind}-${suffix}`,
        sku: kind === 'variable' ? undefined : `INV-${suffix}`,
        itemType: isService ? 'service' : 'physical',
        productType: isService ? 'fixed_service' : 'physical',
        enableVariants: kind === 'variable',
        basePrice: 80, priceInEGP: 80, minOrderQuantity: isService ? 1 : 10,
        _status: 'published',
      },
    });
  }

  function opening(sku: string, quantity: number) {
    return adjustInventoryStock(payload, {
      actor: operator, sku, kind: 'opening', quantity, operationKey: randomUUID(), reason: 'Synthetic counted stock',
    });
  }

  async function balance(sku: string) {
    const { rows: [row] } = await db.execute<{ id: number; available: number }>(sql`
      SELECT balance.id, balance.available FROM inventory_balances balance
      JOIN catalog_sku_claims claim ON claim.record_id = balance.target_id
        AND claim.collection = CASE WHEN balance.target_type = 'product' THEN 'products' ELSE 'variants' END
      WHERE claim.sku = lower(${sku})
    `);
    return row;
  }

  async function movements(balanceId: number) {
    const { rows } = await db.execute<{
      id: number; kind: string; quantity: number; order_id: number | null; actor_id: number | null; reason: string; sku: string;
    }>(sql`
      SELECT id, kind, quantity, order_id, actor_id, reason, sku FROM inventory_movements
      WHERE balance_id = ${balanceId} ORDER BY id
    `);
    return rows;
  }

  async function cartWith(items: CartItem[]) {
    const cart = await getOrCreateCart(payload);
    return payload.update({ collection: 'carts', id: cart.id, data: { items }, depth: 0 });
  }

  function guestPost(path: string, cart: Cart, body: object, key?: string) {
    const headers = new Headers({
      'Content-Type': 'application/json', Origin: origin,
      Cookie: `${CART_COOKIE_NAME}=${signCartId(cart.id)}`,
    });
    if (key) headers.set('Idempotency-Key', key);
    return new NextRequest(`${origin}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  }

  async function quoteFor(cart: Cart, delivery: 'pickup' | 'shipping' | undefined = 'pickup') {
    const response = await quote(guestPost('/api/checkout/quote', cart, {
      ...(delivery === 'shipping' ? { delivery: { method: delivery, governorate: shippingAddress.governorate } }
        : delivery ? { delivery: { method: delivery } } : {}),
    }));
    expect(response.status).toBe(200);
    return await response.json() as CheckoutQuote;
  }

  async function prepare(cart: Cart, delivery: 'pickup' | 'shipping' = 'pickup', paymentMethod = 'cod') {
    const approved = await quoteFor(cart, delivery);
    const body = {
      customer: {
        email: `inventory-buyer-${randomUUID()}@example.test`, password: `Fixture-${randomUUID()}`,
        phone: '+201012345678', companyName: 'Synthetic company', contactPerson: 'Fixture buyer',
      },
      delivery: { method: delivery, ...(delivery === 'shipping' ? { shippingAddress } : {}), ...confirmedTestDelivery(approved) },
      expectedGrandTotal: approved.grandTotal, expectedQuoteConfirmation: approved.confirmation,
      expectedCartId: cart.id, paymentMethod,
    };
    const key = randomUUID();
    return {
      approved,
      submit: (retryKey = key, requestCart = cart) => checkout(guestPost('/api/checkout/create-order', requestCart, body, retryKey)),
    };
  }

  const orderFor = (id: number) => payload.findByID({ collection: 'orders', id, depth: 0 });
  const ordersForCart = (id: number) => payload.find({ collection: 'orders', where: { cart: { equals: id } }, depth: 0 });
  const jobsFor = (id: number) => payload.find({ collection: 'fulfillment-jobs', where: { order: { equals: id } }, depth: 0 });

  function staffApi(path: string, token: string, method = 'GET', body?: object) {
    return handleEndpoints({ config, request: new Request(`${origin}${path}`, {
      method, headers: { Authorization: `JWT ${token}`, Origin: origin, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }) });
  }

  it('allocates the last MOQ to only one of two distinct concurrent carts and replays only the exact authorized order', async () => {
    const item = await product();
    const sku = item.sku!;
    await opening(sku, 10);
    const carts = await Promise.all([cartWith([{ product: item.id, quantity: 10 }]), cartWith([{ product: item.id, quantity: 10 }])]);
    const attempts = await Promise.all(carts.map((cart) => prepare(cart)));
    expect(attempts.every(({ approved }) => approved.canCheckout)).toBe(true);
    expect((await balance(sku)).available).toBe(10);

    const responses = await Promise.all(attempts.map((attempt) => attempt.submit()));
    const diagnostics = await Promise.all(responses.map((res) => res.clone().text()));
    expect(responses.map(({ status }) => status).sort(), diagnostics.join('\n')).toEqual([201, 409]);
    const winningIndex = responses.findIndex(({ status }) => status === 201);
    const losingIndex = 1 - winningIndex;
    const winner = await responses[winningIndex].json();
    expect(await responses[losingIndex].json()).toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect((await ordersForCart(carts[winningIndex].id)).totalDocs).toBe(1);
    expect((await ordersForCart(carts[losingIndex].id)).totalDocs).toBe(0);
    expect((await payload.findByID({ collection: 'carts', id: carts[winningIndex].id })).purchasedAt).toBeTruthy();
    const loserCart = await payload.findByID({ collection: 'carts', id: carts[losingIndex].id });
    expect(loserCart.purchasedAt).toBeFalsy();
    expect(loserCart.items).toHaveLength(1);

    const winningAttempt = attempts[winningIndex];
    const replay = await winningAttempt.submit();
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ orderId: winner.orderId, orderNumber: winner.orderNumber, isIdempotentReplay: true });
    for (const rejected of [await winningAttempt.submit(randomUUID()), await winningAttempt.submit(undefined, carts[losingIndex])]) {
      expect(rejected.status).toBeGreaterThanOrEqual(400);
      expect(await rejected.json()).not.toHaveProperty('orderId');
    }
    expect((await jobsFor(winner.orderId)).totalDocs).toBe(1);
    const after = await balance(sku);
    expect(after.available).toBe(0);
    expect(await movements(after.id)).toMatchObject([{ kind: 'opening', quantity: 10 }, { kind: 'allocation', quantity: -10, order_id: winner.orderId }]);
  });

  it('recovers the durable order when the checkout commit acknowledgement is interrupted', async () => {
    const item = await product();
    const sku = item.sku!;
    await opening(sku, 10);
    const cart = await cartWith([{ product: item.id, quantity: 10 }]);
    const attempt = await prepare(cart);
    const commit = payload.db.commitTransaction.bind(payload.db);
    const interrupted = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionId) => {
      await commit(transactionId);
      throw new Error('Synthetic connection failure after PostgreSQL committed');
    });
    let resolved: Response;
    try {
      resolved = await attempt.submit();
      expect(interrupted).toHaveBeenCalled();
    } finally {
      interrupted.mockRestore();
    }
    expect(resolved.status, await resolved.clone().text()).toBe(200);
    const result = await resolved.json();
    expect(result).toMatchObject({ isIdempotentReplay: true });
    expect((await jobsFor(result.orderId)).totalDocs).toBe(1);
    expect((await ordersForCart(cart.id)).totalDocs).toBe(1);
    expect((await payload.findByID({ collection: 'carts', id: cart.id })).purchasedAt).toBeTruthy();
    const after = await balance(sku);
    expect(after.available).toBe(0);
    expect(await movements(after.id)).toMatchObject([{ kind: 'opening' }, { kind: 'allocation', order_id: result.orderId, quantity: -10 }]);
  });

  it('aggregates customized lines by SKU and rejects a mixed-SKU shortage without changing any stock or closing the cart', async () => {
    const first = await product();
    const other = await product();
    await opening(first.sku!, 10);
    await opening(other.sku!, 9);
    const cart = await cartWith([
      { product: first.id, quantity: 6, printingNotes: 'Black logo' },
      { product: first.id, quantity: 6, printingNotes: 'White logo' },
      { product: other.id, quantity: 10 },
    ]);
    const attempt = await prepare(cart);
    expect(attempt.approved.canCheckout).toBe(false);
    expect(attempt.approved.items.map(({ stockIssue }) => stockIssue)).toMatchObject([
      { code: 'INSUFFICIENT_STOCK', requested: 12, available: 10 },
      { code: 'INSUFFICIENT_STOCK', requested: 12, available: 10 },
      { code: 'INSUFFICIENT_STOCK', requested: 10, available: 9 },
    ]);
    const failure = await attempt.submit();
    expect(failure.status).toBe(409);
    expect(await failure.json()).toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect((await ordersForCart(cart.id)).totalDocs).toBe(0);
    expect((await payload.findByID({ collection: 'carts', id: cart.id })).purchasedAt).toBeFalsy();
    for (const [sku, expectedQuantity] of [[first.sku!, 10], [other.sku!, 9]] as const) {
      const after = await balance(sku);
      expect(after.available).toBe(expectedQuantity);
      expect(await movements(after.id)).toMatchObject([{ kind: 'opening', quantity: expectedQuantity }]);
    }
  });

  it('previews synthetic opening rows by normalized SKU without changing balances or movements', async () => {
    const matched = await product();
    const duplicate = await product();
    const initialized = await product();
    const service = await product('service');
    await opening(initialized.sku!, 10);
    const preview = {
      rows: [
        { sku: matched.sku!.toLowerCase(), quantity: 11 },
        { sku: duplicate.sku, quantity: 12 },
        { sku: duplicate.sku!.toLowerCase(), quantity: 13 },
        { sku: initialized.sku, quantity: 14 },
        { sku: service.sku, quantity: 15 },
        { sku: 'missing-synthetic-sku', quantity: 16 },
        { sku: 'invalid-quantity', quantity: -1 },
      ],
    };
    const url = '/api/inventory/preview-opening';
    expect((await staffApi(url, financeToken, 'POST', preview)).status).toBe(403);
    const expected = [
      { status: 'matched', sku: matched.sku, quantity: 11 },
      { status: 'duplicate' }, { status: 'duplicate' },
      { status: 'initialized', available: 10 },
      { status: 'unresolved' }, { status: 'unresolved' }, { status: 'invalid' },
    ];
    for (const repeat of [1, 2]) {
      const result = await staffApi(url, operatorToken, 'POST', preview);
      expect(result.status, `Preview call ${repeat}`).toBe(200);
      expect(await result.json()).toMatchObject({ results: expected });
    }
    expect(await balance(matched.sku!)).toBeUndefined();
    expect(await balance(duplicate.sku!)).toBeUndefined();
    const after = await balance(initialized.sku!);
    expect(after.available).toBe(10);
    expect(await movements(after.id)).toHaveLength(1);
  });

  it('rolls back an order, its first job and all SKU stock after the second job fails, then allows a retry', async () => {
    const first = await product();
    const second = await product();
    await opening(first.sku!, 10);
    await opening(second.sku!, 10);
    const cart = await cartWith([{ product: first.id, quantity: 10 }, { product: second.id, quantity: 10 }]);
    const attempt = await prepare(cart);
    const create = payload.create.bind(payload);
    let failedOrder: number | undefined;
    const override = vi.spyOn(payload, 'create').mockImplementation((options) => {
      if (options.collection === 'fulfillment-jobs' && 'lineIndex' in options.data && options.data.lineIndex === 1 && 'order' in options.data) {
        failedOrder = Number(options.data.order);
        return Promise.reject(new Error('Synthetic second fulfillment job failure'));
      }
      return create(options);
    });
    try {
      const failure = await attempt.submit();
      expect(failure.status).toBeGreaterThanOrEqual(400);
      expect(failedOrder).toEqual(expect.any(Number));
    } finally {
      override.mockRestore();
    }
    expect((await ordersForCart(cart.id)).totalDocs).toBe(0);
    expect((await jobsFor(failedOrder!)).totalDocs).toBe(0);
    expect((await payload.findByID({ collection: 'carts', id: cart.id })).purchasedAt).toBeFalsy();
    for (const sku of [first.sku!, second.sku!]) {
      const after = await balance(sku);
      expect(after.available).toBe(10);
      expect(await movements(after.id)).toHaveLength(1);
    }
    const success = await attempt.submit();
    expect(success.status).toBe(201);
    expect((await jobsFor((await success.json()).orderId)).totalDocs).toBe(2);
  });

  it('requires initialized stock and audits role-scoped opening and idempotent stock corrections', async () => {
    const item = await product();
    const sku = item.sku!;
    const cart = await cartWith([{ product: item.id, quantity: 10 }]);
    const attempt = await prepare(cart);
    expect(attempt.approved.items[0].stockIssue).toMatchObject({ code: 'INVENTORY_UNINITIALIZED', available: null });
    const failure = await attempt.submit();
    expect(failure.status).toBe(409);
    expect(await failure.json()).toMatchObject({ code: 'INVENTORY_UNINITIALIZED' });
    const initial = { sku, kind: 'opening', quantity: 10, operationKey: randomUUID(), reason: 'Synthetic counted stock' };
    for (const token of [financeToken, customerToken, catalogToken]) {
      expect((await staffApi('/api/inventory', token, 'POST', initial)).status).toBe(403);
    }
    expect(await balance(sku)).toBeUndefined();

    const opened = await staffApi('/api/inventory', operatorToken, 'POST', initial);
    expect(opened.status).toBe(201);
    expect(await opened.json()).toMatchObject({ available: 10, isIdempotentReplay: false });
    const correction = {
      sku, kind: 'adjustment', operationKey: randomUUID(),
      quantity: -3, reason: 'Synthetic recount found three damaged units',
    };
    const adjusted = await staffApi('/api/inventory', operatorToken, 'POST', correction);
    expect(adjusted.status).toBe(201);
    const adjustment = await adjusted.json();
    const replayed = await staffApi('/api/inventory', operatorToken, 'POST', correction);
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toMatchObject({ available: 7, movementId: adjustment.movementId, isIdempotentReplay: true });
    expect((await staffApi('/api/inventory', operatorToken, 'POST', { ...correction, quantity: -4 })).status).toBe(409);
    expect((await staffApi('/api/inventory', operatorToken, 'POST', { ...correction, operationKey: randomUUID(), quantity: -8 })).status).toBe(409);
    const historyPath = `/api/inventory?sku=${encodeURIComponent(sku)}`;
    expect((await staffApi(historyPath, customerToken)).status).toBe(403);
    const history = await staffApi(historyPath, catalogToken);
    expect(history.status).toBe(200);
    expect(await history.json()).toMatchObject({ available: 7, movements: [{ kind: 'adjustment', quantity: -3 }, { kind: 'opening', quantity: 10 }] });
    const after = await balance(sku);
    expect(after.available).toBe(7);
    expect(await movements(after.id)).toMatchObject([
      { kind: 'opening', quantity: 10, actor_id: operator.id, sku, reason: initial.reason },
      { kind: 'adjustment', quantity: -3, actor_id: operator.id, sku, reason: correction.reason },
    ]);
  });

  it('keeps sibling variant balances separate and omits stock movements for service lines', async () => {
    const variable = await product('variable');
    const service = await product('service');
    const key = randomUUID();
    const variantType = await payload.create({ collection: 'variantTypes', data: { name: `color-${key}`, label: 'Color' } });
    await payload.update({ collection: 'products', id: variable.id, data: { variantTypes: [variantType.id] } });
    async function createVariant(color: string) {
      const option = await payload.create({ collection: 'variantOptions', data: { variantType: variantType.id, label: color, value: `${color}-${key}` } });
      return payload.create({ collection: 'variants', data: {
        product: variable.id, title: color, sku: `INV-${color}-${key}`, options: [option.id], priceInEGP: 80, _status: 'published',
      } });
    }
    const red = await createVariant('red');
    const blue = await createVariant('blue');
    await opening(red.sku!, 8);
    await opening(blue.sku!, 9);
    const cart = await cartWith([
      { product: variable.id, variant: red.id, quantity: 4 },
      { product: variable.id, variant: blue.id, quantity: 6 },
      { product: service.id, quantity: 1 },
    ]);
    const order = await (await prepare(cart, 'pickup', 'bank_transfer')).submit();
    expect(order.status, await order.clone().text()).toBe(201);
    const { orderId } = await order.json();
    expect((await jobsFor(orderId)).docs.map(({ track }) => track).sort()).toEqual(['physical', 'physical', 'service']);
    const redBalance = await balance(red.sku!);
    const blueBalance = await balance(blue.sku!);
    expect([redBalance.available, blueBalance.available]).toEqual([4, 3]);
    expect(await movements(redBalance.id)).toMatchObject([{ kind: 'opening' }, { kind: 'allocation', quantity: -4, order_id: orderId }]);
    expect(await movements(blueBalance.id)).toMatchObject([{ kind: 'opening' }, { kind: 'allocation', quantity: -6, order_id: orderId }]);
    expect(await balance(service.sku!)).toBeUndefined();
    await expect(opening(service.sku!, 10)).rejects.toThrow('INVENTORY_SKU_NOT_FOUND');
  });

  it('cancels a pre-dispatch order through the authorized endpoint and restores its allocation once', async () => {
    const item = await product();
    const sku = item.sku!;
    await opening(sku, 10);
    const cart = await cartWith([{ product: item.id, quantity: 10 }]);
    const accepted = await (await prepare(cart)).submit();
    expect(accepted.status, await accepted.clone().text()).toBe(201);
    const { orderId } = await accepted.json();
    const lifecycle = `/api/orders/${orderId}/lifecycle`;
    const data = { action: 'cancel', reason: 'Synthetic buyer cancellation before dispatch' };
    expect((await staffApi(lifecycle, customerToken, 'POST', data)).status).toBe(403);
    expect((await staffApi(lifecycle, financeToken, 'POST', data)).status).toBe(403);
    const direct = await staffApi(`/api/orders/${orderId}`, operatorToken, 'PATCH', { orderStatus: 'cancelled' });
    expect(direct.status).toBeGreaterThanOrEqual(400);
    expect((await balance(sku)).available).toBe(0);
    for (const replayed of [false, true]) {
      const cancelled = await staffApi(lifecycle, operatorToken, 'POST', data);
      expect(cancelled.status).toBe(200);
      expect(await cancelled.json()).toMatchObject({ replayed, event: { restoredQuantity: 10 } });
    }
    expect(await orderFor(orderId)).toMatchObject({ orderStatus: 'cancelled', fulfillmentStatus: 'cancelled', paymentStatus: 'unpaid' });
    const after = await balance(sku);
    expect(after.available).toBe(10);
    expect(await movements(after.id)).toMatchObject([
      { kind: 'opening' }, { kind: 'allocation', quantity: -10 },
      { kind: 'cancellation', quantity: 10, actor_id: operator.id, order_id: orderId, reason: data.reason },
    ]);
    const auditBefore = (await orderFor(orderId)).auditLog;
    await staffApi(`/api/orders/${orderId}`, operatorToken, 'PATCH', { auditLog: [] });
    expect((await orderFor(orderId)).auditLog).toEqual(auditBefore);
  });

  it('keeps a refused shipment unpaid and restores only inspected sellable units once', async () => {
    const item = await product();
    const undispatched = await product();
    const sku = item.sku!;
    await opening(sku, 10);
    await opening(undispatched.sku!, 10);
    const cart = await cartWith([{ product: item.id, quantity: 10 }, { product: undispatched.id, quantity: 10 }]);
    const accepted = await (await prepare(cart, 'shipping')).submit();
    expect(accepted.status, await accepted.clone().text()).toBe(201);
    const { orderId } = await accepted.json();
    const lifecycle = `/api/orders/${orderId}/lifecycle`;
    const job = (await jobsFor(orderId)).docs.find(({ lineIndex }) => lineIndex === 0)!;
    const refusal = { action: 'refuse', reason: 'Recipient refused a synthetic shipment' };
    expect((await staffApi(lifecycle, operatorToken, 'POST', refusal)).status).toBe(409);
    for (const to of ['in_printing', 'quality_check', 'shipped'] as const) await transitionJob(payload, { jobId: job.id, to, user: operator });
    expect(await orderFor(orderId)).toMatchObject({ fulfillmentStatus: 'shipped', paymentStatus: 'unpaid' });
    expect((await staffApi(lifecycle, operatorToken, 'POST', { action: 'cancel', reason: 'Already shipped' })).status).toBe(409);
    expect((await staffApi(lifecycle, operatorToken, 'POST', refusal)).status).toBe(200);
    expect((await staffApi(lifecycle, operatorToken, 'POST', refusal)).status).toBe(200);
    expect(await orderFor(orderId)).toMatchObject({ orderStatus: 'cancelled', fulfillmentStatus: 'returned_to_origin', paymentStatus: 'unpaid' });
    const reserved = await balance(sku);
    expect(reserved.available).toBe(0);
    expect(await movements(reserved.id)).toHaveLength(2);

    const receipt = {
      action: 'receive_return', reason: 'Inspector verified four units were sellable', receiptReference: randomUUID(),
      lines: [{ balanceId: reserved.id, receivedQuantity: 6, sellableQuantity: 4 }],
    };
    const otherBalance = await balance(undispatched.sku!);
    const undispatchedReturn = await staffApi(lifecycle, operatorToken, 'POST', {
      ...receipt, receiptReference: randomUUID(), lines: [{ balanceId: otherBalance.id, receivedQuantity: 1, sellableQuantity: 1 }],
    });
    expect(undispatchedReturn.status).toBe(409);
    expect(await undispatchedReturn.json()).toMatchObject({ code: 'RETURN_QUANTITY_EXCEEDS_ALLOCATION' });
    expect((await balance(undispatched.sku!)).available).toBe(0);
    expect((await staffApi(lifecycle, financeToken, 'POST', receipt)).status).toBe(403);
    expect((await staffApi(lifecycle, customerToken, 'POST', receipt)).status).toBe(403);
    for (const replayed of [false, true]) {
      const returned = await staffApi(lifecycle, operatorToken, 'POST', receipt);
      expect(returned.status).toBe(200);
      expect(await returned.json()).toMatchObject({ replayed, event: { restoredQuantity: 4 } });
    }
    const overReceipt = await staffApi(lifecycle, operatorToken, 'POST', {
      ...receipt, receiptReference: randomUUID(), lines: [{ balanceId: reserved.id, receivedQuantity: 5, sellableQuantity: 5 }],
    });
    expect(overReceipt.status).toBe(409);
    expect(await overReceipt.json()).toMatchObject({ code: 'RETURN_QUANTITY_EXCEEDS_ALLOCATION' });
    expect((await balance(sku)).available).toBe(4);
    expect(await movements(reserved.id)).toMatchObject([
      { kind: 'opening' }, { kind: 'allocation', quantity: -10 },
      { kind: 'return', quantity: 4, actor_id: operator.id, order_id: orderId, reason: receipt.reason },
    ]);
    expect((await payload.find({ collection: 'payment-collections', where: { order: { equals: orderId } } })).totalDocs).toBe(0);
  });
});
