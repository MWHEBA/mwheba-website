import type { Block } from 'payload';

export const StatsBlock: Block = {
  slug: 'stats',
  labels: {
    singular: 'Milestones & Stats',
    plural: 'Milestones & Stats',
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
      name: 'stats',
      type: 'array',
      label: 'Metrics & Milestones',
      minRows: 1,
      fields: [
        {
          name: 'value',
          type: 'text',
          required: true,
          label: 'Metric Value (e.g. 500+ or 7+)',
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Metric Label (e.g. عميل وشركة رائدة)',
        },
        {
          name: 'description',
          type: 'text',
          label: 'Contextual Note',
        },
      ],
    },
  ],
};
