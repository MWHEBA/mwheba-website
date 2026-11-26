'use client';

import React, { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useCart } from '@/modules/cart-checkout/context/CartContext';
import type { Locale } from '@/shared/lib/i18n';
import { Badge } from '@/shared/ui/primitives';
import { catalogHref } from '../services/catalogFilters';
import type { PublicCatalogProductDetail, PublicCatalogVariant } from '../services/publishedCatalog';

interface ProductDetailViewProps {
  product: PublicCatalogProductDetail;
  locale: Locale;
}

interface UploadedArtwork {
  file: File;
  cartId: number;
  assetId: string;
}

function variantLabel(variant: PublicCatalogVariant) {
  return variant.options.length
    ? variant.options.map((option) => `${option.typeLabel}: ${option.label}`).join(' / ')
    : variant.title;
}

export function ProductDetailView({ product, locale }: ProductDetailViewProps) {
  const isArabic = locale === 'ar';
  const { addItem, ensureSession } = useCart();
  const physical = product.productType === 'physical';
  const allowArtwork = physical && product.allowArtworkUpload;
  const currency = new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' });
  const number = new Intl.NumberFormat(locale);
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(String(product.minOrderQuantity));
  const [imageId, setImageId] = useState<number>();
  const [printingNotes, setPrintingNotes] = useState('');
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<'success' | 'uploadError' | 'cartError' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadedArtwork = useRef<UploadedArtwork | null>(null);
  const submitting = useRef(false);

  const variant = product.variants.find((option) => String(option.id) === variantId);
  const price = product.enableVariants ? (variant?.price ?? null) : product.price;
  const sku = product.enableVariants ? variant?.sku : product.sku;
  const hasChoices = product.variants.some((option) => option.price !== null);
  const unavailable = product.enableVariants ? !hasChoices : price === null;
  const validQuantity = Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0;
  const canAdd = !unavailable && price !== null && validQuantity;
  const media = variant?.media.length ? variant.media : product.media;
  const image = media.find(({ id }) => id === imageId) ?? media[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdd || submitting.current) return;

    submitting.current = true;
    setPending(true);
    setFeedback(null);
    let failure: 'uploadError' | 'cartError' = 'cartError';
    try {
      let artworkAssetId: string | undefined;
      if (allowArtwork && artworkFile) {
        failure = 'uploadError';
        const cartId = await ensureSession();
        const previous = uploadedArtwork.current;
        if (previous?.file === artworkFile && previous.cartId === cartId) {
          artworkAssetId = previous.assetId;
        } else {
          const formData = new FormData();
          formData.append('file', artworkFile);
          const response = await fetch('/api/customization/upload-artwork', { method: 'POST', body: formData });
          const data = await response.json();
          if (!response.ok || data?.success !== true || !Number.isSafeInteger(data.assetId) || data.assetId < 1) {
            throw new Error('Artwork upload was not confirmed');
          }
          artworkAssetId = String(data.assetId);
          uploadedArtwork.current = { file: artworkFile, cartId, assetId: artworkAssetId };
        }
      }

      failure = 'cartError';
      await addItem({
        productId: product.id,
        variantId: variant?.id,
        quantity: Number(quantity),
        artworkAssetId,
        printingNotes: allowArtwork ? printingNotes.trim() || undefined : undefined,
      });
      setFeedback('success');
      uploadedArtwork.current = null;
      setArtworkFile(null);
      setPrintingNotes('');
      if (fileInput.current) fileInput.current.value = '';
    } catch {
      setFeedback(failure);
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <article className="container" style={{ paddingBlock: '3.5rem 6rem' }}>
      <Link href={catalogHref(locale)} className="btn-secondary btn-sm">
        {isArabic ? 'العودة إلى المتجر' : 'Back to store'}
      </Link>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 23rem), 1fr))', gap: '2.5rem', marginTop: '1.5rem' }}>
        {image && (
          <section aria-label={isArabic ? 'صور المنتج' : 'Product images'}>
            <div style={{ display: 'grid', placeItems: 'center', aspectRatio: '1 / 1', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {/* Catalog media may use merchant-specific storage hosts. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt || product.title}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                fetchPriority="high"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            {media.length > 1 && (
              <ul style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', marginBlock: '0.75rem 0', padding: 0 }}>
                {media.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="btn-secondary"
                      aria-label={isArabic ? `عرض الصورة ${number.format(index + 1)}` : `Show image ${index + 1}`}
                      aria-pressed={item.id === image.id}
                      onClick={() => setImageId(item.id)}
                      style={{ padding: '0.125rem', borderColor: item.id === image.id ? 'var(--brand-primary)' : undefined }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt="" width={58} height={58} loading="lazy" style={{ objectFit: 'contain' }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section style={{ maxWidth: '42rem' }}>
          <h1 style={{ marginBlock: '0 0.75rem' }}>{product.title}</h1>
          {physical && product.minOrderQuantity > 1 && (
            <Badge variant="warning">
              {isArabic ? `الحد الأدنى للطلب ${number.format(product.minOrderQuantity)} قطعة` : `Minimum order of ${number.format(product.minOrderQuantity)} units`}
            </Badge>
          )}
          {product.description && <p style={{ whiteSpace: 'pre-line' }}>{product.description}</p>}

          {unavailable ? (
            <p role="status">{isArabic ? 'المنتج غير متاح للطلب حالياً.' : 'This product is currently unavailable to order.'}</p>
          ) : (
            <form onSubmit={submit} aria-busy={pending}>
              <fieldset disabled={pending} style={{ display: 'grid', gap: '1rem', border: 0, margin: 0, padding: 0 }}>
                {product.enableVariants && (
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    {isArabic ? 'اختر خيار المنتج' : 'Choose a variant'}
                    <select className="form-input" name="variantId" required value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                      <option value="" disabled>{isArabic ? 'اختر من الخيارات المتاحة' : 'Select an available option'}</option>
                      {product.variants.map((option) => (
                        <option key={option.id} value={option.id} disabled={option.price === null}>
                          {variantLabel(option)}{option.price === null
                            ? (isArabic ? ' (غير متاح)' : ' (Unavailable)')
                            : ` — ${currency.format(option.price)}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div aria-live="polite">
                  {price !== null && (
                    <p style={{ marginBlock: '0 0.25rem' }}>
                      {physical ? (isArabic ? 'سعر القطعة' : 'Unit price') : (isArabic ? 'سعر الباقة' : 'Package price')}{' '}
                      <strong><bdi>{currency.format(price)}</bdi></strong>
                    </p>
                  )}
                  {sku && (
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                      {isArabic ? 'رمز المنتج' : 'SKU'} <bdi>{sku}</bdi>
                    </p>
                  )}
                </div>

                <label style={{ display: 'grid', gap: '0.35rem' }}>
                  {isArabic ? 'الكمية' : 'Quantity'}
                  <input className="form-input" style={{ maxWidth: '10rem' }} type="number" name="quantity" min={1} step={1} required value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </label>

                {allowArtwork && (
                  <fieldset style={{ display: 'grid', gap: '0.75rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', margin: 0, padding: '0.75rem' }}>
                    <legend>{isArabic ? 'الطباعة والشعار (اختياري)' : 'Printing and artwork (optional)'}</legend>
                    {product.customizationFee > 0 && (
                      <p style={{ margin: 0 }}>
                        {isArabic ? 'رسوم الطباعة لكل قطعة عند طلب التخصيص' : 'Printing fee per unit when customization is requested'}{' '}
                        <strong><bdi>{currency.format(product.customizationFee)}</bdi></strong>
                      </p>
                    )}
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      {isArabic ? 'ملف الشعار' : 'Artwork file'}
                      <input
                        ref={fileInput}
                        type="file"
                        name="artwork"
                        accept=".png,.jpg,.jpeg,.svg,.pdf,.ai,.psd,.eps"
                        onChange={(event) => {
                          uploadedArtwork.current = null;
                          setArtworkFile(event.target.files?.[0] ?? null);
                        }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                      {isArabic ? 'ملاحظات الطباعة' : 'Printing notes'}
                      <textarea className="form-input" name="printingNotes" rows={3} value={printingNotes} onChange={(event) => setPrintingNotes(event.target.value)} />
                    </label>
                  </fieldset>
                )}
                <button type="submit" className="btn-primary btn-md" disabled={!canAdd || pending}>
                  {pending
                    ? (isArabic ? 'جارٍ الإضافة…' : 'Adding…')
                    : (isArabic ? 'أضف إلى السلة' : 'Add to cart')}
                </button>
              </fieldset>
            </form>
          )}
          {feedback === 'success' && (
            <p role="status">{isArabic ? 'تمت إضافة المنتج إلى السلة.' : 'Added to your cart.'}</p>
          )}
          {feedback === 'uploadError' && (
            <p role="alert">
              {isArabic ? 'تعذّر رفع الشعار. تحقق من نوع الملف وحجمه ثم حاول مرة أخرى.' : 'The artwork upload failed. Check the file type and size, then try again.'}
            </p>
          )}
          {feedback === 'cartError' && (
            <p role="alert">
              {isArabic ? 'تعذّرت إضافة المنتج إلى السلة. حدّث الصفحة للتحقق من توفر الخيار وحاول مرة أخرى.' : 'Could not add this item to your cart. Refresh to check availability, then try again.'}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
