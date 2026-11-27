import { openFixtureStock } from './fixtures/inventory';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { NextRequest } from 'next/server';
import { getPayload, handleEndpoints, type Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import config from '@/payload.config';
import { confirmedTestDelivery, setTestPilotFulfillment } from './fixtures/pilotFulfillment';
import { GET as getCart, POST as addCartItem } from '@/app/api/cart/items/route';
import { POST as placeOrder } from '@/app/api/checkout/create-order/route';
import { POST as getQuote } from '@/app/api/checkout/quote/route';
import { POST as accountMutation } from '@/app/api/account/[operation]/route';

const mail = await vi.hoisted(async () => {
  const { createServer } = await import('node:net');
  const messages: string[] = [];
  const server = createServer((socket) => {
    let buffer = '';
    let message: string[] | null = null;
    socket.setEncoding('utf8');
    socket.write('220 Test SMTP\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let newline = buffer.indexOf('\r\n');
      while (newline >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        if (message) {
          if (line === '.') {
            messages.push(message.join('\r\n'));
            message = null;
            socket.write('250 Message captured\r\n');
          } else {
            message.push(line);
          }
        } else if (line === 'DATA') {
          message = [];
          socket.write('354 End data with a dot\r\n');
        } else if (line === 'QUIT') {
          socket.end('221 Closing connection\r\n');
        } else {
          socket.write('250 OK\r\n');
        }
        newline = buffer.indexOf('\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  server.unref();
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local SMTP address');
  const site = `http://127.0.0.1:${process.env.CUSTOMER_HTTP_TEST_PORT || 3000}`;
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', site);
  vi.stubEnv('SMTP_HOST', address.address);
  vi.stubEnv('SMTP_PORT', String(address.port));
  vi.stubEnv('SMTP_FROM_ADDRESS', 'store@example.com');
  vi.stubEnv('SMTP_USER', undefined);
  vi.stubEnv('SMTP_PASS', undefined);
  return { messages, server, site };
});

const site = mail.site;
const httpPort = process.env.CUSTOMER_HTTP_TEST_PORT;
const password = 'Cust0mer-Synthetic-Pass!';
const newPassword = 'New-Cust0mer-Synthetic-Pass!';
const locale = 'en';

type Handler = (request: NextRequest) => Promise<Response>;
type Input = Record<string, unknown>;

class CustomerSession {
  private cookies = new Map<string, string>();

  get cookieHeader() {
    return Array.from(this.cookies, ([name, value]) => `${name}=${value}`).join('; ');
  }

  private remember(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0];
      const equals = pair.indexOf('=');
      const name = pair.slice(0, equals);
      const value = pair.slice(equals + 1);
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
    return response;
  }

  async storefront(handler: Handler, path: string, body?: Input | URLSearchParams) {
    const request = this.request(path, body);
    return this.remember(await (httpPort ? fetch(request, { redirect: 'manual' }) : handler(request)));
  }

  account(operation: string, body: Input | URLSearchParams) {
    return this.storefront(
      (request) => accountMutation(request, { params: Promise.resolve({ operation }) }), `/api/account/${operation}`, body,
    );
  }

  async payload(path: string, method = 'GET', body?: Input) {
    const request = this.request(path, body, method);
    return this.remember(await (httpPort ? fetch(request, { redirect: 'manual' }) : handleEndpoints({ config, request })));
  }

  request(path: string, body?: Input | URLSearchParams, method = body ? 'POST' : 'GET') {
    const headers = new Headers({ origin: site });
    if (this.cookieHeader) headers.set('cookie', this.cookieHeader);
    if (body && !(body instanceof URLSearchParams)) headers.set('content-type', 'application/json');
    return new NextRequest(`${site}${path}`, {
      method,
      headers,
      body: body instanceof URLSearchParams ? body : body && JSON.stringify(body),
    });
  }
}

describe('Customer checkout, sessions and owned data', () => {
  let payload: Payload;
  let app: ChildProcess | undefined;
  let productId: number;
  const cartIds = new Set<number>();
  const orderIds = new Set<number>();
  const userIds = new Set<number>();
  const artworkIds = new Set<number>();
  const addressIds = new Set<number>();
  const newAddress = {
    locale,
    action: 'create',
    title: 'Head office',
    firstName: 'Test',
    lastName: 'Customer',
    phone: '+201098765432',
    addressLine1: '21 Test Street',
    city: 'Maadi',
    state: 'Cairo',
  };

  let restorePilotFulfillment: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    if (httpPort) {
      app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', httpPort], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let appLogs = '';
      app.stdout?.on('data', (data) => { appLogs += String(data); });
      app.stderr?.on('data', (data) => { appLogs += String(data); });
      for (let attempt = 0; attempt < 50; attempt += 1) {
        if (app.exitCode !== null || attempt === 49) throw new Error(`Local Next could not start\n${appLogs}`);
        if (appLogs.includes('Ready in ')) {
          const response = await fetch(`${site}/en/account/login`).catch(() => null);
          if (response?.ok) break;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    payload = await getPayload({ config });
    restorePilotFulfillment = await setTestPilotFulfillment(payload, { bankTransfer: true });
    const key = randomUUID();
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Customer checkout example product', slug: `customer-checkout-${key}`,
        sku: `CUSTOMER-${key}`, productType: 'physical', itemType: 'physical', priceInEGP: 200,
        basePrice: 200, minOrderQuantity: 10, _status: 'published',
      },
    });
    await openFixtureStock(payload, 'product', product.id);
    productId = product.id;
  });

  afterAll(async () => {
    await restorePilotFulfillment?.();
    app?.kill();
    mail.server.close();
    vi.unstubAllEnvs();
    if (!payload) return;
    for (const id of orderIds) {
      await payload.delete({ collection: 'fulfillment-jobs', where: { order: { equals: id } } });
      await payload.delete({ collection: 'orders', id });
    }
    for (const id of artworkIds) await payload.delete({ collection: 'artwork-assets', id });
    for (const id of userIds) await payload.update({ collection: 'users', id, data: { defaultAddress: null } });
    for (const id of addressIds) await payload.delete({ collection: 'addresses', id });
    for (const id of cartIds) await payload.delete({ collection: 'carts', id });
    for (const id of userIds) await payload.delete({ collection: 'users', id });
    if (productId) await payload.delete({ collection: 'products', id: productId });
  });

  function shopper(prefix: string) {
    return {
      email: `${prefix}-${randomUUID()}@example.com`,
      password, companyName: 'Synthetic Business', contactPerson: 'Test Customer', phone: '+201098765432',
    };
  }

  async function seedIdentity(email: string, role: 'customer' | 'operations' | 'finance' | 'catalog_manager' = 'customer') {
    const user = await payload.create({
      collection: 'users', data: { email, password, roles: [role] }, context: { isSystemSeed: true },
    });
    userIds.add(user.id);
    return user.id;
  }

  async function addProduct(session: CustomerSession, quantity = 10) {
    const cart = await session.storefront(getCart, '/api/cart/items?locale=en&init=true');
    expect(cart.status).toBe(200);
    const { cartId } = await cart.json();
    cartIds.add(cartId);
    const response = await session.storefront(addCartItem, '/api/cart/items?locale=en', {
      productId, quantity, operationKey: randomUUID(),
    });
    expect(response.status).toBe(200);
    return cartId;
  }

  async function purchase(session: CustomerSession, customer: ReturnType<typeof shopper>, delivery: Input = { method: 'pickup' }) {
    const quote = await session.storefront(getQuote, '/api/checkout/quote', { delivery });
    expect(quote.status).toBe(200);
    const quoted = await quote.json();
    const order = await session.storefront(placeOrder, '/api/checkout/create-order', {
      locale, customer, delivery: { ...delivery, ...confirmedTestDelivery(quoted) },
      expectedGrandTotal: quoted.grandTotal, expectedQuoteConfirmation: quoted.confirmation,
      paymentMethod: 'bank_transfer', idempotencyKey: randomUUID(),
    });
    const result = await order.json();
    if (typeof result.orderId === 'number') orderIds.add(result.orderId);
    if (typeof result.customerId === 'number') userIds.add(result.customerId);
    expect(order.status).toBe(201);
    expect(result).toMatchObject({ success: true, orderId: expect.any(Number), customerId: expect.any(Number), total: quoted.grandTotal });
    return { result, order };
  }

  async function signIn(session: CustomerSession, email: string, overrides: Input = {}) {
    return session.account('login', { locale, email, password, ...overrides });
  }

  it('scopes an authenticated checkout operation key to its original cart', async () => {
    const buyer = shopper('same-checkout-key');
    await seedIdentity(buyer.email);
    const customer = new CustomerSession();
    expect((await signIn(customer, buyer.email)).status).toBe(200);
    const orderPath = '/api/checkout/create-order';
    const idempotencyKey = randomUUID();
    const selection = { method: 'pickup' };
    const currentPurchase = async () => {
      const response = await customer.storefront(getQuote, '/api/checkout/quote', { delivery: selection });
      expect(response.status).toBe(200);
      const quote = await response.json();
      return {
        locale, customer: buyer, idempotencyKey, paymentMethod: 'cod',
        delivery: { ...selection, ...confirmedTestDelivery(quote) },
        expectedGrandTotal: quote.grandTotal, expectedQuoteConfirmation: quote.confirmation,
      };
    };
    const record = async (response: Response) => {
      const order = await response.json();
      if (typeof order.orderId === 'number') orderIds.add(order.orderId);
      expect(response.status).toBe(201);
      return order.orderId;
    };

    const firstCartId = await addProduct(customer);
    const firstPurchase = await currentPurchase();
    const firstOrderId = await record(await customer.storefront(placeOrder, orderPath, {
      ...firstPurchase, expectedCartId: firstCartId,
    }));

    const secondCartId = await addProduct(customer);
    expect(secondCartId).not.toBe(firstCartId);
    const stale = await customer.storefront(placeOrder, orderPath, firstPurchase);
    expect(stale.status).toBe(409);

    const retry = await customer.storefront(placeOrder, orderPath, {
      ...firstPurchase, expectedCartId: firstCartId,
    });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ orderId: firstOrderId, isIdempotentReplay: true });

    const secondPurchase = await currentPurchase();
    const secondOrderId = await record(await customer.storefront(placeOrder, orderPath, secondPurchase));
    expect(secondOrderId).not.toBe(firstOrderId);
    const previousOrders = await payload.find({
      collection: 'orders', depth: 0, where: { idempotencyKey: { equals: idempotencyKey } },
    });
    expect(previousOrders.docs.map(({ cart }) => cart).sort()).toEqual([firstCartId, secondCartId].sort());
  });

  async function saveAddress(session: CustomerSession, fields: Input = {}) {
    const response = await session.account('addresses', { ...newAddress, ...fields });
    const body = await response.json();
    if (typeof body.addressId === 'number') addressIds.add(body.addressId);
    expect(response.ok).toBe(true);
    expect(body.addressId).toEqual(expect.any(Number));
    return body.addressId as number;
  }

  it('registers inline, issues an HTTP-only session and recovers a committed order by signing in again', async () => {
    const buyer = shopper('inline');
    const session = new CustomerSession();
    await addProduct(session);
    const { result, order } = await purchase(session, { ...buyer, email: ` ${buyer.email.toUpperCase()} ` });
    const orderUrl = `/en/account/orders/${result.orderId}`;
    expect(result).toMatchObject({ userCreated: true, sessionEstablished: true, orderUrl });
    expect(order.headers.getSetCookie().find((cookie) => cookie.startsWith('payload-token='))).toMatch(/httponly/i);
    expect(await (await session.payload(`/api/orders/${result.orderId}`)).json()).toMatchObject({ id: result.orderId });
    expect(await payload.count({ collection: 'users', where: { email: { equals: buyer.email } } })).toMatchObject({ totalDocs: 1 });

    const replacement = new CustomerSession();
    const loggedIn = await replacement.account('login', new URLSearchParams({
      locale, email: buyer.email, password, returnTo: orderUrl,
    }));
    expect(loggedIn.status).toBe(303);
    expect(new URL(loggedIn.headers.get('location') ?? '', site).pathname).toBe(orderUrl);
    expect((await replacement.payload(`/api/orders/${result.orderId}`)).status).toBe(200);
  });

  it('requires an existing buyer to authenticate and preserves a single merged cart through safe checkout return', async () => {
    const buyer = shopper('returning');
    await seedIdentity(buyer.email);
    const member = new CustomerSession();
    expect((await signIn(member, buyer.email)).status).toBe(200);
    await addProduct(member, 10);

    const guest = new CustomerSession();
    await addProduct(guest, 11);
    const quote = await guest.storefront(getQuote, '/api/checkout/quote', { delivery: { method: 'pickup' } });
    const quoted = await quote.json();
    const attempted = await guest.storefront(placeOrder, '/api/checkout/create-order', {
      locale, customer: buyer, delivery: { method: 'pickup', ...confirmedTestDelivery(quoted) },
      paymentMethod: 'bank_transfer', expectedGrandTotal: quoted.grandTotal, expectedQuoteConfirmation: quoted.confirmation,
    });
    expect(attempted.status).toBe(409);
    expect(await attempted.json()).toMatchObject({ success: false });

    const returnTo = '/en/checkout';
    const signedIn = await signIn(guest, buyer.email, { returnTo });
    expect(signedIn.status).toBe(200);
    expect(await signedIn.json()).toMatchObject({ success: true, redirectTo: returnTo });
    for (const session of [guest, guest, member]) {
      const resumed = await session.storefront(getCart, '/api/cart/items?locale=en');
      expect(await resumed.json()).toMatchObject({ summary: { totalItemsCount: 21 } });
    }

    const unsafe = await signIn(new CustomerSession(), buyer.email, { returnTo: '//example.com/en/checkout' });
    expect(await unsafe.json()).toMatchObject({ success: true, redirectTo: '/en/account' });
  });

  it('sends a generic recovery response, accepts a reset link once and invalidates sign-out sessions', async () => {
    const buyer = shopper('recover');
    await seedIdentity(buyer.email);
    const session = new CustomerSession();
    expect((await signIn(session, buyer.email)).status).toBe(200);
    const tokenBeforeSignOut = session.cookieHeader;
    const leave = await session.account('logout', { locale });
    expect(leave.status).toBe(200);
    expect(session.cookieHeader).not.toContain('payload-token');
    const oldRequest = new Request(`${site}/api/users/me`, { headers: { cookie: tokenBeforeSignOut } });
    const oldSession = await (httpPort ? fetch(oldRequest) : handleEndpoints({ config, path: '/api/users/me', request: oldRequest }));
    expect(await oldSession.json()).toMatchObject({ user: null });

    const returnTo = '/en/checkout';
    const requestRecovery = (email: string) => session.account('forgot-password', {
      locale, email, returnTo,
    });
    const count = mail.messages.length;
    const absent = await requestRecovery(shopper('unregistered').email);
    const known = await requestRecovery(buyer.email.toUpperCase());
    expect(known.status).toBe(absent.status);
    expect(await known.json()).toEqual(await absent.json());
    expect(mail.messages).toHaveLength(count + 1);
    function latestToken(recipient = buyer.email) {
      const email = mail.messages.at(-1)?.replace(/=\r\n/g, '').replace(/=3D/g, '=').replace(/&amp;/g, '&') ?? '';
      expect(email).toContain(`To: ${recipient}`);
      const url = email.match(/http:\/\/127\.0\.0\.1:\d+\/en\/account\/reset#[^\s"<>]+/)?.[0];
      expect(Boolean(url)).toBe(true);
      const resetLink = new URL(url ?? '');
      const params = new URLSearchParams(resetLink.hash.slice(1));
      expect(resetLink.search).toBe('');
      expect(params.get('returnTo')).toBe(returnTo);
      const token = params.get('token');
      expect(Boolean(token)).toBe(true);
      return token;
    }
    const submitReset = (token: string | null) => session.account('reset-password', {
      locale, token, password: newPassword, returnTo,
    });
    const token = latestToken();
    const competing = await Promise.all([submitReset(token), submitReset(token)]);
    expect(competing.map(({ status }) => status).sort()).toEqual([200, 400]);
    expect((await submitReset(token)).status).toBe(400);
    expect((await signIn(new CustomerSession(), buyer.email)).status).toBe(401);
    expect((await signIn(new CustomerSession(), buyer.email, { password: newPassword })).status).toBe(200);

    const expired = shopper('recover-expired');
    const expiredId = await seedIdentity(expired.email);
    expect((await requestRecovery(expired.email)).ok).toBe(true);
    expect(mail.messages).toHaveLength(count + 2);
    await payload.db.updateOne({ collection: 'users', id: expiredId, data: { resetPasswordExpiration: new Date(0).toISOString() } });
    expect((await submitReset(latestToken(expired.email))).status).toBe(400);
  });

  it('scopes saved address CRUD and checkout references to their owner and freezes the confirmed snapshot', async () => {
    const buyer = shopper('address-owner');
    const buyerId = await seedIdentity(buyer.email);
    const anotherBuyer = shopper('address-other');
    await seedIdentity(anotherBuyer.email);
    const owner = new CustomerSession();
    const other = new CustomerSession();
    expect((await signIn(owner, buyer.email)).status).toBe(200);
    expect((await signIn(other, anotherBuyer.email)).status).toBe(200);
    const ownerAddress = await saveAddress(owner);
    const otherAddress = await saveAddress(other, { addressLine1: '99 Other Street' });
    expect(await (await owner.payload('/api/addresses?depth=0')).json()).toMatchObject({ docs: [{ id: ownerAddress }] });
    expect(await (await other.payload('/api/addresses?depth=0')).json()).toMatchObject({ docs: [{ id: otherAddress }] });
    expect((await owner.payload(`/api/addresses/${ownerAddress}`)).status).toBe(200);
    expect((await owner.payload(`/api/addresses/${otherAddress}`)).status).toBe(404);
    expect(await (await owner.payload(`/api/addresses?where[id][equals]=${otherAddress}`)).json()).toMatchObject({ totalDocs: 0, docs: [] });
    expect((await owner.payload(`/api/addresses/${otherAddress}`, 'PATCH', { title: 'Intrusion' })).ok).toBe(false);
    expect((await owner.payload(`/api/addresses/${otherAddress}`, 'DELETE')).ok).toBe(false);
    const addressMutation = (action: string, id: number) => owner.account('addresses', {
      ...newAddress, action, id,
    });
    for (const action of ['update', 'delete', 'default']) {
      expect((await addressMutation(action, otherAddress)).status).toBe(404);
    }
    expect((await addressMutation('default', ownerAddress)).ok).toBe(true);
    expect(await (await owner.payload(`/api/users/${buyerId}?depth=0`)).json()).toMatchObject({ defaultAddress: ownerAddress });
    await addProduct(owner);
    const wrongDelivery = { method: 'shipping', addressId: otherAddress };
    const wrongQuote = await owner.storefront(getQuote, '/api/checkout/quote', { delivery: wrongDelivery });
    expect(wrongQuote.status).toBe(404);
    const wrongOrder = await owner.storefront(placeOrder, '/api/checkout/create-order', {
      locale, customer: buyer, delivery: wrongDelivery, paymentMethod: 'bank_transfer', expectedGrandTotal: 2080,
    });
    expect(wrongOrder.status).toBe(404);
    const { result } = await purchase(owner, buyer, { method: 'shipping', addressId: ownerAddress });
    await saveAddress(owner, { action: 'update', id: ownerAddress, addressLine1: '22 Edited Street' });
    expect(await (await owner.payload(`/api/addresses/${ownerAddress}`)).json()).toMatchObject({ addressLine1: '22 Edited Street' });
    expect(await (await owner.payload(`/api/orders/${result.orderId}`)).json()).toMatchObject({
      shippingAddress: { addressLine1: newAddress.addressLine1, city: newAddress.city, state: newAddress.state },
    });
    expect((await addressMutation('delete', ownerAddress)).ok).toBe(true);
    addressIds.delete(ownerAddress);
    expect((await owner.payload(`/api/addresses/${ownerAddress}`)).status).toBe(404);
    expect(await (await owner.payload(`/api/users/${buyerId}?depth=0`)).json()).toMatchObject({ defaultAddress: null });
  });

  it('gates order lists, order details, profiles and attachments for two buyers and scoped finance staff', async () => {
    const firstBuyer = shopper('order-a');
    const secondBuyer = shopper('order-b');
    const first = new CustomerSession();
    const second = new CustomerSession();
    await addProduct(first);
    const { result: initial } = await purchase(first, firstBuyer);
    await addProduct(first);
    const { result: next } = await purchase(first, firstBuyer);
    await addProduct(second);
    const { result: other } = await purchase(second, secondBuyer);
    const asset = await payload.create({
      collection: 'artwork-assets', data: {
        storageKey: `artwork/${randomUUID()}/owner-only.png`, originalFilename: 'owner-only.png', uploader: initial.customerId,
      }, context: { isTrustedUpload: true },
    });
    artworkIds.add(asset.id);

    for (const [page, expected] of [[1, next], [2, initial]] as const) {
      const list = await first.payload(`/api/orders?depth=0&limit=1&sort=-id&page=${page}`);
      expect(list.status).toBe(200);
      expect(await list.json()).toMatchObject({ totalDocs: 2, totalPages: 2, docs: [{ id: expected.orderId }] });
    }
    expect(await (await second.payload('/api/orders?depth=0')).json()).toMatchObject({ totalDocs: 1, docs: [{ id: other.orderId }] });
    expect(await (await first.payload(`/api/orders?where[id][equals]=${other.orderId}`)).json()).toMatchObject({ totalDocs: 0, docs: [] });
    expect((await first.payload(`/api/orders/${other.orderId}`)).status).toBe(404);
    expect((await second.payload(`/api/orders/${initial.orderId}`)).status).toBe(404);
    expect((await new CustomerSession().payload(`/api/orders/${initial.orderId}`)).ok).toBe(false);
    expect((await second.payload(`/api/users/${initial.customerId}`)).status).toBe(404);
    expect((await second.payload(`/api/artwork-assets/${asset.id}`)).status).toBe(404);
    expect((await first.payload(`/api/artwork-assets/${asset.id}`)).status).toBe(200);

    const profile = await first.account('profile', {
      locale, name: 'Edited Customer', companyName: 'Edited Company', taxId: '123456789',
      id: other.customerId, roles: ['super_admin'],
    });
    expect(profile.ok).toBe(true);
    expect(await (await first.payload(`/api/users/${initial.customerId}`)).json()).toMatchObject({
      name: 'Edited Customer', companyName: 'Edited Company', roles: ['customer'],
    });
    expect(await (await second.payload(`/api/users/${other.customerId}`)).json()).not.toMatchObject({ name: 'Edited Customer' });

    const financeBuyer = shopper('finance');
    await seedIdentity(financeBuyer.email, 'finance');
    const finance = new CustomerSession();
    expect((await finance.payload('/api/users/login', 'POST', financeBuyer)).status).toBe(200);
    expect((await finance.payload(`/api/users/${initial.customerId}`)).status).toBe(200);
    expect((await finance.payload(`/api/artwork-assets/${asset.id}`)).status).toBe(404);

    if (httpPort) {
      const html = async (session: CustomerSession, path: string) => {
        const response = await fetch(session.request(path), { redirect: 'manual' });
        return { response, text: await response.text() };
      };
      const orderPage = `/en/account/orders/${initial.orderId}`;
      const historyA = await html(first, '/en/account/orders');
      const historyB = await html(second, '/ar/account/orders');
      expect(historyA.response.status).toBe(200);
      expect(historyA.text).toContain(initial.orderNumber);
      expect(historyA.text).toContain(next.orderNumber);
      expect(historyA.text).not.toContain(other.orderNumber);
      expect(historyB.response.status).toBe(200);
      expect(historyB.text).toContain(other.orderNumber);
      expect(historyB.text).not.toContain(initial.orderNumber);
      expect((await html(first, orderPage)).text).toContain(initial.orderNumber);
      expect((await html(second, orderPage)).text).not.toContain(initial.orderNumber);
      expect((await html(new CustomerSession(), orderPage)).text).not.toContain(initial.orderNumber);

      for (let index = 0; index < 9; index += 1) {
        const extra = await payload.create({ collection: 'orders', data: {
          customer: initial.customerId, items: [{ product: productId, quantity: 10 }], paymentMethod: 'bank_transfer',
        } });
        orderIds.add(extra.id);
      }
      const pageOne = await html(first, '/en/account/orders?page=1');
      const pageTwo = await html(first, '/en/account/orders?page=2');
      expect(pageTwo.response.status).toBe(200);
      expect(pageOne.text).toContain(next.orderNumber);
      expect(pageOne.text).not.toContain(initial.orderNumber);
      expect(pageTwo.text).toContain(initial.orderNumber);
      expect(pageTwo.text).not.toContain(next.orderNumber);
      expect(pageTwo.text).not.toContain(other.orderNumber);
    }
  });
});
