import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { accountLoginHref } from '@/modules/identity/logic/accountPaths';
import { getCustomerAccount, listCustomerOrders } from '@/modules/identity/services/customerAccount';
import { AccountShell, type AccountPageProps } from '@/modules/identity/ui/AccountShell';
import styles from '@/modules/identity/ui/account.module.css';
import { isValidLocale } from '@/shared/lib/i18n';

const orderLabels: Record<string, [string, string]> = {
  draft: ['مسودة', 'Draft'],
  pending: ['قيد الانتظار', 'Pending'],
  confirmed: ['مؤكّد', 'Confirmed'],
  processing: ['قيد التجهيز', 'Processing'],
  shipped: ['تم الشحن', 'Shipped'],
  delivered: ['تم التسليم', 'Delivered'],
  completed: ['مكتمل', 'Completed'],
  cancelled: ['ملغى', 'Cancelled'],
  refunded: ['تم رد المبلغ', 'Refunded'],
};

const paymentLabels: Record<string, [string, string]> = {
  pending: ['قيد الانتظار', 'Pending'],
  unpaid: ['غير مدفوع', 'Unpaid'],
  pending_verification: ['قيد المراجعة', 'Awaiting verification'],
  paid: ['مدفوع', 'Paid'],
  failed: ['تعذّر الدفع', 'Failed'],
  cancelled: ['ملغى', 'Cancelled'],
  refunded: ['تم رد المبلغ', 'Refunded'],
};

export default async function CustomerOrdersPage({ params, searchParams }: AccountPageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const { page: param } = await searchParams;
  const requestedPage = typeof param === 'string' && /^[1-9]\d{0,5}$/.test(param) ? Number(param) : 1;
  const base = `/${locale}/account/orders`;
  const pageHref = (page: number) => page > 1 ? `${base}?page=${page}` : base;
  const account = await getCustomerAccount(await headers());
  if (!account) redirect(accountLoginHref(locale, pageHref(requestedPage)));
  const result = await listCustomerOrders(account.payload, account.user, requestedPage);
  if (requestedPage > 1 && requestedPage > result.totalPages) redirect(pageHref(result.totalPages));

  const ar = locale === 'ar';
  const localeTag = ar ? 'ar-EG' : 'en-EG';
  const date = new Intl.DateTimeFormat(localeTag, { dateStyle: 'medium', timeZone: 'Africa/Cairo' });
  const number = new Intl.NumberFormat(localeTag);
  const currency = new Intl.NumberFormat(localeTag, { style: 'currency', currency: 'EGP' });
  const labelIndex = ar ? 0 : 1;

  return (
    <AccountShell locale={locale} section="orders" title={ar ? 'طلباتي' : 'My orders'}>
      <div className={styles.stack}>
        {result.docs.length === 0 ? (
          <div className={`${styles.panel} ${styles.stack}`}>
            <p>{ar ? 'لا توجد طلبات في حسابك بعد.' : 'You have no orders yet.'}</p>
            <Link href={`/${locale}/store`}>{ar ? 'تصفّح المتجر' : 'Browse the store'}</Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {result.docs.map((order) => {
              const orderNumber = order.orderNumber || `#${order.id}`;
              const total = order.amount;
              return (
                <li key={order.id} className={styles.panel}>
                  <div className={styles.row}>
                    <h2><bdi>{orderNumber}</bdi></h2>
                    <Link href={`${base}/${order.id}`} aria-label={ar ? `عرض تفاصيل الطلب ${orderNumber}` : `View order ${orderNumber}`}>
                      {ar ? 'تفاصيل الطلب' : 'View order'}
                    </Link>
                  </div>
                  <dl className={styles.orderDetails}>
                    <div><dt>{ar ? 'تاريخ الطلب' : 'Order date'}</dt><dd><time dateTime={order.createdAt}>{date.format(new Date(order.createdAt))}</time></dd></div>
                    <div><dt>{ar ? 'حالة الطلب' : 'Order status'}</dt><dd>{order.orderStatus && orderLabels[order.orderStatus]?.[labelIndex] || '—'}</dd></div>
                    <div><dt>{ar ? 'حالة الدفع' : 'Payment status'}</dt><dd>{order.paymentStatus && paymentLabels[order.paymentStatus]?.[labelIndex] || '—'}</dd></div>
                    <div><dt>{ar ? 'الإجمالي' : 'Total'}</dt><dd>{typeof total === 'number' ? currency.format(total) : '—'}</dd></div>
                  </dl>
                </li>
              );
            })}
          </ul>
        )}

        {result.totalPages > 1 && (
          <nav className={styles.actions} aria-label={ar ? 'صفحات الطلبات' : 'Order pages'}>
            {result.hasPrevPage && <Link href={pageHref(requestedPage - 1)} rel="prev">{ar ? 'السابقة' : 'Previous'}</Link>}
            <span aria-current="page" className={styles.muted}>
              {ar ? `صفحة ${number.format(requestedPage)} من ${number.format(result.totalPages)}` : `Page ${number.format(requestedPage)} of ${number.format(result.totalPages)}`}
            </span>
            {result.hasNextPage && <Link href={pageHref(requestedPage + 1)} rel="next">{ar ? 'التالية' : 'Next'}</Link>}
          </nav>
        )}
      </div>
    </AccountShell>
  );
}
