import { APIError, buildConfig, type Access, type CollectionBeforeChangeHook } from 'payload';
import sharp from 'sharp';
import { lineHasCustomization, customizationFeePerUnit } from '@/modules/cart-checkout/logic/customizationFee';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { ecommercePlugin } from '@payloadcms/plugin-ecommerce';

import { Users } from './modules/identity/collections/Users';
import { hasRole, isStorefrontCustomer } from './modules/identity/access/roles';
import { customerEmailAdapter, customerSiteOrigin } from './modules/identity/services/customerMail';
import { Media } from './modules/customization/collections/Media';
import { ArtworkAssets } from './modules/customization/collections/ArtworkAssets';
import { BankTransfers } from './modules/payments/collections/BankTransfers';
import { PaymentEvents } from './modules/payments/collections/PaymentEvents';
import { PaymentAttempts } from './modules/payments/collections/PaymentAttempts';
import { PaymentCollections } from './modules/payments/collections/PaymentCollections';
import { CourierRemittances } from './modules/payments/collections/CourierRemittances';
import { codAuditEntries } from './modules/payments/services/codAudit';
import { validateCodEligibility } from './modules/payments/services/codEngine';
import { FulfillmentJobs } from './modules/fulfillment/collections/FulfillmentJobs';
import { ServiceBriefs } from './modules/fulfillment/collections/ServiceBriefs';
import { Categories } from './modules/catalog/collections/Categories';
import { ProductTags } from './modules/catalog/collections/ProductTags';
import { productsCollectionOverride } from './modules/catalog/collections/Products';
import { variantsCollectionOverride } from './modules/catalog/collections/Variants';
import { resolveCatalogSku, resolveCatalogUnitPrice } from './modules/catalog/services/catalogPrice';
import { catalogSelectionError } from './modules/catalog/services/catalogProduct';
import { isRetiredCart } from './modules/cart-checkout/services/cartStorage';
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
import { calculateCheckoutAmounts, priceCheckoutLine } from './modules/orders/logic/checkoutAmounts';
import { getOrderLifecycleEndpoint, postOrderLifecycle } from './modules/orders/endpoints/orderLifecycle';
import { lifecycleAuditEntries } from './modules/orders/services/orderLifecycle';
import { inventoryEndpoints } from './modules/inventory/endpoints/inventory';
// Paymob gateway engine is preserved dormant for Phase 2 (Decision D-008)
// import { paymobWebhookHandler } from './modules/payments/endpoints/paymobWebhook';
import { signPrivateMedia, downloadPrivateMedia } from './modules/customization/endpoints/privateMedia';

const dbUri = process.env.DATABASE_URI || 'postgres://postgres@127.0.0.1:5432/mwheba_dev';
const isPostgres = dbUri.startsWith('postgres://') || dbUri.startsWith('postgresql://');

export default buildConfig({
  sharp,
  email: customerEmailAdapter(),
  serverURL: customerSiteOrigin(),
  secret: process.env.PAYLOAD_SECRET || 'mwheba-dev-foundation-secret-key-32chars-min',
  admin: {
    user: Users.slug,
    components: {
      beforeDashboard: ['@/modules/inventory/admin/InventoryControls#InventoryControls'],
    },
  },
  endpoints: [
    ...inventoryEndpoints,
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
    ProductTags,
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
      addresses: {
        addressesCollectionOverride: ({ defaultCollection }) => ({
          ...defaultCollection,
          fields: defaultCollection.fields.map((field) =>
            field.type === 'select' && field.name === 'country'
              ? { ...field, options: [...field.options, { label: 'Egypt', value: 'EG' }] }
              : field),
          access: {
            ...defaultCollection.access,
            create: ({ req }) => hasRole(req.user, ['super_admin']) || isStorefrontCustomer(req.user),
          },
          hooks: {
            ...defaultCollection.hooks,
            beforeChange: [
              ...(defaultCollection.hooks?.beforeChange ?? []),
              ({ data, operation, originalDoc }) => {
                // An existing address can be edited or deleted, but never reassigned to
                // another account, which could invalidate a customer's default address.
                if (operation === 'update') data.customer = originalDoc.customer;
                return data;
              },
            ],
          },
        }),
      },
      // Stock is maintained by the canonical inventory ledger (D-018).
      inventory: false,
      access: {
        isAdmin: ({ req }: any) => hasRole(req.user, ['super_admin']),
        adminOnlyFieldAccess: ({ req }: any) => hasRole(req.user, ['super_admin']),
        adminOrPublishedStatus: ({ req }: any) => {
          if (hasRole(req.user, ['super_admin', 'catalog_manager', 'marketer'])) return true;
          return { _status: { equals: 'published' } };
        },
        isCustomer: ({ req }) => isStorefrontCustomer(req.user),
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
        variants: { variantsCollectionOverride },
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
          // Storefront writes go through the signed session and locked cart service.
          // Keep native reads and staff administration available.
          const staffCartAccess: Access = ({ req }) => hasRole(req.user, ['super_admin']);
          defaultCollection.access = {
            ...defaultCollection.access,
            create: staffCartAccess,
            update: staffCartAccess,
            delete: staffCartAccess,
          };
          defaultCollection.endpoints = [];
          defaultCollection.hooks = {
            ...defaultCollection.hooks,
            beforeChange: [
              ({ originalDoc }) => {
                if (originalDoc && isRetiredCart(originalDoc)) {
                  throw new APIError('CART_NOT_ACTIVE', 409, undefined, true);
                }
              },
              ...(defaultCollection.hooks?.beforeChange ?? []).map<CollectionBeforeChangeHook>((hook) => (args) =>
                args.req.context?.preserveCartSubtotal ? args.data : hook(args)),
            ],
          };
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
            access: { create: () => false, update: () => false },
            admin: {
              readOnly: true,
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
            admin: {
              ...defaultCollection.admin,
              useAsTitle: 'orderNumber',
              defaultColumns: ['orderNumber', 'orderStatus', 'fulfillmentStatus', 'paymentStatus', 'remittanceStatus', 'createdAt'],
              components: {
                ...defaultCollection.admin?.components,
                beforeListTable: [
                  ...(defaultCollection.admin?.components?.beforeListTable ?? []),
                  '@/modules/payments/admin/CodQueues#CodQueues',
                ],
              },
            },
            access: {
              ...defaultCollection.access,
              create: () => false,
              delete: () => false,
              read: (args) => hasRole(args.req.user, ['super_admin', 'operations', 'finance'])
                || defaultCollection.access?.read?.(args) || false,
            },
            endpoints: [
              ...(defaultCollection.endpoints || []),
              { path: '/:id/lifecycle', method: 'get', handler: getOrderLifecycleEndpoint },
              { path: '/:id/lifecycle', method: 'post', handler: postOrderLifecycle },
            ],
            fields: [
              ...defaultCollection.fields,
              {
                name: 'orderLifecycleControls',
                type: 'ui',
                admin: {
                  position: 'sidebar',
                  components: { Field: '@/modules/orders/admin/OrderLifecycleControls#OrderLifecycleControls' },
                },
              },
              {
                name: 'codOrderControls',
                type: 'ui',
                admin: {
                  position: 'sidebar',
                  components: { Field: '@/modules/payments/admin/CodOrderControls#CodOrderControls' },
                },
              },
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
                  { label: 'Cash in Company Custody', value: 'remitted_to_company' },
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
                access: { read: ({ req }) => hasRole(req.user, ['super_admin', 'operations', 'finance']) },
                fields: [
                  {
                    name: 'entry',
                    type: 'text',
                  },
                ],
                admin: {
                  readOnly: true,
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
                    const codCollectionEngine = Boolean(context?.isCodCollectionEngine || req.context?.isCodCollectionEngine);
                    const codRemittanceEngine = Boolean(context?.isCourierRemittanceEngine || req.context?.isCourierRemittanceEngine);
                    if (!codCollectionEngine && !codRemittanceEngine && data.auditLog !== undefined
                      && JSON.stringify(codAuditEntries(data.auditLog)) !== JSON.stringify(codAuditEntries(originalDoc.auditLog))) {
                      throw new APIError('COD_SETTLEMENT_ENGINE_ONLY: Cash settlement audit entries are managed by the settlement workflow.', 409);
                    }
                    if (originalDoc.paymentMethod === 'cod') {
                      const changed = (field: string) => data[field] !== undefined
                        && (data[field] ?? null) !== (originalDoc[field] ?? null);
                      const changedDetail = (field: string) =>
                        (data.codDetails === null || data.codDetails?.[field] !== undefined)
                        && (data.codDetails?.[field] ?? null) !== (originalDoc.codDetails?.[field] ?? null);
                      const changesCollection = ['requiredAmount', 'collectedAmount', 'collectorType', 'collectorName',
                        'collectedAt', 'collectionReference'].some(changedDetail)
                        || ['paidAt', 'reconciliationReference'].some(changed)
                        || (data.paymentStatus !== 'paid' && changed('paymentStatus'));
                      const changesRemittance = changedDetail('courierRemittanceBatchId')
                        || (!codCollectionEngine && changed('remittanceStatus'));
                      if ((!codCollectionEngine && changesCollection) || (!codRemittanceEngine && changesRemittance)) {
                        throw new APIError('COD_SETTLEMENT_ENGINE_ONLY: Use the cash collection or courier remittance workflow.', 409);
                      }
                    }
                    const lifecycleEngine = Boolean(context?.orderLifecycleEngine || req.context?.orderLifecycleEngine);
                    if (!lifecycleEngine) {
                      const changesTerminal = ['status', 'orderStatus', 'fulfillmentStatus'].some((field) =>
                        data[field] !== undefined && data[field] !== originalDoc[field]
                        && ['cancelled', 'returned_to_origin'].some((status) =>
                          data[field] === status || originalDoc[field] === status),
                      );
                      const changesRefusal = ['refusalReason', 'refusalRecordedAt'].some((field) => (
                        (data.codDetails === null || data.codDetails?.[field] !== undefined)
                          && (data.codDetails?.[field] ?? null) !== (originalDoc.codDetails?.[field] ?? null)
                      ));
                      const changesAudit = data.auditLog !== undefined
                        && JSON.stringify(lifecycleAuditEntries(data.auditLog)) !== JSON.stringify(lifecycleAuditEntries(originalDoc.auditLog));
                      if (changesTerminal || changesRefusal || changesAudit) {
                        throw new APIError('ORDER_LIFECYCLE_ENGINE_ONLY: Use the order cancellation, refusal, or return inspection workflow.', 409);
                      }
                    }

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
                        if (!isAuthorizedCod || !hasCollectionRef || !req.transactionID) {
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
                    if (data.deliveryMethod !== undefined) {
                      data.deliveryMethod = originalDoc.deliveryMethod;
                    }
                    if (data.shippingAddress !== undefined) {
                      data.shippingAddress = originalDoc.shippingAddress;
                    }
                    if (data.appliedTariff !== undefined) {
                      data.appliedTariff = originalDoc.appliedTariff;
                    }
                    for (const field of ['orderNumber', 'cart', 'idempotencyKey', 'currency', 'appliedProductionPolicy', 'customer', 'customerEmail']) {
                      if (data[field] !== undefined) data[field] = originalDoc[field];
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
                    data.grandTotalPiastres = originalDoc.paymentMethod === 'cod'
                      ? originalDoc.grandTotalPiastres ?? toIntegerPiastres(
                        Number(originalDoc.amount ?? originalDoc.total), 'Frozen COD order total',
                      )
                      : toIntegerPiastres(curComputedTotal, 'Order ledger total');
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
                        depth: 0,
                        joins: false,
                        draft: false,
                        disableErrors: true,
                        req,
                      });
                      productMap.set(prodId, product);
                    }

                    const varId = typeof item.variant === 'object' && item.variant !== null ? item.variant.id : item.variant ?? undefined;
                    if (varId !== undefined && !variantMap.has(varId)) {
                      const variant = await req.payload.findByID({
                        collection: 'variants',
                        id: varId,
                        depth: 0,
                        draft: false,
                        disableErrors: true,
                        req,
                      });
                      variantMap.set(varId, variant);
                    }
                    const selectionError = catalogSelectionError(
                      productMap.get(prodId),
                      varId,
                      varId === undefined ? undefined : variantMap.get(varId),
                      Boolean(item.artworkAssetId),
                    );
                    if (selectionError) {
                      throw new APIError(selectionError, 422, undefined, true);
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
                    const eligibility = validateCodEligibility(data.items.map((item: any) => {
                      const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                      return { itemType: productMap.get(prodId)?.itemType };
                    }));
                    if (!eligibility.eligible) {
                      throw new APIError(`${eligibility.code}: ${eligibility.message}`, 422);
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

                  // 5. Freeze the current catalog price and SKU for each line.
                  const pricedLines = data.items.map((item: any) => {
                    const prodId = typeof item.product === 'object' && item.product !== null ? item.product.id : item.product;
                    const prod = productMap.get(prodId);

                    const varId = typeof item.variant === 'object' && item.variant !== null ? item.variant.id : item.variant;
                    const variantDoc = varId ? variantMap.get(varId) : undefined;
                    const unitPrice = resolveCatalogUnitPrice(prod, variantDoc) ?? 0;

                    const qty = Number(item.quantity) || 1;
                    const feePerUnit = customizationFeePerUnit(item, prod);
                    const linePrice = priceCheckoutLine(unitPrice, feePerUnit, qty);

                    // Freeze values onto the persisted line item
                    item.productTitle = prod.title || '';
                    item.variantTitle = variantDoc?.title || '';
                    item.sku = resolveCatalogSku(prod, variantDoc) ?? '';
                    item.unitPrice = unitPrice;
                    item.customizationFee = feePerUnit;
                    item.lineTotal = linePrice.lineTotal;
                    item.fulfillmentType = prod.itemType || 'physical';

                    return linePrice;
                  });

                  const shippingFee = Number(data.shippingFee ?? data.fulfillment?.shippingFee ?? 0);
                  const taxAmount = Number(data.taxAmount || 0);
                  const amounts = calculateCheckoutAmounts(pricedLines, shippingFee, taxAmount);
                  if (amounts.grandTotalPiastres <= 0) {
                    throw new Error('INVALID_MONETARY_AMOUNT: Order grand total must be greater than zero.');
                  }
                  data.subtotal = amounts.subtotal;
                  data.totalCustomizationFees = amounts.totalCustomizationFees;
                  data.shippingFee = amounts.shippingFee;
                  data.taxAmount = amounts.taxAmount;
                  data.taxReviewStatus = data.taxReviewStatus || 'pending_accountant_review';
                  data.amount = amounts.grandTotal;
                  data.total = amounts.grandTotal;
                  data.grandTotalPiastres = amounts.grandTotalPiastres;

                  if (data.deliveryMethod === 'pickup' && !data.appliedTariff?.configurationReference) {
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
                        entry: `Order created in pending state. Frozen total: ${amounts.grandTotal} EGP.`,
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
