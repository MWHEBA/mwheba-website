import type { Block } from 'payload';

export const PortfolioShowcaseBlock: Block = {
  slug: 'portfolioShowcase',
  labels: {
    singular: 'Portfolio Showcase',
    plural: 'Portfolio Showcases',
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
      name: 'description',
      type: 'textarea',
      label: 'Section Narrative',
    },
    {
      name: 'projects',
      type: 'array',
      label: 'Featured Projects',
      minRows: 1,
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'Project Title',
        },
        {
          name: 'clientName',
          type: 'text',
          required: true,
          label: 'Client Name',
        },
        {
          name: 'category',
          type: 'text',
          label: 'Service Category (e.g. هوية تجارية / B2B Branding)',
        },
        {
          name: 'summary',
          type: 'textarea',
          label: 'Deliverables / Scope Summary',
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Showcase Visual',
        },
        {
          name: 'linkUrl',
          type: 'text',
          label: 'Case Study URL',
        },
      ],
    },
  ],
};
