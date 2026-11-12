'use client';

import React, { useEffect } from 'react';
import { useShortlist } from './shortlistStore';
import { ArrowUpRightIcon, CloseIcon } from '@/shared/ui/icons';

interface CorporateShortlistDrawerProps {
  locale: string;
}

export function CorporateShortlistDrawer({ locale }: CorporateShortlistDrawerProps) {
  const isArabic = locale === 'ar';
  const {
    items,
    isDrawerOpen,
    closeDrawer,
    removeItem,
    updateQuantity,
    toastMessage,
  } = useShortlist();

  const itemEntries = Object.entries(items);
  const hasItems = itemEntries.length > 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        closeDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen, closeDrawer]);

  const handleContinueToInquiry = () => {
    closeDrawer();

    const summaryText = isArabic
      ? `يرجى تقديم عرض أسعار للبنود التالية:\n` +
        itemEntries.map(([name, qty]) => `• ${name}: ${qty} وحدة`).join('\n')
      : `Please quote the following corporate items:\n` +
        itemEntries.map(([name, qty]) => `• ${name}: ${qty} units`).join('\n');

    setTimeout(() => {
      const briefEl = document.getElementById('brief') as HTMLTextAreaElement | null;
      const interestEl = document.getElementById('interest') as HTMLSelectElement | null;
      const contactSection = document.getElementById('contact');

      if (briefEl) {
        briefEl.value = summaryText;
        briefEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (interestEl) {
        interestEl.value = 'Corporate gifts & merchandise';
        interestEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 150);
  };

  return (
    <>
      {/* Toast Notification Pill matching v6 */}
      <div
        className={`toast ${toastMessage ? 'show' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toastMessage}
      </div>

      {/* Drawer Backdrop and Panel */}
      {isDrawerOpen && (
        <div
          className="shortlist-drawer-backdrop"
          id="cartBackdrop"
          aria-hidden="false"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDrawer();
          }}
        >
          <aside
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label={isArabic ? 'قائمة طلبات الشركات' : 'Corporate order'}
          >
            <button
              type="button"
              className="close"
              id="closeCart"
              onClick={closeDrawer}
              aria-label={isArabic ? 'إغلاق القائمة' : 'Close cart'}
            >
              <CloseIcon size={16} />
            </button>

            <span className="section-number">
              {isArabic ? 'قائمة طلباتك المختصرة' : 'YOUR SHORTLIST'}
            </span>

            <h2 className="display" style={{ margin: '20px 0' }}>
              {isArabic ? 'طلبات الشركات.' : 'Corporate Order.'}
            </h2>

            <div id="cartItems">
              {itemEntries.map(([name, qty]) => (
                <div key={name} className="cart-line">
                  <div>
                    <strong style={{ display: 'block', fontSize: '15px' }}>{name}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <div className="qty" style={{ scale: '0.9', transformOrigin: isArabic ? 'right center' : 'left center' }}>
                        <button
                          type="button"
                          className="minus"
                          onClick={() => updateQuantity(name, Math.max(10, qty - 10))}
                          aria-label="Decrease"
                        >
                          -
                        </button>
                        <output aria-live="polite">{qty}</output>
                        <button
                          type="button"
                          className="plus"
                          onClick={() => updateQuantity(name, qty + 10)}
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {isArabic ? 'وحدة' : 'units'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="small-btn"
                    onClick={() => removeItem(name)}
                    aria-label={`Remove ${name}`}
                    style={{ alignSelf: 'center' }}
                  >
                    {isArabic ? 'حذف' : 'Remove'}
                  </button>
                </div>
              ))}
            </div>

            {!hasItems && (
              <p id="emptyCart" style={{ color: 'var(--text-muted)', margin: '30px 0' }}>
                {isArabic
                  ? 'قائمة طلباتك فارغة حالياً. أضف منتجات من قسم الهدايا لطلب عرض أسعار مخصص.'
                  : 'Your order shortlist is empty. Add products to request a corporate quote.'}
              </p>
            )}

            {hasItems && (
              <button
                type="button"
                className="dark-btn"
                id="cartQuote"
                onClick={handleContinueToInquiry}
                style={{ width: '100%', marginTop: '30px', justifyContent: 'center' }}
              >
                <span>{isArabic ? 'المتابعة إلى نموذج الاستفسار' : 'Continue to Inquiry'}</span>
                <ArrowUpRightIcon size={16} />
              </button>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
