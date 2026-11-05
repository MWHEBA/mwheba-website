# MWHEBA 2.0 | Quality Gates and Definition of Done

## Global definition of done
A ticket is complete only when:
- Implementation matches approved scope and architecture.
- Relevant automated tests pass.
- Server-side validation and authorization are in place.
- Database migrations are reversible or have a documented recovery plan.
- Errors are observable and do not leak secrets.
- Documentation and configuration examples are updated.
- Owner can verify acceptance criteria with concrete evidence.

## POC acceptance matrix
| ID | Scenario | Pass condition | Blocking? |
|---|---|---|---|
| **POC-01** | Physical product with mixed variants (5 Black + 5 White mugs of Product A = 10 units) | Variants aggregate to 10 units; correct subtotal, separate customization fee, and checkout permitted | **Yes (Blocking)** |
| **POC-02** | Incomplete cart quantity (e.g. 5 Black mugs of Product A) | Cart mutation succeeds and persists; UI displays "5 more units required"; checkout/order creation is blocked server-side | **Yes (Blocking)** |
| **POC-02B** | Cross-product isolation (5 mugs of Product A + 5 mugs of Product B) | Items persist in cart, but checkout and payment initiation are blocked server-side; cross-product pooling strictly rejected | **Yes (Blocking)** |
| **POC-03** | Per-line logo upload | Private file bound to correct cart item and retained immutably in order snapshot | **Yes (Blocking)** |
| **POC-04** | Fixed-price service | Quantity 1 and no physical shipping requirement; fulfillment type marked as service intake | **Yes (Blocking)** |
| **POC-05** | Mixed cart (10 mugs of Product A + 1 service package) | Both lines checkout correctly and retain distinct fulfillment types in order snapshot | **Yes (Blocking)** |
| **POC-06** | Cash on Delivery (COD) Order Lifecycle & Decoupled Execution | COD order for physical goods confirmed and progresses through fulfillment (`processing` → `shipped` → `delivered`) while strictly retaining `paymentStatus: 'unpaid'`; order creation, dispatch, and delivery NEVER trigger automatic `paid` status. Digital services and mixed carts attempting COD are rejected server-side with HTTP 422. | **Yes (Blocking)** |
| **POC-07** | COD Collection Recording, Idempotency & Courier Remittance | Explicit settlement logging: required amount, collected amount, collector identity (courier/office), timestamp, receipt/transaction reference. Duplicate collection confirmations rejected idempotently with zero duplicate financial records. Decouples courier collection (`collected_by_courier`) from MWHEBA bank remittance (`remitted_to_company`). | **Yes (Blocking)** |
| **POC-08** | COD Delivery Refusal, Cancellation & Custom Proof Gate | Refusal at delivery or failed delivery transitions order to `returned_to_origin` / `delivery_failed` with `paymentStatus: 'unpaid'` (strictly zero false payments or false refunds). Physical products with custom artwork strictly require explicit client proof sign-off (`proof_approved`) prior to production commencement. | **Yes (Blocking)** |
| **POC-08B** | Online payment gateway (Paymob) | Live sandbox card/wallet processing & multi-assertion HMAC pipeline. **Formally deferred to Phase 2 per Decision D-008; does not block Phase 1 launch.** | **No (Deferred to Phase 2)** |
| **POC-09** | Bank transfer | Pending verification until authorized finance review | **Yes (Blocking)** |
| **POC-10** | Unauthorized verification | Non-finance user mutation rejected with HTTP 403 and auditable | **Yes (Blocking)** |
| **POC-11** | Basic refund / cancellation | Record refund transaction or document operational manual refund process; does not block MVP launch | **No (Non-blocking)** |
| **POC-12** | Admin usability & plugin extension | Core content, product, order, and customization tasks manageable in unified `/admin` | **Yes (Blocking)** |

**Blocking failures:** Any flaw in payment correctness (including amount, currency mismatch, or COD collection leakage), server-side checkout MOQ enforcement, line-item artwork retention, unauthorized finance approvals, or mixed-cart fulfillment.
**Non-blocking justification for POC-11:** Direct automated API refunds are deferred with Paymob; manual finance bank disbursement is the established operational standard for launch, provided the ledger records manual adjustments.

## Test layers
- Unit: cart aggregation rules, remaining quantity calculations, COD collection calculations, bank transfer verifications, totals.
- Integration: Payload hooks, database transactions, private local file storage, COD settlement engine, concurrency locking.
- E2E: browse → customize → add to cart (incremental quantities) → verify UI notices → checkout validation → payment → admin fulfillment.
- Security: upload abuse, privilege escalation, webhook spoofing, amount tampering, replay, rate limiting.
- Regression: bilingual navigation, 4-tier legacy URL status governance (asserting 200, 301, 410 per redirect map), SEO metadata, accessibility.
- Operational: backup/restore, failed job retry, webhook backlog and downtime recovery, rollback and reconciliation drill.

## Release checklist
- Staging mirrors critical production behavior.
- No live credentials in development.
- Payment provider sandbox and production modes are clearly isolated.
- Financial reconciliation procedures documented.
- Backups and restoration tested.
- Monitoring/alerting assigned to an owner.
- Content and redirects reviewed.
- Manual production go-live approval recorded.
