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
      // Super admin and production ops can view all; finance has NO access to production files; customers only their own
      if (hasRole(req.user, ['super_admin', 'operations'])) {
        return true;
      }
      if (req.user) {
        return { uploader: { equals: req.user.id } };
      }
      return false;
    },
    // Creation restricted to trusted upload route (req.context.isTrustedUpload) or super_admin
    create: ({ req }) => {
      if (req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow) return true;
      return hasRole(req.user, ['super_admin']);
    },
    // Direct modification via Payload API is strictly restricted to operations, super_admin, or trusted order workflow
    // Customers can NEVER directly update artwork records (must not tamper with storageKey, scanStatus, etc.)
    update: ({ req }) => {
      if (req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow) return true;
      return hasRole(req.user, ['super_admin', 'operations']);
    },
    delete: ({ req }) => {
      if (req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow) return true;
      return hasRole(req.user, ['super_admin']);
    },
  },
  fields: [
    {
      name: 'storageKey',
      type: 'text',
      required: true,
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
      admin: {
        description: 'Private filesystem storage key (D-010).',
        readOnly: true,
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
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
    },
    {
      name: 'mimeType',
      type: 'text',
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
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
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow || hasRole(req.user, ['super_admin', 'operations'])),
      },
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
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow || hasRole(req.user, ['super_admin', 'operations'])),
      },
      admin: {
        description: 'Lifecycle status of the artwork asset (pending_order until checkout freezes it).',
      },
    },
    {
      name: 'ownerSession',
      type: 'text',
      index: true,
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
      admin: {
        description: 'Signed session identifier or cart ID for guest session uploaders.',
      },
    },
    {
      name: 'cart',
      type: 'relationship',
      relationTo: 'carts',
      index: true,
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
      admin: {
        description: 'Linked active cart for line-level artwork association.',
      },
    },
    {
      name: 'lineItemId',
      type: 'text',
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
      admin: {
        description: 'Specific cart line item ID bound to this artwork file.',
      },
    },
    {
      name: 'sha256',
      type: 'text',
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || hasRole(req.user, ['super_admin'])),
      },
      admin: {
        description: 'Cryptographic SHA-256 checksum of the uploaded file.',
      },
    },
    {
      name: 'scanStatus',
      type: 'select',
      defaultValue: 'unscanned',
      options: [
        { label: 'Unscanned', value: 'unscanned' },
        { label: 'Clean', value: 'clean' },
        { label: 'Flagged', value: 'flagged' },
      ],
      access: {
        create: ({ req }) => Boolean(req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow || hasRole(req.user, ['super_admin'])),
        update: ({ req }) => Boolean(req.context?.isTrustedUpload || req.context?.isTrustedOrderWorkflow || hasRole(req.user, ['super_admin', 'operations'])),
      },
      admin: {
        description: 'Antivirus and malware content inspection scan status.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        // Enforce pipeline security: direct writes must be trusted context or super_admin
        if (operation === 'create') {
          if (!req.context?.isTrustedUpload && !hasRole(req.user, ['super_admin'])) {
            throw new Error('Forbidden: Artwork assets must be created via the trusted upload endpoint.');
          }
          if (req.user) {
            data.uploader = req.user.id;
          }
        }

        // Direct updates must be trusted context or super_admin / operations
        if (operation === 'update') {
          if (!req.context?.isTrustedUpload && !req.context?.isTrustedOrderWorkflow && !hasRole(req.user, ['super_admin', 'operations'])) {
            throw new Error('Forbidden: Direct updates to artwork assets are restricted.');
          }

          // IMMUTABILITY DEFENSE: Prevent post-order modification of storageKey for assets bound to placed orders
          if (originalDoc) {
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
        }

        return data;
      },
    ],
  },
};
