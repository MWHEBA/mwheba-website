import React from 'react';
import Link from 'next/link';

export interface BlockRendererProps {
  blocks?: any[];
  locale?: string;
}

export function BlockRenderer({ blocks, locale = 'ar' }: BlockRendererProps) {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  const isArabic = locale === 'ar';

  return (
    <div className="cms-page-layout">
      {blocks.map((block, index) => {
        const key = block.id || `${block.blockType}-${index}`;

        switch (block.blockType) {
          case 'hero':
            return <HeroBlockComponent key={key} block={block} isArabic={isArabic} />;
          case 'servicesGrid':
            return <ServicesGridComponent key={key} block={block} isArabic={isArabic} />;
          case 'portfolioShowcase':
            return <PortfolioShowcaseComponent key={key} block={block} isArabic={isArabic} />;
          case 'clientsLogo':
            return <ClientsLogoComponent key={key} block={block} isArabic={isArabic} />;
          case 'stats':
            return <StatsComponent key={key} block={block} isArabic={isArabic} />;
          case 'faq':
            return <FAQComponent key={key} block={block} isArabic={isArabic} />;
          case 'cta':
            return <CTAComponent key={key} block={block} isArabic={isArabic} />;
          case 'formBlock':
            return <FormBlockComponent key={key} block={block} isArabic={isArabic} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function HeroBlockComponent({ block, isArabic }: { block: any; isArabic: boolean }) {
  const isDark = block.theme === 'dark';
  const isMuted = block.theme === 'muted';

  const bgColor = isDark ? 'var(--bg-dark)' : isMuted ? 'var(--bg-secondary)' : 'var(--bg-primary)';
  const textColor = isDark ? 'var(--text-inverted)' : 'var(--text-primary)';
  const subtitleColor = isDark ? 'var(--text-inverted-muted)' : 'var(--text-secondary)';

  return (
    <section
      data-block-type="hero"
      style={{
        backgroundColor: bgColor,
        color: textColor,
        paddingBlock: '4.5rem 6rem',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container" style={{ maxWidth: '1000px', textAlign: 'center' }}>
        {block.badge && (
          <span
            style={{
              display: 'inline-block',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-full)',
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'var(--status-info-bg)',
              color: isDark ? 'var(--text-inverted)' : 'var(--brand-primary)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
              marginBottom: '1.25rem',
            }}
          >
            {block.badge}
          </span>
        )}

        <h1
          style={{
            fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            margin: '0 0 1.5rem',
            color: isDark ? 'var(--text-inverted)' : 'var(--brand-primary-dark)',
          }}
        >
          {block.headline}
        </h1>

        {block.subtitle && (
          <p
            style={{
              fontSize: '1.125rem',
              lineHeight: 1.8,
              color: subtitleColor,
              maxWidth: '750px',
              margin: '0 auto 2.5rem',
            }}
          >
            {block.subtitle}
          </p>
        )}

        {(block.primaryCta?.label || block.secondaryCta?.label) && (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {block.primaryCta?.label && (
              <Link
                href={block.primaryCta.url || '#'}
                className="btn-primary btn-lg"
                style={{
                  fontWeight: 700,
                  textDecoration: 'none',
                  backgroundColor: isDark ? 'var(--brand-primary-light)' : 'var(--brand-primary)',
                }}
              >
                {block.primaryCta.label}
              </Link>
            )}

            {block.secondaryCta?.label && (
              <Link
                href={block.secondaryCta.url || '#'}
                className="btn-secondary btn-lg"
                style={{
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isDark ? 'var(--text-inverted)' : 'var(--text-primary)',
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'var(--border-default)',
                }}
              >
                {block.secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function ServicesGridComponent({ block }: { block: any; isArabic: boolean }) {
  return (
    <section
      data-block-type="servicesGrid"
      style={{
        paddingBlock: '5rem 6rem',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container">
        <header style={{ textAlign: 'center', marginBottom: '3.5rem', maxWidth: '720px', marginInline: 'auto' }}>
          {block.eyebrow && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '0.5rem',
              }}
            >
              {block.eyebrow}
            </span>
          )}
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 1rem' }}>
            {block.title}
          </h2>
          {block.subtitle && (
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
              {block.subtitle}
            </p>
          )}
        </header>

        {block.services && Array.isArray(block.services) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {block.services.map((service: any, idx: number) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  padding: '2rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--status-info-bg)',
                      color: 'var(--brand-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      marginBottom: '1.25rem',
                      fontSize: '1.125rem',
                    }}
                  >
                    0{idx + 1}
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.75rem' }}>
                    {service.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {service.description}
                  </p>
                </div>
                {service.linkUrl && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <Link
                      href={service.linkUrl}
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        color: 'var(--brand-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      {service.linkText || 'المزيد ←'}
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PortfolioShowcaseComponent({ block }: { block: any; isArabic: boolean }) {
  return (
    <section
      data-block-type="portfolioShowcase"
      style={{
        paddingBlock: '5rem 6rem',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container">
        <header style={{ marginBottom: '3rem', maxWidth: '650px' }}>
          {block.eyebrow && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {block.eyebrow}
            </span>
          )}
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.75rem' }}>
            {block.title}
          </h2>
          {block.description && (
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>
              {block.description}
            </p>
          )}
        </header>

        {block.projects && Array.isArray(block.projects) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            {block.projects.map((proj: any, idx: number) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  style={{
                    height: '200px',
                    backgroundColor: 'var(--bg-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.875rem',
                  }}
                >
                  {proj.image?.url ? (
                    <img src={proj.image.url} alt={proj.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>🖼️ {proj.clientName}</span>
                  )}
                </div>
                <div style={{ padding: '1.5rem' }}>
                  {proj.category && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-accent)', display: 'block', marginBottom: '0.35rem' }}>
                      {proj.category}
                    </span>
                  )}
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.5rem' }}>
                    {proj.title}
                  </h3>
                  {proj.summary && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                      {proj.summary}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ClientsLogoComponent({ block }: { block: any; isArabic: boolean }) {
  return (
    <section
      data-block-type="clientsLogo"
      style={{
        paddingBlock: '4rem 5rem',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container" style={{ textAlign: 'center' }}>
        {block.eyebrow && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
            {block.eyebrow}
          </span>
        )}
        {block.title && (
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 2.5rem' }}>
            {block.title}
          </h2>
        )}

        {block.logos && Array.isArray(block.logos) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', alignItems: 'center' }}>
            {block.logos.map((logo: any, idx: number) => (
              <div
                key={idx}
                style={{
                  padding: '1rem 1.75rem',
                  backgroundColor: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-default)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {logo.clientName}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatsComponent({ block }: { block: any; isArabic: boolean }) {
  return (
    <section
      data-block-type="stats"
      style={{
        paddingBlock: '4.5rem 5rem',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container">
        {block.title && (
          <h2 style={{ textAlign: 'center', fontSize: '1.75rem', fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '3rem' }}>
            {block.title}
          </h2>
        )}

        {block.stats && Array.isArray(block.stats) && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'center' }}>
            {block.stats.map((st: any, idx: number) => (
              <div key={idx} style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--brand-primary-dark)', lineHeight: 1.1, marginBottom: '0.5rem' }}>
                  {st.value}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {st.label}
                </div>
                {st.description && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {st.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FAQComponent({ block }: { block: any; isArabic: boolean }) {
  return (
    <section
      data-block-type="faq"
      style={{
        paddingBlock: '5rem 6rem',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container" style={{ maxWidth: '800px' }}>
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          {block.eyebrow && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {block.eyebrow}
            </span>
          )}
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.75rem' }}>
            {block.title}
          </h2>
          {block.description && (
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0 }}>
              {block.description}
            </p>
          )}
        </header>

        {block.items && Array.isArray(block.items) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {block.items.map((item: any, idx: number) => (
              <details
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1.25rem 1.5rem',
                  cursor: 'pointer',
                }}
              >
                <summary style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', fontSize: '1rem', outline: 'none' }}>
                  {item.question}
                </summary>
                <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.7, margin: '0.75rem 0 0' }}>
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function CTAComponent({ block }: { block: any; isArabic: boolean }) {
  const isDark = block.theme === 'dark';
  const bgColor = isDark ? 'var(--bg-dark)' : 'var(--bg-surface)';
  const textColor = isDark ? 'var(--text-inverted)' : 'var(--brand-primary-dark)';
  const subtitleColor = isDark ? 'var(--text-inverted-muted)' : 'var(--text-secondary)';

  return (
    <section
      data-block-type="cta"
      style={{
        paddingBlock: '5rem 6rem',
        backgroundColor: bgColor,
        color: textColor,
        borderBottom: '1px solid var(--border-default)',
        textAlign: 'center',
      }}
    >
      <div className="container" style={{ maxWidth: '800px' }}>
        {block.eyebrow && (
          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: subtitleColor, display: 'block', marginBottom: '0.75rem' }}>
            {block.eyebrow}
          </span>
        )}
        <h2 style={{ fontSize: 'clamp(1.85rem, 3.5vw, 2.75rem)', fontWeight: 700, color: textColor, margin: '0 0 1rem', lineHeight: 1.2 }}>
          {block.title}
        </h2>
        {block.description && (
          <p style={{ fontSize: '1.0625rem', lineHeight: 1.7, color: subtitleColor, maxWidth: '650px', margin: '0 auto 2.5rem' }}>
            {block.description}
          </p>
        )}

        {(block.primaryCta?.label || block.secondaryCta?.label) && (
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {block.primaryCta?.label && (
              <Link
                href={block.primaryCta.url || '#'}
                className="btn-primary btn-lg"
                style={{
                  fontWeight: 700,
                  textDecoration: 'none',
                  backgroundColor: isDark ? 'var(--brand-primary-light)' : 'var(--brand-primary)',
                }}
              >
                {block.primaryCta.label}
              </Link>
            )}
            {block.secondaryCta?.label && (
              <Link
                href={block.secondaryCta.url || '#'}
                className="btn-secondary btn-lg"
                style={{
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: isDark ? 'var(--text-inverted)' : 'var(--text-primary)',
                  borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'var(--border-default)',
                }}
              >
                {block.secondaryCta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function FormBlockComponent({ block, isArabic }: { block: any; isArabic: boolean }) {
  return (
    <section
      data-block-type="formBlock"
      style={{
        paddingBlock: '5rem 6rem',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div className="container" style={{ maxWidth: '650px' }}>
        <header style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          {block.eyebrow && (
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {block.eyebrow}
            </span>
          )}
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.75rem' }}>
            {block.title}
          </h2>
          {block.description && (
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: 0 }}>
              {block.description}
            </p>
          )}
        </header>

        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            padding: '2rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                {isArabic ? 'الاسم بالكامل / اسم المؤسسة *' : 'Full Name / Entity Name *'}
              </label>
              <input
                type="text"
                disabled
                placeholder={isArabic ? 'استمارة CMS-01 تجريبية' : 'CMS-01 Demo Form'}
                style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-muted)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                {isArabic ? 'البريد الإلكتروني المؤسسي *' : 'Corporate Email Address *'}
              </label>
              <input
                type="email"
                disabled
                placeholder="name@company.com"
                style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-muted)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.35rem' }}>
                {isArabic ? 'تفاصيل الطلب أو الاستفسار *' : 'Inquiry / Project Details *'}
              </label>
              <textarea
                disabled
                rows={3}
                placeholder={isArabic ? 'سيتم ربط معالجة الإرسال والتحقق في CMS-05' : 'Submission workflow handled in CMS-05'}
                style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-muted)' }}
              />
            </div>
            <button
              type="button"
              disabled
              className="btn-primary"
              style={{ width: '100%', fontWeight: 700, opacity: 0.7, cursor: 'not-allowed' }}
            >
              {block.submitButtonLabel || (isArabic ? 'إرسال الطلب (CMS-05 Workflow) ←' : 'Submit Inquiry (CMS-05) →')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
