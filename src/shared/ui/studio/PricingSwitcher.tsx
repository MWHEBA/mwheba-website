'use client';

import React from 'react';

export interface PricingOption {
  id: string;
  label: string;
  badge?: string;
}

export interface PricingSwitcherProps {
  options: [PricingOption, PricingOption];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

export function PricingSwitcher({
  options,
  selectedId,
  onChange,
  className = '',
}: PricingSwitcherProps) {
  const [first, second] = options;

  return (
    <div className={`pricing-switcher-wrapper ${className}`.trim()}>
      <div className="pricing-switcher-track" role="radiogroup" aria-label="Billing cycle">
        <button
          type="button"
          role="radio"
          aria-checked={selectedId === first.id}
          onClick={() => onChange(first.id)}
          className={`pricing-switcher-btn ${selectedId === first.id ? 'is-selected' : ''}`.trim()}
        >
          <span>{first.label}</span>
          {first.badge && <span className="pricing-badge">{first.badge}</span>}
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selectedId === second.id}
          onClick={() => onChange(second.id)}
          className={`pricing-switcher-btn ${selectedId === second.id ? 'is-selected' : ''}`.trim()}
        >
          <span>{second.label}</span>
          {second.badge && <span className="pricing-badge is-highlight">{second.badge}</span>}
        </button>
      </div>
    </div>
  );
}
