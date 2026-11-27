import type { CollectionConfig } from 'payload';
import { isCatalogManager } from '../../identity/access/roles';
import { catalogSkuField, protectCatalogHistory, useMajorEgpField } from './catalogFields';

export const variantsCollectionOverride = ({
  defaultCollection,
}: {
  defaultCollection: CollectionConfig;
}): CollectionConfig => ({
  ...defaultCollection,
  access: {
    ...defaultCollection.access,
    create: isCatalogManager,
    update: isCatalogManager,
  },
  admin: {
    ...defaultCollection.admin,
    defaultColumns: ['title', 'sku', 'product', 'options', 'priceInEGP', '_status'],
  },
  fields: [catalogSkuField, ...defaultCollection.fields.map(useMajorEgpField)],
  hooks: {
    ...defaultCollection.hooks,
    beforeOperation: [...(defaultCollection.hooks?.beforeOperation ?? []), protectCatalogHistory],
  },
});
