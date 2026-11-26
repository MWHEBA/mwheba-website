import type { CollectionConfig } from 'payload';
import { isCatalogManager } from '../../identity/access/roles';
import { preventReferencedTermDeletion, readTaxonomy, taxonomyActiveField, taxonomySlugField } from './taxonomy';

export const ProductTags: CollectionConfig = {
  slug: 'product-tags',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'isActive', 'updatedAt'],
    group: 'Ecommerce',
  },
  access: {
    read: readTaxonomy,
    create: isCatalogManager,
    update: isCatalogManager,
    delete: isCatalogManager,
  },
  hooks: {
    beforeDelete: [preventReferencedTermDeletion('tags')],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      required: true,
    },
    {
      ...taxonomySlugField,
      validate: (value: unknown) =>
        (typeof value === 'string' && value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) ||
        'Use up to 100 lowercase ASCII letters or digits separated by single hyphens.',
    },
    taxonomyActiveField,
  ],
};
