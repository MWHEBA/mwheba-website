import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const CourierRemittances: CollectionConfig = {
  slug: 'courier-remittances',
  admin: {
    useAsTitle: 'batchId',
    defaultColumns: ['batchId', 'courierCompany', 'grossCollectedAmount', 'netDepositAmount', 'status', 'depositDate'],
    group: 'Finance',
    description: 'Reconciled courier cash collection remittance batches deposited into MWHEBA bank account.',
  },
  access: {
    read: ({ req }) => hasRole(req.user, ['super_admin', 'finance']),
    create: ({ req }) => hasRole(req.user, ['super_admin', 'finance']),
    update: ({ req }) => hasRole(req.user, ['super_admin', 'finance']),
    delete: () => false, // Financial batches are append-only / immutable
  },
  fields: [
    {
      name: 'batchId',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Unique remittance settlement batch ID (e.g. REM-2026-001)',
      },
    },
    {
      name: 'courierCompany',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the courier or delivery company (e.g. Bosta, Aramex, Internal Fleet)',
      },
    },
    {
      name: 'grossCollectedAmount',
      type: 'number',
      required: true,
      admin: {
        description: 'Exact gross total collected by the courier from customers for all orders in this batch.',
      },
    },
    {
      name: 'courierFeeDeductions',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Shipping, handling, and delivery fees retained by the courier partner.',
      },
    },
    {
      name: 'otherDeductions',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Other authorized deductions (e.g., return fees, bank wire transfer fees).',
      },
    },
    {
      name: 'netDepositAmount',
      type: 'number',
      required: true,
      admin: {
        description: 'Actual net cash deposited into MWHEBA corporate bank account.',
      },
    },
    {
      name: 'depositSlipReference',
      type: 'text',
      required: true,
      admin: {
        description: 'Bank deposit transaction reference or wire confirmation receipt number.',
      },
    },
    {
      name: 'depositDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date the funds were credited to MWHEBA bank account.',
      },
    },
    {
      name: 'orders',
      type: 'relationship',
      relationTo: 'orders' as any,
      hasMany: true,
      admin: {
        description: 'Orders included in this remittance batch.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'reconciled',
      options: [
        { label: 'Reconciled', value: 'reconciled' },
        { label: 'Discrepancy / Variance Hold', value: 'discrepancy' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'varianceApproved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Check if an authorized financial difference between gross and net was accepted.',
      },
    },
    {
      name: 'varianceNotes',
      type: 'textarea',
      admin: {
        description: 'Mandatory documentation explaining any discrepancy between deposit and expected net.',
      },
    },
    {
      name: 'reconciledBy',
      type: 'relationship',
      relationTo: 'users' as any,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
};
