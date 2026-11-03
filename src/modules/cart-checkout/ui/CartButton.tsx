'use client';

import React from 'react';
import { useCart } from '../context/CartContext';

interface CartButtonProps {
  locale: string;
}

export function CartButton({ locale }: CartButtonProps) {
  const isArabic = locale === 'ar';
  const { totalCount, openCart } = useCart();

  return (
    <button
      type="button"
      onClick={openCart}
      className="btn-outline"
      aria-label={isArabic ? `عرض سلة الطلبات (${totalCount} قطع)` : `View Cart (${totalCount} units)`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.45rem 0.85rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>

      <span>{isArabic ? 'السلة' : 'Cart'}</span>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '20px',
          height: '20px',
          paddingInline: '0.35rem',
          backgroundColor: 'var(--brand-primary)',
          color: 'var(--text-inverted)',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.75rem',
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {totalCount}
      </span>
    </button>
  );
}
