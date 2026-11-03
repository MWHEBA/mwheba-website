'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { sampleProducts } from '@/modules/catalog/data/sampleProducts';
import { Badge, Button } from '@/shared/ui/primitives';

interface CheckoutViewProps {
  locale: string;
}

export function CheckoutView({ locale }: CheckoutViewProps) {
  const isArabic = locale === 'ar';
  const { items, calculation, shippingFee, setShippingFee, clearCart } = useCart();

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Toggles
  const [deliveryMethod, setDeliveryMethod] = useState<'shipping' | 'pickup'>('shipping');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cod' | 'paymob'>('bank_transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);

  const handleDeliveryChange = (method: 'shipping' | 'pickup') => {
    setDeliveryMethod(method);
    setShippingFee(method === 'shipping' ? 150 : 0);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!calculation.canCheckout) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsOrderPlaced(true);
      // Cart items intentionally preserved for testing per owner directive (do NOT clear cart)
    }, 800);
  };

  if (isOrderPlaced) {
    return (
      <div className="container" style={{ paddingBlock: '5rem 7rem', maxWidth: '740px', textAlign: 'center' }}>
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--status-info-bg)',
            color: 'var(--brand-primary)',
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            border: '2px solid var(--brand-primary)',
          }}
        >
          ℹ️
        </div>

        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {isArabic ? 'محاكاة تجربة إتمام الشراء المؤسسي (UI Simulation Mode)' : 'B2B Checkout Experience Simulation'}
        </span>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.5rem 0 1rem' }}>
          {isArabic ? 'تمت تجربة تدفق إتمام الطلب بنجاح (محاكاة فقط)' : 'Checkout Simulation Flow Completed (Simulation Only)'}
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          {isArabic
            ? 'هذه محاكاة تفاعلية لواجهة المستخدم لاختبار تجربة الشراء والتأكد من استيفاء الـ MOQ. لم يتم تسجيل أو خصم أي مبالغ أو إنشاء طلب حقيقي بقاعدة البيانات، وتم الاحتفاظ ببيانات السلة كاملة لمتابعة التجارب. الربط الفعلي مع قواعد البيانات وبوابات الدفع محدد في المرحلتين 6 و 7.'
            : 'This is an interactive UI simulation to validate the B2B checkout experience and MOQ governance. No actual order has been created in the database, and your cart items are preserved for further testing. Live transactional order processing is scheduled for Phases 6 & 7.'}
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
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طبيعة العملية:' : 'Operation Mode:'}</span>
            <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
              {isArabic ? 'محاكاة واجهة (Simulation Only - لا يوجد طلب حقيقي)' : 'Front-end Simulation (No Real Order)'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'الجهة المتعاقدة:' : 'Corporate Entity:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{companyName || (isArabic ? 'جهة تجريبية' : 'Test Company')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طريقة الاستلام المختارة:' : 'Fulfillment:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {deliveryMethod === 'shipping'
                ? (isArabic ? 'شحن وتوصيل لمقر الشركة (150 ج.م تقديري طبقاً لـ D-015)' : 'Corporate Courier Delivery (150 EGP estimate per D-015)')
                : (isArabic ? 'استلام مباشر من مقر وكالة موهبة (مجاني)' : 'Office Pickup from MWHEBA Headquarters (Free)')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'طريقة السداد المختارة:' : 'Payment:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {paymentMethod === 'bank_transfer'
                ? (isArabic ? 'تحويل بنكي رسمي للشركات (معتمد D-007)' : 'Corporate Bank Transfer (Confirmed D-007)')
                : paymentMethod === 'cod'
                ? (isArabic ? 'الدفع عند الاستلام (معتمد D-007)' : 'Cash on Delivery (Confirmed D-007)')
                : (isArabic ? 'بوابة الدفع الإلكتروني Paymob (مؤجل للمرحلة 6)' : 'Paymob Gateway (Phase 6 Candidate)')}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'حالة السلة:' : 'Cart State:'}</span>
            <span style={{ fontWeight: 600, color: 'var(--status-success)' }}>
              {isArabic ? '✓ محفوظة كما هي لأغراض المراجعة والتجربة' : '✓ Preserved for further testing and review'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setIsOrderPlaced(false)}
            className="btn-secondary"
            style={{
              padding: '0.85rem 1.75rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {isArabic ? '← العودة لمراجعة نموذج الـ Checkout' : '← Return to Checkout Form'}
          </button>
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
            {isArabic ? 'متابعة تصفح المتجر التجريبي ←' : 'Continue Store Browsing →'}
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

        {/* Phase 3 UI Specimen & Commercial Parameters Notice */}
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--status-info-bg)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8125rem',
            color: 'var(--brand-primary-dark)',
            lineHeight: 1.6,
          }}
        >
          <strong>ℹ️ {isArabic ? 'ملاحظة توضيحية لنموذج الواجهة (Phase 3 Specimen):' : 'Phase 3 UI Specimen Notice:'}</strong>{' '}
          {isArabic
            ? 'هذه الشاشة تمثل نموذج واجهة تفاعلية تجريبية لتجربة رحلة الشراء وحوكمة الـ MOQ. تكامل قواعد البيانات الفعلي وتوليد أوامر الشراء الدائمة وبوابات الدفع محدد في المرحلتين 6 و 7 طبقاً لوثيقة القرارات DECISIONS.md (D-007, D-008, D-015).'
            : 'This page is an interactive design specimen for validating B2B ordering and MOQ governance. Transactional database order creation and payment gateways are formally scheduled for Phases 6 & 7 per DECISIONS.md (D-007, D-008, D-015).'}
        </div>
      </header>

      {/* If cart empty or MOQ not satisfied */}
      {!calculation.canCheckout && (
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
                        150 {isArabic ? 'ج.م (تقديري)' : 'EGP (estimate)'}
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
                    border: paymentMethod === 'paymob' ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                    backgroundColor: paymentMethod === 'paymob' ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'paymob'}
                    onChange={() => setPaymentMethod('paymob')}
                    style={{ marginTop: '0.25rem' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {isArabic ? 'بوابة الدفع الإلكتروني (Paymob)' : 'Online Payment (Paymob Gateway)'}
                      </span>
                      <Badge variant="neutral">{isArabic ? 'مؤجل للمرحلة 6 (D-008)' : 'Phase 6 Integration (D-008)'}</Badge>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      {isArabic ? 'الدفع الفوري ببطاقات ميزة، فيزا، وماستركارد (نموذج محاكاة، الربط الفعلي بالمرحلة 6)' : 'Card payment simulation (live sandbox integration scheduled in Phase 6)'}
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
              {items.map((line) => {
                const product = sampleProducts[line.productId];
                if (!product) return null;
                const hasPrinting = Boolean(line.artworkAssetId || line.printingNotes);
                const printingCost = hasPrinting ? (product.customizationFee || 0) * line.quantity : 0;
                const lineTotal = product.basePrice * line.quantity + printingCost;

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
                      <span>{product.title}</span>
                      <span>{lineTotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {line.quantity} {isArabic ? 'قطع' : 'units'} {line.variantName ? `• ${line.variantName}` : ''}
                    </div>
                    {hasPrinting && (
                      <div style={{ color: 'var(--brand-primary)', marginTop: '0.15rem' }}>
                        🎨 {isArabic ? `شعار مخصص (+${printingCost} ج.م)` : `Branded (+${printingCost} EGP)`}
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
                <span>{calculation.subtotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>

              {calculation.totalCustomizationFees > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{isArabic ? 'رسوم الطباعة والتخصيص:' : 'Customization & Branding:'}</span>
                  <span>{calculation.totalCustomizationFees.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? 'رسوم الشحن والتوصيل:' : 'Delivery & Logistics:'}</span>
                <span>{shippingFee === 0 ? (isArabic ? 'مجاني (استلام مقر)' : 'Free (Pickup)') : `${shippingFee} ${isArabic ? 'ج.م' : 'EGP'}`}</span>
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
                <span>{isArabic ? 'الإجمالي النهائي المطلوب:' : 'Final Grand Total:'}</span>
                <span>{calculation.grandTotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            {/* Submit Action */}
            <div style={{ marginTop: '1.5rem' }}>
              <Button
                variant="primary"
                size="lg"
                type="submit"
                disabled={!calculation.canCheckout}
                loading={isSubmitting}
                loadingText={isArabic ? 'جاري معالجة المحاكاة...' : 'Processing Simulation...'}
                style={{ width: '100%', fontWeight: 700 }}
              >
                {isArabic ? 'تجربة محاكاة إتمام الطلب (Simulation) ←' : 'Test Checkout Simulation Flow →'}
              </Button>
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ℹ️ {isArabic ? 'نموذج محاكاة واجهة تفاعلية - لا يتم خصم أموال أو تسجيل طلب فعلي' : 'Interactive UI Simulation - No real order or charge is executed'}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
