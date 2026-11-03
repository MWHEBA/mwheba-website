'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardBody, CardFooter, Badge, Button, QuantityStepper } from '@/shared/ui/primitives';
import { CheckIcon } from '@/shared/ui/icons';

interface InteractiveProductSpecimenProps {
  locale: string;
}

export function InteractiveProductSpecimen({ locale }: InteractiveProductSpecimenProps) {
  const isArabic = locale === 'ar';
  const [quantity, setQuantity] = useState(10);
  const [isAdding, setIsAdding] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [customization, setCustomization] = useState<'laser' | 'screen' | 'uv'>('laser');

  // Tiered Pricing Architecture
  let unitPrice = 250;
  let discountLabel = '';
  if (quantity >= 100) {
    unitPrice = 210;
    discountLabel = isArabic ? 'خصم شريحة كبرى 16%' : '16% Enterprise Tier';
  } else if (quantity >= 50) {
    unitPrice = 230;
    discountLabel = isArabic ? 'خصم شركات 8%' : '8% Corporate Tier';
  }

  const subtotal = quantity * unitPrice;
  const isMoqMet = quantity >= 10;

  const handleAddToCart = () => {
    setIsAdding(true);
    setTimeout(() => {
      setIsAdding(false);
      setToastMessage(
        isArabic
          ? `تمت إضافة ${quantity} قطعة إلى مسودة أمر التوريد (الإجمالي: ${subtotal.toLocaleString()} ج.م)`
          : `Added ${quantity} units to order draft (Total: ${subtotal.toLocaleString()} EGP)`
      );
      setTimeout(() => setToastMessage(null), 4500);
    }, 450);
  };

  return (
    <div style={{ position: 'relative' }}>
      <Card className="product-specimen-card">
        <CardHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge variant={isMoqMet ? 'warning' : 'error'}>
              {isMoqMet
                ? (isArabic ? 'حد أدنى: 10 قطع' : 'MOQ: 10 Units')
                : (isArabic ? 'أقل من الحد الأدنى!' : 'Below MOQ!')}
            </Badge>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              SKU: TM-500-BLK
            </span>
          </div>

          <CardTitle style={{ marginTop: '0.875rem' }}>
            {isArabic ? 'كوب حراري فاخر (500 مل)' : 'Executive Thermal Mug (500ml)'}
          </CardTitle>
        </CardHeader>

        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.7', margin: 0 }}>
            {isArabic
              ? 'ستانلس ستيل مزدوج الجدار 304، عزل حراري للمشروبات الساخنة حتى 12 ساعة، متاح للطباعة بالليزر أو السلك سكرين بدقة متناهية.'
              : 'Double-wall 304 food-grade stainless steel with 12-hour thermal stability. High-precision laser etching and screen printing supported.'}
          </p>

          {/* Customization Options */}
          <div style={{ marginTop: '1.25rem' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isArabic ? 'طريقة تخصيص الشعار والطباعة' : 'Branding Method'}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[
                { id: 'laser', labelAr: 'حفر ليزر دقيق', labelEn: 'Laser Engraving' },
                { id: 'screen', labelAr: 'سلك سكرين', labelEn: 'Silk Screen' },
                { id: 'uv', labelAr: 'طباعة UV ملونة', labelEn: 'Full-Color UV' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCustomization(opt.id as any)}
                  className={`btn-sm ${customization === opt.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.75rem', height: '1.875rem', borderRadius: 'var(--radius-full)' }}
                >
                  {isArabic ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing & Real-time Calculator */}
          <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--brand-primary-dark)', letterSpacing: '-0.02em' }}>
                  {unitPrice} {isArabic ? 'ج.م' : 'EGP'}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginInlineStart: '0.35rem' }}>
                  {isArabic ? '/ للقطعة' : '/ unit'}
                </span>
              </div>
              {discountLabel && (
                <Badge variant="success">
                  {discountLabel}
                </Badge>
              )}
            </div>

            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-default)', paddingTop: '0.5rem' }}>
              <span>{isArabic ? 'إجمالي الدفعة التقديري:' : 'Estimated Batch Total:'}</span>
              <span style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                {subtotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}
              </span>
            </div>
          </div>
        </CardBody>

        <CardFooter style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <QuantityStepper
            defaultValue={quantity}
            min={1}
            max={500}
            onChange={(val) => setQuantity(val)}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddToCart}
            disabled={!isMoqMet || isAdding}
            loading={isAdding}
            loadingText={isArabic ? 'جاري الإضافة...' : 'Adding...'}
          >
            {isArabic ? 'إضافة إلى الطلب' : 'Add to Order'}
          </Button>
        </CardFooter>
      </Card>

      {/* Sleek B2B Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            bottom: '-4.25rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--brand-primary)',
            color: 'var(--text-inverted)',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-elevated)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            fontSize: '0.8125rem',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            zIndex: 30,
            animation: 'fadeIn 200ms ease',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.25rem',
              height: '1.25rem',
              borderRadius: '50%',
              backgroundColor: 'var(--status-success)',
              color: 'var(--text-inverted)',
            }}
          >
            <CheckIcon size={12} />
          </span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-inverted-muted)',
              cursor: 'pointer',
              padding: '0 0.25rem',
              fontSize: '0.875rem',
            }}
            aria-label={isArabic ? 'إغلاق الإشعار' : 'Dismiss notice'}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
