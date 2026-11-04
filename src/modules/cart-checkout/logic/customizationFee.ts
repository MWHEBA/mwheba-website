/**
 * Single source of truth for the customization (printing) fee rule (D-017).
 * A line is customized when it carries an artwork asset OR printing notes.
 * Every price calculation (cart summary, checkout quote, order creation, order hooks) MUST use these helpers.
 */

export interface CustomizableLine {
  artworkAssetId?: string | number | null;
  printingNotes?: string | null;
}

export function lineHasCustomization(line: CustomizableLine): boolean {
  return Boolean(line.artworkAssetId || (typeof line.printingNotes === 'string' && line.printingNotes.trim()));
}

export function customizationFeePerUnit(
  line: CustomizableLine,
  product: { customizationFee?: number | null }
): number {
  return lineHasCustomization(line) ? Number(product.customizationFee) || 0 : 0;
}
