'use client';

import { Button, useTranslation } from '@payloadcms/ui';
import { useState } from 'react';
import type { Order } from '@/payload-types';
import styles from './codAdmin.module.css';

export type CodLabel = (english: string, arabic: string) => string;
export type CollectorType = 'courier' | 'office_staff';

type CollectionReview = {
  code: string;
  at: string;
  reference?: string;
  actor?: number;
  expectedAmount?: number | null;
  submittedAmount?: number | null;
  expectedCurrency?: string | null;
  submittedCurrency?: string | null;
};

export type CodOrderState = {
  orderId: number;
  paymentStatus: Order['paymentStatus'];
  fulfillmentStatus: Order['fulfillmentStatus'];
  remittanceStatus: Order['remittanceStatus'];
  currency: 'EGP';
  requiredAmount: number;
  collectorType: CollectorType | null;
  canCollect: boolean;
  collectionId?: number | null;
  collectionReference?: string | null;
  refusalReason?: string | null;
  remittanceId?: number | null;
  remittanceBatchId?: string | null;
  review: CollectionReview[];
};

const statuses: Record<string, [string, string]> = {
  unpaid: ['Unpaid', 'لم يُسدَّد'],
  paid: ['Paid', 'تم السداد'],
  pending: ['Pending', 'قيد الانتظار'],
  refunded: ['Refunded', 'تم رد المبلغ'],
  failed: ['Failed', 'تعذّر التنفيذ'],
  unfulfilled: ['Awaiting fulfillment', 'بانتظار التنفيذ'],
  in_production: ['In production', 'قيد الإنتاج'],
  ready_for_pickup: ['Ready for pickup', 'جاهز للاستلام'],
  shipped: ['Dispatched', 'تم الشحن'],
  delivered: ['Delivered', 'تم التسليم'],
  returned_to_origin: ['Refused / returning to origin', 'رُفض الاستلام / جارٍ الإرجاع'],
  cancelled: ['Cancelled', 'ملغى'],
  shipping: ['Courier delivery', 'التوصيل بالشحن'],
  pickup: ['Office pickup', 'الاستلام من المكتب'],
  pending_collection: ['Awaiting cash collection', 'بانتظار التحصيل النقدي'],
  collected_by_courier: ['Courier collected · awaiting remittance', 'حصّل المندوب المبلغ · بانتظار التوريد'],
  remitted_to_company: ['Received by company', 'استلمت الشركة المبلغ'],
  not_applicable: ['Not applicable', 'غير منطبق'],
  courier: ['Courier', 'مندوب الشحن'],
  office_staff: ['Office staff', 'موظف المكتب'],
};

const errors: Record<string, [string, string]> = {
  AUTHENTICATION_REQUIRED: ['Sign in again to continue.', 'سجّل دخولك مجددًا للمتابعة.'],
  FORBIDDEN: ['Your role cannot perform this action.', 'لا يملك دورك صلاحية تنفيذ هذا الإجراء.'],
  FORBIDDEN_ORIGIN: ['Reload this admin page and try again.', 'أعد تحميل صفحة الإدارة ثم حاول مجددًا.'],
  COD_WRITE_UNCONFIRMED: ['The result could not be confirmed. Retry with the same details.', 'تعذّر تأكيد النتيجة. أعد المحاولة بالبيانات نفسها.'],
  COD_COLLECTION_NOT_READY: ['Cash collection is unavailable at this fulfillment stage.', 'التحصيل النقدي غير متاح في مرحلة التنفيذ الحالية.'],
  INVALID_COLLECTION_CHANNEL: ['Use the collection channel shown on the order.', 'استخدم قناة التحصيل المعروضة في الطلب.'],
  CANNOT_COLLECT_CANCELLED_OR_REFUSED_ORDER: ['Collection is unavailable for a cancelled or refused order.', 'التحصيل غير متاح لطلب ملغى أو مرفوض.'],
  ORDER_ALREADY_PAID: ['Payment is already recorded. Refresh to review its reference.', 'السداد مسجل بالفعل. حدّث الصفحة لمراجعة المرجع.'],
  RECEIPT_ALREADY_USED: ['This receipt reference is already in use.', 'مرجع إيصال التحصيل مستخدم بالفعل.'],
  AMOUNT_MISMATCH: ['Collected cash differs from the order total. Review the submitted amount.', 'يختلف المبلغ المحصّل عن إجمالي الطلب. راجع المبلغ المُدخل.'],
  CURRENCY_MISMATCH: ['The submitted currency differs from the order currency.', 'العملة المُدخلة تختلف عن عملة الطلب.'],
  INVALID_RECEIPT_REFERENCE: ['Enter a valid unique collection receipt reference.', 'أدخل مرجعًا فريدًا وصحيحًا لإيصال التحصيل.'],
  INVALID_COLLECTOR_NAME: ['Enter the name of the person or company that collected the cash.', 'أدخل اسم الشخص أو الشركة التي حصّلت المبلغ.'],
  INVALID_COLLECTED_AT: ['Enter a valid collection date and time.', 'أدخل تاريخ ووقت تحصيل صحيحين.'],
  INVALID_MONETARY_AMOUNT: ['Enter a valid monetary amount.', 'أدخل مبلغًا صحيحًا.'],
  FRACTIONAL_PIASTRE_PROHIBITED: ['Enter amounts with up to two decimal places.', 'أدخل المبالغ بمنزلتين عشريتين على الأكثر.'],
  COURIER_REMITTANCE_DISABLED: ['Courier remittance is disabled in Commerce Settings.', 'توريد مبالغ الشحن غير مفعّل في إعدادات التجارة.'],
  INVALID_BATCH_ID: ['Enter a valid unique batch reference.', 'أدخل مرجعًا فريدًا وصحيحًا للدفعة.'],
  INVALID_BATCH: ['Select at least one eligible courier collection.', 'اختر عملية تحصيل واحدة مؤهلة على الأقل.'],
  DUPLICATE_ORDER_IN_BATCH: ['An order can appear only once in a remittance batch.', 'يمكن إدراج الطلب مرة واحدة فقط في دفعة التوريد.'],
  BATCH_ALREADY_EXISTS: ['A batch with this reference already exists. Review the recorded batch.', 'توجد دفعة بهذا المرجع بالفعل. راجع الدفعة المسجلة.'],
  DOUBLE_REMITTANCE_ERROR: ['One of the selected collections has already been reconciled.', 'تمت مطابقة إحدى عمليات التحصيل المحددة بالفعل.'],
  ORDER_NOT_COLLECTED: ['A selected order is no longer awaiting remittance. Refresh the queue.', 'أحد الطلبات المحددة لم يعد بانتظار التوريد. حدّث قائمة الانتظار.'],
  ORDER_COLLECTION_RECORD_MISSING: ['A selected order has no matching collection record.', 'لا يوجد سجل تحصيل مطابق لأحد الطلبات المحددة.'],
  ORDER_COLLECTION_RECORD_MISMATCH: ['A selected order differs from its collection record. Review both records.', 'أحد الطلبات المحددة لا يطابق سجل تحصيله. راجع السجلين.'],
  GROSS_AMOUNT_MISMATCH: ['The batch gross differs from the recorded collections.', 'إجمالي الدفعة لا يطابق مبالغ التحصيل المسجلة.'],
  INVALID_DEDUCTIONS: ['Check the documented deductions against the batch gross.', 'راجع الخصومات الموثّقة مقابل إجمالي الدفعة.'],
  REMITTANCE_VARIANCE_MISMATCH: ['Verify the net deposit and document any approved variance.', 'تحقق من صافي الإيداع ووثّق أي فرق معتمد.'],
  INVALID_COURIER_COMPANY: ['Enter a valid courier company name.', 'أدخل اسم شركة شحن صحيحًا.'],
  INVALID_DEPOSIT_REFERENCE: ['Enter a valid deposit slip reference.', 'أدخل مرجعًا صحيحًا لإيصال الإيداع.'],
  INVALID_DEPOSIT_DATE: ['Enter a valid deposit date.', 'أدخل تاريخ إيداع صحيحًا.'],
  INVALID_VARIANCE_NOTES: ['Enter a valid reason for approving the variance.', 'أدخل سببًا صحيحًا لاعتماد الفرق.'],
};

export function useCodLocale() {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState<'ar' | 'en'>();
  const locale = language ?? (i18n.language.startsWith('ar') ? 'ar' : 'en');
  const label: CodLabel = (english, arabic) => locale === 'ar' ? arabic : english;
  const switchLabel = label('العربية', 'English');
  return {
    label,
    locale,
    direction: locale === 'ar' ? 'rtl' as const : 'ltr' as const,
    toggle: <Button size="xsmall" buttonStyle="secondary" margin={false} type="button"
      onClick={() => setLanguage(locale === 'ar' ? 'en' : 'ar')}>
      <span lang={locale === 'ar' ? 'en' : 'ar'}>{switchLabel}</span>
    </Button>,
    status: (value?: string | null) => value && statuses[value] ? label(...statuses[value]) : '—',
    amount: (amount?: number | null, currency = 'EGP') => {
      if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
      const format = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', { maximumFractionDigits: 2 });
      return `${format.format(amount)} ${currency === 'EGP' ? label('EGP', 'ج.م.') : currency}`;
    },
    date: (value: string) => new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB'),
  };
}

export function codError(label: CodLabel, code: string, english: string, arabic: string) {
  const message = errors[code];
  return message ? label(...message) : label(english, arabic);
}

export async function fetchCod<Result>(url: string, init?: RequestInit): Promise<Result> {
  const response = await fetch(url, { cache: 'no-store', ...init });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.success === false) {
    const code = result?.code ?? result?.error?.split?.(':', 1)[0];
    throw new Error(typeof code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(code) ? code : 'COD_REQUEST_FAILED');
  }
  return result as Result;
}

export function postCod<Result>(path: string, body: object) {
  return fetchCod<Result>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function CodNotice({ error, children }: { error?: boolean; children: React.ReactNode }) {
  return <p className={error ? styles.error : undefined} role={error ? 'alert' : 'status'}>{children}</p>;
}
