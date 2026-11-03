'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { CatalogProduct } from '../data/sampleProducts';
import { useCart } from '@/modules/cart-checkout/context/CartContext';
import { Badge } from '@/shared/ui/primitives';

interface ProductDetailViewProps {
  product: CatalogProduct;
  locale: string;
}

export function ProductDetailView({ product, locale }: ProductDetailViewProps) {
  const isArabic = locale === 'ar';
  const { addItem } = useCart();

  const isPhysical = product.itemType === 'physical';
  const minMoq = product.minOrderQuantity || (isPhysical ? 10 : 1);

  // States
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]?.id || '');
  const [quantity, setQuantity] = useState(minMoq);
  const [hasArtwork, setHasArtwork] = useState(false);
  const [artworkFileName, setArtworkFileName] = useState('');
  const [printingNotes, setPrintingNotes] = useState('');
  const [selectedPrintingOption, setSelectedPrintingOption] = useState(product.customizationOptions[0]?.id || '');
  const [isSuccessToastVisible, setIsSuccessToastVisible] = useState(false);

  // Volume discount calculation (for physical products)
  let discountPercent = 0;
  if (isPhysical) {
    if (quantity >= 100) discountPercent = 16;
    else if (quantity >= 50) discountPercent = 8;
  }

  const effectiveUnitBasePrice = Math.round(product.basePrice * (1 - discountPercent / 100));

  // Printing fee calculation
  const currentPrintingOpt = product.customizationOptions.find((o) => o.id === selectedPrintingOption);
  const unitPrintingFee = hasArtwork ? (currentPrintingOpt?.fee ?? product.customizationFee ?? 0) : 0;

  const totalBaseCost = effectiveUnitBasePrice * quantity;
  const totalPrintingCost = unitPrintingFee * quantity;
  const grandBatchCost = totalBaseCost + totalPrintingCost;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHasArtwork(true);
      setArtworkFileName(file.name);
    }
  };

  const handleRemoveArtwork = () => {
    setHasArtwork(false);
    setArtworkFileName('');
  };

  const handleAddToCart = () => {
    const activeVariant = product.variants.find((v) => v.id === selectedVariant);
    addItem({
      productId: product.id,
      variantId: selectedVariant,
      variantName: activeVariant ? (isArabic ? activeVariant.nameAr : activeVariant.nameEn) : undefined,
      quantity,
      artworkAssetId: hasArtwork ? `art-${Date.now()}` : undefined,
      printingNotes: hasArtwork ? printingNotes || (isArabic ? 'طباعة قياسية للشعار' : 'Standard logo print') : undefined,
    });

    setIsSuccessToastVisible(true);
    setTimeout(() => setIsSuccessToastVisible(false), 3500);
  };

  return (
    <div className="container" style={{ paddingBlock: '3.5rem 6rem' }}>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: '2rem', fontSize: '0.875rem' }}>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <li>
            <Link href={isArabic ? '/ar' : '/en'} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              {isArabic ? 'الرئيسية' : 'Home'}
            </Link>
          </li>
          <li style={{ color: 'var(--text-muted)' }}>/</li>
          <li>
            <Link href={isArabic ? '/ar/store' : '/en/store'} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              {isArabic ? 'المتجر المؤسسي' : 'Store'}
            </Link>
          </li>
          <li style={{ color: 'var(--text-muted)' }}>/</li>
          <li style={{ color: 'var(--brand-primary-dark)', fontWeight: 600 }}>{product.title}</li>
        </ol>
      </nav>

      {/* Main PDP Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3.5rem' }}>
        {/* Left Column: Visual Gallery Specimen */}
        <div>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-secondary)',
              aspectRatio: '1 / 1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-subtle)',
            }}
          >
            {/* Visual Icon / Mock */}
            <div
              style={{
                width: '120px',
                height: '120px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-card)',
                marginBottom: '1.5rem',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.imageUrl}
                alt={product.title}
                width={70}
                height={70}
                style={{ objectFit: 'contain' }}
              />
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
                {isArabic ? product.categoryAr : product.categoryEn}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                {product.title}
              </h3>
            </div>

            {/* Custom Artwork Watermark Overlay when user uploads logo */}
            {hasArtwork && (
              <div
                style={{
                  position: 'absolute',
                  insetInlineEnd: '1.5rem',
                  insetBlockStart: '1.5rem',
                  padding: '0.45rem 0.85rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--status-success)',
                  color: 'var(--status-success)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>✓</span>
                <span>{isArabic ? 'معاينة الشعار محملة' : 'Artwork Preview Active'}</span>
              </div>
            )}
          </div>

          {/* Specifications Table */}
          <div style={{ marginTop: '2.5rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '1rem' }}>
              {isArabic ? 'المواصفات الفنية والمؤسسية' : 'Technical Specifications'}
            </h4>
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {product.specifications.map((spec, i) => (
                <div
                  key={spec.labelEn}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    backgroundColor: i % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    borderBottom: i === product.specifications.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {isArabic ? spec.labelAr : spec.labelEn}
                  </span>
                  <span style={{ color: 'var(--brand-primary-dark)', fontWeight: 600 }}>
                    {isArabic ? spec.valueAr : spec.valueEn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Customization Controls & Pricing */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Badge variant="neutral">{isArabic ? product.categoryAr : product.categoryEn}</Badge>
            {isPhysical && (
              <Badge variant="warning">
                {isArabic ? `الحد الأدنى: ${minMoq} قطع` : `MOQ: ${minMoq} units`}
              </Badge>
            )}
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
              fontWeight: 700,
              color: 'var(--brand-primary-dark)',
              letterSpacing: '-0.025em',
              margin: '0 0 1rem',
              lineHeight: 1.2,
            }}
          >
            {product.title}
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7, margin: '0 0 2rem' }}>
            {isArabic ? product.descriptionAr : product.descriptionEn}
          </p>

          {/* Variant Selector */}
          {product.variants.length > 1 && (
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.75rem' }}>
                {isArabic ? 'اللون والنمط المؤسسي المتاح:' : 'Available Corporate Finishes:'}
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {product.variants.map((variant) => {
                  const isSelected = selectedVariant === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setSelectedVariant(variant.id)}
                      style={{
                        padding: '0.625rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border-default)',
                        backgroundColor: isSelected ? 'var(--status-info-bg)' : 'var(--bg-primary)',
                        color: isSelected ? 'var(--brand-primary-dark)' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {variant.colorHex && (
                        <span
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: variant.colorHex,
                            display: 'inline-block',
                          }}
                        />
                      )}
                      <span>{isArabic ? variant.nameAr : variant.nameEn}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logo Upload Dropzone (Customization Section) */}
          {isPhysical && (
            <div
              style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                {isArabic ? 'تخصيص الهوية والشعار المؤسسي (اختياري)' : 'Corporate Branding & Artwork (Optional)'}
              </h3>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {isArabic
                  ? 'ارفع ملف الشعار الخاص بشركتك بصيغة فيكتور (AI, SVG, PDF) أو صورة عالية الدقة (PNG).'
                  : 'Upload your company logo in vector (AI, SVG, PDF) or high-res raster (PNG).'}
              </p>

              {!hasArtwork ? (
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px dashed var(--border-strong)',
                    backgroundColor: 'var(--bg-primary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <input
                    type="file"
                    accept=".png,.svg,.ai,.pdf"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>📁</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--brand-primary-dark)' }}>
                    {isArabic ? 'اضغط لاختيار الشعار أو اسحبه هنا' : 'Click to browse or drop your logo here'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {isArabic ? 'الحد الأقصى 25 ميجابايت' : 'Maximum file size: 25MB'}
                  </span>
                </label>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.875rem 1rem',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--status-success)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ color: 'var(--status-success)', fontSize: '1.125rem' }}>✓</span>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                        {artworkFileName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {isArabic ? 'تم إرفاق الملف بنجاح' : 'Artwork attached'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRemoveArtwork}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: 'var(--status-error)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                    }}
                  >
                    {isArabic ? 'إزالة الشعار' : 'Remove'}
                  </button>
                </div>
              )}

              {/* Printing Method & Notes (Visible when artwork attached) */}
              {hasArtwork && (
                <div style={{ marginTop: '1.25rem' }}>
                  {product.customizationOptions.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.4rem' }}>
                        {isArabic ? 'طريقة الطباعة أو الحفر:' : 'Application Technique:'}
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {product.customizationOptions.map((opt) => (
                          <label
                            key={opt.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.8125rem',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="radio"
                              name="printMethod"
                              checked={selectedPrintingOption === opt.id}
                              onChange={() => setSelectedPrintingOption(opt.id)}
                            />
                            <span>{isArabic ? opt.labelAr : opt.labelEn}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.4rem' }}>
                      {isArabic ? 'ملاحظات وتوجيهات الطباعة:' : 'Printing Notes & Placement Guidance:'}
                    </label>
                    <input
                      type="text"
                      value={printingNotes}
                      onChange={(e) => setPrintingNotes(e.target.value)}
                      placeholder={isArabic ? 'مثال: حفر الشعار بمنتصف الكوب بارتفاع 4 سم' : 'e.g. Center logo placement, 4cm height'}
                      style={{
                        width: '100%',
                        padding: '0.625rem 0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quantity Selector & Tiered Pricing Matrix */}
          <div
            style={{
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              marginBottom: '2rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                  {isArabic ? 'الكمية المطلوبة (الحد الأدنى 10 قطع):' : 'Batch Quantity (MOQ: 10 units):'}
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isArabic ? 'خصومات تصاعدية مع زيادة حجم الدفعة' : 'Volume pricing applies automatically'}
                </span>
              </div>

              {/* Quantity Counter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(minMoq, q - 5))}
                  disabled={quantity <= minMoq}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-secondary)',
                    fontWeight: 700,
                    cursor: quantity <= minMoq ? 'not-allowed' : 'pointer',
                    opacity: quantity <= minMoq ? 0.5 : 1,
                  }}
                >
                  -
                </button>
                <input
                  type="number"
                  min={minMoq}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(minMoq, parseInt(e.target.value) || minMoq))}
                  style={{
                    width: '64px',
                    height: '34px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: 'var(--brand-primary-dark)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 5)}
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-secondary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Volume Tiers Indicator */}
            {isPhysical && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
                <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: quantity < 50 ? 'var(--status-info-bg)' : 'var(--bg-secondary)', border: `1px solid ${quantity < 50 ? 'var(--brand-primary)' : 'var(--border-default)'}` }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>10 - 49 {isArabic ? 'قطعة' : 'units'}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>{product.basePrice} {isArabic ? 'ج.م' : 'EGP'}</div>
                </div>

                <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: quantity >= 50 && quantity < 100 ? 'var(--status-info-bg)' : 'var(--bg-secondary)', border: `1px solid ${quantity >= 50 && quantity < 100 ? 'var(--brand-primary)' : 'var(--border-default)'}` }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>50 - 99 {isArabic ? 'قطعة' : 'units'}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>{Math.round(product.basePrice * 0.92)} {isArabic ? 'ج.م' : 'EGP'} (-8%)</div>
                </div>

                <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', backgroundColor: quantity >= 100 ? 'var(--status-info-bg)' : 'var(--bg-secondary)', border: `1px solid ${quantity >= 100 ? 'var(--brand-primary)' : 'var(--border-default)'}` }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>100+ {isArabic ? 'قطعة' : 'units'}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>{Math.round(product.basePrice * 0.84)} {isArabic ? 'ج.م' : 'EGP'} (-16%)</div>
                </div>
              </div>
            )}

            {/* Transparent Cost Breakdown */}
            <div style={{ borderTop: '1px dashed var(--border-default)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{isArabic ? `قيمة المنتجات (${quantity} × ${effectiveUnitBasePrice} ج.م):` : `Products Base (${quantity} × ${effectiveUnitBasePrice} EGP):`}</span>
                <span>{totalBaseCost.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>

              {hasArtwork && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>{isArabic ? `رسوم الطباعة (${quantity} × ${unitPrintingFee} ج.م):` : `Branding Fees (${quantity} × ${unitPrintingFee} EGP):`}</span>
                  <span>{totalPrintingCost.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)', borderTop: '1px solid var(--border-default)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <span>{isArabic ? 'إجمالي الدفعة المقدر:' : 'Estimated Batch Total:'}</span>
                <span>{grandBatchCost.toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>
          </div>

          {/* Add to Cart CTA */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="btn-primary"
            style={{
              width: '100%',
              paddingBlock: '1rem',
              fontSize: '1.0625rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-card)',
              cursor: 'pointer',
            }}
          >
            {isArabic ? 'إضافة إلى سلة الطلبات المؤسسية ←' : 'Add to Corporate Cart →'}
          </button>

          {/* Toast Notification */}
          {isSuccessToastVisible && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--status-success-bg)',
                border: '1px solid var(--status-success)',
                color: 'var(--status-success)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              ✓ {isArabic ? 'تمت إضافة الدفعة إلى سلة الطلبات بنجاح!' : 'Batch successfully added to corporate cart!'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
