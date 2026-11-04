import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const ArtworkAssets: CollectionConfig = {
  slug: 'artwork-assets',
  admin: {
    useAsTitle: 'originalFilename',
    defaultColumns: ['originalFilename', 'file', 'uploader', 'createdAt'],
  },
  access: {
    read: ({ req }) => {
      // Super admin, ops, and finance can view all; customers can only view their own
      if (hasRole(req.user, ['super_admin', 'operations', 'finance'])) {
        return true;
      }
      if (req.user) {
        return { uploader: { equals: req.user.id } };
      }
      return false;
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => {
      if (hasRole(req.user, ['super_admin', 'operations', 'finance'])) return true;
      if (req.user) {
        return { uploader: { equals: req.user.id } };
      }
      return false;
    },
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'storageKey',
      type: 'text',
      required: true,
      admin: {
        description: 'Private filesystem storage key (D-010).',
      },
    },
    {
      name: 'originalFilename',
      type: 'text',
      required: true,
    },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'fileSize',
      type: 'number',
    },
    {
      name: 'mimeType',
      type: 'text',
    },
    {
      name: 'verificationStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Valid', value: 'valid' },
        { label: 'Corrupt / Invalid', value: 'invalid' },
      ],
    },
    {
      name: 'dimensions',
      type: 'group',
      fields: [
        { name: 'widthMm', type: 'number' },
        { name: 'heightMm', type: 'number' },
      ],
    },
    {
      name: 'uploader',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'notes',
      type: 'textarea',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending_order',
      options: [
        { label: 'Pending Order', value: 'pending_order' },
        { label: 'Committed Order', value: 'committed_order' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        description: 'Lifecycle status of the artwork asset (pending_order until checkout freezes it).',
      },
    },
    {
      name: 'ownerSession',
      type: 'text',
      index: true,
      admin: {
        description: 'Signed session identifier or cart ID for guest session uploaders.',
      },
    },
    {
      name: 'cart',
      type: 'relationship',
      relationTo: 'carts',
      index: true,
      admin: {
        description: 'Linked active cart for line-level artwork association.',
      },
    },
    {
      name: 'lineItemId',
      type: 'text',
      admin: {
        description: 'Specific cart line item ID bound to this artwork file.',
      },
    },
    {
      name: 'sha256',
      type: 'text',
      admin: {
        description: 'Cryptographic SHA-256 checksum of the uploaded file.',
      },
    },
    {
      name: 'scanStatus',
      type: 'select',
      defaultValue: 'clean',
      options: [
        { label: 'Clean', value: 'clean' },
        { label: 'Flagged', value: 'flagged' },
        { label: 'Unscanned', value: 'unscanned' },
      ],
      admin: {
        description: 'Antivirus and malware content inspection scan status.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        if (operation === 'create' && req.user) {
          data.uploader = req.user.id;
        }

        // IMMUTABILITY DEFENSE: Prevent post-order modification of storageKey for assets bound to placed orders
        if (operation === 'update' && originalDoc) {
          const linkedOrders = await req.payload.find({
            collection: 'orders',
            where: {
              'items.artworkAssetId': { equals: String(originalDoc.id) },
            },
            limit: 1,
            req,
          });

          if (linkedOrders.totalDocs > 0) {
            if (data.storageKey && data.storageKey !== originalDoc.storageKey) {
              throw new Error('Immutable Asset Error: Cannot alter storageKey of an artwork asset bound to placed order(s).');
            }
          }
        }
        return data;
      },
    ],
  },
};
