import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';
import {
  PHYSICAL_STATUSES,
  SERVICE_STATUSES,
  trackOf,
  validateTransition,
  type DeliveryMethod,
  type FulfillmentStatus,
  type FulfillmentTrack,
} from '../logic/stateMachine';

const ALL_STATUSES = Array.from(new Set<string>([...PHYSICAL_STATUSES, ...SERVICE_STATUSES]));

const IMMUTABLE_FIELDS = ['order', 'lineIndex', 'track', 'customized', 'artworkAssetId'] as const;

/**
 * One job per order line. Physical and service jobs have separate state machines (see stateMachine.ts).
 * Jobs are created ONLY by the order engine; status changes ONLY through the fulfillment service
 * (context.fulfillmentEngine), never by direct REST/admin edits.
 */
export const FulfillmentJobs: CollectionConfig = {
  slug: 'fulfillment-jobs',
  admin: {
    useAsTitle: 'productTitle',
    defaultColumns: ['productTitle', 'track', 'status', 'order', 'customized'],
    group: 'Operations',
    description: 'Per-line fulfillment tracking: factory production for physical goods, creative intake for services.',
  },
  access: {
    // Production (operations) sees physical jobs only; creative directors see service jobs only;
    // customers see their own order's jobs; finance and everyone else see none.
    read: ({ req }) => {
      if (hasRole(req.user, ['super_admin'])) return true;
      const clauses: any[] = [];
      if (hasRole(req.user, ['operations'])) clauses.push({ track: { equals: 'physical' } });
      if (hasRole(req.user, ['creative_director'])) clauses.push({ track: { equals: 'service' } });
      if (clauses.length > 0) return clauses.length === 1 ? clauses[0] : { or: clauses };
      if (req.user && !hasRole(req.user, ['finance', 'marketer', 'catalog_manager'])) {
        return { 'order.customer': { equals: req.user.id } };
      }
      return false;
    },
    create: () => false,
    update: ({ req }) => hasRole(req.user, ['super_admin', 'operations', 'creative_director']),
    delete: () => false,
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'lineIndex', type: 'number', required: true },
    {
      name: 'track',
      type: 'select',
      required: true,
      options: [
        { label: 'Physical Production', value: 'physical' },
        { label: 'Service Intake', value: 'service' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: ALL_STATUSES.map((value) => ({ label: value, value })),
    },
    { name: 'customized', type: 'checkbox', defaultValue: false },
    { name: 'artworkAssetId', type: 'text', admin: { description: 'Artwork asset reference (private file; use the signed link endpoint).' } },
    { name: 'productTitle', type: 'text' },
    { name: 'quantity', type: 'number' },
    { name: 'printingNotes', type: 'textarea' },
    {
      name: 'statusHistory',
      type: 'json',
      defaultValue: [],
      admin: { readOnly: true, description: 'Append-only transition log (server-recorded).' },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req, context }) => {
        if (operation === 'create') {
          if (!context?.fulfillmentEngine) {
            throw new Error('FULFILLMENT_JOB_CREATE_FORBIDDEN: Jobs are created only by the order engine.');
          }
          return data;
        }

        // Immutable identity fields
        for (const field of IMMUTABLE_FIELDS) {
          if (data[field] === undefined) continue;
          const nextVal = typeof data[field] === 'object' && data[field] !== null ? (data[field] as any).id : data[field];
          const prevVal = typeof originalDoc[field] === 'object' && originalDoc[field] !== null ? originalDoc[field].id : originalDoc[field];
          if (String(nextVal ?? '') !== String(prevVal ?? '')) {
            throw new Error(`FULFILLMENT_JOB_FIELD_IMMUTABLE: '${field}' cannot be modified.`);
          }
        }

        // History is server-written only (data carries the full document on update, so compare to the stored value)
        if (
          data.statusHistory !== undefined &&
          !context?.fulfillmentEngine &&
          JSON.stringify(data.statusHistory) !== JSON.stringify(originalDoc.statusHistory ?? [])
        ) {
          throw new Error('FULFILLMENT_HISTORY_READ_ONLY: statusHistory is recorded by the server.');
        }

        if (data.status !== undefined && data.status !== originalDoc.status) {
          if (!context?.fulfillmentEngine) {
            throw new Error(
              'FULFILLMENT_STATUS_ENGINE_ONLY: Job status can only change through the fulfillment service, not by direct edit.'
            );
          }
          const track = (originalDoc.track || trackOf(originalDoc.status)) as FulfillmentTrack;
          const orderId = typeof originalDoc.order === 'object' ? originalDoc.order.id : originalDoc.order;
          const order: any = await req.payload.findByID({ collection: 'orders', id: orderId, depth: 0, req });
          const verdict = validateTransition({
            track,
            from: originalDoc.status as FulfillmentStatus,
            to: data.status as FulfillmentStatus,
            deliveryMethod: (order.deliveryMethod || 'shipping') as DeliveryMethod,
            customized: Boolean(originalDoc.customized),
            proofApproved: order.proofStatus === 'proof_approved',
            actor: context?.fulfillmentActor === 'customer_engine' ? 'customer_engine' : 'operator',
          });
          if (!verdict.ok) {
            throw new Error(`${verdict.code}: ${verdict.message}`);
          }
        }
        return data;
      },
    ],
  },
};
