'use client';

import { Button, Link, useAuth, useConfig, useDocumentInfo, useFormFields } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasRole } from '@/modules/identity/access/roles';
import { orderLifecycleUpdatedEvent } from '@/modules/orders/admin/OrderLifecycleControls';
import type { User } from '@/payload-types';
import { CodNotice, codError, fetchCod, postCod, useCodLocale, type CodOrderState } from './codAdmin';
import styles from './codAdmin.module.css';

const collectPath = '/api/payments/cod/collect';

export function CodOrderControls() {
  const { id } = useDocumentInfo();
  const { user } = useAuth<User>();
  const paymentMethod = useFormFields(([fields]) => fields.paymentMethod?.value);
  if (!id || paymentMethod !== 'cod' || !hasRole(user, ['operations', 'finance', 'super_admin'])) return null;
  return <CodOrderPanel key={id} orderId={id} canManageReturns={hasRole(user, ['operations', 'super_admin'])} />;
}

function CodOrderPanel({ orderId, canManageReturns }: { orderId: string | number; canManageReturns: boolean }) {
  const { config } = useConfig();
  const router = useRouter();
  const { label, locale, direction, toggle, status, amount, date } = useCodLocale();
  const [state, setState] = useState<CodOrderState>();
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [collectorName, setCollectorName] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [collectionTime, setCollectionTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; code: string }>();
  const orderUrl = `${collectPath}?orderId=${encodeURIComponent(orderId)}`;

  useEffect(() => {
    const refresh = () => setRevision((current) => current + 1);
    window.addEventListener(orderLifecycleUpdatedEvent, refresh);
    return () => window.removeEventListener(orderLifecycleUpdatedEvent, refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchCod<CodOrderState>(orderUrl, { signal: controller.signal })
      .then((result) => {
        setState(result);
        setLoadFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [orderUrl, revision]);

  async function collect() {
    if (!state?.canCollect || !state.collectorType || saving || loading || loadFailed) return;
    setSaving(true);
    setNotice(undefined);
    try {
      const result = await postCod<{ status: string }>(collectPath, {
        orderId: state.orderId,
        collectedAmount: Number(collectedAmount),
        currency: state.currency,
        collectorType: state.collectorType,
        collectorName: collectorName.trim(),
        receiptReference: receiptReference.trim(),
        ...(collectionTime && { collectedAt: new Date(collectionTime).toISOString() }),
      });
      setCollectedAmount('');
      setCollectorName('');
      setReceiptReference('');
      setCollectionTime('');
      setNotice({ error: false, code: result.status });
      router.refresh();
      setRevision((current) => current + 1);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'COD_REQUEST_FAILED';
      setNotice({ error: true, code });
      if (code === 'AMOUNT_MISMATCH' || code === 'CURRENCY_MISMATCH') setRevision((current) => current + 1);
    } finally {
      setSaving(false);
    }
  }

  const canRecord = Number.isFinite(Number(collectedAmount)) && Number(collectedAmount) > 0
    && /^\d+(\.\d{1,2})?$/.test(collectedAmount) && collectorName.trim() && receiptReference.trim();
  return (
    <section className={styles.panel} lang={locale} dir={direction} aria-label={label('Cash on delivery', 'الدفع عند الاستلام')}>
      <header className={styles.heading}>
        <h3>{label('Cash on delivery', 'الدفع عند الاستلام')}</h3>
        {toggle}
      </header>
      <div className={styles.stack}>
        {loading && <CodNotice>{label('Loading collection details…', 'جارٍ تحميل تفاصيل التحصيل…')}</CodNotice>}
        {loadFailed && <CodNotice error>{label('Could not load collection details.', 'تعذّر تحميل تفاصيل التحصيل.')}</CodNotice>}
        {notice && <CodNotice error={notice.error}>
          {notice.error ? codError(label, notice.code, 'Could not confirm the collection. Retry with the same details.',
            'تعذّر تأكيد التحصيل. أعد المحاولة بالبيانات نفسها.')
            : notice.code === 'ALREADY_COLLECTED'
              ? label('This collection was already recorded.', 'تم تسجيل هذا التحصيل من قبل.')
              : label('Collection recorded.', 'تم تسجيل التحصيل.')}
        </CodNotice>}
        {state && <>
          <dl className={styles.meta}>
            <dt>{label('Order total', 'إجمالي الطلب')}</dt><dd>{amount(state.requiredAmount, state.currency)}</dd>
            <dt>{label('Payment', 'السداد')}</dt><dd>{status(state.paymentStatus)}</dd>
            <dt>{label('Fulfillment', 'التنفيذ')}</dt><dd>{status(state.fulfillmentStatus)}</dd>
            <dt>{label('Remittance', 'التوريد')}</dt><dd>{status(state.remittanceStatus)}</dd>
            {state.collectionReference && <>
              <dt>{label('Collection receipt', 'إيصال التحصيل')}</dt>
              <dd>{state.collectionId
                ? <Link href={`${config.routes.admin}/collections/payment-collections/${state.collectionId}`}><bdi>{state.collectionReference}</bdi></Link>
                : <bdi>{state.collectionReference}</bdi>}</dd>
            </>}
            {state.remittanceBatchId && <>
              <dt>{label('Remittance batch', 'دفعة التوريد')}</dt>
              <dd>{state.remittanceId
                ? <Link href={`${config.routes.admin}/collections/courier-remittances/${state.remittanceId}`}><bdi>{state.remittanceBatchId}</bdi></Link>
                : <bdi>{state.remittanceBatchId}</bdi>}</dd>
            </>}
            {state.refusalReason && <>
              <dt>{label('Refusal reason', 'سبب رفض الاستلام')}</dt><dd dir="auto">{state.refusalReason}</dd>
            </>}
          </dl>
          {state.review.length > 0 && <details open>
            <summary>{label('Collection discrepancies for finance review', 'فروق التحصيل للمراجعة المالية')}</summary>
            <ul>
              {state.review.map((review, index) => (
                <li key={`${review.at}-${review.code}-${index}`}>
                  <time dateTime={review.at}>{date(review.at)}</time>{' · '}
                  {codError(label, review.code, 'Collection discrepancy', 'فرق في التحصيل')}{' '}
                  {label('Expected', 'المتوقع')} {amount(review.expectedAmount, review.expectedCurrency ?? state.currency)}{' · '}
                  {label('Submitted', 'المُدخل')} {amount(review.submittedAmount, review.submittedCurrency ?? state.currency)}
                  {review.reference && <> · {label('Receipt', 'الإيصال')} <bdi>{review.reference}</bdi></>}
                  {review.actor && <> · {label('Recorded by staff ID', 'رقم الموظف المسجّل')} #{review.actor}</>}
                </li>
              ))}
            </ul>
          </details>}
          {state.canCollect && state.collectorType && (
            <fieldset className={styles.fields} disabled={saving || loading || loadFailed}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                  event.preventDefault();
                  if (canRecord) void collect();
                }
              }}>
              <legend>{label('Record cash collection', 'تسجيل التحصيل النقدي')}</legend>
              <p>{label('Collection channel', 'قناة التحصيل')}{' · '}{status(state.collectorType)}</p>
              <label>{label('Cash received (EGP)', 'النقد المحصّل (ج.م.)')}
                <input type="number" min="0.01" step="0.01" required inputMode="decimal" value={collectedAmount}
                  onChange={(event) => setCollectedAmount(event.target.value)} />
              </label>
              <label>{label('Collected by', 'القائم بالتحصيل')}
                <input required value={collectorName} maxLength={120} onChange={(event) => setCollectorName(event.target.value)} />
              </label>
              <label>{label('Unique receipt reference', 'المرجع الفريد لإيصال التحصيل')}
                <input required dir="auto" value={receiptReference} maxLength={120}
                  onChange={(event) => setReceiptReference(event.target.value)} />
              </label>
              <label>{label('Collection date and time (optional)', 'تاريخ ووقت التحصيل (اختياري)')}
                <input type="datetime-local" value={collectionTime} onChange={(event) => setCollectionTime(event.target.value)} />
              </label>
              <div className={styles.actions}>
                <Button type="button" size="small" margin={false} disabled={!canRecord || saving || loading || loadFailed}
                  onClick={() => void collect()}>
                  {saving ? label('Recording…', 'جارٍ التسجيل…') : label('Record collection', 'تسجيل التحصيل')}
                </Button>
              </div>
            </fieldset>
          )}
          {!state.canCollect && state.paymentStatus === 'unpaid'
            && state.fulfillmentStatus !== 'returned_to_origin' && state.fulfillmentStatus !== 'cancelled'
            && <p>{state.collectorType === 'office_staff'
              ? label('Collection becomes available when the order is ready for office pickup.', 'يتاح التحصيل عندما يكون الطلب جاهزًا للاستلام من المكتب.')
              : label('Collection becomes available after courier delivery is recorded.', 'يتاح التحصيل بعد تسجيل التسليم بواسطة الشحن.')}</p>}
          <div className={styles.actions}>
            {canManageReturns && <a href="#order-operations">{label('Dispatch, refusal and returns', 'الشحن ورفض الاستلام والمرتجعات')}</a>}
            <Button type="button" size="xsmall" buttonStyle="secondary" margin={false} disabled={loading || saving}
              onClick={() => setRevision((current) => current + 1)}>{label('Refresh', 'تحديث')}</Button>
          </div>
        </>}
        {loadFailed && !state && <div>
          <Button type="button" size="xsmall" buttonStyle="secondary" margin={false} disabled={loading}
            onClick={() => setRevision((current) => current + 1)}>{label('Retry', 'إعادة المحاولة')}</Button>
        </div>}
      </div>
    </section>
  );
}
