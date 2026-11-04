import type { Payload } from 'payload';
import { getCartSummary } from '@/modules/cart-checkout/services/cartStorage';
import { resolveDeliveryTariff, getCommerceSettings } from './deliveryTariff';

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
  /** The tariff schedule is provisional until the owner approves D-015 in CommerceSettings. */
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
 * Prices come from the catalog and active CommerceSettings; nothing is taken from the client except delivery method/governorate.
 */
export async function buildCheckoutQuote(
  payload: Payload,
  cartId: number,
  delivery: { method: 'shipping' | 'pickup'; governorate?: string }
): Promise<CheckoutQuote> {
  const settings = await getCommerceSettings(payload);
  const tariff = resolveDeliveryTariff({
    method: delivery.method,
    governorate: delivery.governorate,
    schedule: settings,
  });
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
    bankDetails: {
      status: settings.bankDetailsStatus || 'pending_configuration',
      bankName: settings.bankDetailsStatus === 'active' ? settings.bankName : null,
      accountName: settings.bankDetailsStatus === 'active' ? settings.accountName : null,
      accountNumber: settings.bankDetailsStatus === 'active' ? settings.accountNumber : null,
      iban: settings.bankDetailsStatus === 'active' ? settings.iban : null,
      swiftCode: settings.bankDetailsStatus === 'active' ? settings.swiftCode : null,
      instapayHandle: settings.bankDetailsStatus === 'active' ? settings.instapayHandle : null,
      bankInstructions: settings.bankDetailsStatus === 'active' ? settings.bankInstructions : null,
    },
  };
}
