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
  AwardIcon,
} from '@/shared/ui/icons';
import { legacyServicesData } from '@/scripts/migration/data/legacyServices';
import { agencyWorkflow } from '@/shared/data/agencyData';

interface ServicePageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of locales) {
    for (const service of legacyServicesData) {
      params.push({ locale, slug: service.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: ServicePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};

  const service = legacyServicesData.find((s) => s.slug === slug);
  if (!service) return {};

  const isArabic = locale === 'ar';
  const content = isArabic ? service.ar : service.en;
  const siteName = isArabic ? 'وكالة موهبة' : 'MWHEBA Agency';

  return {
    title: `${content.title} | ${siteName}`,
    description: content.metaDescription,
    openGraph: {
      title: `${content.title} | ${siteName}`,
      description: content.metaDescription,
      type: 'website',
      locale: isArabic ? 'ar_EG' : 'en_US',
    },
  };
}

export default async function ServiceDetailPage({ params }: ServicePageProps) {
  const { locale, slug } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const service = legacyServicesData.find((s) => s.slug === slug);
  if (!service) {
    notFound();
  }

  const isArabic = locale === 'ar';
  const ArrowIcon = isArabic ? ArrowLeftIcon : ArrowRightIcon;
  const content = isArabic ? service.ar : service.en;
  const isPrinting = service.slug === 'printing';

  // Other 5 related disciplines for deep discovery
  const relatedServices = legacyServicesData.filter((s) => s.slug !== slug);

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
    <div className="service-detail-wrapper">
      {/* 1. Header Banner & Breadcrumbs */}
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
                <Link href={isArabic ? '/ar/services' : '/en/services'} className="breadcrumbs-link">
                  {isArabic ? 'خدماتنا' : 'Services'}
                </Link>
              </li>
              <li className="breadcrumbs-separator" aria-hidden="true">/</li>
              <li className="breadcrumbs-item">
                <span className="breadcrumbs-current" aria-current="page">
                  {content.title}
                </span>
              </li>
            </ol>
          </nav>

          <span className="service-detail-eyebrow">
            {renderServiceIcon(service.category)}
            <span>
              {isArabic ? `تخصص معتمد // ${content.title}` : `CORE DISCIPLINE // ${content.title}`}
            </span>
          </span>

          <h1 className="service-detail-title">{content.title}</h1>
          <h2 className="service-detail-subtitle">{content.subtitle}</h2>
          <p className="service-detail-summary">{content.summary}</p>

          <div className="hero-actions">
            <Link
              href={
                isArabic
                  ? `/ar/contact?service=${service.slug}`
                  : `/en/contact?service=${service.slug}`
              }
              className="btn-primary btn-lg"
            >
              <span>{isArabic ? 'طلب استشارة وتحديد نطاق العمل' : 'Request Consultation & Scope'}</span>
              <ArrowIcon size={16} />
            </Link>

            {isPrinting && (
              <Link
                href={isArabic ? '/ar/store' : '/en/store'}
                className="btn-accent btn-lg"
              >
                <span>{isArabic ? 'متجر هدايا الشركات (MOQ 10)' : 'Corporate Store (MOQ 10)'}</span>
              </Link>
            )}

            <Link
              href={isArabic ? '/ar/services' : '/en/services'}
              className="btn-secondary btn-lg"
            >
              <span>{isArabic ? 'العودة لكافة الخدمات' : 'All Disciplines'}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Structured Capabilities & Deliverables Grid */}
      <section className="container" style={{ paddingBlock: '4.5rem 3.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem' }}>
          {/* Column A: Scope & Execution Features */}
          <div>
            <div className="section-header" style={{ marginBlockEnd: '2rem' }}>
              <span className="section-eyebrow">
                {isArabic ? 'محاور العمل // نطاق التنفيذ' : 'EXECUTION PILLARS // SCOPE'}
              </span>
              <h3 className="section-title" style={{ fontSize: '1.5rem' }}>
                {isArabic ? 'ماذا تشمل هذه الخدمة؟' : 'What We Deliver Under This Scope'}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {content.features.map((feat, idx) => (
                <div key={idx} className="service-feature-card">
                  <div className="service-feature-icon-badge">
                    <CheckIcon size={14} />
                  </div>
                  <p className="service-feature-text">{feat}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Column B: Deliverables & Institutional SLA */}
          <div>
            <div className="section-header" style={{ marginBlockEnd: '2rem' }}>
              <span className="section-eyebrow">
                {isArabic ? 'المخرجات والضمانات // معايير التسليم' : 'DELIVERABLES & ASSURANCE'}
              </span>
              <h3 className="section-title" style={{ fontSize: '1.5rem' }}>
                {isArabic ? 'المخرجات المعيارية والضمان الهندسي' : 'Standard Deliverables & SLA'}
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBlockEnd: '2rem' }}>
              {content.deliverables.map((deliv, dIdx) => (
                <div key={dIdx} className="deliverable-item">
                  <span style={{ color: 'var(--brand-primary)', flexShrink: 0 }}>
                    <ShieldCheckIcon size={18} />
                  </span>
                  <span>{deliv}</span>
                </div>
              ))}
            </div>

            {/* Quality Guarantee Box */}
            <div className="guarantee-box">
              <h4 className="guarantee-box-title">
                <AwardIcon size={20} />
                <span>{isArabic ? 'ضمان الجودة المؤسسي من موهبة' : 'MWHEBA Institutional Quality Guarantee'}</span>
              </h4>
              <p className="guarantee-box-desc">
                {isArabic
                  ? 'تلتزم وكالة موهبة بأعلى معايير الدقة الهندسية والفنية، وتقديم كافة ملفات المصدر الأصلية، ومراجعة الألوان ومواصفات الإنتاج مع عملائنا عبر مراحل معتمدة قبل التسليم النهائي.'
                  : 'We enforce rigorous quality controls, delivering master source assets, calibrated color standards, and strict milestone approvals prior to final production handover.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Workflow Methodology */}
      <section className="workflow-section" style={{ backgroundColor: 'var(--bg-secondary)', borderBlock: '1px solid var(--border-default)' }}>
        <div className="container">
          <div className="section-header">
            <span className="section-eyebrow">
              {isArabic ? 'مراحل التنفيذ // سير العمل' : 'EXECUTION TIMELINE // WORKFLOW'}
            </span>
            <h3 className="section-title">
              {isArabic ? `مراحل تنفيذ ${content.title}` : `Execution Milestones for ${content.title}`}
            </h3>
          </div>

          <div className="workflow-grid-4">
            {agencyWorkflow.map((flow) => (
              <div key={flow.step} className="workflow-card">
                <span className="workflow-step-num">{flow.step}</span>
                <h4 className="workflow-step-title">
                  {isArabic ? flow.titleAr : flow.titleEn}
                </h4>
                <p className="workflow-step-desc">
                  {isArabic ? flow.descAr : flow.descEn}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Related Disciplines */}
      <section className="container" style={{ paddingBlock: '5rem 4rem' }}>
        <div className="section-header" style={{ marginBlockEnd: '2.5rem' }}>
          <span className="section-eyebrow">
            {isArabic ? 'تخصصات أخرى // تكامل الخدمات' : 'OTHER DISCIPLINES // CROSS-CAPABILITIES'}
          </span>
          <h3 className="section-title">
            {isArabic ? 'خدمات إضافية تقدمها وكالة موهبة' : 'Explore Complementary Capabilities'}
          </h3>
        </div>

        <div className="related-services-grid">
          {relatedServices.map((rel) => {
            const relContent = isArabic ? rel.ar : rel.en;
            const relHref = isArabic
              ? `/ar/services/${rel.slug}`
              : `/en/services/${rel.slug}`;

            return (
              <Link key={rel.slug} href={relHref} className="related-service-card">
                <span style={{ color: 'var(--brand-primary)', marginBlockEnd: '0.75rem' }}>
                  {renderServiceIcon(rel.category)}
                </span>
                <h4 className="related-service-title">{relContent.title}</h4>
                <p className="related-service-subtitle">{relContent.subtitle}</p>
                <div className="related-service-link">
                  <span>{isArabic ? 'عرض التفاصيل' : 'Learn More'}</span>
                  <ArrowIcon size={12} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 5. Direct Conversion CTA */}
      <div className="container" style={{ paddingBlockEnd: '5rem' }}>
        <section className="cta-banner-section">
          <div className="cta-banner-inner">
            <h3 className="cta-banner-title">
              {isArabic
                ? `طلب استشارة وتحديد نطاق عمل ${content.title}`
                : `Schedule Consultation for ${content.title}`}
            </h3>
            <p className="cta-banner-desc">
              {isArabic
                ? 'تواصل مع فريق موهبة الاستشاري لمناقشة متطلبات مشروعك والحصول على عرض فني ومالي مفصل.'
                : 'Connect with our leadership team to define project deliverables, scope, and institutional quotes.'}
            </p>
            <div className="cta-banner-actions">
              <Link
                href={
                  isArabic
                    ? `/ar/contact?service=${service.slug}`
                    : `/en/contact?service=${service.slug}`
                }
                className="btn-primary btn-lg"
                style={{
                  backgroundColor: 'var(--brand-primary-light)',
                  borderColor: 'var(--brand-primary-light)',
                }}
              >
                <span>{isArabic ? 'طلب استشارة فورية' : 'Request Quotation & Scope'}</span>
                <ArrowIcon size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
