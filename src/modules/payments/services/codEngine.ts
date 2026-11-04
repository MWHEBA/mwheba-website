/**
 * MWHEBA 2.0 Cash on Delivery (COD) Engine
 *
 * Core Financial Invariants (DECISIONS.md D-007, D-021, D-022 & PAY-01 / PAY-02):
 * 1. Scope: COD is available STRICTLY for 100% physical merchandise.
 * 2. Exclusions: Pure digital services and mixed carts cannot use COD (HTTP 422).
 * 3. Lifecycle Decoupling: Placing a COD order sets orderStatus = 'confirmed', paymentStatus = 'unpaid',
 *    and remittanceStatus = 'pending_collection'.
 * 4. Fulfillment Protection: Advancing fulfillment (shipped, delivered, ready_for_pickup) NEVER marks
 *    paymentStatus as paid. Payment is only recognized upon explicit cash collection settlement.
 * 5. Settlement: Collection recording and courier remittance reconciliation with exact piastre matching
 *    and idempotency (PAY-02).
 */

export interface CodEligibilityVerdict {
  eligible: boolean;
  code?: 'COD_PROHIBITED_FOR_DIGITAL' | 'COD_PROHIBITED_FOR_MIXED_CART';
  message?: string;
}

/**
 * Validates whether a set of items can be checked out using Cash on Delivery.
 * Enforces Decision D-021: COD restricted strictly to physical merchandise.
 */
export function validateCodEligibility(
  items: Array<{ itemType?: string }>
): CodEligibilityVerdict {
  const hasPhysical = items.some((i) => i.itemType === 'physical');
  const hasService = items.some((i) => i.itemType === 'service' || i.itemType === 'fixed_service');

  if (hasService && !hasPhysical) {
    return {
      eligible: false,
      code: 'COD_PROHIBITED_FOR_DIGITAL',
      message:
        'Cash on Delivery is strictly prohibited for service packages and digital deliverables. Please use Corporate Bank Transfer.',
    };
  }

  if (hasService && hasPhysical) {
    return {
      eligible: false,
      code: 'COD_PROHIBITED_FOR_MIXED_CART',
      message:
        'Mixed carts containing digital services cannot use Cash on Delivery. Please use Corporate Bank Transfer or checkout separately.',
    };
  }

  return { eligible: true };
}

// Re-export collection, refusal, and remittance services (PAY-02)
export * from './codSettlementService';
