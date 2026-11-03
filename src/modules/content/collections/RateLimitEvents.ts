import type { CollectionConfig } from 'payload';

export const RateLimitEvents: CollectionConfig = {
  slug: 'rate-limit-events',
  admin: {
    hidden: true,
  },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      index: true,
    },
  ],
};
