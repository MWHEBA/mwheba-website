import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const PaymentCollections: CollectionConfig = {
  slug: 'payment-collections',
  admin: {
    useAsTitle: 'receiptReference',
    defaultColumns: ['receiptReference', 'order', 'amount', 'collectorType', 'collectorName', 'remittanceStatus', 'collectedAt'],
    group: 'Finance',
    description: 'Individual cash collection records from couriers or agency office counter.',
  },
  access: {
    read: ({ req }) => hasRole(req.user, ['super_admin', 'finance', 'operations']),
    create: ({ req }) => hasRole(req.user, ['super_admin', 'finance', 'operations']),
    update: ({ req }) => hasRole(req.user, ['super_admin', 'finance']),
    delete: () => false, // Immutable audit trail
  },
  fields: [
    {
      name: 'receiptReference',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique collection receipt / courier tracking reference (e.g. REC-987654 or BST-AWB-12345)',
      },
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders' as any,
      required: true,
      admin: {
        description: 'Related customer order',
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Collected cash amount in EGP (must match order total)',
      },
    },
    {
      name: 'collectorType',
      type: 'select',
      required: true,
      options: [
        { label: 'Courier Delivery Partner', value: 'courier' },
        { label: 'MWHEBA Office Staff (Pickup)', value: 'office_staff' },
      ],
    },
    {
      name: 'collectorName',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the courier driver, delivery company, or office cashier',
      },
    },
    {
      name: 'collectedAt',
      type: 'date',
      required: true,
      admin: {
        description: 'Date and time the physical cash was handed over',
      },
    },
    {
      name: 'remittanceStatus',
      type: 'select',
      defaultValue: 'pending_remittance',
      options: [
        { label: 'Pending Remittance to Bank', value: 'pending_remittance' },
        { label: 'Remitted to Company Account', value: 'remitted_to_company' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'remittanceBatchId',
      type: 'text',
      admin: {
        description: 'Identifier of the bank remittance batch this collection belongs to',
      },
    },
    {
      name: 'recordedBy',
      type: 'relationship',
      relationTo: 'users' as any,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
};
