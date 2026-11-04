/**
 * MWHEBA 2.0 Delivery Tariff Engine
 * Resolves standard corporate courier delivery tariffs and office pickup fees.
 *
 * GOVERNANCE NOTICE (DECISIONS.md D-015 & PROJECT_SPEC.md Section 7):
 * All delivery and pickup fee rates are PROVISIONAL working parameters pending formal
 * project owner tariff schedule approval. Zero fees should be presented as immutable or final.
 */

export interface DeliveryTariffQuote {
  method: 'shipping' | 'pickup';
  amount: number;
  currency: 'EGP';
  isProvisional: boolean;
  governorate?: string;
  tariffScheduleStatus: 'pending_owner_tariff_approval';
  fulfillmentNoteAr: string;
  fulfillmentNoteEn: string;
}

/**
 * Baseline illustrative delivery tariff table (working fixture per PROJECT_SPEC.md line 108).
 * Subject to project owner approval before production launch.
 */
export const PROVISIONAL_DELIVERY_TARIFFS = {
  officePickupDefault: 0, // Provisional: free pickup subject to owner confirmation per D-015
  cairoAndGiza: 80,
  alexandria: 90,
  otherGovernorates: 120,
  standardFallback: 150, // Illustrative fallback rate
} as const;

/**
 * Resolves the delivery tariff for an order.
 * Ensures the calculated rate is explicitly flagged as provisional pending owner sign-off.
 */
export function resolveDeliveryTariff(params: {
  method: 'shipping' | 'pickup';
  governorate?: string;
  customFee?: number;
}): DeliveryTariffQuote {
  const { method, governorate, customFee } = params;

  if (method === 'pickup') {
    const amount = typeof customFee === 'number' && customFee >= 0 ? customFee : PROVISIONAL_DELIVERY_TARIFFS.officePickupDefault;
    return {
      method: 'pickup',
      amount,
      currency: 'EGP',
      isProvisional: true,
      tariffScheduleStatus: 'pending_owner_tariff_approval',
      fulfillmentNoteAr: amount === 0
        ? 'استلام من مقر الوكالة (رسوم مبدئية: 0 ج.م - خاضعة لاعتماد الشروط والتعريفة النهائية طبقاً للبند D-015)'
        : `استلام من مقر الوكالة (رسوم مبدئية: ${amount} ج.م - خاضعة لاعتماد المالك D-015)`,
      fulfillmentNoteEn: amount === 0
        ? 'Office Pickup from MWHEBA Agency Office (Provisional: 0 EGP - Subject to owner terms & tariff approval per D-015)'
        : `Office Pickup (Provisional: ${amount} EGP - Subject to owner tariff approval D-015)`,
    };
  }

  // Standard Shipping
  let amount: number = PROVISIONAL_DELIVERY_TARIFFS.standardFallback;

  if (typeof customFee === 'number' && customFee >= 0) {
    amount = customFee;
  } else if (governorate) {
    const govNorm = governorate.toLowerCase();
    if (govNorm.includes('القاهرة') || govNorm.includes('cairo') || govNorm.includes('الجيزة') || govNorm.includes('giza')) {
      amount = PROVISIONAL_DELIVERY_TARIFFS.cairoAndGiza;
    } else if (govNorm.includes('الإسكندرية') || govNorm.includes('alexandria')) {
      amount = PROVISIONAL_DELIVERY_TARIFFS.alexandria;
    } else {
      amount = PROVISIONAL_DELIVERY_TARIFFS.otherGovernorates;
    }
  }

  return {
    method: 'shipping',
    amount,
    currency: 'EGP',
    isProvisional: true,
    governorate,
    tariffScheduleStatus: 'pending_owner_tariff_approval',
    fulfillmentNoteAr: `شحن وتوصيل لمقر الشركة (رسوم شحن تجريبية: ${amount} ج.م - خاضعة لاعتماد جدول أسعار الشحن النهائي)`,
    fulfillmentNoteEn: `Corporate Courier Delivery (Illustrative test fee: ${amount} EGP - Subject to owner tariff sign-off)`,
  };
}
