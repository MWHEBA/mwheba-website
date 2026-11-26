'use client';

import { Button } from '@payloadcms/ui';
import { useState, type FormEvent } from 'react';
import { CodNotice, codError, postCod, type useCodLocale } from './codAdmin';
import type { CourierCollection } from './CodQueues';
import styles from './codAdmin.module.css';

type BatchResult = {
  reference: string;
  id?: number;
  replayed: boolean;
  variance: boolean;
};

type Props = {
  i18n: ReturnType<typeof useCodLocale>;
  records: CourierCollection[];
  saving: boolean;
  disabled: boolean;
  onSaving: (saving: boolean) => void;
  onClear: () => void;
  onSuccess: (batch: BatchResult) => void;
};

export function CodRemittanceForm({ i18n, records, saving, disabled, onSaving, onClear, onSuccess }: Props) {
  const { label, amount } = i18n;
  const [approveVariance, setApproveVariance] = useState(false);
  const [error, setError] = useState<string>();
  const selectedGross = records.reduce((sum, record) => sum + Math.round(record.amount * 100), 0) / 100;
  const tooMany = records.length > 200;

  async function reconcile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || saving || !records.length || tooMany) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    setError(undefined);
    onSaving(true);
    try {
      const result = await postCod<{ status: string; batchId: string; remittanceId: number; discrepancy?: number }>(
        '/api/payments/cod/remit',
        {
          batchId: value('batchId'),
          courierCompany: value('courierCompany'),
          orderIds: records.map(({ order }) => typeof order === 'object' ? order.id : order),
          grossCollectedAmount: Number(value('grossCollectedAmount')),
          courierFeeDeductions: Number(value('courierFeeDeductions')),
          otherDeductions: Number(value('otherDeductions')),
          netDepositAmount: Number(value('netDepositAmount')),
          depositSlipReference: value('depositSlipReference'),
          depositDate: value('depositDate'),
          varianceApproved: approveVariance,
          varianceNotes: approveVariance ? value('varianceNotes') : '',
        },
      );
      form.reset();
      setApproveVariance(false);
      onSuccess({
        reference: result.batchId,
        id: result.remittanceId,
        replayed: result.status === 'ALREADY_RECONCILED',
        variance: Boolean(result.discrepancy),
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'COD_REQUEST_FAILED');
    } finally {
      onSaving(false);
    }
  }

  if (!records.length) return null;

  return (
    <form onSubmit={(event) => void reconcile(event)} className={styles.stack}>
      <div className={styles.actions}>
        <strong>{label('Selected collections', 'عمليات التحصيل المحددة')} {records.length}</strong>
        <span>{label('Recorded gross', 'الإجمالي المسجّل')} {amount(selectedGross)}</span>
        <Button type="button" size="xsmall" margin={false} buttonStyle="secondary" disabled={saving}
          onClick={() => { onClear(); setError(undefined); setApproveVariance(false); }}>
          {label('Clear selection', 'إلغاء التحديد')}
        </Button>
      </div>
      <details>
        <summary>{label('Selected receipt references', 'مراجع الإيصالات المحددة')}</summary>
        <ul>{records.map((record) => <li key={record.id}><bdi>{record.receiptReference}</bdi></li>)}</ul>
      </details>
      {tooMany && <CodNotice error>{label('Select up to 200 collections per batch.', 'يمكن تحديد ٢٠٠ عملية تحصيل على الأكثر لكل دفعة.')}</CodNotice>}
      {error && <CodNotice error>{codError(label, error, 'Could not confirm the batch. Retry with the same details.',
        'تعذّر تأكيد الدفعة. أعد المحاولة بالبيانات نفسها.')}</CodNotice>}
      <fieldset className={styles.fields} disabled={disabled || saving || tooMany}>
        <legend>{label('Reconcile courier remittance', 'مطابقة توريد مبالغ الشحن')}</legend>
        <label>{label('Batch reference', 'مرجع الدفعة')}
          <input name="batchId" dir="auto" required maxLength={120} />
        </label>
        <label>{label('Courier company', 'شركة الشحن')}
          <input name="courierCompany" dir="auto" required maxLength={120} />
        </label>
        <label>{label('Reported gross (EGP)', 'الإجمالي المُبلّغ عنه (ج.م.)')}
          <input name="grossCollectedAmount" type="number" inputMode="decimal" required min="0.01" step="0.01" />
        </label>
        <label>{label('Courier fees (EGP)', 'رسوم شركة الشحن (ج.م.)')}
          <input name="courierFeeDeductions" type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0" />
        </label>
        <label>{label('Other deductions (EGP)', 'الخصومات الأخرى (ج.م.)')}
          <input name="otherDeductions" type="number" inputMode="decimal" min="0" step="0.01" defaultValue="0" />
        </label>
        <label>{label('Net deposit (EGP)', 'صافي الإيداع (ج.م.)')}
          <input name="netDepositAmount" type="number" inputMode="decimal" required min="0" step="0.01" />
        </label>
        <label>{label('Deposit slip reference', 'مرجع إيصال الإيداع')}
          <input name="depositSlipReference" dir="auto" required maxLength={120} />
        </label>
        <label>{label('Deposit date', 'تاريخ الإيداع')}
          <input name="depositDate" type="date" required />
        </label>
        <div>
          <label>
            <input type="checkbox" checked={approveVariance} onChange={(event) => setApproveVariance(event.target.checked)} />{' '}
            {label('Approve a deposit variance', 'اعتماد فرق في مبلغ الإيداع')}
          </label>
        </div>
        {approveVariance && <label>{label('Reason for approving the variance', 'سبب اعتماد الفرق')}
          <textarea name="varianceNotes" dir="auto" rows={3} required maxLength={1000} />
        </label>}
        <div className={styles.actions}>
          <Button type="submit" size="small" margin={false} disabled={disabled || saving || tooMany}>
            {saving ? label('Reconciling…', 'جارٍ إجراء المطابقة…') : label('Reconcile batch', 'مطابقة الدفعة')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
