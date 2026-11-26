'use client';

import React, { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { Badge } from '@/shared/ui/primitives';
import { stockNotice } from '../logic/stockNotice';

interface CartDrawerProps {
  locale: string;
}

const availabilityMessagesAr: Record<string, string> = {
  PRODUCT_UNAVAILABLE: 'هذا المنتج غير متاح حالياً.',
  VARIANT_UNAVAILABLE: 'هذا الخيار غير متاح حالياً.',
  VARIANT_MISMATCH: 'هذا الخيار لم يعد متاحاً لهذا المنتج.',
  VARIANT_REQUIRED: 'اختر أحد الخيارات المتاحة لهذا المنتج.',
  PRICE_UNAVAILABLE: 'سعر هذا الصنف غير متاح حالياً.',
  CUSTOMIZATION_UNAVAILABLE: 'هذا المنتج لا يقبل إرفاق ملفات الطباعة.',
  INVALID_QUANTITY: 'أدخل كمية صحيحة بالوحدات.',
};

export function CartDrawer({ locale }: CartDrawerProps) {
  const isArabic = locale === 'ar';
  const {
    items,
    calculation,
    isLoading,
    error,
    isCartOpen,
    closeCart,
    refreshCart,
    updateQuantity,
    removeItem,
  } = useCart();

  // Close drawer on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCartOpen) {
        closeCart();
      }
    },
    [isCartOpen, closeCart]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCartOpen]);

  if (!isCartOpen) return null;

  const storefront = isArabic ? '/ar' : '/en';
  const checkoutHref = `${storefront}/checkout`;
  const currency = new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-EG', {
    style: 'currency',
    currency: 'EGP',
  });
  const shortages = Object.values(calculation.productStatuses).filter((status) => !status.isSatisfied);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isArabic ? 'سلة الطلبات المؤسسية' : 'Corporate Cart'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: isArabic ? 'flex-start' : 'flex-end',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={closeCart}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'var(--brand-primary-dark)',
          opacity: 0.5,
          cursor: 'pointer',
        }}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          backgroundColor: 'var(--bg-primary)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 101,
          borderInlineStart: isArabic ? 'none' : '1px solid var(--border-default)',
          borderInlineEnd: isArabic ? '1px solid var(--border-default)' : 'none',
        }}
      >
        {/* Drawer Header */}
        <header
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--brand-primary-dark)',
              }}
            >
              {isArabic ? 'سلة الطلبات المؤسسية' : 'Corporate Cart'}
            </h2>
            <Badge variant="neutral">{items.length} {isArabic ? 'أصناف' : 'items'}</Badge>
          </div>

          <button
            type="button"
            onClick={closeCart}
            aria-label={isArabic ? 'إغلاق السلة' : 'Close cart'}
            style={{
              padding: '0.35rem 0.65rem',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {isArabic ? 'إغلاق ✕' : '✕ Close'}
          </button>
        </header>

        {shortages.length > 0 && (
          <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
            {shortages.map((status) => (
                <div
                  key={status.productId}
                  style={{
                    marginBottom: '0.5rem',
                    padding: '0.625rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--status-warning-bg)',
                    border: '1px solid var(--status-warning)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--status-warning)' }}>
                      {status.productTitle}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {status.totalQuantity} / {status.minOrderQuantity} {isArabic ? 'قطعة' : 'units'}
                    </span>
                  </div>

                  <div style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
                    ⚠️ {isArabic
                      ? `متبقي ${status.remainingNeeded} قطع لتفعيل إمكانية إتمام الطلب`
                      : `${status.remainingNeeded} more units required to enable checkout`}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Line Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
          {isLoading && (
            <p role="status">
              {isArabic
                ? (items.length ? 'جارٍ تحديث السلة…' : 'جارٍ تحميل السلة…')
                : (items.length ? 'Updating your cart…' : 'Loading your cart…')}
            </p>
          )}
          {error && (
            <div style={{ marginBlockEnd: '1rem' }}>
              <p role="alert" style={{ color: 'var(--status-error)' }}>
                {isArabic
                  ? 'تعذّر تحديث السلة. أعد تحميلها للتحقق من آخر التغييرات.'
                  : 'Could not update your cart. Reload it to check the latest changes.'}
              </p>
              <button type="button" className="btn-secondary" onClick={() => void refreshCart()} disabled={isLoading}>
                {isArabic ? 'إعادة تحميل السلة' : 'Reload cart'}
              </button>
            </div>
          )}
          {items.length === 0 && !isLoading && !error && (
            <div style={{ textAlign: 'center', paddingBlock: '3rem', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontSize: '0.9375rem' }}>
                {isArabic ? 'سلة الطلبات فارغة حالياً' : 'Your cart is currently empty'}
              </p>
              <Link href={`${storefront}/store`} onClick={closeCart} className="btn-secondary" style={{ marginBlockStart: '1rem' }}>
                {isArabic ? 'تصفّح المتجر' : 'Browse the store'}
              </Link>
            </div>
          )}
          {items.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((line) => {
                const variantName = line.variantTitle;
                const hasPrinting = Boolean(line.artworkAssetId || line.printingNotes);
                const printingFeeTotal = line.lineCustomizationFee;
                const lineTotal = line.lineTotal;
                const productHref = `${storefront}/store/${encodeURIComponent(line.productSlug)}`;
                const unavailable = Boolean(line.availabilityError);

                return (
                  <li
                    key={line.id}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                          {line.productSlug
                            ? <Link href={productHref} onClick={closeCart}>{line.productTitle}</Link>
                            : line.productTitle}
                        </h4>
                        {variantName && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {isArabic ? 'الخيار:' : 'Variant:'} {variantName}
                          </div>
                        )}
                        {line.sku && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {isArabic ? 'رمز المنتج' : 'SKU'} <bdi>{line.sku}</bdi>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => void removeItem(line.id).catch(() => undefined)}
                        disabled={isLoading}
                        aria-label={isArabic ? 'حذف العنصر' : 'Remove item'}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--status-error)',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          padding: '0.25rem',
                        }}
                      >
                        {isArabic ? 'حذف' : 'Remove'}
                      </button>
                    </div>

                    {unavailable && (
                      <div style={{ color: 'var(--status-warning)', fontSize: '0.875rem', marginBlockStart: '0.625rem' }}>
                        <p>
                          {isArabic
                            ? availabilityMessagesAr[line.availabilityError?.split(':')[0] ?? ''] ?? 'هذا الصنف غير متاح حالياً.'
                            : line.availabilityError?.replace(/^[A-Z_]+: /, '')}
                          {' '}
                          {isArabic ? 'احذف الصنف للمتابعة.' : 'Remove this item to continue.'}
                        </p>
                        {line.productSlug && (
                          <Link href={productHref} onClick={closeCart}>
                            {isArabic ? 'عرض خيارات المنتج' : 'View product options'}
                          </Link>
                        )}
                      </div>
                    )}

                    {line.stockIssue && (
                      <p style={{ color: 'var(--status-warning)', fontSize: '0.875rem', marginBlockStart: '0.625rem' }}>
                        {stockNotice(line.stockIssue, isArabic ? 'ar' : 'en')}
                      </p>
                    )}

                    {/* Attached Customization Indicator */}
                    {hasPrinting && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          padding: '0.35rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--status-info-bg)',
                          border: '1px solid var(--border-default)',
                          fontSize: '0.75rem',
                          color: 'var(--brand-primary-dark)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          🎨 {isArabic ? 'شعار وهوية الشركة مرفقة' : 'Corporate Artwork Attached'}
                        </div>
                        {line.printingNotes && (
                          <div style={{ color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {line.printingNotes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pricing & Stepper Row */}
                    <div
                      style={{
                        marginTop: '0.875rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderTop: '1px dashed var(--border-default)',
                        paddingTop: '0.75rem',
                      }}
                    >
                      {/* Quantity Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <button
                          type="button"
                          onClick={() => void updateQuantity(line.id, -1).catch(() => undefined)}
                          disabled={isLoading || unavailable}
                          aria-label={isArabic ? 'تقليل الكمية' : 'Decrease quantity'}
                          style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 700,
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: '32px', textAlign: 'center', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => void updateQuantity(line.id, 1).catch(() => undefined)}
                          disabled={isLoading || unavailable}
                          aria-label={isArabic ? 'زيادة الكمية' : 'Increase quantity'}
                          style={{
                            width: '28px',
                            height: '28px',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            fontWeight: 700,
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Item Total */}
                      {!unavailable && <div style={{ textAlign: 'end' }}>
                        <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', fontSize: '0.9375rem' }}>
                          {currency.format(lineTotal)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {isArabic ? 'سعر الوحدة' : 'Unit price'} {currency.format(line.unitPrice)}
                        </div>
                        {printingFeeTotal > 0 && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {isArabic ? 'رسوم الطباعة' : 'Printing fee'} {currency.format(printingFeeTotal)}
                          </div>
                        )}
                      </div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Drawer Footer & Checkout Action */}
        {items.length > 0 && <footer
          style={{
            padding: '1.25rem 1.5rem',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--bg-surface)',
          }}
        >
          {/* Subtotals & Fees */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>{isArabic ? 'إجمالي المنتجات الأساسية:' : 'Base Products Total:'}</span>
              <span>{currency.format(calculation.subtotal)}</span>
            </div>

            {calculation.totalCustomizationFees > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? 'رسوم الطباعة والحفر (بند مستقل):' : 'Customization Fees (Separate):'}</span>
                <span>{currency.format(calculation.totalCustomizationFees)}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--brand-primary-dark)',
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: '0.5rem',
                marginTop: '0.25rem',
              }}
            >
              <span>{isArabic ? 'الإجمالي التقديري للدفع:' : 'Estimated Total:'}</span>
              <span>{currency.format(calculation.grandTotal)}</span>
            </div>
          </div>

          {/* Checkout is available when the current server summary permits it. */}
          {calculation.canCheckout ? (
            <Link
              href={checkoutHref}
              onClick={closeCart}
              className="btn-primary"
              style={{
                display: 'block',
                textAlign: 'center',
                paddingBlock: '0.85rem',
                textDecoration: 'none',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {isArabic ? 'متابعة إتمام الطلب' : 'Proceed to checkout'}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="btn-primary"
              style={{
                width: '100%',
                paddingBlock: '0.85rem',
                opacity: 0.5,
                cursor: 'not-allowed',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {isArabic ? 'متابعة إتمام الطلب' : 'Proceed to checkout'}
            </button>
          )}
        </footer>}
      </aside>
    </div>
  );
}
