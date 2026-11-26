'use client';

import { Button, useAuth, useConfig, useDocumentInfo, useTranslation } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User } from '@/payload-types';
import { hasRole } from '@/modules/identity/access/roles';

type Job = { id: number; status: string; productTitle?: string; nextStatus?: string };
type Balance = { balanceId: number; sku: string; remainingQuantity: number };
type OrderOperationState = { canCancel: boolean; canRefuse: boolean; canReceive: boolean; jobs: Job[]; balances: Balance[] };
type Action = 'cancel' | 'refuse' | 'receive_return';

export const orderLifecycleUpdatedEvent = 'mwheba:order-lifecycle-updated';

const statusLabels: Record<string, [string, string]> = {
  pending_artwork_approval: ['Awaiting artwork approval', 'بانتظار اعتماد التصميم'],
  queued: ['Queued', 'في قائمة الانتظار'],
  in_printing: ['In production', 'قيد الإنتاج'],
  quality_check: ['Quality check', 'مراجعة الجودة'],
  ready_for_pickup: ['Ready for pickup', 'جاهز للاستلام'],
  shipped: ['Dispatched', 'تم الشحن'],
  delivered: ['Delivered', 'تم التسليم'],
};

export function OrderLifecycleControls() {
  const { id } = useDocumentInfo();
  const { user } = useAuth<User>();
  const { config } = useConfig();
  const { i18n } = useTranslation();
  const router = useRouter();
  const permitted = hasRole(user, ['operations', 'super_admin']);
  const endpoint = `${config.routes.api}/orders/${id}/lifecycle`;
  const [language, setLanguage] = useState<'ar' | 'en'>();
  const ar = language ? language === 'ar' : i18n.language.startsWith('ar');
  const label = (en: string, arabic: string) => ar ? arabic : en;
  const statusLabel = (status: string) => statusLabels[status]?.[ar ? 1 : 0] ?? status;
  const [state, setState] = useState<OrderOperationState>();
  const [action, setAction] = useState<Action>();
  const [reason, setReason] = useState('');
  const [receipt, setReceipt] = useState('');
  const [counts, setCounts] = useState<Record<number, { received: string; sellable: string }>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string }>();

  useEffect(() => {
    if (!permitted || !id) return;
    const abort = new AbortController();
    setState(undefined);
    void fetch(endpoint, { signal: abort.signal }).then(async (response) => {
      if (!response.ok) throw Error('unavailable');
      setState(await response.json() as OrderOperationState);
    }).catch(() => {
      if (!abort.signal.aborted) setNotice({
        error: true, text: ar ? 'تعذر تحميل إجراءات الطلب.' : 'Could not load order operations.',
      });
    });
    return () => abort.abort();
  }, [endpoint, id, permitted, ar]);

  if (!permitted || !id) return null;

  async function run(url: string, body: object) {
    setBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw Error(result.error ?? label('The order update failed.', 'تعذر تحديث الطلب.'));
      setAction(undefined);
      setReason('');
      setReceipt('');
      setCounts({});
      setNotice({ error: false, text: label('Order update saved.', 'تم حفظ تحديث الطلب.') });
      window.dispatchEvent(new Event(orderLifecycleUpdatedEvent));
      router.refresh();
      const updated = await fetch(endpoint).catch(() => undefined);
      if (updated?.ok) setState(await updated.json() as OrderOperationState);
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : label('The order update failed.', 'تعذر تحديث الطلب.') });
    } finally {
      setBusy(false);
    }
  }

  const actions: Array<[Action, string, boolean | undefined]> = [
    ['cancel', label('Cancel before dispatch', 'إلغاء قبل الشحن'), state?.canCancel],
    ['refuse', label('Record delivery refusal', 'تسجيل رفض الاستلام'), state?.canRefuse],
    ['receive_return', label('Inspect received return', 'فحص المرتجع المستلَم'), state?.canReceive],
  ];
  const receivedLines = Object.entries(counts).filter(([, value]) => Number(value.received) > 0)
    .map(([balanceId, value]) => ({
      balanceId: Number(balanceId), receivedQuantity: Number(value.received), sellableQuantity: Number(value.sellable),
      hasCount: value.sellable.trim() !== '',
    }));

  return (
    <section id="order-operations" lang={ar ? 'ar' : 'en'} dir={ar ? 'rtl' : 'ltr'}
      aria-label={label('Order operations', 'عمليات الطلب')}>
      <h3>{label('Order operations', 'عمليات الطلب')}</h3>
      <Button size="xsmall" buttonStyle="secondary" type="button" disabled={busy}
        onClick={() => setLanguage(ar ? 'en' : 'ar')}>
        <span lang={ar ? 'en' : 'ar'}>{label('العربية', 'English')}</span>
      </Button>
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {state?.jobs.map((job) => (
        <div key={job.id}>
          <strong>{job.productTitle ?? `#${job.id}`}</strong>
          <p>{statusLabel(job.status)}</p>
          {job.nextStatus && (
            <Button buttonStyle="secondary" size="small" disabled={busy}
              onClick={() => void run(`${config.routes.api}/fulfillment/jobs/${job.id}/transition`, { to: job.nextStatus })}>
              {statusLabel(job.nextStatus)}
            </Button>
          )}
        </div>
      ))}
      {actions.filter(([, , enabled]) => enabled).map(([key, text]) => (
        <Button key={key} buttonStyle="secondary" size="small" disabled={busy}
          onClick={() => setAction(key)}>{text}</Button>
      ))}
      {action && (
        <fieldset disabled={busy} style={{ display: 'grid', gap: '0.75rem' }}>
          <legend>{actions.find(([key]) => key === action)?.[1]}</legend>
          <label>
            {label('Reason', 'السبب')}
            <textarea className="field-type text" rows={3} value={reason} maxLength={500}
              onChange={(event) => setReason(event.target.value)} />
          </label>
          {action === 'receive_return' && <>
            <label>
              {label('Return receipt reference', 'مرجع استلام المرتجع')}
              <input type="text" value={receipt} maxLength={100} onChange={(event) => setReceipt(event.target.value)} />
            </label>
            {state?.balances.filter((row) => row.remainingQuantity > 0).map((row) => {
              const values = counts[row.balanceId] ?? { received: '', sellable: '' };
              return (
                <fieldset key={row.balanceId}>
                  <legend>{row.sku}</legend>
                  <p>{label('Remaining to inspect', 'الكمية المتبقية للفحص')} {row.remainingQuantity}</p>
                  <label>
                    {label('Physically received', 'المستلَم فعليًا')}
                    <input type="number" min={0} max={row.remainingQuantity} step={1} value={values.received}
                      onChange={(event) => setCounts({ ...counts, [row.balanceId]: { ...values, received: event.target.value } })} />
                  </label>
                  <label>
                    {label('Sellable after inspection', 'الصالح للبيع بعد الفحص')}
                    <input type="number" min={0} max={Number(values.received)} step={1} value={values.sellable}
                      onChange={(event) => setCounts({ ...counts, [row.balanceId]: { ...values, sellable: event.target.value } })} />
                  </label>
                </fieldset>
              );
            })}
          </>}
          <Button size="small" disabled={!reason.trim() || busy
            || (action === 'receive_return' && (!receipt.trim() || receivedLines.length === 0
              || receivedLines.some(({ hasCount, receivedQuantity, sellableQuantity }) =>
                !hasCount || sellableQuantity > receivedQuantity)))}
          onClick={() => void run(endpoint, { action, reason, receiptReference: receipt, lines: receivedLines })}>
            {label('Save order update', 'حفظ تحديث الطلب')}
          </Button>
        </fieldset>
      )}
    </section>
  );
}
