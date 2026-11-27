import { NextRequest, NextResponse } from 'next/server';
import { createLocalReq, getPayload, logoutOperation } from 'payload';
import config from '@/payload.config';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { applyCartCookie, resolveCartRequest } from '@/modules/cart-checkout/services/cartRequest';
import { isStorefrontCustomer } from '@/modules/identity/access/roles';
import { accountLocale, normalizeCustomerEmail, safeAccountReturnTo, validCustomerEmail } from '@/modules/identity/logic/accountPaths';
import { accountProfile, customerAddressID, listCustomerAddresses, ownedCustomerAddress, payloadAccountCookie } from '@/modules/identity/services/customerAccount';
import { customerSiteOrigin, hasTransactionalEmail, sameAccountOrigin } from '@/modules/identity/services/customerMail';

function readFields(input: Record<string, unknown>, lengths: Record<string, number>) {
  const fields: Record<string, string> = {};
  for (const [name, maxLength] of Object.entries(lengths)) {
    const value = input[name];
    if (value == null) continue;
    if (typeof value !== 'string' || value.trim().length > maxLength) return null;
    fields[name] = value.trim();
  }
  return fields;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ operation: string }> }) {
  if (!sameAccountOrigin(request)) return NextResponse.json({ success: false, error: 'FORBIDDEN_ORIGIN' }, { status: 403 });

  const json = request.headers.get('content-type')?.includes('application/json');
  let input: Record<string, unknown>;
  try {
    const data: unknown = json ? await request.json() : Object.fromEntries(await request.formData());
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid form data');
    input = data as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_ACCOUNT_INPUT' }, { status: 400 });
  }

  const { operation } = await params;
  const locale = accountLocale(input.locale);
  const account = `/${locale}/account`;
  const returnTo = safeAccountReturnTo(locale, input.returnTo);
  const withStatus = (path: string, status: string, preserveReturn = false) => `${path}?${new URLSearchParams({
    status, ...(preserveReturn ? { returnTo } : {}),
  })}`;
  const respond = (redirectTo: string, status = 200, error?: string, data?: Record<string, unknown>) => {
    const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
    return json
      ? NextResponse.json({ success: status < 400, redirectTo, ...(error ? { error } : {}), ...data }, { status, headers })
      : new NextResponse(null, { status: 303, headers: { ...headers, Location: redirectTo } });
  };
  const loginInvalid = () => respond(withStatus(`${account}/login`, 'invalid', true), 401, 'INVALID_CREDENTIALS');
  const recoverySent = () => respond(withStatus(`${account}/recover`, 'sent', true));
  const resetInvalid = () => respond(withStatus(`${account}/reset`, 'invalid', true), 400, 'INVALID_RESET');
  const editFailure = (path: string, status = 400, error = 'INVALID_ACCOUNT_INPUT') => respond(withStatus(path, 'invalid'), status, error);
  const invalidAuth = () => respond(`${account}/login?${new URLSearchParams({ returnTo: operation === 'addresses' ? `${account}/addresses` : `${account}/profile` })}`,
    401, 'CUSTOMER_SESSION_REQUIRED');
  const email = normalizeCustomerEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';
  const storefrontContext = { storefrontAccount: true, customerLocale: locale, customerReturnTo: returnTo };

  try {
    const payload = await getPayload({ config });

    if (operation === 'login') {
      if (!validCustomerEmail(email) || !password || password.length > 128) return loginInvalid();
      const { token, user } = await payload.login({ collection: 'users', data: { email, password },
        depth: 0, context: storefrontContext });
      if (!token || !isStorefrontCustomer(user)) return loginInvalid();
      const addresses = json ? await listCustomerAddresses(payload, user) : [];
      const response = respond(returnTo, 200, undefined, { profile: accountProfile(user), addresses });
      const signedCartCookie = request.cookies.get(CART_COOKIE_NAME)?.value;
      if (signedCartCookie) {
        try {
          const result = await resolveCartRequest(payload, {
            headers: new Headers({ Cookie: `${payload.config.cookiePrefix}-token=${token}` }), signedCartCookie,
          });
          applyCartCookie(response, result.guestCookie);
        } catch {
          // Leave the signed guest cookie in place so the canonical cart entry point can retry.
        }
      }
      response.headers.append('Set-Cookie', payloadAccountCookie(payload, token));
      return response;
    }

    if (operation === 'forgot-password') {
      if (validCustomerEmail(email) && customerSiteOrigin() && hasTransactionalEmail(payload)) {
        const { docs: [target] } = await payload.find({ collection: 'users', where: { email: { equals: email } },
          limit: 1, depth: 0, select: { roles: true } });
        if (target && isStorefrontCustomer({ ...target, collection: 'users' })) {
          await payload.forgotPassword({ collection: 'users', data: { email }, context: storefrontContext });
        }
      }
      return recoverySent();
    }

    if (operation === 'reset-password') {
      const token = typeof input.token === 'string' ? input.token : '';
      if (!/^[a-f0-9]{40}$/.test(token) || password.length < 8 || password.length > 128) return resetInvalid();
      await payload.resetPassword({ collection: 'users', data: { token, password }, overrideAccess: false, context: storefrontContext });
      const response = respond(withStatus(`${account}/login`, 'reset', true));
      response.headers.append('Set-Cookie', payloadAccountCookie(payload));
      return response;
    }

    const { user } = await payload.auth({ headers: request.headers });
    if (operation === 'logout') {
      if (isStorefrontCustomer(user)) {
        const req = await createLocalReq({ user, req: { headers: request.headers } }, payload);
        await logoutOperation({ collection: payload.collections.users, req });
      }
      const response = respond(`${account}/login`);
      if (!user || isStorefrontCustomer(user)) response.headers.append('Set-Cookie', payloadAccountCookie(payload));
      return response;
    }

    if (operation === 'profile') {
      if (!isStorefrontCustomer(user)) return invalidAuth();
      const fields = readFields(input, { name: 100, companyName: 200, taxId: 60 });
      if (!fields) return editFailure(`${account}/profile`);
      await payload.update({ collection: 'users', id: user.id, data: fields, user, depth: 0, overrideAccess: false });
      return respond(withStatus(`${account}/profile`, 'saved'));
    }

    if (operation === 'addresses') {
      if (!isStorefrontCustomer(user)) return invalidAuth();
      const addressPath = `${account}/addresses`;
      const id = customerAddressID(input.id);
      const action = input.action;
      if (action !== 'create' && action !== 'update' && action !== 'delete' && action !== 'default') return editFailure(addressPath);
      const existing = action !== 'create' && id ? await ownedCustomerAddress(payload, user.id, id) : null;
      if (action !== 'create' && !existing) return editFailure(addressPath, 404, 'SAVED_ADDRESS_UNAVAILABLE');

      if (action === 'delete' && existing) {
        await payload.delete({ collection: 'addresses', id: existing.id, user, overrideAccess: false });
      } else if (action === 'default' && existing) {
        await payload.update({ collection: 'users', id: user.id, data: { defaultAddress: existing.id }, user, depth: 0, overrideAccess: false });
      } else {
        const fields = readFields(input, { title: 100, firstName: 100, lastName: 100, company: 200, phone: 40,
          addressLine1: 300, addressLine2: 300, city: 100, state: 100 });
        if (!fields || !['state', 'city', 'addressLine1'].every((field) => (fields[field] ?? existing?.[field as 'state' | 'city' | 'addressLine1'])?.trim())) {
          return editFailure(addressPath);
        }
        const data = { ...fields, country: 'EG' as const };
        const address = existing
          ? await payload.update({ collection: 'addresses', id: existing.id, data, user, depth: 0, overrideAccess: false })
          : await payload.create({ collection: 'addresses', data, user, depth: 0, overrideAccess: false });
        return respond(withStatus(addressPath, 'saved'), 200, undefined, { addressId: address.id });
      }
      return respond(withStatus(addressPath, 'saved'));
    }

    return NextResponse.json({ success: false, error: 'ACCOUNT_OPERATION_NOT_FOUND' }, { status: 404 });
  } catch {
    if (operation === 'login') return loginInvalid();
    if (operation === 'forgot-password') return recoverySent();
    if (operation === 'reset-password') return resetInvalid();
    if (operation === 'profile' || operation === 'addresses') return editFailure(`${account}/${operation}`);
    return respond(account, 503, 'ACCOUNT_OPERATION_UNAVAILABLE');
  }
}
