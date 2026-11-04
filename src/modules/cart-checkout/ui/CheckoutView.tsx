'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { Badge, Button } from '@/shared/ui/primitives';
import type { CheckoutQuote } from '@/modules/orders/services/checkoutQuote';

interface CheckoutViewProps {
  locale: string;
}

export function CheckoutView({ locale }: CheckoutViewProps) {
  const isArabic = locale === 'ar';
  const { items, shippingFee, setShippingFee, resetSession } = useCart();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [quoteReady, setQuoteReady] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Shipping Address Fields
  const [governorate, setGovernorate] = useState('القاهرة (Cairo)');
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [buildingDetails, setBuildingDetails] = useState('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');

  // Toggles
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cod'>('bank_transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const handleDeliveryChange = (method: 'shipping' | 'pickup') => {
    setDeliveryMethod(method);
  };

  // Server-authoritative delivery quote (tariff is provisional until owner approval per D-015)
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    setQuoteReady(false);
    setQuoteError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/checkout/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            delivery: { method: deliveryMethod, governorate: deliveryMethod === 'shipping' ? governorate : undefined },
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) throw new Error(data.error || 'Quote unavailable');
        setQuote(data);
        setShippingFee(data.shippingFee);
        setQuoteReady(true);
      } catch (err: any) {
        if (!cancelled) setQuoteError(err.message || 'Quote unavailable');
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deliveryMethod, governorate, items.length, setShippingFee]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !quote.canCheckout || !quoteReady) return;

    setIsSubmitting(true);
    setOrderError(null);

    try {
      const res = await fetch('/api/checkout/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email,
            password,
            companyName,
            contactPerson: contactName,
            phone,
            taxId,
          },
          delivery: {
            method: deliveryMethod,
            shippingAddress: deliveryMethod === 'shipping' ? {
              governorate,
              city,
              streetAddress,
              buildingDetails,
            } : undefined,
            fulfillmentNotes,
            expectedShippingFee: quote.shippingFee,
          },
          paymentMethod: paymentMethod,
          expectedGrandTotal: quote.grandTotal,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 409 && data.updatedQuote) {
          // Price or tariff changed between display and confirmation: show the refreshed quote and ask to re-confirm.
          setQuote(data.updatedQuote);
          setShippingFee(data.updatedQuote.shippingFee);
          setOrderError(
            isArabic
              ? `تغيّر السعر أو رسوم الشحن. الإجمالي المحدّث ${Number(data.updatedQuote.grandTotal).toLocaleString()} ج.م. راجع الملخص ثم أكّد الطلب مجددًا.`
              : `Pricing or delivery fee changed. Updated total: ${Number(data.updatedQuote.grandTotal).toLocaleString()} EGP. Please review and confirm again.`
          );
          return;
        }
        throw new Error(data.error || 'Failed to place order');
      }

      setPlacedOrder(data);
      setIsOrderPlaced(true);
      resetSession();
    } catch (err: any) {
      setOrderError(err.message || 'An unexpected error occurred during checkout');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isOrderPlaced && placedOrder) {
    return (
      <div className="container" style={{ paddingBlock: '5rem 7rem', maxWidth: '740px', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            border: '2px solid var(--status-success)',
          }}
        >
          ✓
        </div>

        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {isArabic ? 'تم اعتماد وتأكيد أمر الشراء المؤسسي بنجاح' : 'Corporate Order Placed Successfully'}
        </span>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.5rem 0 1rem' }}>
          {placedOrder.orderNumber}
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          {isArabic
            ? 'تم حفظ وتسجيل تفاصيل طلبكم وتجميد الأسعار ورسوم الطباعة بدقة داخل النظام، وربط ملفات الشعار المرفقة بالطلب.'
            : 'Your order snapshot, pricing, customization fees, and uploaded assets have been securely frozen in the database.'}
        </p>

        <div
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            marginBottom: '2rem',
            textAlign: isArabic ? 'right' : 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'رقم الطلب الرسمي:' : 'Order Number:'}</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>{placedOrder.orderNumber}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'الجهة المتعاقدة:' : 'Corporate Entity:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{companyName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طريقة الاستلام:' : 'Fulfillment:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {deliveryMethod === 'shipping'
                ? (isArabic ? `شحن وتوصيل لمقر الشركة (${city || 'القاهرة'})` : `Corporate Delivery (${city || 'Cairo'})`)
                : (isArabic ? 'استلام مباشر من مقر وكالة موهبة (مجاني)' : 'Office Pickup from MWHEBA Agency Office (Free)')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طريقة السداد:' : 'Payment Method:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {paymentMethod === 'bank_transfer'
                ? (isArabic ? 'تحويل بنكي رسمي للشركات' : 'Corporate Bank Transfer')
                : (isArabic ? 'الدفع عند الاستلام (COD)' : 'Cash on Delivery')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'حالة الطلب:' : 'Order Status:'}</span>
            <Badge variant="info">{placedOrder.status || 'pending'}</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'حالة السداد:' : 'Payment Status:'}</span>
            <Badge variant="warning">{placedOrder.paymentStatus || 'unpaid'}</Badge>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'الإجمالي النهائي المجمد:' : 'Frozen Grand Total:'}</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', fontSize: '1.125rem' }}>
              {placedOrder.total ? `${Number(placedOrder.total).toLocaleString()} ${isArabic ? 'ج.م' : 'EGP'}` : ''}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href={isArabic ? '/ar/store' : '/en/store'}
            className="btn-primary"
            style={{
              display: 'inline-block',
              padding: '0.85rem 2rem',
              textDecoration: 'none',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {isArabic ? 'متابعة تصفح المتجر والخدمات ←' : 'Return to Catalog →'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBlock: '3.5rem 6rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          {isArabic ? 'الخطوة 2 // إتمام الطلب والتعاقد' : 'STEP 2 // B2B CHECKOUT & INVOICING'}
        </span>
        <h1 style={{ fontSize: 'clamp(1.85rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.35rem 0 1rem' }}>
          {isArabic ? 'إتمام طلب الشراء المؤسسي (B2B)' : 'Corporate Order Checkout'}
        </h1>
      </header>

      {/* If cart empty or MOQ not satisfied */}
      {(items.length === 0 || (quote && !quote.canCheckout)) && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--status-warning-bg)',
            border: '1px solid var(--status-warning)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: 'var(--status-warning)', fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
              ⚠️ {isArabic ? 'الحد الأدنى للطلب (MOQ) لم يكتمل بعد' : 'Minimum Order Quantity Requirements Not Met'}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {isArabic
                ? 'يتطلب كل صنف مادي 10 قطع كحد أدنى لتفعيل الدفع والتعاقد الرسمي.'
                : 'Each physical product line requires at least 10 units to enable official B2B checkout.'}
            </div>
          </div>

          <Link
            href={isArabic ? '/ar/store' : '/en/store'}
            className="btn-secondary"
            style={{ padding: '0.5rem 1rem', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600 }}
          >
            {isArabic ? 'تعديل السلة وإكمال الكمية ←' : 'Update Cart Quantities →'}
          </Link>
        </div>
      )}

      {/* 2-Column Checkout Grid */}
      <form onSubmit={handleSubmitOrder}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem', alignItems: 'start' }}>
          {/* Left Column: Form Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 1. Company Information */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1.25rem' }}>
                {isArabic ? '1. بيانات الشركة والجهة المتعاقدة' : '1. Corporate Entity Details'}
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'اسم الشركة / المؤسسة *' : 'Company Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={isArabic ? 'شركة النيل للحلول الرقمية' : 'Nile Digital Solutions LLC'}
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'السجل التجاري أو الرقم الضريبي (اختياري)' : 'Commercial Register / Tax ID (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    placeholder="123-456-789"
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'اسم المسؤول التنفيذي *' : 'Authorized Contact Person *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={isArabic ? 'أحمد الشناوي' : 'Ahmed El Shennawy'}
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'رقم الهاتف للتواصل والمتابعة *' : 'Phone Number *'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 100 000 0000"
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                    {isArabic ? 'البريد الإلكتروني المؤسسي *' : 'Corporate Email Address *'}
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="purchasing@company.com"
                    style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Seamless Account Setup */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.5rem' }}>
                {isArabic ? '2. إعداد حساب العميل لمتابعة الشحنات' : '2. Direct Account Access'}
              </h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {isArabic
                  ? 'اختر كلمة مرور لحسابك لمتابعة مراحل تجهيز الشعار وتتبع الشحن بدون كلمات مرور مؤقتة.'
                  : 'Establish a password for real-time tracking of artwork proofing and shipment progress.'}
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                  {isArabic ? 'كلمة المرور *' : 'Account Password *'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                />
              </div>
            </div>

            {/* 3. Delivery Method Toggle */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1rem' }}>
                {isArabic ? '3. طريقة الاستلام والتوصيل' : '3. Delivery Method'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: deliveryMethod === 'shipping' ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                    backgroundColor: deliveryMethod === 'shipping' ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="shipping"
                    checked={deliveryMethod === 'shipping'}
                    onChange={() => handleDeliveryChange('shipping')}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {isArabic ? 'شحن وتوصيل لمقر الشركة' : 'Corporate Courier Delivery'}
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {isArabic ? 'يُحسب من الخادم' : 'Server quote'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {isArabic
                        ? 'شحن مؤمن لجميع المحافظات (قيمة الشحن تقديرية للمعاينة وخاضعة للاعتماد طبقاً للبند D-015)'
                        : 'Insured delivery across Egypt (illustrative estimate subject to owner confirmation per D-015)'}
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: deliveryMethod === 'pickup' ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                    backgroundColor: deliveryMethod === 'pickup' ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="delivery"
                    value="pickup"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => handleDeliveryChange('pickup')}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {isArabic ? 'استلام مباشر من مقر وكالة موهبة' : 'Pickup from MWHEBA Agency Office'}
                      </span>
                      <Badge variant="success">{isArabic ? 'مجاني' : 'Free'}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {isArabic ? 'مقر الوكالة الرئيسي (المعادي / التجمع الخامس - القاهرة)' : 'MWHEBA Headquarters (Maadi / New Cairo)'}
                    </div>
                  </div>
                </label>
              </div>

              {/* Delivery Address Fields for Corporate Shipping */}
              {deliveryMethod === 'shipping' && (
                <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-default)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.25rem' }}>
                      {isArabic ? 'المحافظة *' : 'Governorate *'}
                    </label>
                    <input
                      type="text"
                      required={deliveryMethod === 'shipping'}
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      placeholder={isArabic ? 'القاهرة' : 'Cairo'}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.25rem' }}>
                      {isArabic ? 'المدينة / المنطقة *' : 'City / District *'}
                    </label>
                    <input
                      type="text"
                      required={deliveryMethod === 'shipping'}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={isArabic ? 'المعادي / التجمع الخامس' : 'Maadi / New Cairo'}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.25rem' }}>
                      {isArabic ? 'اسم الشارع ومقر الشركة التفصيلي *' : 'Street Address *'}
                    </label>
                    <input
                      type="text"
                      required={deliveryMethod === 'shipping'}
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder={isArabic ? 'شارع التسعين، مجمع الأعمال، مبنى A' : '90th St, Business Complex, Building A'}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.25rem' }}>
                      {isArabic ? 'تفاصيل المبنى / الطابق / رقم المكتب (اختياري)' : 'Building / Floor / Office (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={buildingDetails}
                      onChange={(e) => setBuildingDetails(e.target.value)}
                      placeholder={isArabic ? 'الطابق الثالث، مكتب 301' : '3rd Floor, Suite 301'}
                      style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                    />
                  </div>
                </div>
              )}

              {/* Fulfillment Notes */}
              <div style={{ marginTop: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.25rem' }}>
                  {isArabic ? 'ملاحظات وتوجيهات الاستلام / التوصيل (اختياري)' : 'Fulfillment & Delivery Notes (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={fulfillmentNotes}
                  onChange={(e) => setFulfillmentNotes(e.target.value)}
                  placeholder={isArabic ? 'أي تعليمات خاصة بالاستلام أو مواعيد التسليم المفضلة...' : 'Any specific delivery instructions or preferred pickup time...'}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}
                />
              </div>
            </div>

            {/* 4. Payment Method Selection */}
            <div style={{ padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-surface)' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1rem' }}>
                {isArabic ? '4. طريقة السداد المالي' : '4. Payment Method'}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* 1. Bank Transfer (D-007 Confirmed) */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: paymentMethod === 'bank_transfer' ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                    backgroundColor: paymentMethod === 'bank_transfer' ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={() => setPaymentMethod('bank_transfer')}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {isArabic ? 'تحويل بنكي رسمي للشركات' : 'Corporate Bank Transfer'}
                      </span>
                      <Badge variant="success">{isArabic ? 'معتمد D-007' : 'Confirmed D-007'}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {isArabic ? 'تحويل مباشر لحساب وكالة موهبة الرسمي مع مراجعة الإشعار البنكي' : 'Direct swift transfer to MWHEBA Agency official corporate account'}
                    </div>
                  </div>
                </label>

                {/* 2. Cash on Delivery (D-007 / D-021 Confirmed) */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: paymentMethod === 'cod' ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                    backgroundColor: paymentMethod === 'cod' ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {isArabic ? 'الدفع عند الاستلام (COD للبضائع المادية)' : 'Cash on Delivery (COD for Physical Goods)'}
                      </span>
                      <Badge variant="success">{isArabic ? 'معتمد D-007' : 'Confirmed D-007'}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {isArabic ? 'سداد قيمة الشحنة لمندوب التوصيل أو بمقر الوكالة وفق ضوابط D-021 و D-023' : 'Payment upon courier handover or agency pickup per D-021 governance'}
                    </div>
                  </div>
                </label>

                {/* 3. Paymob Gateway (D-008 Deferred to Phase 6) */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    padding: '1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-secondary)',
                    opacity: 0.65,
                    cursor: 'not-allowed',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    disabled={true}
                    checked={false}
                    readOnly
                    style={{ marginTop: '0.25rem', cursor: 'not-allowed' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                        {isArabic ? 'بوابة الدفع الإلكتروني (Paymob)' : 'Online Payment (Paymob Gateway)'}
                      </span>
                      <Badge variant="neutral">{isArabic ? 'مؤجل للمرحلة 6 (D-008)' : 'Deferred to Phase 6 (D-008)'}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {isArabic ? 'مغلق ومؤجل للمرحلة 6 وفقاً للقرار D-008. غير متاح للاختيار حالياً.' : 'Disabled and deferred to Phase 6 per Decision D-008. Not available for selection.'}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Immutable Order Summary */}
          <div
            style={{
              position: 'sticky',
              top: '2rem',
              padding: '1.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1.25rem' }}>
              {isArabic ? 'ملخص أمر الشراء المعتمد' : 'Immutable Order Summary'}
            </h2>

            {/* Itemized List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {(quote?.items ?? []).map((line) => {
                const title = line.title;
                const variantName = line.variantTitle;
                const lineTotal = line.lineTotal;

                return (
                  <div
                    key={line.id}
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      fontSize: '0.8125rem',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                      <span>{title}</span>
                      <span>{lineTotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {line.quantity} {isArabic ? 'قطع' : 'units'} {variantName ? `• ${variantName}` : ''}
                    </div>
                    {line.lineCustomizationFee > 0 && (
                      <div style={{ color: 'var(--brand-primary)', marginTop: '0.15rem' }}>
                        🎨 {isArabic ? `شعار مخصص (+${line.lineCustomizationFee} ج.م)` : `Branded (+${line.lineCustomizationFee} EGP)`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calculations Breakdown */}
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? 'إجمالي المنتجات الأساسية:' : 'Base Products Subtotal:'}</span>
                <span>{(quote?.subtotal ?? 0).toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>

              {(quote?.totalCustomizationFees ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{isArabic ? 'رسوم الطباعة والتخصيص:' : 'Customization & Branding:'}</span>
                  <span>{(quote?.totalCustomizationFees ?? 0).toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? 'رسوم الشحن والتوصيل:' : 'Delivery & Logistics:'}</span>
                <span>{!quoteReady ? (isArabic ? 'جاري الحساب من الخادم...' : 'Calculating from server...') : shippingFee === 0 ? (isArabic ? 'مجاني (استلام مقر)' : 'Free (Pickup)') : `${shippingFee} ${isArabic ? 'ج.م (تقديري مؤقت D-015)' : 'EGP (provisional D-015)'}`}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--brand-primary-dark)',
                  borderTop: '2px solid var(--border-default)',
                  paddingTop: '0.75rem',
                  marginTop: '0.5rem',
                }}
              >
                <span>{isArabic ? 'الإجمالي المقدّر (الشحن مؤقت حتى اعتماد D-015):' : 'Estimated Total (shipping provisional per D-015):'}</span>
                <span>{quote ? quote.grandTotal.toLocaleString() : '—'} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            {/* Error Message Display */}
            {(orderError || quoteError) && (
              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--status-error-bg)',
                  border: '1px solid var(--status-error)',
                  color: 'var(--status-error)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  lineHeight: 1.5,
                }}
              >
                ⚠️ {orderError || quoteError}
              </div>
            )}

            {/* Submit Action */}
            <div style={{ marginTop: '1.5rem' }}>
              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={!quote?.canCheckout || !quoteReady}
                loading={isSubmitting}
                loadingText={isArabic ? 'جاري تأكيد وتسجيل الطلب...' : 'Processing Order...'}
                style={{ width: '100%', fontWeight: 700 }}
              >
                {isArabic ? 'تأكيد أمر الشراء المؤسسي (B2B) ←' : 'Confirm B2B Corporate Order →'}
              </Button>
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🔒 {isArabic ? 'عملية شراء مشفرة وآمنة وفق ضوابط التعاقد المؤسسي D-007 و D-013' : 'Secure corporate order process compliant with D-007 & D-013'}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
