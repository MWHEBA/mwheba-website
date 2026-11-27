import type { CollectionConfig } from 'payload';
import { isCatalogManager } from '../../identity/access/roles';
import { preventReferencedTermDeletion, readTaxonomy, taxonomyActiveField, taxonomySlugField } from './taxonomy';

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'isActive', 'updatedAt'],
  },
  access: {
    read: readTaxonomy,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: {
    beforeDelete: [preventReferencedTermDeletion('category')],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    taxonomySlugField,
    {
      name: 'description',
      type: 'textarea',
    },
    taxonomyActiveField,
  ],
};
