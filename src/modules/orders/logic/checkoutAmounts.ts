import { toIntegerPiastres } from './orderSnapshotEngine';

function nonnegativePiastres(amount: number, name: string): number {
  const piastres = amount === 0 ? 0 : toIntegerPiastres(amount, name);
  if (!Number.isSafeInteger(piastres)) throw new Error(`INVALID_MONETARY_AMOUNT: ${name} is too large.`);
  return piastres;
}

export function priceCheckoutLine(unitPrice: number, customizationFee: number, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    throw new Error('INVALID_QUANTITY: Order quantities must be positive whole numbers.');
  }
  const subtotalPiastres = nonnegativePiastres(unitPrice, 'Unit price') * quantity;
  const customizationPiastres = nonnegativePiastres(customizationFee, 'Customization fee') * quantity;
  const totalPiastres = subtotalPiastres + customizationPiastres;
  if (!Number.isSafeInteger(totalPiastres)) {
    throw new Error('INVALID_MONETARY_AMOUNT: The line total exceeds the currency precision or range.');
  }

  return {
    subtotalPiastres,
    customizationPiastres,
    lineCustomizationFee: customizationPiastres / 100,
    lineTotal: totalPiastres / 100,
  };
}

export function calculateCheckoutAmounts(
  lines: readonly Pick<ReturnType<typeof priceCheckoutLine>, 'subtotalPiastres' | 'customizationPiastres'>[],
  shippingFee: number,
  taxAmount: number,
) {
  const subtotalPiastres = lines.reduce((sum, line) => sum + line.subtotalPiastres, 0);
  const customizationPiastres = lines.reduce((sum, line) => sum + line.customizationPiastres, 0);
  const shippingPiastres = nonnegativePiastres(shippingFee, 'Shipping fee');
  const taxPiastres = nonnegativePiastres(taxAmount, 'Tax amount');
  const grandTotalPiastres = subtotalPiastres + customizationPiastres
    + shippingPiastres + taxPiastres;
  if (!Number.isSafeInteger(grandTotalPiastres)) {
    throw new Error('INVALID_MONETARY_AMOUNT: The order total is too large.');
  }

  return {
    subtotal: subtotalPiastres / 100,
    totalCustomizationFees: customizationPiastres / 100,
    shippingFee: shippingPiastres / 100,
    taxAmount: taxPiastres / 100,
    grandTotal: grandTotalPiastres / 100,
    grandTotalPiastres,
  };
}
