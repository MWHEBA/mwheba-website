# MWHEBA 2.0 | Administrative Handover & Operations Guide

**Audience:** Agency Operations, Production Workshop, Finance Officers, Creative Directors, and System Administrators.

---

## 1. Access & Role-Based Access Control (RBAC)

The Payload Admin panel is accessible at `https://mwheba.com/admin`. 

| Role | Permitted Areas | Prohibited Areas |
|---|---|---|
| **super_admin** | Full access to all collections, settings, users, and audit logs | None |
| **operations** | Orders, Fulfillment Jobs, Products, Delivery Settings, Courier Remittances | Financial settlement approvals, user role elevation |
| **finance** | Bank Transfers review, Courier Remittance reconciliation, Financial Ledgers | Modifying product catalog, modifying design briefs |
| **creative** | Service fulfillment jobs, client design briefs, vector artwork assets | Courier settlements, user passwords, physical printing |
| **customer** | Customer-facing portal (`/ar/account/orders/...`), brief submissions | Any `/admin` access |

---

## 2. Managing the B2B Product Catalog

### 2.1 Physical Promotional Merchandise (MOQ = 10)
- **Minimum Order Quantity:** Strictly set to `10`. The system automatically blocks any cart where the aggregate of variants for that Product ID is under 10 units.
- **Customization Fee:** Defined per unit (e.g., 15 EGP/unit). This is itemized separately in checkout quotes and order summaries.
- **Variants:** Colors, sizes, and materials are configured under `variantTypes` and `variantOptions` and assigned to products.

### 2.2 Digital Fixed Services (MOQ = 1)
- Services (e.g. Brand Identity Design, Web Development) have MOQ = `1`.
- Physical delivery options are automatically hidden during checkout for service-only orders.
- Upon order confirmation, the system creates a dedicated `fulfillment-job` on the `service` track with status `pending_brief`.

---

## 3. Order Processing & Operations Fulfillment

Orders automatically split their lines into decoupled fulfillment tracks:

```
[Customer Places Mixed Order]
        |
        +---> Physical Item Line ---> Track: physical ---> In-House Print Workshop
        |
        +---> Service Item Line  ---> Track: service  ---> Creative Direction Team
```

### 3.1 Physical Print Workshop Workflow
1. **Uncustomized Goods:** Advance directly to `queued` -> `in_printing` -> `completed`.
2. **Customized Goods (with vector logo):** Held in `pending_artwork_approval` until digital proof is uploaded and customer approves via the portal.
3. **Pre-Production Payment Clearance Gate:** When the operational policy requires payment clearance, physical production (`in_printing`) is locked until finance clears the bank transfer or cash deposit.

### 3.2 Service & Creative Brief Intake
1. The client navigates to their order details page (`/[locale]/account/orders/[id]/brief`) and submits their creative brief and brand assets.
2. The Creative Director reviews the brief in Payload Admin and initiates production.

---

## 4. Finance & Payment Reconciliation

### 4.1 Bank Wire Transfer Verification
1. Clients upload bank transfer slips at `/[locale]/account/orders/[id]`.
2. Finance officers access the **Finance Verification Panel** (`/[locale]/finance/verification`) or `/admin/collections/bank-transfers`.
3. The officer inspects the attached wire receipt, enters the matching internal bank transaction code, and clicks **Approve**.
4. The system atomically transitions the order to `paid`, logs the transaction to the financial ledger, and clears production gates.

### 4.2 Courier Cash on Delivery (COD) Settlements
1. Couriers collect cash upon package delivery.
2. The courier cash collection is recorded via the authorized settlement API (`recordCodCollection`), setting `remittanceStatus: 'collected_by_courier'`.
3. At the end of the day or billing cycle, courier companies remit bulk cash batches.
4. Finance officers reconcile the batch via `reconcileCourierRemittanceBatch`, verifying gross collections minus shipping fees against the net bank deposit.

---

## 5. Content Management (Bilingual Pages, Blog & Portfolio)

1. **Bilingual Isolation:** Content, headings, slugs, and SEO metadata are maintained independently for Arabic (`ar`) and English (`en`).
2. **Strict Media Provenance:** Use authentic high-resolution agency media files (`media` collection). Never publish low-resolution synthetic placeholders.
3. **Draft Mode:** Content editors can preview unpublished pages using Payload's Draft Mode before publishing.
