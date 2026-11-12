'use client';

import React, { useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { UploadIcon, ArrowUpRightIcon } from '@/shared/ui/icons';

export interface LiveProofStageProps {
  initialText?: string;
  className?: string;
}

type FinishType = 'blue' | 'charcoal' | 'silver';

export function LiveProofStage({ initialText = 'YOUR\nLOGO', className = '' }: LiveProofStageProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [activeFinish, setActiveFinish] = useState<FinishType>('blue');

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoSrc(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const finishSurfaces: Record<FinishType, string> = {
    blue: 'var(--color-brand-blue)',
    charcoal: 'var(--color-surface-dark)',
    silver: 'var(--color-border-line)',
  };

  const finishTextColors: Record<FinishType, string> = {
    blue: 'var(--color-text-inverse)',
    charcoal: 'var(--color-text-inverse)',
    silver: 'var(--color-brand-blue)',
  };

  return (
    <div className={`feature-grid studio-proof-grid ${className}`.trim()}>
      <div className="proof-stage studio-proof-stage reveal-on-scroll" data-aos="reveal-anim-left">
        <span className="corner">LIVE CONCEPT PREVIEW / 01</span>
        <div
          className="proof-card studio-proof-card"
          style={{
            backgroundColor: finishSurfaces[activeFinish],
            color: finishTextColors[activeFinish],
          }}
        >
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Uploaded logo preview"
              style={{ maxWidth: '65%', maxHeight: '55%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ whiteSpace: 'pre-line', lineHeight: 1.1 }}>{initialText}</span>
          )}
        </div>
      </div>

      <div className="proof-controls studio-proof-controls reveal-on-scroll" data-aos="fade-up-sm" data-aos-delay="200">
        <span className="section-number">04 / MAKE IT YOURS</span>
        <h2 className="display" style={{ margin: '18px 0 20px', lineHeight: 1.02 }}>
          YOUR LOGO.<br />
          <span style={{ color: 'var(--blue)' }}>YOUR WAY.</span>
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.8, maxWidth: '410px' }}>
          Test how your mark might look on a branded surface. Upload a logo and try a finish before sending your corporate request.
        </p>

        <label className="upload studio-upload-btn">
          <UploadIcon size={18} />
          <span>Upload your logo</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>

        <div style={{ fontSize: '11px', color: 'var(--muted)', margin: '12px 0 8px', fontWeight: 800 }}>
          CHOOSE A FINISH
        </div>

        <div className="swatches studio-proof-swatches">
          <button
            type="button"
            className="swatch studio-swatch"
            data-finish="blue"
            aria-label="Blue finish"
            aria-pressed={activeFinish === 'blue'}
            onClick={() => setActiveFinish('blue')}
            style={{ backgroundColor: 'var(--color-brand-blue)' }}
          />
          <button
            type="button"
            className="swatch studio-swatch"
            data-finish="charcoal"
            aria-label="Charcoal finish"
            aria-pressed={activeFinish === 'charcoal'}
            onClick={() => setActiveFinish('charcoal')}
            style={{ backgroundColor: 'var(--color-surface-dark)' }}
          />
          <button
            type="button"
            className="swatch studio-swatch"
            data-finish="silver"
            aria-label="Silver finish"
            aria-pressed={activeFinish === 'silver'}
            onClick={() => setActiveFinish('silver')}
            style={{ backgroundColor: 'var(--color-border-line)' }}
          />
        </div>

        <Link href="#contact" className="dark-btn magnetic" style={{ marginTop: '12px' }}>
          <span>Request a Custom Quote</span>
          <ArrowUpRightIcon size={16} />
        </Link>
        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '14px' }}>
          Concept preview only. Final production artwork requires approval.
        </p>
      </div>
    </div>
  );
}
