import type { InventoryIssue } from '@/modules/inventory/services/inventoryService';
import type { Locale } from '@/shared/lib/i18n';

export function stockNotice(issue: InventoryIssue, locale: Locale) {
  if (issue.code === 'INVALID_QUANTITY') return locale === 'ar'
    ? 'أدخل كمية صحيحة بالوحدات.' : 'Enter a valid whole quantity.';
  if (!issue.available) return locale === 'ar'
    ? 'غير متاح حاليًا. احذفه من السلة أو اختر خيارًا آخر.'
    : 'Currently unavailable. Remove it from the cart or select another option.';
  const available = new Intl.NumberFormat(locale).format(issue.available);
  return locale === 'ar'
    ? `الكمية المتاحة ${available}. قلّل إجمالي كمية هذا الصنف في السلة.`
    : `Available quantity is ${available}. Reduce the total quantity of this item in your cart.`;
}
