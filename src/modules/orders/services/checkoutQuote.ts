import type { Payload } from 'payload';
import { getCartSummary } from '@/modules/cart-checkout/services/cartStorage';
import { resolveDeliveryTariff } from './deliveryTariff';

export interface CheckoutQuoteLine {
  id: string;
  productId: number;
  title: string;
  variantTitle?: string;
  quantity: number;
  unitPrice: number;
  lineCustomizationFee: number;
  lineTotal: number;
}

export interface CheckoutQuote {
  items: CheckoutQuoteLine[];
  subtotal: number;
  totalCustomizationFees: number;
  shippingFee: number;
  grandTotal: number;
  currency: 'EGP';
  canCheckout: boolean;
  validationErrors: string[];
  /** The tariff schedule is a working fixture until the owner approves D-015. */
  isProvisional: boolean;
  tariffScheduleStatus: 'pending_owner_tariff_approval';
}

/**
 * Builds the server-authoritative quote (lines, fees, shipping, total) for a cart.
 * Prices come from the catalog; nothing is taken from the client except delivery method/governorate.
 */
export async function buildCheckoutQuote(
  payload: Payload,
  cartId: number,
  delivery: { method: 'shipping' | 'pickup'; governorate?: string }
): Promise<CheckoutQuote> {
  const tariff = resolveDeliveryTariff({ method: delivery.method, governorate: delivery.governorate });
  const summary = await getCartSummary(payload, cartId, tariff.amount);

  return {
    items: summary.items.map((line) => ({
      id: line.id,
      productId: line.productId,
      title: line.productTitle,
      variantTitle: line.variantTitle,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineCustomizationFee: line.lineCustomizationFee,
      lineTotal: line.lineTotal,
    })),
    subtotal: summary.subtotal,
    totalCustomizationFees: summary.totalCustomizationFees,
    shippingFee: tariff.amount,
    grandTotal: summary.grandTotal,
    currency: summary.currency,
    canCheckout: summary.canCheckout,
    validationErrors: summary.validationErrors,
    isProvisional: tariff.isProvisional,
    tariffScheduleStatus: tariff.tariffScheduleStatus,
  };
}
