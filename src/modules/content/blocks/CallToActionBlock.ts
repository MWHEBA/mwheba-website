import type { Block } from 'payload';

export const CallToActionBlock: Block = {
  slug: 'cta',
  labels: {
    singular: 'Call to Action Banner',
    plural: 'Call to Action Banners',
  },
  fields: [
    {
      name: 'eyebrow',
      type: 'text',
      label: 'Eyebrow',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Main Heading',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Body Description',
    },
    {
      name: 'primaryCta',
      type: 'group',
      label: 'Primary Button',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Label',
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
        },
      ],
    },
    {
      name: 'secondaryCta',
      type: 'group',
      label: 'Secondary Button',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Label',
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
        },
      ],
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'dark',
      options: [
        { label: 'Brand Petrol Dark (Default)', value: 'dark' },
        { label: 'Clean Surface Light', value: 'light' },
        { label: 'Muted Subtle', value: 'muted' },
      ],
    },
  ],
};
