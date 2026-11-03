import type { Block } from 'payload';

export const ClientsLogoBlock: Block = {
  slug: 'clientsLogo',
  labels: {
    singular: 'Clients Logo Grid',
    plural: 'Clients Logo Grids',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      label: 'Section Eyebrow',
    },
    {
      name: 'title',
      type: 'text',
      label: 'Section Title',
    },
    {
      name: 'subtitle',
      type: 'textarea',
      label: 'Supporting Description',
    },
    {
      name: 'logos',
      type: 'array',
      label: 'Partner / Client Logos',
      minRows: 1,
      fields: [
        {
          name: 'clientName',
          type: 'text',
          required: true,
          label: 'Client Name',
        },
        {
          name: 'logoImage',
          type: 'upload',
          relationTo: 'media',
          label: 'Logo Mark (SVG or High-Res PNG)',
        },
        {
          name: 'websiteUrl',
          type: 'text',
          label: 'Website URL (Optional)',
        },
      ],
    },
  ],
};
