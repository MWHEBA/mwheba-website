import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const PaymentAttempts: CollectionConfig = {
  slug: 'payment-attempts',
  admin: {
    useAsTitle: 'providerTransactionId',
    defaultColumns: ['order', 'attemptNumber', 'amountCents', 'status', 'isActiveAttempt', 'createdAt'],
  },
  access: {
    read: ({ req }) => {
      if (hasRole(req.user, ['super_admin', 'finance'])) return true;
      if (req.user) return { customer: { equals: req.user.id } };
      return false;
    },
    create: ({ req }) => Boolean(hasRole(req.user, ['super_admin']) || req.context?.isSystem),
    update: ({ req }) => Boolean(hasRole(req.user, ['super_admin']) || req.context?.isSystem),
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
    },
    {
      name: 'attemptNumber',
      type: 'number',
      defaultValue: 1,
      required: true,
    },
    {
      name: 'amountCents',
      type: 'number',
      required: true,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'EGP',
      required: true,
    },
    {
      name: 'provider',
      type: 'text',
      defaultValue: 'paymob',
      required: true,
    },
    {
      name: 'gatewayOrderId',
      type: 'text',
      admin: {
        description: 'Authenticated gateway order reference (e.g. Paymob order.id) established when payment session was registered.',
      },
    },
    {
      name: 'providerTransactionId',
      type: 'text',
      index: true,
    },
    {
      name: 'providerTxnKey',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Compound unique key `${provider}_${providerTransactionId}` preventing duplicate attempt records for the same gateway transaction.',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Initiated', value: 'initiated' },
        { label: 'Pending', value: 'pending' },
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Succeeded (Duplicate / Overpayment)', value: 'succeeded_duplicate' },
        { label: 'Failed', value: 'failed' },
        { label: 'Amount Mismatch (Fraud Frozen)', value: 'amount_mismatch' },
        { label: 'Currency Mismatch', value: 'currency_mismatch' },
      ],
      required: true,
    },
    {
      name: 'isActiveAttempt',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this attempt is the currently active payment session for the order.',
      },
    },
    {
      name: 'failureReason',
      type: 'text',
    },
    {
      name: 'metadata',
      type: 'json',
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }: any) => {
        if (originalDoc && (originalDoc.status === 'succeeded' || originalDoc.status === 'succeeded_duplicate')) {
          if (
            data &&
            data.providerTransactionId &&
            originalDoc.providerTransactionId &&
            String(data.providerTransactionId) !== String(originalDoc.providerTransactionId)
          ) {
            throw new Error(
              `Payment Immutability Violation: Cannot overwrite providerTransactionId (${originalDoc.providerTransactionId} -> ${data.providerTransactionId}) of already collected attempt #${originalDoc.id}`
            );
          }
        }
        if (data && data.provider && data.providerTransactionId) {
          data.providerTxnKey = `${data.provider}_${data.providerTransactionId}`;
        }
        return data;
      },
    ],
  },
};
