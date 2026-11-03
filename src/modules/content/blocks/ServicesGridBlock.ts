import type { Block } from 'payload';

export const ServicesGridBlock: Block = {
  slug: 'servicesGrid',
  labels: {
    singular: 'Services Grid',
    plural: 'Services Grids',
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
      required: true,
      label: 'Section Title',
    },
    {
      name: 'subtitle',
      type: 'textarea',
      label: 'Section Description',
    },
    {
      name: 'services',
      type: 'array',
      label: 'Service Cards',
      minRows: 1,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Service Title',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'Short Description',
        },
        {
          name: 'icon',
          type: 'select',
          defaultValue: 'sparkles',
          options: [
            { label: 'Branding / Identity', value: 'palette' },
            { label: 'Digital / Platforms', value: 'code' },
            { label: 'Merchandise / Print', value: 'gift' },
            { label: 'Media / Studio', value: 'video' },
            { label: 'General / Sparkles', value: 'sparkles' },
          ],
        },
        {
          name: 'linkUrl',
          type: 'text',
          label: 'Learn More URL',
        },
      ],
    },
  ],
};
