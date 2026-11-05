import type { CollectionConfig } from 'payload';
import path from 'node:path';
import { hasRole } from '../../identity/access/roles';

const defaultPrivateDir = path.resolve(process.cwd(), 'private-uploads');
const configuredDir = process.env.PRIVATE_UPLOAD_DIR || defaultPrivateDir;

if (
  process.env.NODE_ENV === 'production' &&
  (!path.isAbsolute(configuredDir) ||
    path.normalize(configuredDir).toLowerCase().split(path.sep).includes('public_html'))
) {
  throw new Error('PRIVATE_UPLOAD_DIR must be an absolute path outside public_html in production.');
}

export const privateUploadDir = path.resolve(/* turbopackIgnore: true */ configuredDir);

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: privateUploadDir,
    mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'application/pdf'],
  },
  access: {
    read: ({ req, isReadingStaticFile }): any => {
      if (isReadingStaticFile) return { mediaType: { equals: 'public' } };
      // Admins and production ops can view all media assets (finance excluded from private files)
      if (hasRole(req.user, ['super_admin', 'operations'])) {
        return true;
      }
      // Authenticated users can access public media OR their own uploaded media
      if (req.user) {
        return {
          or: [
            { mediaType: { equals: 'public' } },
            { uploader: { equals: req.user.id } },
          ],
        };
      }
      // Unauthenticated visitors can only view public media assets
      return { mediaType: { equals: 'public' } };
    },
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => {
      if (hasRole(req.user, ['super_admin'])) return true;
      if (req.user) {
        return { uploader: { equals: req.user.id } };
      }
      return false;
    },
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'mediaType',
      type: 'select',
      options: [
        { label: 'Public Asset', value: 'public' },
        { label: 'Customer Artwork', value: 'artwork' },
        { label: 'Bank Receipt', value: 'receipt' },
      ],
      defaultValue: 'artwork',
      required: true,
    },
    {
      name: 'uploader',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, operation, data }) => {
        if (operation === 'create' && req.user && !data.uploader) {
          data.uploader = req.user.id;
        }
        return data;
      },
    ],
  },
};
