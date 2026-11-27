'use client';

import { Button, Link, useAuth, useConfig } from '@payloadcms/ui';
import { useEffect, useState } from 'react';
import { hasRole } from '@/modules/identity/access/roles';
import type { Order, PaymentCollection, User } from '@/payload-types';
import { CodNotice, fetchCod, useCodLocale } from './codAdmin';
import { CodRemittanceForm } from './CodRemittanceForm';
import styles from './codAdmin.module.css';

type PendingOrder = Pick<Order, 'id' | 'orderNumber' | 'amount' | 'currency' | 'deliveryMethod' | 'appliedTariff' | 'fulfillmentStatus'>;
export type CourierCollection = Pick<PaymentCollection, 'id' | 'order' | 'amount' | 'receiptReference' | 'collectorName' | 'collectedAt'>;
type Page<Row> = { docs: Row[]; hasNextPage: boolean };
type Queue = 'cash' | 'remittance';

const cashQuery = {
  'where[paymentMethod][equals]': 'cod',
  'where[paymentStatus][equals]': 'unpaid',
  'where[orderStatus][not_equals]': 'cancelled',
  'where[fulfillmentStatus][not_in]': 'returned_to_origin,cancelled',
  'select[orderNumber]': 'true',
  'select[amount]': 'true',
  'select[currency]': 'true',
  'select[deliveryMethod]': 'true',
  'select[appliedTariff]': 'true',
  'select[fulfillmentStatus]': 'true',
};

const remittanceQuery = {
  'where[collectorType][equals]': 'courier',
  'where[remittanceStatus][equals]': 'pending_remittance',
  'select[order]': 'true',
  'select[amount]': 'true',
  'select[receiptReference]': 'true',
  'select[collectorName]': 'true',
  'select[collectedAt]': 'true',
};

export function CodQueues() {
  const { user } = useAuth<User>();
  if (!hasRole(user, ['operations', 'finance', 'super_admin'])) return null;
  return <Queues canReconcile={hasRole(user, ['finance', 'super_admin'])} />;
}

function Queues({ canReconcile }: { canReconcile: boolean }) {
  const { config } = useConfig();
  const i18n = useCodLocale();
  const { label, locale, direction, toggle, status, amount, date } = i18n;
  const [queue, setQueue] = useState<Queue>('cash');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [cash, setCash] = useState<Page<PendingOrder>>();
  const [remittance, setRemittance] = useState<Page<CourierCollection>>();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Record<number, CourierCollection>>({});
  const [saving, setSaving] = useState(false);
  const [batch, setBatch] = useState<{ reference: string; id?: number; replayed: boolean; variance: boolean }>();
  const api = config.routes.api;
  const collections = `${config.routes.admin}/collections`;

  useEffect(() => {
    const abort = new AbortController();
    const init = { signal: abort.signal };
    const load = async () => {
      setLoading(true);
      setLoadFailed(false);
      setCash(undefined);
      setRemittance(undefined);
      setEnabled(false);
      const commonQuery = { limit: '20', depth: '0', page: String(page) };
      try {
        if (queue === 'cash') {
          const query = new URLSearchParams({ ...commonQuery, sort: 'createdAt', ...cashQuery });
          setCash(await fetchCod<Page<PendingOrder>>(`${api}/orders?${query}`, init));
        } else if (canReconcile) {
          const query = new URLSearchParams({ ...commonQuery, sort: 'collectedAt', ...remittanceQuery });
          const [records, setting] = await Promise.all([
            fetchCod<Page<CourierCollection>>(`${api}/payment-collections?${query}`, init),
            fetchCod<{ enabled: boolean }>('/api/payments/cod/remit', init),
          ]);
          setRemittance(records);
          setEnabled(setting.enabled === true);
        }
      } catch {
        if (!abort.signal.aborted) setLoadFailed(true);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => abort.abort();
  }, [api, canReconcile, page, queue, revision]);

  function selectQueue(view: Queue) {
    if (queue === view) return;
    setQueue(view);
    setPage(1);
  }

  function selectCollection(record: CourierCollection) {
    setSelected((previous) => {
      const next = { ...previous };
      if (next[record.id]) delete next[record.id];
      else next[record.id] = record;
      return next;
    });
  }

  const activePage = queue === 'cash' ? cash : remittance;
  return (
    <section className={styles.panel} lang={locale} dir={direction} aria-label={label('Cash on delivery queues', 'قوائم الدفع عند الاستلام')}>
      <header className={styles.heading}>
        <h2>{label('Cash on delivery queues', 'قوائم الدفع عند الاستلام')}</h2>
        {toggle}
      </header>
      <div className={styles.stack}>
        <div className={styles.actions}>
          {canReconcile && <>
            <Button type="button" size="small" margin={false} buttonStyle={queue === 'cash' ? 'primary' : 'secondary'}
              extraButtonProps={{ 'aria-pressed': queue === 'cash' }} disabled={saving} onClick={() => selectQueue('cash')}>
              {label('Unpaid orders', 'الطلبات غير المسددة')}
            </Button>
            <Button type="button" size="small" margin={false} buttonStyle={queue === 'remittance' ? 'primary' : 'secondary'}
              extraButtonProps={{ 'aria-pressed': queue === 'remittance' }} disabled={saving} onClick={() => selectQueue('remittance')}>
              {label('Courier cash awaiting remittance', 'مبالغ الشحن بانتظار التوريد')}
            </Button>
          </>}
          <Button type="button" size="xsmall" margin={false} buttonStyle="secondary" disabled={loading || saving}
            onClick={() => setRevision((current) => current + 1)}>{label('Refresh', 'تحديث')}</Button>
        </div>
        {queue === 'cash' && <p>{label('Open an unpaid order to manage dispatch, pickup or cash collection.',
          'افتح طلبًا غير مسدد لإدارة الشحن أو الاستلام أو التحصيل النقدي.')}</p>}
        {loading && <CodNotice>{label('Loading queue…', 'جارٍ تحميل القائمة…')}</CodNotice>}
        {loadFailed && <CodNotice error>{label('Could not load the queue.', 'تعذّر تحميل القائمة.')}</CodNotice>}
        {queue === 'cash' && cash && <>
          {cash.docs.length ? <div className={styles.tableScroll}>
            <table className={styles.table} aria-label={label('Orders awaiting cash collection', 'طلبات بانتظار التحصيل النقدي')}>
              <thead><tr>
                <th scope="col">{label('Order', 'الطلب')}</th>
                <th scope="col">{label('Delivery method', 'طريقة التسليم')}</th>
                <th scope="col">{label('Fulfillment', 'التنفيذ')}</th>
                <th scope="col">{label('Cash due', 'المبلغ المستحق')}</th>
              </tr></thead>
              <tbody>{cash.docs.map((order) => {
                const tariff = order.appliedTariff as { label?: { en?: string; ar?: string }; method?: string } | undefined;
                return <tr key={order.id}>
                  <td><Link href={`${collections}/orders/${order.id}`}><bdi>{order.orderNumber || `#${order.id}`}</bdi></Link></td>
                  <td>{tariff?.label?.[locale] || status(tariff?.method ?? order.deliveryMethod)}</td>
                  <td>{status(order.fulfillmentStatus)}</td>
                  <td>{amount(order.amount, order.currency ?? 'EGP')}</td>
                </tr>;
              })}</tbody>
            </table>
          </div> : <p>{label('No unpaid COD orders on this page.', 'لا توجد طلبات دفع عند الاستلام غير مسددة في هذه الصفحة.')}</p>}
        </>}
        {queue === 'remittance' && remittance && <>
          {!enabled && <p>{label('Courier remittance is disabled in Commerce Settings.', 'توريد مبالغ الشحن غير مفعّل في إعدادات التجارة.')}</p>}
          {batch && <CodNotice>
            {batch.replayed ? label('Batch already reconciled.', 'تمت مطابقة الدفعة من قبل.') : label('Batch reconciled.', 'تمت مطابقة الدفعة.')}{' '}
            {batch.id ? <Link href={`${collections}/courier-remittances/${batch.id}`}><bdi>{batch.reference}</bdi></Link>
              : <bdi>{batch.reference}</bdi>}
            {batch.variance && <> · {label('With an approved variance', 'مع فرق معتمد')}</>}
          </CodNotice>}
          {remittance.docs.length ? <div className={styles.tableScroll}>
            <table className={styles.table} aria-label={label('Courier collections awaiting remittance', 'عمليات تحصيل الشحن بانتظار التوريد')}>
              <thead><tr>
                {enabled && <th scope="col">{label('Include', 'إدراج')}</th>}
                <th scope="col">{label('Receipt', 'الإيصال')}</th>
                <th scope="col">{label('Order', 'الطلب')}</th>
                <th scope="col">{label('Collected by', 'القائم بالتحصيل')}</th>
                <th scope="col">{label('Collected at', 'وقت التحصيل')}</th>
                <th scope="col">{label('Cash collected', 'النقد المحصّل')}</th>
              </tr></thead>
              <tbody>{remittance.docs.map((record) => {
                const orderId = typeof record.order === 'object' ? record.order.id : record.order;
                return <tr key={record.id}>
                  {enabled && <td><input type="checkbox" checked={Boolean(selected[record.id])} disabled={saving}
                    aria-label={`${label('Include receipt', 'أدرج الإيصال')} ${record.receiptReference}`}
                    onChange={() => selectCollection(record)} /></td>}
                  <td><Link href={`${collections}/payment-collections/${record.id}`}><bdi>{record.receiptReference}</bdi></Link></td>
                  <td><Link href={`${collections}/orders/${orderId}`}>#{orderId}</Link></td>
                  <td dir="auto">{record.collectorName}</td>
                  <td><time dateTime={record.collectedAt}>{date(record.collectedAt)}</time></td>
                  <td>{amount(record.amount)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div> : <p>{label('No courier cash awaiting remittance on this page.', 'لا توجد مبالغ شحن بانتظار التوريد في هذه الصفحة.')}</p>}
        </>}
        {activePage && (activePage.hasNextPage || page > 1) && <div className={styles.actions}>
          <Button type="button" size="xsmall" margin={false} buttonStyle="secondary" disabled={page === 1 || saving}
            onClick={() => setPage(page - 1)}>{label('Previous page', 'الصفحة السابقة')}</Button>
          <span>{label('Page', 'الصفحة')} {page}</span>
          <Button type="button" size="xsmall" margin={false} buttonStyle="secondary" disabled={!activePage.hasNextPage || saving}
            onClick={() => setPage(page + 1)}>{label('Next page', 'الصفحة التالية')}</Button>
        </div>}
        {canReconcile && queue === 'remittance' && <CodRemittanceForm
          i18n={i18n} records={Object.values(selected)} saving={saving}
          disabled={!enabled || loading || loadFailed}
          onSaving={setSaving} onClear={() => setSelected({})} onSuccess={(result) => {
            setBatch(result);
            setSelected({});
            setPage(1);
            setRevision((current) => current + 1);
          }} />}
      </div>
    </section>
  );
}
