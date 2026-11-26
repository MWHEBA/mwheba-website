import { createHmac } from 'node:crypto';
import { APIError, type Payload, type PayloadRequest } from 'payload';
import { calculateCartSummary, hydrateCartLines } from '@/modules/cart-checkout/services/cartCalculator';
import { isRetiredCart } from '@/modules/cart-checkout/services/cartStorage';
import { checkoutSavedShippingAddress } from '@/modules/identity/services/customerAccount';
import type { InventoryIssue } from '@/modules/inventory/services/inventoryService';
import { validateCodEligibility } from '@/modules/payments/services/codEngine';
import type { Cart } from '@/payload-types';
import { calculateCheckoutAmounts, priceCheckoutLine } from '../logic/checkoutAmounts';
import { getCommerceSettings } from './deliveryTariff';
import { resolveCheckoutFulfillment, type CheckoutFulfillment, type CheckoutFulfillmentSelection } from './checkoutFulfillment';

export type CheckoutPaymentMethod = 'cod' | 'bank_transfer';

export interface CheckoutShippingAddress {
  governorate: string;
  city: string;
  streetAddress: string;
  buildingDetails?: string;
}

export interface CheckoutQuoteDeliveryInput extends CheckoutFulfillmentSelection {
  addressId?: number;
  customerId?: number;
  shippingAddress?: CheckoutShippingAddress;
}

export interface CheckoutQuoteLine {
  id: string;
  productId: number;
  title: string;
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  lineCustomizationFee: number;
  lineTotal: number;
  stockIssue?: InventoryIssue;
}

export interface CheckoutQuote {
  items: CheckoutQuoteLine[];
  subtotal: number;
  totalCustomizationFees: number;
  shippingFee: number;
  taxAmount: number;
  grandTotal: number;
  currency: 'EGP';
  canCheckout: boolean;
  validationErrors: string[];
  fulfillment: CheckoutFulfillment;
  codEligible: boolean;
  paymentMethods: CheckoutPaymentMethod[];
  confirmation: string | null;
  /** Legacy response flags. Fulfillment availability is reported by fulfillment.issue. */
  isProvisional: boolean;
  tariffScheduleStatus: 'pending_owner_tariff_approval' | 'owner_approved';
  /** Bank wire details from CommerceSettings for B2B bank transfer settlement (PAY-03) */
  bankDetails?: {
    status: 'pending_configuration' | 'active';
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
    swiftCode?: string | null;
    instapayHandle?: string | null;
    bankInstructions?: string | null;
  };
}

/**
 * Builds the server-authoritative quote (lines, fees, shipping, total) for a cart.
 * Prices come from the catalog and active CommerceSettings.
 */
export async function buildCheckoutQuote(
  payload: Payload,
  cartId: number,
  delivery: CheckoutQuoteDeliveryInput = {},
): Promise<CheckoutQuote> {
  const cart = await payload.findByID({ collection: 'carts', id: cartId, depth: 0 });
  if (isRetiredCart(cart)) throw new APIError('CART_NOT_ACTIVE', 409, undefined, true);
  return (await priceCheckoutCart(payload, cart, delivery)).quote;
}

/** Reads the same catalog, settings and owned address for previews and the order transaction. */
export async function priceCheckoutCart(
  payload: Payload,
  cart: Pick<Cart, 'id' | 'items'>,
  delivery: CheckoutQuoteDeliveryInput,
  req?: Partial<PayloadRequest>,
) {
  const items = await hydrateCartLines(cart.items ?? [], payload, undefined, req);
  const summary = calculateCartSummary(items);
  const settings = await getCommerceSettings(payload, { req });
  const needsFulfillment = items.some((item) => item.itemType === 'physical');
  const savedAddress = needsFulfillment && delivery.method !== 'pickup' && delivery.addressId != null
    ? await checkoutSavedShippingAddress(payload, delivery.customerId, delivery.addressId, req)
    : null;
  const shippingAddress = savedAddress ?? delivery.shippingAddress;
  const fulfillment = resolveCheckoutFulfillment(settings.pilotFulfillment, needsFulfillment, {
    method: delivery.method,
    optionId: delivery.optionId,
    governorate: shippingAddress?.governorate ?? delivery.governorate,
  });
  const isProvisional = fulfillment.issue === 'NO_APPROVED_FULFILLMENT';
  const lines = items.map((item) => ({
    ...item,
    ...priceCheckoutLine(item.unitPrice, item.customizationFeePerUnit, item.quantity),
  }));
  // Tax remains zero pending deployment-specific accountant review.
  const amounts = calculateCheckoutAmounts(lines, fulfillment.selected?.amount ?? 0, 0);
  const codEligibility = validateCodEligibility(items);
  const codEligible = Boolean(fulfillment.selected?.codAllowed && codEligibility.eligible);
  const paymentMethods: CheckoutPaymentMethod[] = [];
  if (codEligible) paymentMethods.push('cod');
  const bankActive = settings.bankDetailsStatus === 'active'
    && Boolean(settings.accountName?.trim() && (
      settings.iban?.trim() || settings.instapayHandle?.trim()
      || (settings.bankName?.trim() && settings.accountNumber?.trim())
    ));
  if (bankActive) paymentMethods.push('bank_transfer');
  const bankDetails: CheckoutQuote['bankDetails'] = {
    status: bankActive ? 'active' : 'pending_configuration',
    bankName: bankActive ? settings.bankName : null,
    accountName: bankActive ? settings.accountName : null,
    accountNumber: bankActive ? settings.accountNumber : null,
    iban: bankActive ? settings.iban : null,
    swiftCode: bankActive ? settings.swiftCode : null,
    instapayHandle: bankActive ? settings.instapayHandle : null,
    bankInstructions: bankActive ? settings.bankInstructions : null,
  };
  const canCheckout = summary.canCheckout && amounts.grandTotalPiastres > 0
    && (!needsFulfillment || Boolean(fulfillment.selected)) && paymentMethods.length > 0;
  const confirmation = canCheckout ? createHmac('sha256', payload.secret)
    .update(JSON.stringify([
      'checkout-v1', cart.id, summary.currency,
      lines.map((line) => [
        line.id, line.productId, line.variantId, line.sku, line.itemType, line.quantity,
        line.productTitle, line.variantTitle,
        line.unitPrice, line.customizationFeePerUnit, line.artworkAssetId, line.printingNotes,
      ]),
      amounts, fulfillment.selected?.confirmation, savedAddress && [String(delivery.addressId), savedAddress],
      paymentMethods, bankDetails,
    ]))
    .digest('hex') : null;

  const quote: CheckoutQuote = {
    items: lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      title: line.productTitle,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineCustomizationFee: line.lineCustomizationFee,
      lineTotal: line.lineTotal,
      ...(line.stockIssue ? { stockIssue: line.stockIssue } : {}),
    })),
    subtotal: amounts.subtotal,
    totalCustomizationFees: amounts.totalCustomizationFees,
    shippingFee: amounts.shippingFee,
    taxAmount: amounts.taxAmount,
    grandTotal: amounts.grandTotal,
    currency: summary.currency,
    canCheckout,
    validationErrors: summary.validationErrors,
    fulfillment,
    codEligible,
    paymentMethods,
    confirmation,
    isProvisional,
    tariffScheduleStatus: isProvisional ? 'pending_owner_tariff_approval' : 'owner_approved',
    bankDetails,
  };
  return { quote, summary, amounts, lines, shippingAddress, settings, codEligibility };
}
