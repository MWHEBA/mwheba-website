import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

/**
 * Customer-submitted creative brief for a service line. Append-only: created by the brief service only.
 * Customers read their own briefs; operations/super_admin read all.
 */
export const ServiceBriefs: CollectionConfig = {
  slug: 'service-briefs',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['order', 'job', 'customer', 'submittedAt', 'notificationStatus'],
    group: 'Operations',
    description: 'Creative brief intake for fixed-price service packages (D-003).',
  },
  access: {
    read: ({ req }) => {
      if (hasRole(req.user, ['super_admin', 'creative_director'])) return true;
      if (req.user && !hasRole(req.user, ['operations', 'finance', 'marketer', 'catalog_manager'])) {
        return { customer: { equals: req.user.id } };
      }
      return false;
    },
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'job', type: 'relationship', relationTo: 'fulfillment-jobs', required: true, unique: true, index: true },
    { name: 'customer', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'answers',
      type: 'json',
      required: true,
      admin: { description: 'Agency questions: targetAudience, brandValues, existingGuidelines, notes.' },
    },
    {
      name: 'attachmentAssetIds',
      type: 'json',
      defaultValue: [],
      admin: { description: 'Reference material stored as private artwork-assets (never public).' },
    },
    { name: 'submittedAt', type: 'date', required: true },
    {
      name: 'notificationStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending - NOT delivered (outbox work item)', value: 'pending' },
        { label: 'Delivered', value: 'sent' },
        { label: 'Delivery failed', value: 'failed' },
      ],
      admin: {
        description:
          'Creative-director notification outbox. "pending" is an outstanding work item, NOT evidence of delivery. No transport is wired yet (real email deferred by owner decision), so nothing sets "sent".',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ operation, context }) => {
        if (operation === 'create' && !context?.fulfillmentEngine) {
          throw new Error('SERVICE_BRIEF_CREATE_FORBIDDEN: Briefs are created only through the brief submission service.');
        }
      },
    ],
  },
};
