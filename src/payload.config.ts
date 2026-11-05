import { buildConfig } from 'payload';
import sharp from 'sharp';
import { lineHasCustomization, customizationFeePerUnit } from '@/modules/cart-checkout/logic/customizationFee';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce';

import { Users } from './modules/identity/collections/Users';
import { hasRole } from './modules/identity/access/roles';
import { Media } from './modules/customization/collections/Media';
import { ArtworkAssets } from './modules/customization/collections/ArtworkAssets';
import { BankTransfers } from './modules/payments/collections/BankTransfers';
import { PaymentEvents } from './modules/payments/collections/PaymentEvents';
import { PaymentAttempts } from './modules/payments/collections/PaymentAttempts';
import { PaymentCollections } from './modules/payments/collections/PaymentCollections';
import { CourierRemittances } from './modules/payments/collections/CourierRemittances';
import { FulfillmentJobs } from './modules/fulfillment/collections/FulfillmentJobs';
import { ServiceBriefs } from './modules/fulfillment/collections/ServiceBriefs';
import { Categories } from './modules/catalog/collections/Categories';
import { productsCollectionOverride } from './modules/catalog/collections/Products';
import { Pages } from './modules/content/collections/Pages';
import { PortfolioProjects } from './modules/content/collections/PortfolioProjects';
import { BlogPosts } from './modules/content/collections/BlogPosts';
import { Inquiries } from './modules/content/collections/Inquiries';
import { RateLimitEvents } from './modules/content/collections/RateLimitEvents';
import { Navigation } from './modules/content/globals/Navigation';
import { InquirySettings } from './modules/content/globals/InquirySettings';
import { CommerceSettings } from './modules/orders/globals/CommerceSettings';
import { validateCartMoq } from './modules/cart-checkout/logic/moqEngine';
import { toIntegerPiastres } from './modules/orders/logic/orderSnapshotEngine';
// Paymob gateway engine is preserved dormant for Phase 2 (Decision D-008)
// import { paymobWebhookHandler } from './modules/payments/endpoints/paymobWebhook';
import { signPrivateMedia, downloadPrivateMedia } from './modules/customization/endpoints/privateMedia';

const dbUri = process.env.DATABASE_URI || 'postgres://postgres@127.0.0.1:5432/mwheba_dev';
const isPostgres = dbUri.startsWith('postgres://') || dbUri.startsWith('postgresql://');

export default buildConfig({
  sharp,
  secret: process.env.PAYLOAD_SECRET || 'mwheba-dev-foundation-secret-key-32chars-min',
  admin: {
    user: Users.slug,
  },
  endpoints: [
    { path: '/private-media/:id/sign', method: 'post', handler: signPrivateMedia },
    { path: '/private-media/:id/download', method: 'get', handler: downloadPrivateMedia },
    // Decision D-008: Paymob online gateway is formally deferred to Phase 2.
    // Live activation via environment flag is permanently locked down in Phase 1 until formal approval.
    {
      path: '/paymob/webhook',
      method: 'post' as const,
      handler: async () => {
        return Response.json(
          {
            error: 'PAYMOB_DISABLED',
            message:
              'Paymob gateway is formally deferred to Phase 2 per Decision D-008. Live activation via ENABLE_PAYMOB_GATEWAY is permanently locked in Phase 1.',
          },
          { status: 404 }
        );
      },
    },
  ],
  collections: [
    Users,
    Pages,
    PortfolioProjects,
    BlogPosts,
    Inquiries,
    RateLimitEvents,
    Categories,
    Media,
    ArtworkAssets,
    BankTransfers,
    PaymentEvents,
    PaymentAttempts,
    PaymentCollections,
    CourierRemittances,
    FulfillmentJobs,
    ServiceBriefs,
  ],
  localization: {
    locales: [
      {
        code: 'ar',
        label: 'العربية (Arabic)',
        rtl: true,
      },
      {
        code: 'en',
        label: 'English',
        rtl: false,
      },
    ],
    defaultLocale: 'ar',
    fallback: true,
  },
  editor: lexicalEditor({}),
  globals: [Navigation, InquirySettings, CommerceSettings],
  typescript: {
    outputFile: './src/payload-types.ts',
  },
  db: postgresAdapter({
    pool: {
      connectionString: dbUri,
    },
    push: false,
  }),
  plugins: [
    ecommercePlugin({
      customers: {
        slug: Users.slug,
      },
      // Native exclusion of inventory tracking per DECISIONS.md D-018
      inventory: false,
      access: {
        isAdmin: ({ req }: any) => hasRole(req.user, ['super_admin']),
        adminOnlyFieldAccess: ({ req }: any) => hasRole(req.user, ['super_admin']),
        adminOrPublishedStatus: ({ req }: any) => {
          if (hasRole(req.user, ['super_admin', 'catalog_manager', 'marketer'])) return true;
          return { _status: { equals: 'published' } };
        },
        isCustomer: ({ req }: any) => Boolean(req.user && !hasRole(req.user, ['super_admin', 'catalog_manager', 'operations', 'creative_director', 'finance', 'marketer'])),
        isAuthenticated: ({ req }: any) => Boolean(req.user),
        isDocumentOwner: ({ req }: any) => {
          if (!req.user) return false;
          return { customer: { equals: req.user.id } };
        },
      },
      currencies: {
        defaultCurrency: 'EGP',
        supportedCurrencies: [
          {
            code: 'EGP',
            decimals: 2,
            label: 'Egyptian Pound',
            symbol: 'EGP',
          },
        ],
      },
      products: {
        variants: true,
        productsCollectionOverride,
      },
      carts: {
        allowGuestCarts: true,
        cartItemMatcher: ({ existingItem, newItem }: any) => {
          return (
            existingItem.product === newItem.product &&
            existingItem.variant === newItem.variant &&
            existingItem.artworkAssetId === newItem.artworkAssetId &&
            existingItem.printingNotes === newItem.printingNotes
          );
        },
        cartsCollectionOverride: ({ defaultCollection }) => {
          const itemsField = defaultCollection.fields.find((f: any) => f.name === 'items');
          if (itemsField && 'fields' in itemsField && Array.isArray(itemsField.fields)) {
            itemsField.fields.push(
              {
                name: 'artworkAssetId',
                type: 'text',
                admin: { description: 'Attached customer vector logo / artwork reference' },
              },
              {
                name: 'printingNotes',
                type: 'textarea',
                admin: { description: 'Specific customization notes for this line' },
              },
              {
                name: 'customizationFee',
                type: 'number',
                defaultValue: 0,
                admin: { description: 'Itemized separate printing fee for this line' },
              }
            );
          }
          defaultCollection.fields.push({
            name: 'appliedOperations',
            type: 'json',
            defaultValue: [],
            admin: {
              description: 'Independent idempotency operation keys applied to this cart',
            },
          });
          return defaultCollection;
        },
      },
      orders: {
        ordersCollectionOverride: ({ defaultCollection }) => {
          // Inject custom fields into the items array inside the orderDetails tab
          const tabsField = defaultCollection.fields.find((f: any) => f.type === 'tabs') as any;
          const orderDetailsTab = tabsField?.tabs?.[0];
          const itemsField = orderDetailsTab?.fields?.find((f: any) => f.name === 'items');
          if (itemsField && Array.isArray(itemsField.fields)) {
            itemsField.fields.push(
              {
                name: 'productTitle',
                type: 'text',
                admin: { description: 'Frozen product title at order placement' },
              },
              {
                name: 'variantTitle',
                type: 'text',
                admin: { description: 'Frozen variant title at order placement' },
              },
              {
                name: 'sku',
                type: 'text',
                admin: { description: 'Frozen SKU at order placement' },
              },
              {
                name: 'artworkAssetId',
                type: 'text',
                admin: { description: 'Attached customer vector logo / artwork reference (D-016)' },
              },
              {
                name: 'artworkStorageKey',
                type: 'text',
                admin: { description: 'Frozen private storage key of the artwork at order placement' },
              },
              {
                name: 'artworkOriginalFilename',
                type: 'text',
                admin: { description: 'Frozen original filename of the artwork at order placement' },
              },
              {
                name: 'printingNotes',
                type: 'textarea',
                admin: { description: 'Specific customization notes for this line' },
              },
              {
                name: 'unitPrice',
                type: 'number',
                admin: { description: 'Frozen catalog unit price at checkout snapshot' },
              },
              {
                name: 'customizationFee',
                type: 'number',
                defaultValue: 0,
                admin: { description: 'Frozen printing fee per unit at checkout snapshot (D-017)' },
              },
              {
                name: 'lineTotal',
                type: 'number',
                admin: { description: 'Frozen penny-perfect total for this line' },
              },
              {
                name: 'fulfillmentType',
                type: 'select',
                options: [
                  { label: 'Physical Delivery', value: 'physical' },
                  { label: 'Digital Service Intake', value: 'service' },
                ],
                defaultValue: 'physical',
              }
            );
          }

          return {
            ...defaultCollection,
            fields: [
              ...defaultCollection.fields,
              {
                name: 'orderNumber',
                type: 'text',
                unique: true,
                index: true,
                admin: {
                  position: 'sidebar',
                  readOnly: true,
                },
              },
              {
                name: 'cart',
                type: 'relationship',
                relationTo: 'carts',
                index: true,
                admin: {
                  description: 'Active cart session linked to this placed order for ambiguous recovery',
                },
              },
              {
                name: 'idempotencyKey',
                type: 'text',
                index: true,
                admin: {
                  description: 'Checkout idempotency key for network retry deduplication',
                },
              },
              {
                name: 'deliveryMethod',
                type: 'select',
                defaultValue: 'shipping',
                options: [
                  { label: 'Standard Shipping', value: 'shipping' },
                  { label: 'Agency Office Pickup', value: 'pickup' },
                ],
              },
              {
                name: 'fulfillmentNotes',
                type: 'textarea',
                admin: { description: 'Fulfillment instructions or office pickup notes' },
              },
              {
                name: 'companyName',
                type: 'text',
              },
              {
                name: 'contactPerson',
                type: 'text',
              },
              {
                name: 'phone',
                type: 'text',
              },
              {
                name: 'taxId',
                type: 'text',
              },
              {
                name: 'orderStatus',
                type: 'select',
                defaultValue: 'confirmed',
                options: [
                  { label: 'Draft', value: 'draft' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Confirmed', value: 'confirmed' },
                  { label: 'Processing', value: 'processing' },
                  { label: 'Completed', value: 'completed' },
                  { label: 'Cancelled', value: 'cancelled' },
                ],
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'paymentStatus',
                type: 'select',
                defaultValue: 'pending',
                options: [
                  { label: 'Pending Payment', value: 'pending' },
                  { label: 'Unpaid (COD)', value: 'unpaid' },
                  { label: 'Pending Verification', value: 'pending_verification' },
                  { label: 'Paid in Full', value: 'paid' },
                  { label: 'Failed', value: 'failed' },
                  { label: 'Cancelled', value: 'cancelled' },
                  { label: 'Refunded', value: 'refunded' },
                ],
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'paymentMethod',
                type: 'select',
                options: [
                  { label: 'Cash on Delivery (COD)', value: 'cod' },
                  { label: 'Manual Bank Transfer', value: 'bank_transfer' },
                  { label: 'Paymob Gateway (Deferred)', value: 'paymob' },
                ],
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'fulfillmentStatus',
                type: 'select',
                defaultValue: 'unfulfilled',
                options: [
                  { label: 'Unfulfilled', value: 'unfulfilled' },
                  { label: 'In Production', value: 'in_production' },
                  { label: 'Ready for Pickup', value: 'ready_for_pickup' },
                  { label: 'Shipped', value: 'shipped' },
                  { label: 'Delivered', value: 'delivered' },
                  { label: 'Returned to Origin / Refused', value: 'returned_to_origin' },
                  { label: 'Cancelled', value: 'cancelled' },
                ],
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'remittanceStatus',
                type: 'select',
                defaultValue: 'not_applicable',
                options: [
                  { label: 'Not Applicable', value: 'not_applicable' },
                  { label: 'Pending Cash Collection', value: 'pending_collection' },
                  { label: 'Collected by Courier', value: 'collected_by_courier' },
                  { label: 'Remitted to MWHEBA Bank', value: 'remitted_to_company' },
                ],
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'proofStatus',
                type: 'select',
                defaultValue: 'not_required',
                options: [
                  { label: 'Not Required', value: 'not_required' },
                  { label: 'Proof Pending Client Approval', value: 'proof_pending' },
                  { label: 'Proof Approved', value: 'proof_approved' },
                ],
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'proofApprovedAt',
                type: 'date',
                admin: {
                  position: 'sidebar',
                },
              },
              {
                name: 'codDetails',
                type: 'group',
                fields: [
                  { name: 'requiredAmount', type: 'number' },
                  { name: 'collectedAmount', type: 'number' },
                  { name: 'collectorType', type: 'select', options: [{ label: 'Courier', value: 'courier' }, { label: 'Office Staff', value: 'office_staff' }] },
                  { name: 'collectorName', type: 'text' },
                  { name: 'collectedAt', type: 'date' },
                  { name: 'collectionReference', type: 'text' },
                  { name: 'courierRemittanceBatchId', type: 'text' },
                  { name: 'refusalReason', type: 'text' },
                  { name: 'refusalRecordedAt', type: 'date' },
                ],
              },
              {
                name: 'shippingFee',
                type: 'number',
                defaultValue: 0,
                admin: {
                  description: 'Calculated shipping fee or office pickup charge.',
                },
              },
              {
                name: 'paidAt',
                type: 'date',
                admin: {
                  position: 'sidebar',
                  readOnly: true,
                },
              },
              {
                name: 'subtotal',
                type: 'number',
                admin: {
                  description: 'Subtotal before separate customization and printing charges.',
                },
              },
              {
                name: 'totalCustomizationFees',
                type: 'number',
                defaultValue: 0,
                admin: {
                  description: 'Total itemized customization/printing fees across all lines (D-017).',
                },
              },
              {
                name: 'taxAmount',
                type: 'number',
                defaultValue: 0,
                admin: {
                  description: 'Statutory VAT / sales tax (default 0 until formally reviewed with agency tax counsel per PAY-05).',
                },
              },
              {
                name: 'taxReviewStatus',
                type: 'select',
                defaultValue: 'pending_accountant_review',
                options: [
                  { label: 'Pending Accountant Legal & Tax Review', value: 'pending_accountant_review' },
                  { label: 'Tax Exempt', value: 'tax_exempt' },
                  { label: 'Tax Applied', value: 'tax_applied' },
                ],
                admin: {
                  position: 'sidebar',
                  description: 'Legal tax boundary review status (PAY-05).',
                },
              },
              {
                name: 'grandTotalPiastres',
                type: 'number',
                admin: {
                  readOnly: true,
                  description: 'Integer piastres (100 piastres = 1 EGP) for gateway and audit ledger precision.',
                },
              },
              {
                name: 'reconciliationReference',
                type: 'text',
                admin: {
                  description: 'Reconciled bank statement transaction code or courier remittance reference.',
                },
              },
              {
                name: 'auditLog',
                type: 'array',
                fields: [
                  {
                    name: 'entry',
                    type: 'text',
                  },
                ],
                admin: {
                  description: 'Server-recorded append-only audit trail of financial and fulfillment status changes.',
                },
              },
              {
                name: 'appliedTariff',
                type: 'json',
                admin: {
                  readOnly: true,
                  description: 'Frozen delivery tariff schedule snapshot applied at order placement (D-015).',
                },
              },
              {
                name: 'appliedProductionPolicy',
                type: 'select',
                defaultValue: 'require_payment_clearance',
                options: [
                  { label: 'Require Payment Clearance Before Production', value: 'require_payment_clearance' },
                  { label: 'Allow Immediate Production', value: 'allow_immediate_production' },
                ],
                admin: {
                  readOnly: true,
                  position: 'sidebar',
                  description: 'Frozen production policy snapshot applied at order placement.',
                },
              },
            ],
            hooks: {
              ...defaultCollection.hooks,
              beforeValidate: [
                ...(defaultCollection.hooks?.beforeValidate || []),
                async ({ data, req, operation, originalDoc, context }: any) => {
                  if (!data) return data;

                  // DEFENSE 0: PAYMENT METHOD IMMUTABILITY
                  // Once an order is created, mutating paymentMethod is strictly prohibited!
                  if (operation === 'update' && originalDoc) {
                    if (data.paymentMethod && originalDoc.paymentMethod && data.paymentMethod !== originalDoc.paymentMethod) {
                      throw new Error(
                        `PAYMENT_METHOD_IMMUTABLE: Modifying paymentMethod on an existing order from '${originalDoc.paymentMethod}' to '${data.paymentMethod}' is strictly prohibited. The customer must place a new order if they wish to change payment methods.`
                      );
                    }
                    if (originalDoc.paymentMethod) {
                      data.paymentMethod = originalDoc.paymentMethod;
                    }

                    // DEFENSE 1: PROTECT FROZEN FINANCIAL SNAPSHOT & LINE ITEMS ON UPDATE (Issue 1)
                    // When updating an order, modifying line items, quantities, or products is strictly forbidden!
                    if (data.items && Array.isArray(data.items)) {
                      const origItems = originalDoc.items || [];
                      if (data.items.length !== origItems.length) {
                        throw new Error('Order Immutability Error: Modifying purchased items count on an existing order is strictly prohibited.');
                      }
                      for (let i = 0; i < data.items.length; i++) {
                        const it = data.items[i];
                        const orig = origItems[i];
                        const itProdId = typeof it.product === 'object' && it.product !== null ? it.product.id : it.product;
                        const origProdId = typeof orig.product === 'object' && orig.product !== null ? orig.product.id : orig.product;
                        const itVarId = typeof it.variant === 'object' && it.variant !== null ? it.variant.id : it.variant;
                        const origVarId = typeof orig.variant === 'object' && orig.variant !== null ? orig.variant.id : orig.variant;

                        if (
                          String(itProdId) !== String(origProdId) ||
                          String(itVarId || '') !== String(origVarId || '') ||
                          Number(it.quantity) !== Number(orig.quantity)
                        ) {
                          throw new Error(
                            `Order Immutability Error: Modifying purchased items, quantities (${orig.quantity} -> ${it.quantity}), or variants on an existing order is strictly prohibited.`
                          );
                        }
                      }
                    }

                    // DEFENSE 2: TERMINAL PAID STATUS IMMUTABILITY
                    // An order that has been paid in full can NEVER regress to failed or pending
                    if (originalDoc.paymentStatus === 'paid') {
                      if (data.paymentStatus && data.paymentStatus !== 'paid' && data.paymentStatus !== 'refunded') {
                        data.paymentStatus = 'paid';
                      }
                    }

                    // DEFENSE 3: PRE-PRODUCTION PROOF APPROVAL GATE (D-023)
                    // Proof approval is performed ONLY by the customer's own approval engine; an operator cannot
                    // approve in the same update that advances fulfillment, nor set proofStatus directly.
                    const approvalEngine = Boolean(context?.isProofApprovalEngine || req?.context?.isProofApprovalEngine);
                    if (data.proofStatus !== undefined && data.proofStatus !== originalDoc.proofStatus && !approvalEngine) {
                      throw new Error(
                        'PROOF_STATUS_ENGINE_ONLY: proofStatus can only change through the customer proof approval flow.'
                      );
                    }
                    if (data.proofApprovedAt !== undefined && !approvalEngine) {
                      data.proofApprovedAt = originalDoc.proofApprovedAt;
                    }
                    if (originalDoc.proofStatus === 'proof_pending') {
                      const targetFulfillment = data.fulfillmentStatus;
                      if (targetFulfillment && ['in_production', 'ready_for_pickup', 'shipped', 'delivered'].includes(targetFulfillment)) {
                        throw new Error(
                          `PROOF_NOT_APPROVED: Cannot transition order to fulfillment status '${targetFulfillment}' while proofStatus is 'proof_pending'. Client proof must be approved first.`
                        );
                      }
                    }

                    // Order-level production/delivery statuses are derived by the fulfillment engine from line jobs.
                    if (
                      data.fulfillmentStatus !== undefined &&
                      data.fulfillmentStatus !== originalDoc.fulfillmentStatus &&
                      ['in_production', 'ready_for_pickup', 'shipped', 'delivered'].includes(data.fulfillmentStatus) &&
                      !(context?.fulfillmentEngine || req?.context?.fulfillmentEngine)
                    ) {
                      throw new Error(
                        `FULFILLMENT_STATUS_ENGINE_ONLY: Order fulfillment status '${data.fulfillmentStatus}' is derived from line-level fulfillment jobs and cannot be set directly.`
                      );
                    }

                    // DEFENSE 4: REJECT PAYMENT ON CANCELLED OR REFUSED ORDERS
                    if (
                      (originalDoc.orderStatus === 'cancelled' ||
                        originalDoc.status === 'cancelled' ||
                        originalDoc.fulfillmentStatus === 'returned_to_origin') &&
                      data.paymentStatus === 'paid'
                    ) {
                      throw new Error(
                        `CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER: Cannot mark a cancelled or refused order as paid.`
                      );
                    }

                    // DEFENSE 5: COMPREHENSIVE PAYMENT STATUS MUTATION RESTRICTION (D-022)
                    // Direct manual update of paymentStatus to 'paid' by Admin/API without the verified pipeline for that paymentMethod is strictly blocked!
                    if (originalDoc.paymentStatus !== 'paid' && data.paymentStatus === 'paid') {
                      const isAuthorizedAny = Boolean(
                        context?.isBankTransferVerification ||
                        req?.context?.isBankTransferVerification ||
                        context?.isCodCollectionEngine ||
                        req?.context?.isCodCollectionEngine ||
                        context?.isPaymentWebhook ||
                        req?.context?.isPaymentWebhook
                      );

                      const method = originalDoc.paymentMethod || data.paymentMethod;

                      if (!isAuthorizedAny) {
                        if (method === 'cod') {
                          throw new Error(
                            'DIRECT_COD_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of a COD order to paid is strictly prohibited. COD payments can only be marked as paid through the authorized recordCodCollection pipeline within an active transaction and with an immutable collection receipt.'
                          );
                        } else if (method === 'bank_transfer') {
                          throw new Error(
                            'DIRECT_BANK_TRANSFER_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of a bank transfer order to paid is strictly prohibited. Bank transfer orders can only be marked as paid through an approved bank transfer reconciliation record.'
                          );
                        } else if (method === 'paymob') {
                          throw new Error(
                            'DIRECT_GATEWAY_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of a gateway payment order to paid is strictly prohibited. Gateway payments can only be marked as paid through verified webhook callbacks.'
                          );
                        } else {
                          throw new Error(
                            'DIRECT_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of an order to paid is strictly prohibited. Orders can only be marked as paid through authorized payment verification pipelines.'
                          );
                        }
                      }

                      // If authorized context is present, perform method-specific checks
                      if (method === 'cod') {
                        const isAuthorizedCod = Boolean(context?.isCodCollectionEngine || req?.context?.isCodCollectionEngine);
                        const hasCollectionRef = Boolean(data.codDetails?.collectionReference);
                        if (!isAuthorizedCod || !hasCollectionRef) {
                          throw new Error(
                            'DIRECT_COD_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of a COD order to paid is strictly prohibited. COD payments can only be marked as paid through the authorized recordCodCollection pipeline within an active transaction and with an immutable collection receipt.'
                          );
                        }
                        const collections = await req.payload.find({
                          collection: 'payment-collections',
                          where: {
                            and: [
                              { order: { equals: originalDoc.id } },
                              { receiptReference: { equals: data.codDetails.collectionReference } },
                            ],
                          },
                          req,
                          limit: 1,
                        });
                        if (!collections || collections.docs.length === 0) {
                          throw new Error(
                            'MISSING_COLLECTION_RECORD: Cannot mark COD order as paid without an associated verified PaymentCollection record inside the transaction.'
                          );
                        }
                      } else if (method === 'bank_transfer') {
                        const isAuthorizedBank = Boolean(context?.isBankTransferVerification || req?.context?.isBankTransferVerification);
                        if (!isAuthorizedBank) {
                          throw new Error(
                            'DIRECT_BANK_TRANSFER_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of a bank transfer order to paid is strictly prohibited. Bank transfer orders can only be marked as paid through an approved bank transfer reconciliation record.'
                          );
                        }
                        const approvedTransfers = await req.payload.find({
                          collection: 'bank-transfers',
                          where: {
                            and: [
                              { order: { equals: originalDoc.id } },
                              { status: { equals: 'approved' } },
                            ],
                          },
                          req,
                          limit: 1,
                        });
                        if (!approvedTransfers || approvedTransfers.docs.length === 0) {
                          throw new Error(
                            'MISSING_APPROVED_BANK_TRANSFER: Cannot mark bank transfer order as paid without an approved and reconciled bank transfer record.'
                          );
                        }

                        // Verify that the approved bank transfer amount matches the order total with exact integer piastre equality
                        const transfer = approvedTransfers.docs[0];
                        const transferAmount = Number(transfer.confirmedAmount || transfer.claimedAmount || 0);
                        const expectedTotal = Number(originalDoc.total || originalDoc.amount || 0);

                        const transferPiastres = toIntegerPiastres(transferAmount, 'Approved bank transfer amount');
                        const orderTotalPiastres = toIntegerPiastres(expectedTotal, 'Order grand total');

                        if (transferPiastres !== orderTotalPiastres) {
                          throw new Error(
                            `BANK_TRANSFER_AMOUNT_MISMATCH: Approved bank transfer amount (${transferAmount} EGP / ${transferPiastres} piastres) does not match order grand total (${expectedTotal} EGP / ${orderTotalPiastres} piastres). Exact piastre equality is required.`
                          );
                        }
                      } else if (method === 'paymob') {
                        const isAuthorizedPaymob = Boolean(context?.isPaymentWebhook || req?.context?.isPaymentWebhook);
                        if (!isAuthorizedPaymob) {
                          throw new Error(
                            'DIRECT_GATEWAY_PAYMENT_STATUS_MUTATION_FORBIDDEN: Direct manual transition of a gateway payment order to paid is strictly prohibited. Gateway payments can only be marked as paid through verified webhook callbacks.'
                          );
                        }
                      }
                    }

                    // Enforce complete preservation of the existing order snapshot
                    // Only restore snapshot fields if the update payload attempted to provide/mutate them
                    if (data.items !== undefined) {
                      data.items = originalDoc.items;
                    }
                    if (data.amount !== undefined) {
                      data.amount = originalDoc.amount;
                    }
                    if (data.subtotal !== undefined) {
                      data.subtotal = originalDoc.subtotal;
                    }
                    if (data.totalCustomizationFees !== undefined) {
                      data.totalCustomizationFees = originalDoc.totalCustomizationFees;
                    }
                    if (data.shippingFee !== undefined) {
                      data.shippingFee = originalDoc.shippingFee;
                    }
                    if (data.taxAmount !== undefined) {
                      data.taxAmount = originalDoc.taxAmount;
                    }
                    if (data.taxReviewStatus === undefined && originalDoc.taxReviewStatus) {
                      data.taxReviewStatus = originalDoc.taxReviewStatus;
                    }
                    if (data.grandTotalPiastres === undefined && originalDoc.grandTotalPiastres) {
                      data.grandTotalPiastres = originalDoc.grandTotalPiastres;
                    }

                    // Enforce mathematical financial consistency on updates
                    const curSub = Number(data.subtotal ?? originalDoc.subtotal ?? 0);
                    const curFees = Number(data.totalCustomizationFees ?? originalDoc.totalCustomizationFees ?? 0);
                    const curShip = Number(data.shippingFee ?? originalDoc.shippingFee ?? 0);
                    const curTax = Number(data.taxAmount ?? originalDoc.taxAmount ?? 0);
                    const curComputedTotal = curSub + curFees + curShip + curTax;
                    const curExpectedPiastres = toIntegerPiastres(curComputedTotal, 'Order ledger total');

                    data.grandTotalPiastres = curExpectedPiastres;
                    return data;
                  }

                  // INITIAL ORDER CREATION LOGIC (operation === 'create')
                  // 1. Enforce non-empty items
                  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
                    throw new Error('Order Validation Failed: An order must contain at least one line item.');
                  }

                  // 2. Fetch all referenced products and variants
                  const productMap = new Map<string | number, any>();
                  const variantMap = new Map<string | number, any>();

                  for (const item of data.items) {
                    const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                    if (!prodId) throw new Error('Order Validation Failed: Line item is missing product reference.');
                    if (!productMap.has(prodId)) {
                      const product = await req.payload.findByID({
                        collection: 'products',
                        id: prodId,
                        req,
                      });
                      if (!product) throw new Error(`Product not found: ${prodId}`);
                      productMap.set(prodId, product);
                    }

                    if (item.variant) {
                      const varId = typeof item.variant === 'object' && item.variant !== null ? item.variant.id : item.variant;
                      if (!variantMap.has(varId)) {
                        const variant = await req.payload.findByID({
                          collection: 'variants',
                          id: varId,
                          req,
                        });
                        if (!variant) throw new Error(`Variant not found: ${varId}`);
                        variantMap.set(varId, variant);
                      }

                      // DEFENSE 2: Verify variant strictly belongs to item.product (Issue 2)
                      const variantDoc = variantMap.get(varId);
                      const variantParentProdId =
                        typeof variantDoc.product === 'object' && variantDoc.product !== null
                          ? variantDoc.product.id
                          : variantDoc.product;

                      if (String(variantParentProdId) !== String(prodId)) {
                        throw new Error(
                          `Variant Mismatch Error: Variant "${variantDoc.title || varId}" (ID: ${varId}) belongs to Product ID ${variantParentProdId}, but was attached to Product ID ${prodId}. Cross-product variant assignment is strictly prohibited.`
                        );
                      }
                    }
                  }

                  // 3. DEFENSE 3: Ownership validation & artwork snapshot freezing (Issue 3)
                  const orderCustomerId = typeof data.customer === 'object' && data.customer !== null ? data.customer.id : data.customer;
                  for (const item of data.items) {
                    if (item.artworkAssetId) {
                      const asset = await req.payload.findByID({
                        collection: 'artwork-assets',
                        id: item.artworkAssetId,
                        req,
                      });
                      if (!asset) {
                        throw new Error(`Artwork Asset not found: ${item.artworkAssetId}`);
                      }
                      const assetUploaderId = typeof asset.uploader === 'object' && asset.uploader !== null ? asset.uploader.id : asset.uploader;
                      if (assetUploaderId && orderCustomerId && String(assetUploaderId) !== String(orderCustomerId) && !hasRole(req.user, ['super_admin', 'operations'])) {
                        throw new Error('Forbidden: Customer cannot attach artwork assets owned by another user.');
                      }
                      // Freeze file snapshot directly onto order item
                      item.artworkStorageKey = asset.storageKey;
                      item.artworkOriginalFilename = asset.originalFilename;
                    }
                  }

                  // 4. Server-side MOQ Validation (D-009)
                  const cartForMoq = data.items.map((item: any) => {
                    const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                    const prod = productMap.get(prodId);
                    return {
                      productId: String(prodId),
                      productTitle: prod.title || 'Product',
                      itemType: prod.itemType || 'physical',
                      minOrderQuantity: prod.minOrderQuantity || 1,
                      quantity: Number(item.quantity) || 1,
                      variantId: item.variant ? String(typeof item.variant === 'object' ? item.variant.id : item.variant) : undefined,
                    };
                  });

                  const moqCheck = validateCartMoq(cartForMoq);
                  if (!moqCheck.valid) {
                    throw new Error(`MOQ Violation (D-009): ${moqCheck.errors.join('; ')}`);
                  }

                  // 4b. COD Scope & Validation Rules at Order Creation Hook (D-021, D-022)
                  if (data.paymentMethod === 'cod') {
                    const hasPhysical = data.items.some((item: any) => {
                      const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                      return productMap.get(prodId)?.itemType === 'physical';
                    });
                    const hasService = data.items.some((item: any) => {
                      const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                      return productMap.get(prodId)?.itemType === 'service';
                    });

                    if (hasService && !hasPhysical) {
                      throw new Error('COD_PROHIBITED_FOR_DIGITAL: Cash on Delivery is strictly prohibited for service packages and digital deliverables.');
                    }
                    if (hasService && hasPhysical) {
                      throw new Error('COD_PROHIBITED_FOR_MIXED_CART: Mixed carts containing digital services cannot use Cash on Delivery. Please use Bank Transfer or checkout separately.');
                    }

                    // Enforce server-authoritative initial states for COD
                    data.paymentStatus = 'unpaid';
                    data.remittanceStatus = 'pending_collection';
                    data.orderStatus = 'confirmed';
                  } else if (data.paymentMethod === 'bank_transfer') {
                    data.paymentStatus = data.paymentStatus || 'unpaid';
                    data.remittanceStatus = 'not_applicable';
                    data.orderStatus = data.orderStatus || 'pending';
                  }

                  const hasCustomization = data.items.some((item: any) => lineHasCustomization(item));
                  data.proofStatus = hasCustomization ? 'proof_pending' : 'not_required';

                  // 5. DEFENSE 2: Resolve prices from Variant priceInEGP or Product priceInEGP (Issue 2)
                  let calculatedSubtotal = 0;
                  let calculatedCustomizationTotal = 0;
                  let calculatedAmount = 0;

                  for (const item of data.items) {
                    const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                    const prod = productMap.get(prodId);

                    let unitPrice = 0;
                    let variantDoc: any = undefined;
                    // Check variant pricing first
                    if (item.variant) {
                      const varId = typeof item.variant === 'object' && item.variant !== null ? item.variant.id : item.variant;
                      variantDoc = variantMap.get(varId);
                      if (variantDoc) {
                        if (typeof variantDoc.priceInEGP === 'number') {
                          unitPrice = variantDoc.priceInEGP;
                        }
                      }
                    }
                    // Fallback to product-level priceInEGP or basePrice
                    if (unitPrice === 0) {
                      if (typeof prod.priceInEGP === 'number') {
                        unitPrice = prod.priceInEGP;
                      } else if (typeof prod.basePrice === 'number') {
                        unitPrice = prod.basePrice;
                      }
                    }

                    const qty = Number(item.quantity) || 1;
                    const feePerUnit = customizationFeePerUnit(item, prod);
                    const lineCustomization = feePerUnit * qty;
                    const lineBase = unitPrice * qty;
                    const lineTotal = lineBase + lineCustomization;

                    // Freeze values onto the persisted line item
                    item.productTitle = prod.title || '';
                    item.variantTitle = variantDoc?.title || '';
                    item.sku = variantDoc?.sku || prod.sku || '';
                    item.unitPrice = unitPrice;
                    item.customizationFee = feePerUnit;
                    item.lineTotal = lineTotal;
                    item.fulfillmentType = prod.itemType || 'physical';

                    calculatedSubtotal += lineBase;
                    calculatedCustomizationTotal += lineCustomization;
                    calculatedAmount += lineTotal;
                  }

                  const shippingFee = Number(data.shippingFee || data.fulfillment?.shippingFee || 0);
                  const taxAmount = Number(data.taxAmount || 0);
                  const grandTotal = calculatedAmount + shippingFee + taxAmount;
                  data.subtotal = calculatedSubtotal;
                  data.totalCustomizationFees = calculatedCustomizationTotal;
                  data.shippingFee = shippingFee;
                  data.taxAmount = taxAmount;
                  data.taxReviewStatus = data.taxReviewStatus || 'pending_accountant_review';
                  data.amount = grandTotal;
                  data.total = grandTotal;
                  data.grandTotalPiastres = toIntegerPiastres(grandTotal, 'Order grand total');

                  if (data.deliveryMethod === 'pickup') {
                    if (!data.fulfillmentNotes || !data.fulfillmentNotes.includes('Office Pickup')) {
                      data.fulfillmentNotes = data.fulfillmentNotes ? `${data.fulfillmentNotes} (Office Pickup)` : 'Office Pickup';
                    }
                  }

                  if (!data.orderNumber) {
                    try {
                      const pool = (req.payload?.db as any)?.pool;
                      if (pool) {
                        const seqRes = await pool.query("SELECT nextval('order_number_seq') AS seq");
                        const seq = seqRes.rows[0]?.seq || Math.floor(10000 + Math.random() * 90000);
                        data.orderNumber = `MWH-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
                      } else {
                        data.orderNumber = `MWH-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                      }
                    } catch {
                      data.orderNumber = `MWH-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
                    }
                  }

                  if (!data.orderStatus) {
                    data.orderStatus = 'pending';
                  }
                  if (!data.paymentStatus) {
                    data.paymentStatus = 'unpaid';
                  }
                  if (!data.fulfillmentStatus) {
                    data.fulfillmentStatus = 'unfulfilled';
                  }

                  if (!data.auditLog || data.auditLog.length === 0) {
                    data.auditLog = [
                      {
                        entry: `Order created in pending state. Frozen total: ${calculatedAmount} EGP.`,
                      },
                    ];
                  }

                  return data;
                },
              ],
            },
          };
        },
      },
    }),
  ],
});
