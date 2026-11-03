import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  labels: {
    singular: 'Lead / Inquiry',
    plural: 'Inquiries & Leads',
  },
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'companyName', 'email', 'serviceInterest', 'status', 'emailDeliveryStatus', 'createdAt'],
  },
  access: {
    create: () => true,
    read: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    update: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
      label: 'Full Name',
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      label: 'Work Email',
    },
    {
      name: 'phone',
      type: 'text',
      required: true,
      label: 'Phone Number',
    },
    {
      name: 'companyName',
      type: 'text',
      label: 'Company Name',
    },
    {
      name: 'serviceInterest',
      type: 'select',
      required: true,
      defaultValue: 'general',
      options: [
        { label: 'Branding & Visual Identity', value: 'branding' },
        { label: 'Digital Marketing & Growth', value: 'marketing' },
        { label: 'Corporate Merchandise & Executive Gifts', value: 'merchandise' },
        { label: 'Media & Video Production', value: 'media' },
        { label: 'General Corporate Consultation', value: 'general' },
      ],
      label: 'Service Interest',
    },
    {
      name: 'estimatedBudget',
      type: 'select',
      options: [
        { label: 'Under 50,000 EGP', value: 'under_50k' },
        { label: '50,000 - 150,000 EGP', value: '50k_150k' },
        { label: '150,000 - 500,000 EGP', value: '150k_500k' },
        { label: 'Above 500,000 EGP', value: 'above_500k' },
        { label: 'Undisclosed / Discuss with team', value: 'undisclosed' },
      ],
      label: 'Estimated Budget',
    },
    {
      name: 'projectDetails',
      type: 'textarea',
      required: true,
      label: 'Project Details / Scope',
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'New Lead', value: 'new' },
        { label: 'In Review / In Progress', value: 'in_progress' },
        { label: 'Client Contacted', value: 'contacted' },
        { label: 'Closed / Converted', value: 'closed' },
        { label: 'Spam / Filtered', value: 'spam' },
      ],
      label: 'Lead Status',
    },
    {
      name: 'ipAddress',
      type: 'text',
      label: 'Submitter IP Address',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'emailDeliveryStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent Successfully', value: 'sent' },
        { label: 'Failed (Flagged for Retry)', value: 'failed' },
        { label: 'Requires Manual Follow-up', value: 'requires_manual_followup' },
        { label: 'Skipped (Review Mode Active)', value: 'skipped_review_mode' },
      ],
      label: 'Email Notification Status',
    },
    {
      name: 'emailDeliveryError',
      type: 'textarea',
      label: 'Email Delivery Error Log',
    },
    {
      name: 'emailDeliveryAttempts',
      type: 'number',
      defaultValue: 0,
      label: 'Delivery Attempts',
    },
    {
      name: 'emailDeliveredAt',
      type: 'date',
      label: 'Delivered At',
    },
    {
      name: 'emailRecipient',
      type: 'text',
      label: 'Notified Recipient',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Internal Sales Notes',
    },
  ],
};
