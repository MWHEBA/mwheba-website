'use client';

import React, { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import { sampleProducts } from '@/modules/catalog/data/sampleProducts';
import { Badge } from '@/shared/ui/primitives';

interface CartDrawerProps {
  locale: string;
}

export function CartDrawer({ locale }: CartDrawerProps) {
  const isArabic = locale === 'ar';
  const {
    items,
    calculation,
    isCartOpen,
    closeCart,
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

  const checkoutHref = isArabic ? '/ar/checkout' : '/en/checkout';

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

        {/* MOQ Shortage Warning Banners (Displayed ONLY if MOQ is not yet satisfied) */}
        {Object.values(calculation.productStatuses).some((s) => !s.isSatisfied) && (
          <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
            {Object.values(calculation.productStatuses)
              .filter((status) => !status.isSatisfied)
              .map((status) => (
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
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', paddingBlock: '3rem', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛒</div>
              <p style={{ margin: 0, fontSize: '0.9375rem' }}>
                {isArabic ? 'سلة الطلبات فارغة حالياً' : 'Your cart is currently empty'}
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((line: any) => {
                const sample = sampleProducts[line.productId];
                const title = line.productTitle || sample?.title || `منتج #${line.productId}`;
                const variantName = line.variantTitle || line.variantName;
                const hasPrinting = Boolean(line.artworkAssetId || line.printingNotes);
                const printingFeeTotal =
                  line.lineCustomizationFee ??
                  (hasPrinting ? (sample?.customizationFee || 0) * line.quantity : 0);
                const lineTotal =
                  line.lineTotal ??
                  ((sample?.basePrice || 0) * line.quantity + printingFeeTotal);

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
                          {title}
                        </h4>
                        {variantName && (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {isArabic ? 'الخيار:' : 'Variant:'} {variantName}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(line.id)}
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
                          onClick={() => updateQuantity(line.id, -1)}
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
                          onClick={() => updateQuantity(line.id, 1)}
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
                      <div style={{ textAlign: isArabic ? 'left' : 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', fontSize: '0.9375rem' }}>
                          {lineTotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}
                        </div>
                        {hasPrinting && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {isArabic ? `يشمل ${printingFeeTotal} ج.م طباعة` : `incl. ${printingFeeTotal} EGP print`}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Drawer Footer & Checkout Action */}
        <footer
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
              <span>{calculation.subtotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
            </div>

            {calculation.totalCustomizationFees > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? 'رسوم الطباعة والحفر (بند مستقل):' : 'Customization Fees (Separate):'}</span>
                <span>{calculation.totalCustomizationFees.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
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
              <span>{calculation.grandTotal.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>

          {/* Checkout CTA or MOQ Blocking Notice */}
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
              {isArabic ? 'متابعة إتمام الطلب المؤسسي ←' : 'Proceed to B2B Checkout →'}
            </Link>
          ) : (
            <div>
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
                {isArabic ? 'متابعة إتمام الطلب (مغلق لعدم اكتمال الحد الأدنى)' : 'Proceed to Checkout (Locked: MOQ Not Met)'}
              </button>
              <p
                style={{
                  margin: '0.5rem 0 0',
                  fontSize: '0.75rem',
                  color: 'var(--status-warning)',
                  textAlign: 'center',
                  fontWeight: 600,
                }}
              >
                {isArabic
                  ? 'يجب إكمال 10 قطع على الأقل لكل صنف لتفعيل الدفع'
                  : 'At least 10 units required per product to unlock checkout'}
              </p>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
}
