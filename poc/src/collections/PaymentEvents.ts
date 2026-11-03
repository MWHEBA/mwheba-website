import type { CollectionConfig } from 'payload';

export const PaymentEvents: CollectionConfig = {
  slug: 'payment-events',
  admin: {
    useAsTitle: 'providerEventId',
    defaultColumns: ['providerEventId', 'providerTransactionId', 'provider', 'status', 'createdAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user?.roles?.includes('admin') || req.user?.roles?.includes('finance')),
    create: ({ req }) => Boolean(req.user?.roles?.includes('admin') || req.context?.isSystem),
    update: ({ req }) => Boolean(req.user?.roles?.includes('admin') || req.context?.isSystem),
    delete: ({ req }) => Boolean(req.user?.roles?.includes('admin')),
  },
  fields: [
    {
      name: 'provider',
      type: 'text',
      defaultValue: 'paymob',
      required: true,
    },
    {
      name: 'providerEventId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Deduplication key: ${obj.id}_${obj.success}_${obj.pending}_${obj.txn_response_code}',
      },
    },
    {
      name: 'providerTransactionId',
      type: 'text',
      required: true,
      admin: {
        description: 'Paymob gateway transaction ID (obj.id)',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'processing',
      options: [
        { label: 'Processing', value: 'processing' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Duplicate', value: 'duplicate' },
      ],
      required: true,
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
    },
    {
      name: 'lockedAt',
      type: 'date',
    },
    {
      name: 'completedAt',
      type: 'date',
    },
    {
      name: 'eventData',
      type: 'json',
    },
  ],
};
