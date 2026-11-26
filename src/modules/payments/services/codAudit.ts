import type { Order } from '@/payload-types';

const prefix = 'cod-settlement:';

type CollectionAudit = {
  action: 'collected' | 'collection_rejected';
  code?: 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH';
  actor: number;
  at: string;
  reference: string;
  expectedAmountPiastres: number;
  submittedAmountPiastres: number;
  expectedCurrency: string;
  submittedCurrency: string;
};

type RemittanceAudit = {
  action: 'remitted';
  actor: number;
  at: string;
  reference: string;
};

type CodAudit = CollectionAudit | RemittanceAudit;

export function codAuditEntries(log: Order['auditLog']): string[] {
  return (Array.isArray(log) ? log : []).flatMap(({ entry }) =>
    typeof entry === 'string' && entry.startsWith(prefix) ? [entry] : []);
}

export function readCodAudit(log: Order['auditLog']): CodAudit[] {
  return codAuditEntries(log).map((entry) => JSON.parse(entry.slice(prefix.length)) as CodAudit);
}

export function codAuditEntry(audit: CodAudit) {
  return prefix + JSON.stringify(audit);
}
