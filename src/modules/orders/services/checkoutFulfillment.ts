import { createHash } from 'node:crypto';
import {
  fulfillmentRegions,
  normalizeFulfillmentRegion,
  type BilingualFulfillmentText,
  type FulfillmentRegion,
  type FulfillmentRegionCode,
} from '../logic/fulfillmentRegions';

export type CheckoutFulfillmentMethod = 'shipping' | 'pickup';

interface FulfillmentRate {
  amount: number;
  codAllowed: boolean;
}

interface PilotPickupPoint extends FulfillmentRate {
  id: string;
  label: BilingualFulfillmentText;
  address: BilingualFulfillmentText;
  instructions: BilingualFulfillmentText;
}

interface PilotFulfillmentConfig {
  status: 'provisional' | 'owner_approved';
  reference: string;
  courierRemittanceEnabled?: boolean;
  delivery?: Array<FulfillmentRate & { regionCode: FulfillmentRegionCode }>;
  pickup?: PilotPickupPoint | null;
}

export interface CheckoutFulfillmentSelection {
  method?: CheckoutFulfillmentMethod;
  optionId?: string;
  governorate?: string;
}

export interface CheckoutFulfillmentOption extends FulfillmentRate {
  id: string;
  method: CheckoutFulfillmentMethod;
  label: BilingualFulfillmentText;
  currency: 'EGP';
  regionCode: FulfillmentRegionCode | null;
  configurationReference: string;
  confirmation: string;
  pickup?: { address: BilingualFulfillmentText; instructions: BilingualFulfillmentText };
}

export interface CheckoutFulfillment {
  required: boolean;
  regions: FulfillmentRegion[];
  options: CheckoutFulfillmentOption[];
  selected: CheckoutFulfillmentOption | null;
  issue: 'NO_APPROVED_FULFILLMENT' | 'UNSUPPORTED_DELIVERY_REGION' | 'DELIVERY_REGION_REQUIRED'
    | 'FULFILLMENT_SELECTION_REQUIRED' | 'FULFILLMENT_OPTION_UNAVAILABLE' | null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasKnownFields(value: Record<string, unknown>, fields: string[]): boolean {
  return Object.keys(value).every((key) => fields.includes(key));
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= 500;
}

function validBilingualText(value: unknown): value is BilingualFulfillmentText {
  return isObject(value) && hasKnownFields(value, ['ar', 'en']) && validText(value.ar) && validText(value.en);
}

function validRate(value: Record<string, unknown>): boolean {
  const amount = value.amount;
  return typeof value.codAllowed === 'boolean' && typeof amount === 'number' && Number.isFinite(amount)
    && amount >= 0 && Number.isSafeInteger(Math.round(amount * 100)) && amount === Math.round(amount * 100) / 100;
}

function validConfig(value: unknown): value is PilotFulfillmentConfig {
  if (!isObject(value) || !hasKnownFields(value, ['status', 'reference', 'delivery', 'pickup', 'courierRemittanceEnabled'])
    || (value.status !== 'provisional' && value.status !== 'owner_approved') || !validText(value.reference)) return false;
  if (value.courierRemittanceEnabled !== undefined && typeof value.courierRemittanceEnabled !== 'boolean') return false;

  const { delivery, pickup } = value;
  const seenRegions = new Set<FulfillmentRegionCode>();
  if (delivery !== undefined && (!Array.isArray(delivery) || !delivery.every((row: unknown) => {
    if (!isObject(row) || !hasKnownFields(row, ['regionCode', 'amount', 'codAllowed']) || !validRate(row)) return false;
    const code = normalizeFulfillmentRegion(row.regionCode);
    if (!code || row.regionCode !== code || seenRegions.has(code)) return false;
    seenRegions.add(code);
    return true;
  }))) return false;

  if (pickup != null && (!isObject(pickup) || !hasKnownFields(pickup, ['id', 'amount', 'codAllowed', 'label', 'address', 'instructions'])
    || typeof pickup.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(pickup.id) || !validRate(pickup)
    || !validBilingualText(pickup.label) || !validBilingualText(pickup.address) || !validBilingualText(pickup.instructions))) return false;

  return value.status === 'provisional' || seenRegions.size > 0 || pickup != null;
}

export function isCourierRemittanceEnabled(config: unknown): boolean {
  return validConfig(config) && config.status === 'owner_approved' && config.courierRemittanceEnabled === true;
}

export function validatePilotFulfillment(value: unknown): true | string {
  return value == null || validConfig(value) || 'Enter a valid pilot configuration with unique governorate codes, explicit EGP amounts and COD flags, and bilingual pickup details when pickup is enabled.';
}

function confirmedOption(option: Omit<CheckoutFulfillmentOption, 'confirmation'>): CheckoutFulfillmentOption {
  const { id, amount, currency, codAllowed, label, pickup, configurationReference } = option;
  const confirmation = createHash('sha256').update(JSON.stringify([
    id, amount, currency, codAllowed, label.ar, label.en, configurationReference,
    pickup?.address.ar, pickup?.address.en, pickup?.instructions.ar, pickup?.instructions.en,
  ])).digest('hex');
  return { ...option, confirmation };
}

export function resolveCheckoutFulfillment(
  config: unknown,
  required: boolean,
  selection: CheckoutFulfillmentSelection = {},
): CheckoutFulfillment {
  const result: CheckoutFulfillment = { required, regions: [], options: [], selected: null, issue: null };
  if (!required) return result;
  if (!validConfig(config) || config.status !== 'owner_approved') {
    return { ...result, issue: 'NO_APPROVED_FULFILLMENT' };
  }

  const regionCode = normalizeFulfillmentRegion(selection.governorate);
  const regions = fulfillmentRegions.filter(({ code }) => config.delivery?.some((row) => row.regionCode === code));
  const delivery = config.delivery?.find((row) => row.regionCode === regionCode);
  const options: CheckoutFulfillmentOption[] = [];
  if (delivery) {
    options.push(confirmedOption({
      id: `shipping:${delivery.regionCode}`,
      method: 'shipping',
      label: { ar: 'التوصيل إلى العنوان', en: 'Courier delivery' },
      currency: 'EGP',
      regionCode: delivery.regionCode,
      configurationReference: config.reference,
      amount: delivery.amount,
      codAllowed: delivery.codAllowed,
    }));
  }
  if (config.pickup) {
    const { id, label, amount, codAllowed, address, instructions } = config.pickup;
    options.push(confirmedOption({
      id: `pickup:${id}`, method: 'pickup', label, currency: 'EGP', regionCode: null,
      configurationReference: config.reference, amount, codAllowed, pickup: { address, instructions },
    }));
  }

  const selected = options.find((option) =>
    (selection.optionId ? option.id === selection.optionId : option.method === selection.method)
    && (!selection.method || option.method === selection.method)) ?? null;
  let issue: CheckoutFulfillment['issue'] = null;
  if (!selected) {
    const hasDestination = typeof selection.governorate === 'string' && Boolean(selection.governorate.trim());
    if ((hasDestination || selection.method === 'shipping' || options.length === 0) && regions.length > 0 && !delivery && selection.method !== 'pickup') {
      issue = hasDestination ? 'UNSUPPORTED_DELIVERY_REGION' : 'DELIVERY_REGION_REQUIRED';
    } else if (selection.optionId || selection.method) {
      issue = 'FULFILLMENT_OPTION_UNAVAILABLE';
    } else {
      issue = 'FULFILLMENT_SELECTION_REQUIRED';
    }
  }

  return { ...result, regions, options, selected, issue };
}
