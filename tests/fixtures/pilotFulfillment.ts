import type { Payload } from 'payload';
import type { CheckoutQuote } from '@/modules/orders/services/checkoutQuote';

// Synthetic configuration for the migrated test database. These terms have no merchant approval.
export const testPilotFulfillment = {
  status: 'owner_approved',
  reference: 'test-fixture-v1',
  delivery: [
    { regionCode: 'EG-C', amount: 80, codAllowed: true },
    { regionCode: 'EG-GZ', amount: 80, codAllowed: true },
    { regionCode: 'EG-ALX', amount: 90, codAllowed: true },
  ],
  pickup: {
    id: 'test-office',
    amount: 0,
    codAllowed: true,
    label: { ar: 'استلام تجريبي', en: 'Test pickup' },
    address: { ar: 'عنوان تجريبي', en: 'Test pickup address' },
    instructions: { ar: 'شروط تجريبية', en: 'Test pickup terms' },
  },
} as const;

type FixtureRate = { regionCode: string; amount: number; codAllowed: boolean };

export const testBankTransfer = {
  bankDetailsStatus: 'active',
  bankName: 'Synthetic Test Bank',
  accountName: 'Synthetic Checkout Fixture',
  accountNumber: '0000000000',
} as const;

export function confirmedTestDelivery(quote: Pick<CheckoutQuote, 'fulfillment'>) {
  const selected = quote.fulfillment.selected;
  return selected ? {
    optionId: selected.id,
    expectedFulfillmentConfirmation: selected.confirmation,
  } : {};
}

export async function setTestPilotFulfillment(
  payload: Payload,
  { additionalRates = [], bankTransfer = false, courierRemittanceEnabled = false }: {
    additionalRates?: FixtureRate[];
    bankTransfer?: boolean;
    courierRemittanceEnabled?: boolean;
  } = {},
) {
  const previous = await payload.findGlobal({ slug: 'commerce-settings', depth: 0 });
  await payload.updateGlobal({
    slug: 'commerce-settings',
    data: {
      pilotFulfillment: {
        ...testPilotFulfillment,
        delivery: [...testPilotFulfillment.delivery, ...additionalRates],
        courierRemittanceEnabled,
      },
      ...(bankTransfer ? testBankTransfer : {}),
    },
  });
  return async () => {
    await payload.updateGlobal({
      slug: 'commerce-settings',
      data: {
        pilotFulfillment: previous.pilotFulfillment ?? null,
        ...(bankTransfer ? {
          bankDetailsStatus: previous.bankDetailsStatus ?? 'pending_configuration',
          bankName: previous.bankName ?? null,
          accountName: previous.accountName ?? null,
          accountNumber: previous.accountNumber ?? null,
        } : {}),
      },
    });
  };
}
