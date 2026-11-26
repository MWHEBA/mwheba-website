import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { getPayload, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import config from '@/payload.config';
import { GET as readCart, POST as addCartItem } from '@/app/api/cart/items/route';
import { POST as placeOrder } from '@/app/api/checkout/create-order/route';
import { POST as quoteOrder } from '@/app/api/checkout/quote/route';
import { POST as transitionFulfillment } from '@/app/api/fulfillment/jobs/[id]/transition/route';
import { GET as readCollection, POST as collect } from '@/app/api/payments/cod/collect/route';
import { POST as refuse } from '@/app/api/payments/cod/refuse/route';
import { GET as readRemittance, POST as remit } from '@/app/api/payments/cod/remit/route';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { getInventoryStock } from '@/modules/inventory/services/inventoryService';
import type { CheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import type { FulfillmentJob, Product, User } from '@/payload-types';
import { openFixtureStock } from './fixtures/inventory';
import { confirmedTestDelivery, setTestPilotFulfillment } from './fixtures/pilotFulfillment';

const origin = 'http://localhost:3000';
const paymentPath = '/api/payments/cod';
const excludedRate = { regionCode: 'EG-DK', amount: 100, codAllowed: false };
const pilotOptions = { bankTransfer: true, additionalRates: [excludedRate] };

function post(path: string, body: object, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}${path}`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
}

async function json<T = Record<string, unknown>>(response: Response, status: number) {
  const body = await response.text();
  expect(response.status, body.slice(0, 1200)).toBe(status);
  return JSON.parse(body) as T;
}

describe('COD storefront and staff actions on migrated PostgreSQL', () => {
  let payload: Payload;
  let operator: User;
  let operatorAuth: Record<string, string>;
  let financeAuth: Record<string, string>;
  let customerAuth: Record<string, string>;
  let restore: (() => Promise<void>) | undefined;

  async function actor(role: 'operations' | 'finance' | 'customer') {
    const email = `cod-${role}-${randomUUID()}@example.test`;
    const password = `COD-fixture-${randomUUID()}`;
    const user = await payload.create({ collection: 'users', data: { email, password, roles: [role] }, context: { isSystemSeed: true } });
    const session = await payload.login({ collection: 'users', data: { email, password } });
    if (!session.token) throw new Error(`No JWT for COD fixture role ${role}`);
    return { user, headers: { Authorization: `JWT ${session.token}` } };
  }

  beforeAll(async () => {
    payload = await getPayload({ config });
    restore = await setTestPilotFulfillment(payload, pilotOptions);
    ({ user: operator, headers: operatorAuth } = await actor('operations'));
    ({ headers: financeAuth } = await actor('finance'));
    ({ headers: customerAuth } = await actor('customer'));
  });

  afterAll(async () => { await restore?.(); });

  async function product(kind: 'physical' | 'service' = 'physical') {
    const id = randomUUID();
    const item = await payload.create({
      collection: 'products',
      data: {
        title: `COD ${kind} fixture`, slug: `cod-${id}`, sku: `COD-${id}`,
        itemType: kind, productType: kind === 'physical' ? 'physical' : 'fixed_service',
        basePrice: 79.95, priceInEGP: 79.95, minOrderQuantity: kind === 'physical' ? 10 : 1, _status: 'published',
      },
    });
    if (kind === 'physical') await openFixtureStock(payload, 'product', item.id);
    return item;
  }

  async function checkout(items: Product[], method: 'shipping' | 'pickup' = 'shipping', governorate = 'EG-C') {
    const started = await readCart(new NextRequest(`${origin}/api/cart/items?init=true&locale=en`));
    const cookie = started.cookies.get(CART_COOKIE_NAME);
    if (!cookie) throw new Error('Storefront cart did not return its signed cookie');
    const headers = { Cookie: `${cookie.name}=${cookie.value}` };
    const { cartId } = await json<{ cartId: number }>(started, 200);
    for (const item of items) {
      await json(await addCartItem(post('/api/cart/items', {
        productId: item.id, quantity: item.itemType === 'physical' ? 10 : 1, operationKey: randomUUID(),
      }, headers)), 200);
    }
    const shippingAddress = { governorate, city: 'Synthetic city', streetAddress: 'Synthetic street' };
    const delivery = method === 'shipping' ? { method, shippingAddress } : { method };
    const quote = await json<CheckoutQuote>(await quoteOrder(post('/api/checkout/quote', {
      delivery: method === 'shipping' ? { method, governorate } : { method },
    }, headers)), 200);
    const submit = () => placeOrder(post('/api/checkout/create-order', {
      customer: {
        email: `cod-buyer-${randomUUID()}@example.test`, password: `COD-fixture-${randomUUID()}`,
        phone: '+201012345678', companyName: 'Synthetic company', contactPerson: 'Fixture buyer',
      },
      delivery: { ...delivery, ...confirmedTestDelivery(quote) }, expectedGrandTotal: quote.grandTotal,
      expectedQuoteConfirmation: quote.confirmation, expectedCartId: cartId, paymentMethod: 'cod',
    }, { ...headers, 'Idempotency-Key': randomUUID() }));
    return { quote, submit, cartId };
  }

  async function step(orderId: number, statuses: FulfillmentJob['status'][], lineIndex = 0) {
    const { docs: [job], totalDocs } = await payload.find({
      collection: 'fulfillment-jobs', where: { order: { equals: orderId }, lineIndex: { equals: lineIndex } }, depth: 0,
    });
    expect(totalDocs).toBe(1);
    for (const to of statuses) {
      const endpoint = `/api/fulfillment/jobs/${job.id}/transition`;
      await json(await transitionFulfillment(post(endpoint, { to }, operatorAuth), { params: Promise.resolve({ id: String(job.id) }) }), 200);
    }
  }

  const findOrder = (id: number) => payload.findByID({ collection: 'orders', id, depth: 0 });
  const collections = (id: number) => payload.find({ collection: 'payment-collections', where: { order: { equals: id } }, depth: 0 });
  const collectFor = (body: object, headers = operatorAuth) => collect(post(`${paymentPath}/collect`, body, headers));
  const collectionInfo = (orderId: number, headers = financeAuth) =>
    readCollection(new NextRequest(`${origin}${paymentPath}/collect?orderId=${orderId}`, { headers }));
  const remitFor = (body: object, headers = financeAuth) => remit(post(`${paymentPath}/remit`, body, headers));
  const remittanceInfo = (headers = financeAuth) => readRemittance(new NextRequest(`${origin}${paymentPath}/remit`, { headers }));

  it('leaves shipped and delivered orders unpaid, then records exact courier collection and remittance once', async () => {
    const staged = await checkout([await product()]);
    expect(staged.quote).toMatchObject({ currency: 'EGP', codEligible: true, paymentMethods: ['cod', 'bank_transfer'] });
    const { orderId } = await json<{ orderId: number }>(await staged.submit(), 201);
    const cash = {
      orderId, collectedAmount: staged.quote.grandTotal, currency: 'EGP', collectorType: 'courier',
      collectorName: 'Synthetic courier', collectedAt: new Date().toISOString(), receiptReference: `COD-${randomUUID()}`,
    };
    expect(await findOrder(orderId)).toMatchObject({
      orderStatus: 'confirmed', paymentStatus: 'unpaid', remittanceStatus: 'pending_collection', grandTotalPiastres: 87950,
    });
    await step(orderId, ['in_printing', 'quality_check', 'shipped']);
    expect(await findOrder(orderId)).toMatchObject({ fulfillmentStatus: 'shipped', paymentStatus: 'unpaid' });
    expect(await json(await collectFor(cash), 422)).toMatchObject({ code: 'COD_COLLECTION_NOT_READY' });
    await step(orderId, ['delivered']);
    expect(await findOrder(orderId)).toMatchObject({ fulfillmentStatus: 'delivered', paymentStatus: 'unpaid' });

    await json(await collectFor({ ...cash, actor: { id: operator.id, roles: ['operations'] } }, customerAuth), 403);
    for (let attempt = 0; attempt < 2; attempt++) {
      expect(await json(await collectFor({ ...cash, collectedAmount: cash.collectedAmount - 1 }), 422)).toMatchObject({ code: 'AMOUNT_MISMATCH' });
    }
    expect(await json(await collectFor({ ...cash, currency: 'USD' }), 422)).toMatchObject({ code: 'CURRENCY_MISMATCH' });
    expect(await findOrder(orderId)).toMatchObject({ paymentStatus: 'unpaid', remittanceStatus: 'pending_collection' });
    expect((await collections(orderId)).totalDocs).toBe(0);
    await json(await collectionInfo(orderId, customerAuth), 403);
    expect(await json(await collectionInfo(orderId, operatorAuth), 200)).toMatchObject({ review: [] });
    const { review } = await json<{ review: unknown[] }>(await collectionInfo(orderId), 200);
    expect(review).toHaveLength(2);
    expect(review).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'AMOUNT_MISMATCH', expectedAmount: 879.5, submittedAmount: 878.5, expectedCurrency: 'EGP', submittedCurrency: 'EGP' }),
      expect.objectContaining({ code: 'CURRENCY_MISMATCH', expectedAmount: 879.5, expectedCurrency: 'EGP', submittedCurrency: 'USD' }),
    ]));

    const recorded = await json<{ status: string; collectionId: number }>(await collectFor(cash), 200);
    expect(recorded.status).toBe('COLLECTION_RECORDED');
    expect(await json(await collectFor(cash), 200)).toMatchObject({ status: 'ALREADY_COLLECTED', collectionId: recorded.collectionId });
    expect(await json(await collectFor({ ...cash, collectorName: 'Different synthetic courier' }), 409)).toMatchObject({ code: 'RECEIPT_ALREADY_USED' });
    const paidOrder = await findOrder(orderId);
    expect(paidOrder).toMatchObject({ paymentStatus: 'paid', remittanceStatus: 'collected_by_courier' });
    const settlementAudit = (paidOrder.auditLog ?? []).flatMap(({ entry }) =>
      entry?.startsWith('cod-settlement:') ? [JSON.parse(entry.slice('cod-settlement:'.length))] : []);
    expect(settlementAudit.filter(({ action }) => action === 'collected')).toEqual([
      expect.objectContaining({ action: 'collected', expectedAmountPiastres: 87950, submittedAmountPiastres: 87950 }),
    ]);
    const collection = await collections(orderId);
    expect(collection.totalDocs).toBe(1);
    expect(collection.docs[0]).toMatchObject({ id: recorded.collectionId, order: orderId, amount: staged.quote.grandTotal, recordedBy: operator.id });

    const batch = {
      batchId: `REMIT-${randomUUID()}`, courierCompany: cash.collectorName, orderIds: [orderId],
      grossCollectedAmount: cash.collectedAmount, courierFeeDeductions: 10, netDepositAmount: cash.collectedAmount - 10,
      depositSlipReference: `DEPOSIT-${randomUUID()}`, depositDate: cash.collectedAt,
    };
    await json(await remittanceInfo(customerAuth), 403);
    expect(await json(await remittanceInfo(), 200)).toMatchObject({ enabled: false });
    expect(await json(await remitFor(batch), 409)).toMatchObject({ code: 'COURIER_REMITTANCE_DISABLED' });
    expect(await findOrder(orderId)).toMatchObject({ paymentStatus: 'paid', remittanceStatus: 'collected_by_courier' });
    const disable = await setTestPilotFulfillment(payload, { ...pilotOptions, courierRemittanceEnabled: true });
    try {
      expect(await json(await remittanceInfo(), 200)).toMatchObject({ enabled: true });
      await json(await remitFor(batch, operatorAuth), 403);
      const settled = await json<{ remittanceId: number }>(await remitFor(batch), 200);
      expect(await json(await remitFor(batch), 200)).toMatchObject({ status: 'ALREADY_RECONCILED', remittanceId: settled.remittanceId });
      expect(await json(await remitFor({ ...batch, batchId: randomUUID() }), 409)).toMatchObject({ code: 'DOUBLE_REMITTANCE_ERROR' });
      expect(await findOrder(orderId)).toMatchObject({ paymentStatus: 'paid', remittanceStatus: 'remitted_to_company' });
      const remaining = await collections(orderId);
      expect(remaining.totalDocs).toBe(1);
      expect(remaining.docs[0]).toMatchObject({ id: recorded.collectionId, remittanceBatchId: batch.batchId });
    } finally {
      await disable();
    }
  });

  it('collects at pickup readiness with the office channel and independently refuses a dispatched unpaid parcel without restocking', async () => {
    const item = await product();
    const pickup = await checkout([item, await product()], 'pickup');
    const { orderId } = await json<{ orderId: number }>(await pickup.submit(), 201);
    const pickupCash = {
      orderId, collectedAmount: pickup.quote.grandTotal, currency: 'EGP', collectorName: 'Synthetic counter', receiptReference: randomUUID(),
    };
    await step(orderId, ['in_printing', 'quality_check', 'ready_for_pickup']);
    expect(await findOrder(orderId)).toMatchObject({ fulfillmentStatus: 'ready_for_pickup', paymentStatus: 'unpaid' });
    expect(await json(await collectFor({ ...pickupCash, collectorType: 'office_staff' }), 422)).toMatchObject({ code: 'COD_COLLECTION_NOT_READY' });
    expect((await collections(orderId)).totalDocs).toBe(0);
    await step(orderId, ['in_printing', 'quality_check', 'ready_for_pickup'], 1);
    expect(await json(await collectFor({ ...pickupCash, collectorType: 'courier' }), 422)).toMatchObject({ code: 'INVALID_COLLECTION_CHANNEL' });
    await json(await collectFor({ ...pickupCash, collectorType: 'office_staff' }), 200);
    expect(await findOrder(orderId)).toMatchObject({ paymentStatus: 'paid', remittanceStatus: 'remitted_to_company' });

    const parcel = await checkout([item]);
    const { orderId: parcelId } = await json<{ orderId: number }>(await parcel.submit(), 201);
    await step(parcelId, ['in_printing', 'quality_check', 'shipped']);
    const stockBefore = await getInventoryStock(payload, { actor: operator, sku: item.sku });
    const reason = 'Fixture recipient refused delivery';
    await json(await refuse(post(`${paymentPath}/refuse`, { orderId: parcelId, refusalReason: reason }, operatorAuth)), 200);
    expect(await findOrder(parcelId)).toMatchObject({ orderStatus: 'cancelled', fulfillmentStatus: 'returned_to_origin', paymentStatus: 'unpaid' });
    expect((await collections(parcelId)).totalDocs).toBe(0);
    expect(await getInventoryStock(payload, { actor: operator, sku: item.sku })).toEqual(stockBefore);
  });

  it('rejects direct COD placement for empty, service-only, mixed and COD-excluded delivery carts', async () => {
    const physical = await product();
    const service = await product('service');
    const fixtures = [
      { items: [], region: 'EG-C' }, { items: [service], region: 'EG-C' },
      { items: [physical, service], region: 'EG-C' }, { items: [physical], region: excludedRate.regionCode },
    ];
    for (const { items, region } of fixtures) {
      const staged = await checkout(items, 'shipping', region);
      expect(staged.quote.codEligible).toBe(false);
      expect(staged.quote.paymentMethods).not.toContain('cod');
      const rejected = await staged.submit();
      expect(rejected.status, await rejected.clone().text()).toBeGreaterThanOrEqual(400);
      expect(rejected.status).toBeLessThan(500);
      expect((await payload.find({ collection: 'orders', where: { cart: { equals: staged.cartId } }, depth: 0 })).totalDocs).toBe(0);
    }
  });

  it('accepts only one of two concurrent collections that claim the same reference for different orders', async () => {
    const item = await product();
    const receiptReference = `COD-CONFLICT-${randomUUID()}`;
    const pending = await Promise.all([checkout([item]), checkout([item])]);
    const attempts = await Promise.all(pending.map(async (staged) => {
      const { orderId } = await json<{ orderId: number }>(await staged.submit(), 201);
      await step(orderId, ['in_printing', 'quality_check', 'shipped', 'delivered']);
      return { orderId, receiptReference, collectedAmount: staged.quote.grandTotal, currency: 'EGP', collectorType: 'courier', collectorName: 'Synthetic courier' };
    }));
    const responses = await Promise.all(attempts.map((attempt) => collectFor(attempt)));
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(await json(responses.find(({ status }) => status === 409)!, 409)).toMatchObject({ code: 'RECEIPT_ALREADY_USED' });
    const persisted = await Promise.all(attempts.map(({ orderId }) => findOrder(orderId)));
    expect(persisted.map(({ paymentStatus }) => paymentStatus).sort()).toEqual(['paid', 'unpaid']);
    expect((await payload.find({ collection: 'payment-collections', where: { receiptReference: { equals: receiptReference } }, depth: 0 })).totalDocs).toBe(1);
  });
});
