import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { isValidLocale } from '@/shared/lib/i18n';
import { getCommerceSettings } from '@/modules/orders/services/deliveryTariff';
import { BankTransferReceiptUploadForm } from '@/modules/payments/ui/BankTransferReceiptUploadForm';

export const dynamic = 'force-dynamic';

interface OrderPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const isArabic = locale === 'ar';
  return {
    title: isArabic ? `تفاصيل الطلب #${id} | وكالة موهبة` : `Order #${id} Details | MWHEBA Agency`,
    robots: { index: false, follow: false },
  };
}

const idOf = (rel: any) => (typeof rel === 'object' && rel !== null ? rel.id : rel);

export default async function CustomerOrderPage({ params }: OrderPageProps) {
  const { locale, id } = await params;
  if (!isValidLocale(locale)) notFound();

  const isArabic = locale === 'ar';
  const payload = await getPayload({ config: configPromise });

  let user: any = null;
  try {
    const auth = await payload.auth({ headers: await headers() });
    user = auth?.user ?? null;
  } catch {
    user = null;
  }

  // Unauthenticated visitors must sign in; zero order details disclosed
  if (!user) {
    return (
      <div className="container" style={{ paddingBlock: '5rem', maxWidth: '580px', textAlign: 'center' }}>
        <div style={{ padding: '2rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '0.5rem' }}>
            {isArabic ? 'تسجيل الدخول لمتابعة الطلب' : 'Sign In to View Order'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {isArabic
              ? 'يرجى تسجيل الدخول بحساب العميل المسجل للاطلاع على تفاصيل الطلب وإرسال إشعار السداد.'
              : 'Please sign in to inspect order details and submit payment proof.'}
          </p>
          <Link
            href={`/${locale}/account`}
            className="btn-primary"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {isArabic ? 'تسجيل الدخول ←' : 'Sign In →'}
          </Link>
        </div>
      </div>
    );
  }

  const order: any = await payload.findByID({ collection: 'orders', id, depth: 2 }).catch(() => null);
  if (!order || String(idOf(order.customer)) !== String(user.id)) {
    notFound();
  }

  // Load operational bank details
  const settings = await getCommerceSettings(payload);
  const bankDetails = {
    status: settings.bankDetailsStatus || 'pending_configuration',
    bankName: settings.bankDetailsStatus === 'active' ? settings.bankName : null,
    accountName: settings.bankDetailsStatus === 'active' ? settings.accountName : null,
    accountNumber: settings.bankDetailsStatus === 'active' ? settings.accountNumber : null,
    iban: settings.bankDetailsStatus === 'active' ? settings.iban : null,
    swiftCode: settings.bankDetailsStatus === 'active' ? settings.swiftCode : null,
    instapayHandle: settings.bankDetailsStatus === 'active' ? settings.instapayHandle : null,
    bankInstructions: settings.bankDetailsStatus === 'active' ? settings.bankInstructions : null,
  };

  // Find any submitted bank transfer record for this order
  let existingTransfer: any = null;
  if (order.paymentMethod === 'bank_transfer') {
    const transfers = await payload.find({
      collection: 'bank-transfers',
      where: { order: { equals: order.id } },
      sort: '-createdAt',
      limit: 1,
    });
    existingTransfer = transfers.docs[0] || null;
  }

  // Check if order has service items requiring a brief
  const hasServiceItems = Array.isArray(order.items) && order.items.some((i: any) => i.fulfillmentType === 'service');

  const orderTotal = Number(order.total || order.amount || 0);

  return (
    <div className="container" style={{ paddingBlock: '3rem 5rem', maxWidth: '960px' }} dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Breadcrumb / Back Link */}
      <div style={{ marginBottom: '1.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <Link href={`/${locale}/store`} style={{ color: 'var(--brand-primary)', textDecoration: 'none' }}>
          {isArabic ? '← العودة للمتجر' : '← Back to Catalog'}
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-default)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', textTransform: 'uppercase' }}>
            {isArabic ? 'أمر شراء مؤسسي' : 'Corporate Purchase Order'}
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.25rem 0' }}>
            {order.orderNumber || `#${order.id}`}
          </h1>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            {isArabic ? 'تاريخ التحرير:' : 'Date:'} {order.createdAt ? new Date(order.createdAt).toLocaleDateString(isArabic ? 'ar-EG' : 'en-US') : ''}
          </span>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-xs)', fontSize: '0.8125rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
            {isArabic ? 'حالة الطلب:' : 'Order:'} <strong>{order.orderStatus || order.status || 'confirmed'}</strong>
          </div>
          <div
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              backgroundColor: order.paymentStatus === 'paid' ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
              color: order.paymentStatus === 'paid' ? 'var(--status-success)' : 'var(--status-warning)',
              border: `1px solid ${order.paymentStatus === 'paid' ? 'var(--status-success)' : 'var(--status-warning)'}`,
            }}
          >
            {isArabic ? 'السداد:' : 'Payment:'} <strong>{order.paymentStatus}</strong>
          </div>
        </div>
      </div>

      {/* Grid: Order Summary & Payment / Action Hub */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
        {/* Left Column: Line Items & Totals */}
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '1rem' }}>
            {isArabic ? 'بنود الطلب والتكلفة' : 'Order Items & Financial Summary'}
          </h3>

          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            {Array.isArray(order.items) &&
              order.items.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <div>
                    <strong>{item.productTitle || item.title || `Item #${idx + 1}`}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.quantity} × {item.unitPrice} {isArabic ? 'ج.م' : 'EGP'}
                      {item.customizationFee > 0 && ` + ${item.customizationFee * item.quantity} ${isArabic ? 'رسوم تخصيص' : 'customization'}`}
                    </div>
                  </div>
                  <span style={{ fontWeight: 600 }}>{item.lineTotal ? `${Number(item.lineTotal).toLocaleString()} ${isArabic ? 'ج.م' : 'EGP'}` : ''}</span>
                </div>
              ))}
          </div>

          <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'طريقة السداد:' : 'Payment Method:'}</span>
              <strong>{order.paymentMethod === 'bank_transfer' ? (isArabic ? 'تحويل بنكي رسمي' : 'Bank Transfer') : 'Cash on Delivery (COD)'}</strong>
            </div>
            {order.shippingFee !== undefined && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{isArabic ? 'رسوم التوصيل / الاستلام:' : 'Delivery Fee:'}</span>
                <span>{Number(order.shippingFee).toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
              <span>{isArabic ? 'الإجمالي النهائي:' : 'Grand Total:'}</span>
              <span>{orderTotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>

          {/* Service Brief CTA if applicable */}
          {hasServiceItems && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontWeight: 600, color: 'var(--brand-primary-dark)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                {isArabic ? 'يتضمن هذا الطلب خدمات تصميم / هوية' : 'This order includes creative services'}
              </div>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {isArabic ? 'يرجى تقديم بيانات متطلبات الخدمة (Service Brief) لتمكين الفريق الإبداعي من بدء العمل.' : 'Please provide your service brief so our creative team can commence.'}
              </p>
              <Link
                href={`/${locale}/account/orders/${order.id}/brief`}
                style={{
                  display: 'inline-block',
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--brand-primary)',
                  color: 'var(--text-inverse)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                {isArabic ? 'تعبئة Brief الخدمة ←' : 'Submit Service Brief →'}
              </Link>
            </div>
          )}
        </div>

        {/* Right Column: Bank Transfer Receipt Action Hub */}
        <div>
          {order.paymentMethod === 'bank_transfer' ? (
            <div>
              {order.paymentStatus === 'paid' ? (
                <div style={{ border: '1px solid var(--status-success)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', backgroundColor: 'var(--status-success-bg)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.75rem', color: 'var(--status-success)', marginBottom: '0.5rem' }}>✓</div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--status-success)', margin: '0 0 0.5rem' }}>
                    {isArabic ? 'تم تأكيد واعتماد السداد البنكي بنجاح' : 'Bank Payment Confirmed & Reconciled'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {isArabic
                      ? `تمت مطابقة الإيداع البنكي بكشف الحساب الرسمي. الطلب قيد التنفيذ والتجهيز.`
                      : `Your bank deposit has been matched with our statement. Order is in processing.`}
                  </p>
                  {existingTransfer?.internalReconciliationCode && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {isArabic ? 'كود المطابقة:' : 'Reconciliation Ref:'} {existingTransfer.internalReconciliationCode}
                    </div>
                  )}
                </div>
              ) : order.paymentStatus === 'pending_verification' ? (
                <div style={{ border: '1px solid var(--brand-primary)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', backgroundColor: 'var(--status-info-bg)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                    {isArabic ? 'إشعار التحويل قيد المراجعة والمطابقة المالية' : 'Payment Proof Under Finance Review'}
                  </div>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {isArabic
                      ? 'تم استلام بيانات التحويل البنكي الخاصة بكم، ويقوم مسؤول المالية بمطابقتها مع كشف الحساب الرسمي للوكالة.'
                      : 'We have received your transfer reference. Our finance department is currently verifying the deposit.'}
                  </p>
                  {existingTransfer && (
                    <div style={{ fontSize: '0.8125rem', backgroundColor: 'var(--bg-primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div>{isArabic ? 'المرجع البنكي المزعوم:' : 'Bank Reference:'} <strong>{existingTransfer.bankReferenceCode}</strong></div>
                      <div>{isArabic ? 'المبلغ المسجل:' : 'Claimed Amount:'} <strong>{Number(existingTransfer.claimedAmount).toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</strong></div>
                      {existingTransfer.receiptStorageKey && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <a
                            href={`/api/payments/bank-transfer/${existingTransfer.id}/receipt`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--brand-primary)',
                              fontSize: '0.8125rem',
                              textDecoration: 'underline',
                              fontWeight: 600,
                            }}
                          >
                            📄 {isArabic ? 'معاينة الإشعار المرفوع' : 'View Uploaded Slip'}
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Unpaid / Failed -> Render Receipt Upload Form */
                <BankTransferReceiptUploadForm
                  orderId={order.id}
                  orderNumber={order.orderNumber}
                  orderTotal={orderTotal}
                  bankDetails={bankDetails}
                  locale={locale}
                />
              )}
            </div>
          ) : (
            /* Cash on Delivery Notice */
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.5rem' }}>
                {isArabic ? 'الدفع عند الاستلام (COD)' : 'Cash on Delivery (COD)'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                {isArabic
                  ? 'يتم سداد القيمة نقدًا لمندوب شركة الشحن عند تسليم الشحنة أو عند الاستلام المباشر من مقر الوكالة وفق ضوابط D-021.'
                  : 'Payment is collected in cash upon courier handover or agency pickup per D-021 governance.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}