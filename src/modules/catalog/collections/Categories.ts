import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => hasRole(req.user, ['super_admin', 'catalog_manager']),
    update: ({ req }) => hasRole(req.user, ['super_admin', 'catalog_manager']),
    delete: ({ req }) => hasRole(req.user, ['super_admin', 'catalog_manager']),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
};
