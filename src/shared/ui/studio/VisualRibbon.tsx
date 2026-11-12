import React from 'react';

export interface VisualRibbonProps {
  primaryText?: string;
  middleText?: string;
  endText?: string;
  className?: string;
}

export function VisualRibbon({
  primaryText = 'DESIGNED TO STAND OUT',
  middleText = 'CREATIVE × COMMERCE',
  endText = 'MADE IN EGYPT',
  className = '',
}: VisualRibbonProps) {
  return (
    <div className={`studio-visual-ribbon reveal-on-scroll ${className}`.trim()} data-aos="fade-up-sm" role="region" aria-label="Creative direction ribbon">
      <span>{primaryText}</span>
      <span className="studio-ribbon-line" aria-hidden="true" />
      <span>{middleText}</span>
      <span className="studio-ribbon-line" aria-hidden="true" />
      <span>{endText}</span>
    </div>
  );
}
