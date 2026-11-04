/**
 * B2B-05: Fulfillment state machines.
 *
 * Physical (factory) lines and service (creative intake) lines are tracked on SEPARATE tracks with
 * their own statuses. Transitions are forward-only; there is no skipping and no regression.
 * Pure module: no I/O, safe to use from hooks, services and tests.
 */

export type FulfillmentTrack = 'physical' | 'service';

export const PHYSICAL_STATUSES = [
  'pending_artwork_approval',
  'queued',
  'in_printing',
  'quality_check',
  'ready_for_pickup',
  'shipped',
  'delivered',
] as const;

export const SERVICE_STATUSES = [
  'pending_brief',
  'brief_submitted',
  'in_progress',
  'review',
  'completed',
] as const;

export type PhysicalStatus = (typeof PHYSICAL_STATUSES)[number];
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type FulfillmentStatus = PhysicalStatus | ServiceStatus;

export type DeliveryMethod = 'shipping' | 'pickup';

/** Statuses that mean physical production (or later) has started. */
export const PRODUCTION_OR_LATER: readonly PhysicalStatus[] = [
  'in_printing',
  'quality_check',
  'ready_for_pickup',
  'shipped',
  'delivered',
];

export function trackOf(status: string): FulfillmentTrack | null {
  if ((PHYSICAL_STATUSES as readonly string[]).includes(status)) return 'physical';
  if ((SERVICE_STATUSES as readonly string[]).includes(status)) return 'service';
  return null;
}

export function initialStatus(params: { track: FulfillmentTrack; customized: boolean }): FulfillmentStatus {
  if (params.track === 'service') return 'pending_brief';
  return params.customized ? 'pending_artwork_approval' : 'queued';
}

/**
 * Allowed next statuses.
 * Physical: pending_artwork_approval -> queued is NOT an operator transition; only the customer's
 * proof approval (server engine) may perform it.
 * Service: pending_brief -> brief_submitted is NOT an operator transition; only the customer's brief
 * submission may perform it.
 */
export function allowedNext(params: {
  track: FulfillmentTrack;
  from: FulfillmentStatus;
  deliveryMethod: DeliveryMethod;
}): FulfillmentStatus[] {
  const { track, from, deliveryMethod } = params;
  if (track === 'physical') {
    switch (from) {
      case 'pending_artwork_approval':
        return ['queued'];
      case 'queued':
        return ['in_printing'];
      case 'in_printing':
        return ['quality_check'];
      case 'quality_check':
        return [deliveryMethod === 'pickup' ? 'ready_for_pickup' : 'shipped'];
      case 'ready_for_pickup':
        return ['delivered'];
      case 'shipped':
        return ['delivered'];
      default:
        return [];
    }
  }
  switch (from) {
    case 'pending_brief':
      return ['brief_submitted'];
    case 'brief_submitted':
      return ['in_progress'];
    case 'in_progress':
      return ['review'];
    case 'review':
      return ['in_progress', 'completed'];
    default:
      return [];
  }
}

/** Transitions only the system (customer proof approval / brief submission) may perform. */
export function isCustomerGatedTransition(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return (
    (from === 'pending_artwork_approval' && to === 'queued') ||
    (from === 'pending_brief' && to === 'brief_submitted')
  );
}

export type TransitionVerdict =
  | { ok: true }
  | { ok: false; code: string; message: string };

export function validateTransition(params: {
  track: FulfillmentTrack;
  from: FulfillmentStatus;
  to: FulfillmentStatus;
  deliveryMethod: DeliveryMethod;
  customized: boolean;
  proofApproved: boolean;
  actor: 'operator' | 'customer_engine';
}): TransitionVerdict {
  const { track, from, to, deliveryMethod, customized, proofApproved, actor } = params;

  if (trackOf(to) !== track) {
    return { ok: false, code: 'WRONG_TRACK', message: `Status '${to}' does not belong to the ${track} track.` };
  }

  if (!allowedNext({ track, from, deliveryMethod }).includes(to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Transition '${from}' -> '${to}' is not allowed on the ${track} track (delivery: ${deliveryMethod}).`,
    };
  }

  if (isCustomerGatedTransition(from, to) && actor !== 'customer_engine') {
    return {
      ok: false,
      code: 'CUSTOMER_APPROVAL_REQUIRED',
      message: `Transition '${from}' -> '${to}' can only be performed by the customer's own proof approval / brief submission.`,
    };
  }

  // Customized physical goods can never start production before the proof is approved.
  if (track === 'physical' && customized && (PRODUCTION_OR_LATER as readonly string[]).includes(to) && !proofApproved) {
    return {
      ok: false,
      code: 'PROOF_NOT_APPROVED',
      message: `Customized item cannot move to '${to}' before the customer approves the proof.`,
    };
  }

  return { ok: true };
}
