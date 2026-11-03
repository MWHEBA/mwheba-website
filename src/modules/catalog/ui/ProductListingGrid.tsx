'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { sampleProducts } from '../data/sampleProducts';
import { Badge } from '@/shared/ui/primitives';

interface ProductListingGridProps {
  locale: string;
}

export function ProductListingGrid({ locale }: ProductListingGridProps) {
  const isArabic = locale === 'ar';
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'giveaways' | 'stationery' | 'services'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const products = Object.values(sampleProducts);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const title = isArabic ? product.title : product.title;
      const desc = isArabic ? product.descriptionAr : product.descriptionEn;
      const matchesSearch =
        searchQuery.trim() === '' ||
        title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        desc.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery, isArabic]);

  return (
    <div className="container" style={{ paddingBlock: '3.5rem 6rem' }}>
      {/* PLP Header */}
      <header style={{ marginBottom: '2.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          {isArabic ? 'كتالوج المنتجات والخدمات المؤسسية' : 'ENTERPRISE CATALOG & GIVEAWAYS'}
        </span>
        <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.35rem 0 1rem' }}>
          {isArabic ? 'هدايا الشركات والحلول المخصصة' : 'Corporate Merchandise & B2B Solutions'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', margin: 0, maxWidth: '720px', lineHeight: 1.7 }}>
          {isArabic
            ? 'توريد هدايا دعائية ومطبوعات مكتبية للشركات مع حوكمة صارمة للحد الأدنى (10 قطع كحد أدنى لكل منتج)، مع إمكانية إرفاق شعار الشركة وحساب التكلفة الفورية.'
            : 'Corporate giveaways, executive merchandise, and brand packages governed by strict minimum order quantities (10 units min per model) and transparent printing fee itemization.'}
        </p>
      </header>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2.5rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-default)',
        }}
      >
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', labelAr: 'الكل', labelEn: 'All Catalog' },
            { id: 'giveaways', labelAr: 'هدايا الشركات', labelEn: 'Giveaways' },
            { id: 'stationery', labelAr: 'مطبوعات وأدوات', labelEn: 'Stationery' },
            { id: 'services', labelAr: 'باقات الهوية', labelEn: 'Brand Services' },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id as typeof selectedCategory)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: isSelected ? '1px solid var(--brand-primary)' : '1px solid var(--border-default)',
                  backgroundColor: isSelected ? 'var(--brand-primary)' : 'var(--bg-primary)',
                  color: isSelected ? 'var(--text-inverted)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                {isArabic ? cat.labelAr : cat.labelEn}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '260px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isArabic ? 'بحث في المنتجات...' : 'Search products...'}
            style={{
              width: '100%',
              padding: '0.5rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
            }}
          />
        </div>
      </div>

      {/* Product Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {filteredProducts.map((product) => {
          const isPhysical = product.itemType === 'physical';
          const productHref = isArabic ? `/ar/store/${product.slug}` : `/en/store/${product.slug}`;

          return (
            <article
              key={product.id}
              style={{
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                padding: '1.75rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-subtle)',
                transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <Badge variant="neutral">{isArabic ? product.categoryAr : product.categoryEn}</Badge>
                  {isPhysical ? (
                    <Badge variant="warning">{isArabic ? `الحد الأدنى: ${product.minOrderQuantity} قطع` : `MOQ: ${product.minOrderQuantity} units`}</Badge>
                  ) : (
                    <Badge variant="success">{isArabic ? 'خدمة مؤسسية' : 'Service'}</Badge>
                  )}
                </div>

                {/* Specimen Visual */}
                <div
                  style={{
                    height: '140px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.25rem',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.imageUrl} alt={product.title} width={64} height={64} style={{ objectFit: 'contain' }} />
                </div>

                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
                  {product.title}
                </h2>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
                  {isArabic ? product.descriptionAr : product.descriptionEn}
                </p>
              </div>

              {/* Pricing & PDP Link Footer */}
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                    {product.basePrice.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {isPhysical ? (isArabic ? 'للقطعة غير شامل الطباعة' : 'per unit base') : (isArabic ? 'تسليم تعاقدي كامل' : 'fixed contract')}
                  </div>
                </div>

                <Link
                  href={productHref}
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1rem',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {isArabic ? 'تخصيص والطلب ←' : 'Customize →'}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
