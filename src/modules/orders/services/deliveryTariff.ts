import type { Payload } from 'payload';
import type { CommerceSettingsData } from '../globals/CommerceSettings';

/**
 * MWHEBA 2.0 Delivery Tariff Engine
 * Resolves standard corporate courier delivery tariffs and office pickup fees.
 *
 * GOVERNANCE NOTICE (DECISIONS.md D-015 & PROJECT_SPEC.md Section 7):
 * All delivery and pickup fee rates are configurable at runtime via CommerceSettings.
 * Until the project owner explicitly marks the schedule as 'owner_approved', all quotes
 * are flagged as isProvisional = true and tariffScheduleStatus = 'pending_owner_tariff_approval'.
 */

export interface DeliveryTariffQuote {
  method: 'shipping' | 'pickup';
  amount: number;
  currency: 'EGP';
  isProvisional: boolean;
  governorate?: string;
  tariffScheduleStatus: 'pending_owner_tariff_approval' | 'owner_approved';
  fulfillmentNoteAr: string;
  fulfillmentNoteEn: string;
}

/**
 * Baseline illustrative delivery tariff table (working fixture per PROJECT_SPEC.md line 108).
 * Used when no runtime CommerceSettings global is available or during initial database bootstrap.
 */
export const PROVISIONAL_DELIVERY_TARIFFS = {
  officePickupDefault: 0,
  cairoAndGiza: 80,
  alexandria: 90,
  otherGovernorates: 120,
  standardFallback: 150,
} as const;

/**
 * Loads the active runtime operational settings from the Payload CommerceSettings global.
 * Falls back to provisional safe defaults if the global is uninitialized.
 */
export async function getCommerceSettings(payload: Payload): Promise<CommerceSettingsData> {
  try {
    const settings = await payload.findGlobal({
      slug: 'commerce-settings',
      depth: 0,
    });
    if (settings) {
      return settings as unknown as CommerceSettingsData;
    }
  } catch {
    // Database or global uninitialized; use safe fallback
  }

  return {
    tariffStatus: 'provisional',
    cairoAndGizaFee: PROVISIONAL_DELIVERY_TARIFFS.cairoAndGiza,
    alexandriaFee: PROVISIONAL_DELIVERY_TARIFFS.alexandria,
    otherGovernoratesFee: PROVISIONAL_DELIVERY_TARIFFS.otherGovernorates,
    officePickupFee: PROVISIONAL_DELIVERY_TARIFFS.officePickupDefault,
    standardFallbackFee: PROVISIONAL_DELIVERY_TARIFFS.standardFallback,
    productionPolicy: 'allow_immediate_production',
    emailDispatchMode: 'deferred_review',
    changeLog: [],
  };
}

/**
 * Resolves the delivery tariff for an order based on delivery method, governorate, and active tariff schedule.
 */
export function resolveDeliveryTariff(params: {
  method: 'shipping' | 'pickup';
  governorate?: string;
  customFee?: number;
  schedule?: Partial<CommerceSettingsData>;
}): DeliveryTariffQuote {
  const { method, governorate, customFee, schedule } = params;

  const isProvisional = schedule?.tariffStatus !== 'owner_approved';
  const tariffScheduleStatus = isProvisional ? 'pending_owner_tariff_approval' : 'owner_approved';

  const pickupFee =
    typeof customFee === 'number' && customFee >= 0
      ? customFee
      : (schedule?.officePickupFee ?? PROVISIONAL_DELIVERY_TARIFFS.officePickupDefault);

  if (method === 'pickup') {
    return {
      method: 'pickup',
      amount: pickupFee,
      currency: 'EGP',
      isProvisional,
      tariffScheduleStatus,
      fulfillmentNoteAr: isProvisional
        ? pickupFee === 0
          ? 'استلام من مقر الوكالة (رسوم مبدئية: 0 ج.م - خاضعة لاعتماد الشروط والتعريفة النهائية طبقاً للبند D-015)'
          : `استلام من مقر الوكالة (رسوم مبدئية: ${pickupFee} ج.م - خاضعة لاعتماد المالك D-015)`
        : pickupFee === 0
          ? 'استلام من مقر الوكالة (مجاناً)'
          : `استلام من مقر الوكالة (${pickupFee} ج.م)`,
      fulfillmentNoteEn: isProvisional
        ? pickupFee === 0
          ? 'Office Pickup from MWHEBA Agency Office (Provisional: 0 EGP - Subject to owner terms & tariff approval per D-015)'
          : `Office Pickup (Provisional: ${pickupFee} EGP - Subject to owner tariff approval D-015)`
        : pickupFee === 0
          ? 'Office Pickup from MWHEBA Agency Office (Free)'
          : `Office Pickup from MWHEBA Agency Office (${pickupFee} EGP)`,
    };
  }

  // Standard Courier Shipping
  let amount: number = schedule?.standardFallbackFee ?? PROVISIONAL_DELIVERY_TARIFFS.standardFallback;

  if (typeof customFee === 'number' && customFee >= 0) {
    amount = customFee;
  } else if (governorate) {
    const govNorm = governorate.toLowerCase();
    if (
      govNorm.includes('القاهرة') ||
      govNorm.includes('cairo') ||
      govNorm.includes('الجيزة') ||
      govNorm.includes('giza')
    ) {
      amount = schedule?.cairoAndGizaFee ?? PROVISIONAL_DELIVERY_TARIFFS.cairoAndGiza;
    } else if (govNorm.includes('الإسكندرية') || govNorm.includes('alexandria')) {
      amount = schedule?.alexandriaFee ?? PROVISIONAL_DELIVERY_TARIFFS.alexandria;
    } else {
      amount = schedule?.otherGovernoratesFee ?? PROVISIONAL_DELIVERY_TARIFFS.otherGovernorates;
    }
  }

  return {
    method: 'shipping',
    amount,
    currency: 'EGP',
    isProvisional,
    governorate,
    tariffScheduleStatus,
    fulfillmentNoteAr: isProvisional
      ? `شحن وتوصيل لمقر الشركة (رسوم شحن تجريبية: ${amount} ج.م - خاضعة لاعتماد جدول أسعار الشحن النهائي)`
      : `شحن وتوصيل لمقر الشركة (${amount} ج.م)`,
    fulfillmentNoteEn: isProvisional
      ? `Corporate Courier Delivery (Illustrative test fee: ${amount} EGP - Subject to owner tariff sign-off)`
      : `Corporate Courier Delivery (${amount} EGP)`,
  };
}
