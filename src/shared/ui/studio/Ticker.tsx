import React from 'react';

export interface TickerProps {
  items?: string[];
  className?: string;
}

const defaultTickerItems = [
  'BRAND STRATEGY',
  'CREATIVE PRODUCTION',
  'CORPORATE GIFTS',
  'DIGITAL EXPERIENCES',
  'BRANDED MERCHANDISE',
  'BRAND STRATEGY',
  'CREATIVE PRODUCTION',
  'CORPORATE GIFTS',
  'DIGITAL EXPERIENCES',
  'BRANDED MERCHANDISE',
];

export function Ticker({ items = defaultTickerItems, className = '' }: TickerProps) {
  return (
    <div className={`studio-ticker reveal-on-scroll ${className}`.trim()} data-aos="fade-in" aria-label="Capabilities ticker" role="region">
      <div className="studio-ticker-track">
        {items.map((item, idx) => (
          <span key={`ticker-item-${idx}`}>
            {item} <b aria-hidden="true">✳</b>
          </span>
        ))}
      </div>
    </div>
  );
}
