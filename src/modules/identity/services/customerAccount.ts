import { APIError, getPayload, type Payload, type PayloadRequest } from 'payload';
import { generateExpiredPayloadCookie, generatePayloadCookie } from 'payload/shared';
import config from '@/payload.config';
import type { Address, User } from '@/payload-types';
import { isStorefrontCustomer } from '../access/roles';

export async function getCustomerAccount(headers: Headers) {
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers });
  return isStorefrontCustomer(user) ? { payload, user } : null;
}

export function payloadAccountCookie(payload: Payload, token?: string) {
  const options = { collectionAuthConfig: payload.collections.users.config.auth, cookiePrefix: payload.config.cookiePrefix };
  return token ? generatePayloadCookie({ ...options, token }) : generateExpiredPayloadCookie(options);
}

export function listCustomerAddresses(payload: Payload, user: User) {
  return payload.find({
    collection: 'addresses', where: { customer: { equals: user.id } },
    depth: 0, pagination: false, sort: '-updatedAt', user, overrideAccess: false,
  }).then(({ docs }) => docs);
}

export function listCustomerOrders(payload: Payload, user: User, page = 1) {
  return payload.find({
    collection: 'orders', where: { customer: { equals: user.id } },
    depth: 0, limit: 10, page, sort: ['-createdAt', '-id'], user, overrideAccess: false,
    select: {
      orderNumber: true, createdAt: true, amount: true,
      orderStatus: true, paymentStatus: true, deliveryMethod: true,
    },
  });
}

export function customerAddressID(value: unknown): number | null {
  const numeric = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  return typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

export function accountProfile(user: User) {
  return {
    name: user.name, email: user.email, companyName: user.companyName, taxId: user.taxId,
    defaultAddressId: typeof user.defaultAddress === 'object' ? user.defaultAddress?.id ?? null : user.defaultAddress ?? null,
  };
}

export async function ownedCustomerAddress(payload: Payload, customerId: number, addressId: number, req?: Partial<PayloadRequest>) {
  const { docs: [address] } = await payload.find({
    collection: 'addresses', depth: 0, limit: 1, req,
    where: { id: { equals: addressId }, customer: { equals: customerId } },
  });
  return address ?? null;
}

export async function checkoutSavedShippingAddress(
  payload: Payload,
  customerId: number | undefined,
  value: unknown,
  req?: Partial<PayloadRequest>,
) {
  const id = customerAddressID(value);
  const address: Address | null = id && customerId ? await ownedCustomerAddress(payload, customerId, id, req) : null;
  if (!address || address.country !== 'EG' || !address.state?.trim() || !address.city?.trim() || !address.addressLine1?.trim()) {
    throw new APIError('SAVED_ADDRESS_UNAVAILABLE: Choose a valid shipping address.', 404, undefined, true);
  }
  return {
    governorate: address.state.trim(), city: address.city.trim(), streetAddress: address.addressLine1.trim(),
    buildingDetails: address.addressLine2?.trim() || undefined,
  };
}
