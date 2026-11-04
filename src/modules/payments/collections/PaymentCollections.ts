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
    // Direct creation via Admin UI or REST API is strictly prohibited.
    // Must be recorded through the authorized recordCodCollection settlement engine.
    create: ({ req }) => Boolean(req.context?.isCodCollectionEngine || req.context?.isSystemSeed),
    // Direct modification via Admin UI or REST API is strictly prohibited.
    // Can only be updated through the authorized courier remittance engine.
    update: ({ req }) => Boolean(req.context?.isCourierRemittanceEngine || req.context?.isSystemSeed),
    delete: () => false, // Immutable audit trail
  },
  hooks: {
    beforeValidate: [
      async ({ data, req, operation, originalDoc, context }: any) => {
        if (!data) return data;

        const isCollectionEngine = Boolean(
          context?.isCodCollectionEngine ||
          req?.context?.isCodCollectionEngine ||
          context?.isSystemSeed ||
          req?.context?.isSystemSeed
        );

        if (operation === 'create' && !isCollectionEngine) {
          throw new Error(
            'DIRECT_COLLECTION_CREATION_FORBIDDEN: Direct manual creation of payment collections via Admin/API is strictly prohibited. Collections must be recorded through the authorized recordCodCollection settlement engine.'
          );
        }

        const isRemittanceEngine = Boolean(
          context?.isCourierRemittanceEngine ||
          req?.context?.isCourierRemittanceEngine ||
          context?.isSystemSeed ||
          req?.context?.isSystemSeed
        );

        if (operation === 'update') {
          if (!isRemittanceEngine) {
            throw new Error(
              'DIRECT_COLLECTION_MUTATION_FORBIDDEN: Direct manual modification of payment collections via Admin/API is strictly prohibited. Collections can only be updated through the authorized courier remittance engine.'
            );
          }

          if (originalDoc) {
            if (data.amount !== undefined && Number(data.amount) !== Number(originalDoc.amount)) {
              throw new Error(
                'COLLECTION_AMOUNT_IMMUTABLE: Modifying collected cash amount on an existing collection record is strictly prohibited.'
              );
            }
            if (data.order !== undefined) {
              const origOrderId =
                typeof originalDoc.order === 'object' && originalDoc.order !== null
                  ? originalDoc.order.id
                  : originalDoc.order;
              const newOrderId =
                typeof data.order === 'object' && data.order !== null
                  ? data.order.id
                  : data.order;
              if (String(origOrderId) !== String(newOrderId)) {
                throw new Error(
                  'COLLECTION_ORDER_IMMUTABLE: Re-assigning collection to a different order is strictly prohibited.'
                );
              }
            }
            if (data.receiptReference !== undefined && data.receiptReference !== originalDoc.receiptReference) {
              throw new Error(
                'COLLECTION_RECEIPT_IMMUTABLE: Modifying receiptReference on an existing collection is strictly prohibited.'
              );
            }
          }
        }

        return data;
      },
    ],
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
