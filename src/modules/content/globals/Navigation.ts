import type { GlobalConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const Navigation: GlobalConfig = {
  slug: 'navigation',
  label: 'Navigation & Menus',
  access: {
    read: () => true,
    update: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
  },
  fields: [
    {
      name: 'headerMenu',
      type: 'array',
      label: 'Main Header Navigation',
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
          label: 'Menu Label',
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'Destination URL (e.g. /store, /services)',
        },
        {
          name: 'openInNewTab',
          type: 'checkbox',
          defaultValue: false,
          label: 'Open in new tab',
        },
      ],
    },
    {
      name: 'footerColumns',
      type: 'array',
      label: 'Footer Columns',
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          localized: true,
          label: 'Column Title',
        },
        {
          name: 'links',
          type: 'array',
          label: 'Column Links',
          fields: [
            {
              name: 'label',
              type: 'text',
              required: true,
              localized: true,
              label: 'Link Label',
            },
            {
              name: 'url',
              type: 'text',
              required: true,
              label: 'Destination URL',
            },
          ],
        },
      ],
    },
  ],
};
