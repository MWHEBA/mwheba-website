'use client';

import { Button, useAuth, useConfig, useTranslation } from '@payloadcms/ui';
import { useRef, useState, type FormEvent } from 'react';
import { hasRole } from '@/modules/identity/access/roles';
import type { User } from '@/payload-types';

type Movement = {
  id: number;
  kind: 'opening' | 'adjustment' | 'allocation' | 'cancellation' | 'return';
  quantity: number;
  reason: string;
  actor_id: number | null;
  order_id: number | null;
  created_at: string;
};

type Stock = {
  sku: string;
  available: number | null;
  movements: Movement[];
  nextBefore: number | null;
};

const movementNames = {
  opening: ['Opening balance', 'الرصيد الافتتاحي'],
  adjustment: ['Adjustment', 'تسوية المخزون'],
  allocation: ['Order allocation', 'تخصيص للطلب'],
  cancellation: ['Cancellation', 'إلغاء الطلب'],
  return: ['Sellable return', 'مرتجع صالح للبيع'],
};

export function InventoryControls() {
  const { user } = useAuth<User>();
  const { config } = useConfig();
  const { i18n } = useTranslation();
  const ar = i18n.language.startsWith('ar');
  const label = (en: string, arabic: string) => ar ? arabic : en;
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState<Stock>();
  const [units, setUnits] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string }>();
  const operation = useRef<{ fingerprint: string; key: string }>(null);
  const canWrite = hasRole(user, ['super_admin', 'operations']);
  if (!canWrite && !hasRole(user, ['catalog_manager'])) return null;
  const endpoint = `${config.routes.api}/inventory`;

  async function fetchStock(value: string, before?: number | null) {
    const query = new URLSearchParams({ sku: value });
    if (before) query.set('before', String(before));
    const response = await fetch(`${endpoint}?${query}`);
    const result = await response.json();
    if (!response.ok || !result.success) throw Error(result.error ?? label('Could not load stock.', 'تعذر تحميل المخزون.'));
    return result as Stock;
  }

  async function lookup(event?: FormEvent, before?: number | null) {
    event?.preventDefault();
    setBusy(true);
    setNotice(undefined);
    try {
      const updated = await fetchStock(before && stock ? stock.sku : sku.trim(), before);
      setStock(before && stock ? { ...updated, movements: [...stock.movements, ...updated.movements] } : updated);
      if (!before) {
        setUnits('');
        setReason('');
      }
    } catch (error) {
      if (!before) setStock(undefined);
      setNotice({ error: true, text: error instanceof Error ? error.message : label('Could not load stock.', 'تعذر تحميل المخزون.') });
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!stock) return;
    const details = {
      sku: stock.sku, kind: stock.available === null ? 'opening' : 'adjustment', reason: reason.trim(), quantity: Number(units),
    };
    const fingerprint = JSON.stringify(details);
    if (operation.current?.fingerprint !== fingerprint) operation.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setNotice(undefined);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...details, operationKey: operation.current.key }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw Error(result.error ?? label('Could not save stock.', 'تعذر حفظ المخزون.'));
      setUnits('');
      setReason('');
      operation.current = null;
      setNotice({ error: false, text: label('Stock movement saved.', 'تم حفظ حركة المخزون.') });
      const updated = await fetchStock(stock.sku).catch(() => undefined);
      setStock(updated ?? { ...stock, available: result.available });
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : label('Could not save stock.', 'تعذر حفظ المخزون.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginBlockEnd: '2rem' }}>
      <h2>{label('SKU stock', 'مخزون وحدات البيع')}</h2>
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      <form onSubmit={(event) => void lookup(event)}>
        <label>
          {label('SKU', 'رمز وحدة البيع')}{' '}
          <input required type="search" value={sku} onChange={(event) => setSku(event.target.value)} />
        </label>{' '}
        <Button type="submit" size="small" disabled={busy}>{label('Find stock', 'عرض المخزون')}</Button>
      </form>
      {stock && <>
        <h3>{stock.sku}</h3>
        <p>{stock.available === null
          ? label('Opening balance required', 'يلزم تسجيل الرصيد الافتتاحي')
          : `${label('Available', 'المتاح')}: ${stock.available}`}</p>
        {canWrite && <form onSubmit={(event) => void save(event)}>
          <label>
            {stock.available === null ? label('Opening units', 'وحدات الرصيد الافتتاحي') : label('Units to add or subtract', 'عدد الوحدات للإضافة أو الخصم')}{' '}
            <input type="number" step={1} required min={stock.available === null ? 0 : -(stock.available ?? 0)}
              value={units} onChange={(event) => setUnits(event.target.value)} />
          </label>{' '}
          <label>
            {label('Reason', 'السبب')}{' '}
            <input required value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </label>{' '}
          <Button type="submit" size="small" disabled={busy}>{label('Save movement', 'حفظ الحركة')}</Button>
        </form>}
        {stock.movements.length > 0 && (
          <table cellPadding={8}>
            <caption>{label('Stock movements', 'حركات المخزون')}</caption>
            <thead><tr>
              {[label('Date', 'التاريخ'), label('Type', 'النوع'), label('Units', 'الوحدات'), label('Reason', 'السبب'), label('Actor', 'الموظف'), label('Order', 'الطلب')]
                .map((name) => <th key={name} scope="col">{name}</th>)}
            </tr></thead>
            <tbody>
              {stock.movements.map((movement) => <tr key={movement.id}>
                <td>{new Date(movement.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</td>
                <td>{movementNames[movement.kind][ar ? 1 : 0]}</td>
                <td>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</td>
                <td>{movement.reason}</td>
                <td>{movement.actor_id ?? label('Checkout', 'إتمام الشراء')}</td>
                <td>{movement.order_id ? <a href={`${config.routes.admin}/collections/orders/${movement.order_id}`}>#{movement.order_id}</a> : '—'}</td>
              </tr>)}
            </tbody>
          </table>
        )}
        {stock.nextBefore && <Button size="small" buttonStyle="secondary" disabled={busy}
          onClick={() => void lookup(undefined, stock.nextBefore)}>{label('Older movements', 'الحركات الأقدم')}</Button>}
      </>}
    </section>
  );
}
