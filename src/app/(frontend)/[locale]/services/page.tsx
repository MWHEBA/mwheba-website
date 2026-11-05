import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidLocale, locales } from '@/shared/lib/i18n';
import {
  BrandingIcon,
  MerchandiseIcon,
  WebPlatformsIcon,
  MediaIcon,
  UiUxIcon,
  MarketingIcon,
  ShieldCheckIcon,
  CheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@/shared/ui/icons';
import { legacyServicesData } from '@/scripts/migration/data/legacyServices';
import { agencyWorkflow } from '@/shared/data/agencyData';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'خدماتنا المؤسسية والحلول الإبداعية | وكالة موهبة'
    : 'Our Corporate Services & Creative Solutions | MWHEBA Agency';
  const description = isArabic
    ? 'استكشف تخصصات وكالة موهبة الست: تصميم الهوية التجارية، تطوير منصات الويب، إنتاج الوسائط السينمائية، تصميم UI/UX، التسويق الرقمي، والطباعة وهدايا الشركات.'
    : 'Explore MWHEBA Agency’s 6 core disciplines: Brand Architecture, Bespoke Web Development, Cinematic Media Production, UI/UX Design, Performance Marketing, and Corporate Merchandise.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: isArabic ? 'ar_EG' : 'en_US',
    },
  };
}

export default async function ServicesHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const isArabic = locale === 'ar';
  const ArrowIcon = isArabic ? ArrowLeftIcon : ArrowRightIcon;

  const renderServiceIcon = (category: string) => {
    switch (category) {
      case 'branding':
        return <BrandingIcon size={24} />;
      case 'technology':
        return <WebPlatformsIcon size={24} />;
      case 'design':
        return <UiUxIcon size={24} />;
      case 'marketing':
        return <MarketingIcon size={24} />;
      case 'media':
        return <MediaIcon size={24} />;
      case 'printing':
        return <MerchandiseIcon size={24} />;
      default:
        return <BrandingIcon size={24} />;
    }
  };

  return (
    <div className="services-hub-wrapper">
      {/* 1. Header Banner */}
      <section className="service-detail-hero">
        <div className="container" style={{ maxWidth: '980px', marginInline: 'auto' }}>
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumbs">
              <li className="breadcrumbs-item">
                <Link href={isArabic ? '/ar' : '/en'} className="breadcrumbs-link">
                  {isArabic ? 'الرئيسية' : 'Home'}
                </Link>
              </li>
              <li className="breadcrumbs-separator" aria-hidden="true">/</li>
              <li className="breadcrumbs-item">
                <span className="breadcrumbs-current" aria-current="page">
                  {isArabic ? 'خدماتنا' : 'Services'}
                </span>
              </li>
            </ol>
          </nav>

          <span className="service-detail-eyebrow">
            <ShieldCheckIcon size={14} />
            <span>{isArabic ? 'مجالات العمل الرئيسية // خدماتنا' : 'CORE DISCIPLINES & CAPABILITIES'}</span>
          </span>

          <h1 className="service-detail-title">
            {isArabic
              ? 'منظومة إبداعية وإنتاجية متكاملة لنمو علامتك التجارية'
              : 'Integrated Creative & Production Solutions for Enterprise Growth'}
          </h1>

          <p className="service-detail-summary">
            {isArabic
              ? 'نجمع بين الفكر الاستراتيجي المعمق، التصميم المؤسسي الراقي، الهندسة البرمجية المتقدمة، والتصنيع والإنتاج الملموس، لنقدم لشركائنا حلولاً تصنع فارقاً حقيقياً في السوق وتضمن أعلى عائد على الاستثمار.'
              : 'We unite strategic thought, authoritative design systems, bespoke software engineering, and precision merchandise manufacturing under one roof to deliver measurable market impact.'}
          </p>

          <div className="hero-actions">
            <Link
              href={isArabic ? '/ar/contact' : '/en/contact'}
              className="btn-primary btn-lg"
            >
              <span>{isArabic ? 'طلب استشارة وتحديد نطاق عمل' : 'Request Consultation & Scope'}</span>
              <ArrowIcon size={16} />
            </Link>
            <Link
              href={isArabic ? '/ar/store' : '/en/store'}
              className="btn-secondary btn-lg"
            >
              <span>{isArabic ? 'متجر هدايا الشركات (B2B)' : 'Corporate Merchandise Store'}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Core 6 Services Showcase */}
      <section className="container" style={{ paddingBlock: '5rem 4rem' }}>
        <div className="section-header" style={{ maxWidth: '800px', marginBlockEnd: '3.5rem' }}>
          <span className="section-eyebrow">
            {isArabic ? 'التخصصات الست // مسارات العمل' : 'THE 6 DISCIPLINES // WORK TRACKS'}
          </span>
          <h2 className="section-title">
            {isArabic
              ? 'تخصصات متكاملة تغطي كافة مراحل تطور العلامة التجارية'
              : 'Comprehensive Capabilities Powering Brand Transformation'}
          </h2>
        </div>

        <div className="services-grid-6">
          {legacyServicesData.map((service, index) => {
            const content = isArabic ? service.ar : service.en;
            const stepNum = `0${index + 1}`;
            const detailHref = isArabic
              ? `/ar/services/${service.slug}`
              : `/en/services/${service.slug}`;

            return (
              <div key={service.slug} className="service-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="service-card-header">
                  <div className="service-card-icon">
                    {renderServiceIcon(service.category)}
                  </div>
                  <span className="service-card-num">
                    {stepNum} // {service.category.toUpperCase()}
                  </span>
                </div>

                <h3 className="service-card-title">{content.title}</h3>
                <h4 className="service-card-subtitle">{content.subtitle}</h4>
                <p className="service-card-desc">{content.summary}</p>

                <div style={{ marginBlockEnd: '1.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBlockEnd: '0.75rem',
                    }}
                  >
                    {isArabic ? 'أبرز محاور التنفيذ:' : 'Key Capabilities:'}
                  </span>
                  <ul className="service-card-features">
                    {content.features.slice(0, 4).map((feat, fIdx) => (
                      <li key={fIdx} className="service-card-feature-item">
                        <span style={{ color: 'var(--status-success)', flexShrink: 0, marginTop: '2px' }}>
                          <CheckIcon size={14} />
                        </span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginBlockEnd: '1.5rem' }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-muted)',
                      display: 'block',
                      marginBlockEnd: '0.5rem',
                    }}
                  >
                    {isArabic ? 'المخرجات المعيارية:' : 'Standard Deliverables:'}
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {content.deliverables.map((deliv, dIdx) => (
                      <span key={dIdx} className="badge badge-neutral">
                        {deliv}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginBlockStart: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <Link href={detailHref} className="btn-primary btn-sm">
                    <span>{isArabic ? 'استكشف تفاصيل الخدمة' : 'Service Details'}</span>
                    <ArrowIcon size={14} />
                  </Link>

                  {service.slug === 'printing' && (
                    <Link
                      href={isArabic ? '/ar/store' : '/en/store'}
                      className="btn-secondary btn-sm"
                    >
                      {isArabic ? 'متجر الهدايا (MOQ 10)' : 'Merchandise Catalog'}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. Methodology & Workflow */}
      <section className="workflow-section" style={{ backgroundColor: 'var(--bg-secondary)', borderBlock: '1px solid var(--border-default)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-eyebrow">
              {isArabic ? 'سير العمل // منهجية موهبة' : 'THE PROCESS // HOW WE DELIVER'}
            </span>
            <h2 className="section-title">
              {isArabic
                ? 'كيف نضمن جودة ودقة المخرجات من الفكرة حتى التسليم؟'
                : 'Rigorous Execution From Concept to Final Handover'}
            </h2>
          </div>

          <div className="workflow-grid-4">
            {agencyWorkflow.map((flow) => (
              <div key={flow.step} className="workflow-card">
                <span className="workflow-step-num">{flow.step}</span>
                <h3 className="workflow-step-title">
                  {isArabic ? flow.titleAr : flow.titleEn}
                </h3>
                <p className="workflow-step-desc">
                  {isArabic ? flow.descAr : flow.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. High-Impact CTA Banner */}
      <div className="container" style={{ paddingBlock: '3rem 5rem' }}>
        <section className="cta-banner-section">
          <div className="cta-banner-inner">
            <h2 className="cta-banner-title">
              {isArabic
                ? 'جاهز لبدء مشروعك أو مناقشة متطلبات مؤسستك؟'
                : 'Ready to Define Your Scope or Launch Your Brand?'}
            </h2>
            <p className="cta-banner-desc">
              {isArabic
                ? 'فريق موهبة الاستشاري جاهز لتحليل احتياجاتك وتقديم عرض فني ومالي مفصل يناسب طموحات مؤسستك.'
                : 'Connect with our leadership team to define deliverables, timelines, and tailored institutional quotations.'}
            </p>
            <div className="cta-banner-actions">
              <Link
                href={isArabic ? '/ar/contact' : '/en/contact'}
                className="btn-primary btn-lg"
                style={{
                  backgroundColor: 'var(--brand-primary-light)',
                  borderColor: 'var(--brand-primary-light)',
                }}
              >
                <span>{isArabic ? 'تواصل مع فريقنا الآن' : 'Schedule Consultation'}</span>
                <ArrowIcon size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
