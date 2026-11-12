'use client';

import React, { useState } from 'react';
import { shortlistStore } from './shortlistStore';

export interface ProductShowcaseCardProps {
  id: string;
  title: string;
  category: string;
  imageUrl?: string;
  isTechKit?: boolean;
  minQuantity?: number;
  onAddToShortlist?: (productId: string, quantity: number) => void;
  className?: string;
  delay?: number;
}

export function ProductShowcaseCard({
  id,
  title,
  category,
  imageUrl,
  isTechKit = false,
  minQuantity = 10,
  onAddToShortlist,
  className = '',
  delay,
}: ProductShowcaseCardProps) {
  const [quantity, setQuantity] = useState(minQuantity);

  const handleDecrease = () => {
    setQuantity((prev) => Math.max(minQuantity, prev - 10));
  };

  const handleIncrease = () => {
    setQuantity((prev) => prev + 10);
  };

  const handleAdd = () => {
    if (onAddToShortlist) {
      onAddToShortlist(id, quantity);
    } else {
      shortlistStore.addItem(title, quantity);
    }
  };

  return (
    <article
      className={`product tilt studio-product-card reveal-on-scroll ${className}`.trim()}
      data-product={title}
      data-product-id={id}
      data-aos="fade-up-sm"
      data-aos-delay={delay ? `${delay}` : undefined}
    >
      <div className="product-stage studio-product-stage">
        <span className="product-label studio-product-label">{category}</span>
        {isTechKit ? (
          <div className="fake-product tech">
            MWHEBA<span style={{ color: 'var(--color-brand-red)' }}>.</span>
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} loading="lazy" />
        ) : (
          <div className="fake-product tech">
            MWHEBA<span style={{ color: 'var(--color-brand-red)' }}>.</span>
          </div>
        )}
      </div>

      <div className="product-info studio-product-info">
        <h3>{title}</h3>
        <p>{`Custom branding · Minimum ${minQuantity} units`}</p>

        <div className="product-bottom studio-product-bottom">
          <div className="qty ui-stepper">
            <button
              type="button"
              className="minus"
              aria-label={`Decrease ${title} quantity`}
              onClick={handleDecrease}
            >
              −
            </button>
            <output aria-live="polite">{quantity}</output>
            <button
              type="button"
              className="plus"
              aria-label={`Increase ${title} quantity`}
              onClick={handleIncrease}
            >
              +
            </button>
          </div>

          <button
            type="button"
            className="add ui-btn-primary"
            onClick={handleAdd}
          >
            Add to Order ↗
          </button>
        </div>
      </div>
    </article>
  );
}
