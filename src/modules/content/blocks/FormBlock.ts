import type { Block } from 'payload';

export const FormBlock: Block = {
  slug: 'formBlock',
  labels: {
    singular: 'Inquiry & Contact Form Block',
    plural: 'Inquiry & Contact Form Blocks',
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
      label: 'Form Description / Guidance',
    },
    {
      name: 'formType',
      type: 'select',
      defaultValue: 'general_contact',
      required: true,
      options: [
        { label: 'General Corporate Contact', value: 'general_contact' },
        { label: 'Brand & Platform Quotation', value: 'service_quote' },
        { label: 'Corporate Merchandise & Gifts Inquiry', value: 'merchandise_inquiry' },
      ],
    },
    {
      name: 'submitButtonLabel',
      type: 'text',
      label: 'Submit Button Label',
    },
  ],
};
