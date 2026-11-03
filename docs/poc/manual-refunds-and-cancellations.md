# Manual Refund and Cancellation Procedure (POC-11)

## Scope

This procedure covers Phase 1 COD and manual bank transfer orders. It is an operational draft for finance review, not an automated refund implementation.

## Cancellation before collection

1. Confirm order identity, customer, payment method, fulfillment state, and whether production or dispatch has begun.
2. Record the reason, operator, and timestamp in the order audit trail. Apply the allowed cancellation transition; preserve the payment status as unpaid when no collection occurred.
3. If goods were customized or dispatched, assign operations to resolve production or return costs before promising any refund.

## Refund after bank transfer or COD collection

1. Finance verifies the original settled collection or approved bank transfer against the bank statement, courier remittance, and order amount.
2. Finance records a refund request with the order ID, customer identity, amount in integer piastres, reason, original payment reference, and approver. Partial refunds must not exceed the remaining refundable balance.
3. A second authorized finance user verifies the bank destination or cash payout details through an independent channel and approves the disbursement.
4. Finance executes the disbursement outside the application, then records the external transaction reference, amount, date, and evidence. Keep the original collection record intact; represent the refund as a separate adjustment.
5. Reconcile the adjustment to the bank statement or cash ledger. Mark the refund complete only after reconciliation and notify the customer with the documented reference.

## Controls and recovery

- Never infer that a cancelled order has been refunded. Cancellation, payment, collection, and refund are separate states.
- Reject duplicate disbursement references and amounts above the remaining refundable balance.
- If a payout fails or is uncertain, leave it pending investigation; do not retry until finance confirms whether the first attempt settled.
- Retain the approval, payment evidence, and reconciliation record for audit. A later automated refund feature must use the same immutable adjustment trail.

## POC status

This document satisfies the nonblocking documentation alternative in POC-11. The application does not yet implement a refund request ledger or two-person approval workflow; those controls must be implemented and tested before operational use.
