import { APIError, type CollectionBeforeOperationHook, type Field } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const catalogSkuField: Field = {
  name: 'sku',
  type: 'text',
  maxLength: 128,
  admin: {
    description: 'Stock keeping unit. Use a distinct value across products and variants.',
  },
  hooks: {
    beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() || null : value)],
  },
};

export const protectCatalogHistory: CollectionBeforeOperationHook = ({ args, operation, overrideAccess, req }) => {
  if (overrideAccess || hasRole(req.user, ['super_admin']) || !hasRole(req.user, ['catalog_manager'])) return;

  if (operation === 'restoreVersion') {
    throw new APIError('Only a super admin can restore a catalog version.', 403, undefined, true);
  }
  if ((operation === 'update' && args.trash) ||
      ((operation === 'create' || operation === 'update') && args.data?.deletedAt != null)) {
    throw new APIError('Only a super admin can manage catalog trash.', 403, undefined, true);
  }
};

export function useMajorEgpField(field: Field): Field {
  if (field.type === 'group' || field.type === 'row') {
    return { ...field, fields: field.fields.map(useMajorEgpField) };
  }
  if (field.type !== 'number' || field.name !== 'priceInEGP') return field;

  // Ecommerce's widgets scale to minor units. This catalog stores prices in EGP.
  return {
    ...field,
    min: 0,
    admin: { ...field.admin, components: undefined, description: 'Unit price in EGP, e.g. 125.50.' },
  };
}
