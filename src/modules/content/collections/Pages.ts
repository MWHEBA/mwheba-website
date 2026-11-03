import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';
import { pageBlocks } from '../blocks';
import { generatePreviewToken } from '../lib/previewTokens';

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: {
    singular: 'Page',
    plural: 'Pages',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    preview: (doc, { locale }) => {
      const slug = doc?.slug === 'home' ? '' : (doc?.slug as string) || '';
      const token = generatePreviewToken({ slug, locale });
      return `/api/preview?token=${token}&slug=${encodeURIComponent(slug)}&locale=${encodeURIComponent(locale)}`;
    },
  },
  versions: {
    drafts: true,
  },
  access: {
    read: ({ req }) => {
      if (hasRole(req.user, ['super_admin', 'marketer'])) {
        return true;
      }
      return {
        _status: {
          equals: 'published',
        },
      };
    },
    create: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    update: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      label: 'Page Title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'URL Slug (e.g. "home", "about", "services")',
      admin: {
        description: 'URL identifier for this page. Use "home" for the landing page.',
      },
    },
    {
      name: 'layout',
      type: 'blocks',
      localized: true,
      label: 'Page Content Blocks',
      blocks: pageBlocks,
      admin: {
        initCollapsed: true,
      },
    },
    {
      name: 'meta',
      type: 'group',
      label: 'SEO & Search Engine Metadata',
      fields: [
        {
          name: 'title',
          type: 'text',
          localized: true,
          label: 'Meta Title',
        },
        {
          name: 'description',
          type: 'textarea',
          localized: true,
          label: 'Meta Description',
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'OpenGraph Share Image',
        },
        {
          name: 'noIndex',
          type: 'checkbox',
          defaultValue: false,
          label: 'Prevent Search Engines from Indexing (noindex)',
        },
      ],
    },
  ],
};
