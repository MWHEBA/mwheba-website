import { APIError, type Access, type CheckboxField, type CollectionBeforeDeleteHook, type TextField } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const readTaxonomy: Access = ({ req }) =>
  hasRole(req.user, ['super_admin', 'catalog_manager']) || { isActive: { equals: true } };

export const taxonomySlugField: TextField = {
  name: 'slug',
  type: 'text',
  required: true,
  unique: true,
  index: true,
  access: { update: () => false },
  admin: { description: 'Used in storefront links and set when the term is created.' },
};

export const taxonomyActiveField: CheckboxField = {
  name: 'isActive',
  type: 'checkbox',
  defaultValue: true,
  validate: (value: unknown) => typeof value === 'boolean' || 'Choose active or archived.',
  admin: {
    description: 'Clear this to archive the term and hide it from storefront filters.',
  },
};

export function preventReferencedTermDeletion(field: 'category' | 'tags'): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const products = await req.payload.find({
      collection: 'products',
      where: { [field]: { equals: id } },
      select: { slug: true },
      depth: 0,
      limit: 1,
      overrideAccess: true,
      trash: true,
      req,
    });
    if (!products.docs.length) {
      const versions = await req.payload.findVersions({
        collection: 'products',
        where: { [`version.${field}`]: { equals: id } },
        select: { id: true },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        trash: true,
        req,
      });
      if (!versions.docs.length) return;
    }

    throw new APIError('This term is used by a product or product revision. Archive it instead.', 409, undefined, true);
  };
}
