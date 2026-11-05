# MWHEBA 2.0 | Role-Based Access Control (RBAC) Matrix & Operations Runbook

> **Scope:** Internal Staff & External Customer Access Governance  
> **Source of Truth:** `src/modules/identity/access/roles.ts`  
> **Security Invariant:** Least Privilege Access & Anti-Privilege Escalation

---

## 1. System Role Definitions

| Role Identifier | Title & Department | Core Responsibility |
|---|---|---|
| `super_admin` | Managing Director / CTO | Unrestricted system governance, user role assignment, system settings, global audit logs. |
| `catalog_manager` | E-Commerce / Inventory Operations | Managing merchandise products, variant matrices, MOQ thresholds, and category taxonomies. |
| `operations` | Factory & Print Production | Managing physical production queues, proofs, parcel dispatches, and delivery status updates. |
| `creative_director` | Design & Media Studio | Managing service intake workflows, reviewing client design briefs, and fulfilling digital service lines. |
| `finance` | Accounting & Treasury | Auditing COD courier remittances, verifying corporate bank transfer receipts, and financial ledger review. |
| `marketer` | Marketing & Communications | Drafting and publishing blog articles, portfolio case studies, and corporate CMS pages. |
| `customer` | Corporate / Individual Buyer | Managing cart checkout, submitting artwork briefs, approving print proofs, and viewing owned orders. |

---

## 2. Granular Permissions Matrix

| Entity / Resource | `super_admin` | `catalog_manager` | `operations` | `creative_director` | `finance` | `marketer` | `customer` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Users & Roles** | Full Access | View Self | View Self | View Self | View Self | View Self | View/Edit Self |
| **Catalog Products** | Full Access | Create/Edit/Publish | Read Only | Read Only | Read Only | Draft Only | Read Published |
| **B2B Orders** | Full Access | Read Only | Full Operational | Read Service Jobs | Read & Audit | No Access | Own Orders Only |
| **Client Artwork** | Full Access | No Access | Download/Print | Download Art | No Access | No Access | Own Assets Only |
| **Service Briefs** | Full Access | No Access | No Access | Download/Intake | No Access | No Access | Submit/Own Brief |
| **Fulfillment Jobs** | Full Access | No Access | Physical Track | Service Track | Read Only | No Access | Order Status |
| **Bank Transfers** | Full Access | No Access | Read Status | No Access | Verify/Approve | No Access | Submit Wire Slip |
| **COD Remittances** | Full Access | No Access | Courier Dispatch | No Access | Reconcile Batch | No Access | No Access |
| **Corporate CMS** | Full Access | No Access | No Access | No Access | No Access | Create/Publish | Read Published |

---

## 3. Strict Privilege Escalation Defenses

To prevent internal role elevation or lateral account takeovers:
1. **Protected Role Mutation:** Any request attempting to assign or alter `roles` on a user account is intercepted by `Users.ts` collection hooks. Only authenticated sessions bearing the `super_admin` role can mutate roles.
2. **System Seed Exemption:** Initial admin seeds require explicit internal execution context (`context: { isSystemSeed: true }`) to create privileged accounts.
3. **Decoupled Financial Mutability:** Direct HTTP creation or modification of `payment-collections` and `courier-remittances` from Payload Admin or REST API is permanently forbidden. Mutation is exclusively permitted to the settlement and reconciliation engine within verified server transactions.
4. **Artwork Privacy Separation:** Finance officers have zero read access to client private vector artwork files, ensuring strict data boundaries.

---

## 4. Standard Operating Procedure (SOP): Staff Onboarding

When a new employee joins the agency:
1. Super Admin logs into `/admin`.
2. Navigates to **Users** -> **Create New**.
3. Enters official corporate email (`@mwheba.com`), full name, and generates an initial password.
4. Selects **exactly one primary operational role** corresponding to their department (e.g., `finance` for accountants, `operations` for factory staff).
5. The employee logs in, updates their password, and receives access strictly constrained to their departmental panel.
