import type { Block } from 'payload';

export const HeroBlock: Block = {
  slug: 'hero',
  labels: {
    singular: 'Hero Banner',
    plural: 'Hero Banners',
  },
  fields: [
    {
      name: 'badge',
      type: 'text',
      label: 'Badge / Eyebrow (e.g. وكالة متكاملة // منذ 2018)',
    },
    {
      name: 'headline',
      type: 'text',
      required: true,
      label: 'Main Headline',
    },
    {
      name: 'subtitle',
      type: 'textarea',
      label: 'Supporting Subtitle',
    },
    {
      name: 'primaryCta',
      type: 'group',
      label: 'Primary Call to Action',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Button Label',
        },
        {
          name: 'url',
          type: 'text',
          label: 'Destination URL',
        },
      ],
    },
    {
      name: 'secondaryCta',
      type: 'group',
      label: 'Secondary Call to Action',
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Button Label',
        },
        {
          name: 'url',
          type: 'text',
          label: 'Destination URL',
        },
      ],
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Background Visual (Optional, Flat Tone)',
    },
    {
      name: 'theme',
      type: 'select',
      defaultValue: 'light',
      options: [
        { label: 'Corporate Clean Light', value: 'light' },
        { label: 'Brand Petrol Dark', value: 'dark' },
        { label: 'Subtle Slate Neutral', value: 'muted' },
      ],
    },
  ],
};
