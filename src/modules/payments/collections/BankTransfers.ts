import type { CollectionConfig } from 'payload';
import { toIntegerPiastres } from '../../orders/logic/orderSnapshotEngine';
import { hasRole } from '../../identity/access/roles';

// Global in-process mutex to serialize concurrent approvals with the same reconciliation code
const reconciliationCodeMutexes = new Map<string, Promise<void>>();

export const BankTransfers: CollectionConfig = {
  slug: 'bank-transfers',
  admin: {
    useAsTitle: 'bankReferenceCode',
    defaultColumns: ['bankReferenceCode', 'order', 'claimedAmount', 'status', 'verifiedAt'],
  },
  access: {
    read: ({ req }) => {
      // Finance and super_admin have global read access
      if (hasRole(req.user, ['super_admin', 'finance'])) {
        return true;
      }
      // Authenticated users can only read transfers they submitted
      if (req.user) {
        return { submittedBy: { equals: req.user.id } };
      }
      return false;
    },
    create: ({ req }) => Boolean(req.user), // Customers submit at checkout
    update: ({ req }) => {
      // Only authorized finance or super_admin can approve / reject bank transfers
      return hasRole(req.user, ['super_admin', 'finance']);
    },
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
      name: 'submittedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      name: 'receiptFile',
      type: 'relationship',
      relationTo: 'media',
      required: false,
    },
    {
      name: 'receiptStorageKey',
      type: 'text',
      admin: {
        description: 'Object storage key for uploaded bank deposit receipt slip.',
      },
    },
    {
      name: 'claimedAmount',
      type: 'number',
      required: true,
    },
    {
      name: 'confirmedAmount',
      type: 'number',
      admin: {
        description: 'Actual confirmed deposit amount credited to the MWHEBA bank account as shown on the official bank statement.',
      },
    },
    {
      name: 'bankReferenceCode',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending_verification',
      options: [
        { label: 'Pending Verification', value: 'pending_verification' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      required: true,
    },
    {
      name: 'internalReconciliationCode',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Internal bank statement reconciliation code entered by finance officer upon verification. Each deposit can only be reconciled once.',
      },
    },
    {
      name: 'verifiedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'verifiedAt',
      type: 'date',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'rejectionReason',
      type: 'textarea',
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ req, id }: any) => {
        const transfer = await req.payload.findByID({
          collection: 'bank-transfers',
          id,
          req,
        });

        if (transfer?.status === 'approved') {
          throw new Error(
            'BANK_TRANSFER_DELETION_FORBIDDEN_AFTER_APPROVAL: Approved bank transfer records cannot be deleted. They form an immutable financial audit trail.'
          );
        }
      },
    ],
    beforeChange: [
      async ({ req, operation, data, originalDoc }: any) => {
        if (operation === 'create') {
          // STRICT SECURITY:
          // 1. Force submittedBy to authenticated user (never trust client payload or customer input)
          if (!req.user) {
            throw new Error('UNAUTHORIZED: Authentication is required to submit a bank transfer.');
          }
          data.submittedBy = req.user.id;

          // 2. Force initial status to pending_verification and strip privileged verification fields
          data.status = 'pending_verification';
          delete data.internalReconciliationCode;
          delete data.confirmedAmount;
          delete data.verifiedBy;
          delete data.verifiedAt;

          // 3. Validate linked order exists
          const orderId =
            typeof data.order === 'object' && data.order !== null ? data.order.id : data.order;
          if (!orderId) {
            throw new Error('LINKED_ORDER_REQUIRED: Bank transfer submission must be linked to a valid order.');
          }

          const linkedOrder = await req.payload.findByID({
            collection: 'orders',
            id: orderId,
            req,
          });

          if (!linkedOrder) {
            throw new Error(`ORDER_NOT_FOUND: Linked order #${orderId} does not exist.`);
          }

          // 4. Verify order payment method is strictly 'bank_transfer'
          if (linkedOrder.paymentMethod !== 'bank_transfer') {
            throw new Error(
              `INVALID_ORDER_PAYMENT_METHOD: Cannot submit bank transfer for order #${orderId} with payment method '${linkedOrder.paymentMethod}'. Only 'bank_transfer' orders accept bank receipts.`
            );
          }

          // 5. Verify order is not already paid
          if (linkedOrder.paymentStatus === 'paid') {
            throw new Error(
              `ORDER_ALREADY_PAID: Cannot submit bank transfer for order #${orderId} because it is already paid.`
            );
          }

          // 6. Verify order ownership: customer submitting must own the order (unless super_admin/finance)
          const isPrivileged = hasRole(req.user, ['super_admin', 'finance']);
          const orderCustomerId =
            typeof linkedOrder.customer === 'object' && linkedOrder.customer !== null
              ? linkedOrder.customer.id
              : linkedOrder.customer;

          if (!isPrivileged && String(orderCustomerId) !== String(req.user.id)) {
            throw new Error(
              'ORDER_OWNERSHIP_MISMATCH: Forbidden: You cannot submit a bank transfer for an order that belongs to another customer.'
            );
          }

          // 7. Validate claimedAmount if provided
          if (data.claimedAmount !== undefined) {
            toIntegerPiastres(Number(data.claimedAmount), 'Claimed deposit amount');
          }
        }

        if (operation === 'update') {
          // Once approved, the bank transfer record is permanently immutable
          if (originalDoc?.status === 'approved') {
            throw new Error(
              'BANK_TRANSFER_IMMUTABLE_AFTER_APPROVAL: Approved bank transfer records are immutable and cannot be updated, modified, or re-assigned.'
            );
          }

          // Strictly enforce RBAC for finance verification
          const isFinanceUser = hasRole(req.user, ['super_admin', 'finance']);
          if (!isFinanceUser) {
            throw new Error('Forbidden: Only finance officers can update bank transfer verification status.');
          }

          if (data.status === 'approved') {
            const recCode = String(data.internalReconciliationCode || '').trim();
            if (!recCode) {
              throw new Error('Reconciliation code is required to approve a bank transfer.');
            }
            data.internalReconciliationCode = recCode;

            // In-process serialization mutex for same reconciliation code
            const previous = reconciliationCodeMutexes.get(recCode) || Promise.resolve();
            let resolveCurrent: () => void;
            const current = new Promise<void>((r) => { resolveCurrent = r; });
            reconciliationCodeMutexes.set(recCode, previous.then(() => current, () => current));
            await previous;

            try {
              let transferDoc = originalDoc;
              const transferId = originalDoc?.id || (req as any)?.id;
              if ((!transferDoc || transferDoc.claimedAmount === undefined || transferDoc.order === undefined) && transferId) {
                try {
                  transferDoc = await req.payload.findByID({
                    collection: 'bank-transfers',
                    id: transferId,
                    req,
                  });
                } catch (_) {}
              }

              // UNICITY GUARD: Prevent duplicate reconciliation of the same bank deposit code across different transfers
              const currentTransferId = transferDoc?.id || originalDoc?.id;
              const existingWithCode = await req.payload.find({
                collection: 'bank-transfers',
                where: {
                  and: [
                    { internalReconciliationCode: { equals: recCode } },
                    { status: { equals: 'approved' } },
                    ...(currentTransferId ? [{ id: { not_equals: currentTransferId } }] : []),
                  ],
                },
                req,
                limit: 1,
              });

              if (existingWithCode && existingWithCode.docs.length > 0) {
                const duplicateDoc = existingWithCode.docs[0];
                throw new Error(
                  `RECONCILIATION_CODE_ALREADY_USED: Bank statement reconciliation code "${recCode}" has already been used to reconcile bank transfer #${duplicateDoc.id}. Each bank statement deposit row can only be reconciled once.`
                );
              }

              if (data.confirmedAmount === undefined || data.confirmedAmount === null) {
                throw new Error(
                  'CONFIRMED_AMOUNT_REQUIRED: A valid confirmed deposit amount must be explicitly recorded by finance to approve a bank transfer. Relying on customer claimed amount is strictly prohibited.'
                );
              }

              const confirmedDeposit = Number(data.confirmedAmount);

              if (!confirmedDeposit || confirmedDeposit <= 0 || isNaN(confirmedDeposit)) {
                throw new Error(
                  'CONFIRMED_AMOUNT_REQUIRED: A valid confirmed deposit amount must be recorded to approve a bank transfer.'
                );
              }

              const orderId =
                typeof (data.order || transferDoc?.order) === 'object' && (data.order || transferDoc?.order) !== null
                  ? (data.order || transferDoc?.order).id
                  : (data.order || transferDoc?.order);

              if (!orderId) {
                throw new Error('LINKED_ORDER_REQUIRED: Bank transfer is not associated with an order.');
              }

              const linkedOrder = await req.payload.findByID({
                collection: 'orders',
                id: orderId,
                req,
              });

              if (!linkedOrder) {
                throw new Error(`ORDER_NOT_FOUND: Linked order #${orderId} does not exist.`);
              }

              const expectedOrderTotal = Number(
                linkedOrder.total || linkedOrder.amount || linkedOrder.financials?.grandTotal || 0
              );

              const confirmedPiastres = toIntegerPiastres(confirmedDeposit, 'Confirmed bank deposit amount');
              const expectedPiastres = toIntegerPiastres(expectedOrderTotal, 'Order grand total');

              if (confirmedPiastres !== expectedPiastres) {
                throw new Error(
                  `BANK_TRANSFER_AMOUNT_MISMATCH: Confirmed bank deposit amount (${confirmedDeposit} EGP / ${confirmedPiastres} piastres) does not match order grand total (${expectedOrderTotal} EGP / ${expectedPiastres} piastres). Exact piastre equality is required.`
                );
              }

              data.confirmedAmount = confirmedDeposit;
              data.verifiedBy = req.user?.id;
              data.verifiedAt = new Date().toISOString();
            } finally {
              reconciliationCodeMutexes.delete(recCode);
              resolveCurrent!();
            }
          } else if (data.status === 'rejected') {
            data.verifiedBy = req.user?.id;
            data.verifiedAt = new Date().toISOString();
          }
        }
        return data;
      },
    ],
    afterChange: [
      async ({ req, doc, previousDoc }) => {
        if (doc.status === 'approved' && previousDoc?.status !== 'approved') {
          const orderId = typeof doc.order === 'object' && doc.order !== null ? doc.order.id : doc.order;
          if (orderId) {
            const existingOrder = await req.payload.findByID({
              collection: 'orders',
              id: orderId,
              req,
            });

            if (existingOrder) {
              const previousLogs = Array.isArray(existingOrder.auditLog) ? existingOrder.auditLog : [];
              const newEntry = {
                entry: `Payment confirmed via manual Bank Transfer. Bank Ref: ${doc.bankReferenceCode}, Reconciliation Code: ${doc.internalReconciliationCode}, Verified by user #${req.user?.id} at ${new Date().toISOString()}`,
              };

              if (req) {
                req.context = {
                  ...(req.context || {}),
                  isBankTransferVerification: true,
                  bankTransferId: doc.id,
                };
              }

              await req.payload.update({
                collection: 'orders',
                id: orderId,
                data: {
                  paymentStatus: 'paid',
                  paidAt: existingOrder.paidAt || new Date().toISOString(),
                  auditLog: [...previousLogs, newEntry],
                },
                req,
                context: {
                  isBankTransferVerification: true,
                  bankTransferId: doc.id,
                },
              });
            }
          }
        }
      },
    ],
  },
};
