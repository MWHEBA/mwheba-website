import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidLocale, locales } from '@/shared/lib/i18n';
import {
  ShieldCheckIcon,
  CheckIcon,
  AwardIcon,
  UsersIcon,
  CompassIcon,
  RocketIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@/shared/ui/icons';
import {
  agencyAboutStats,
  agencyValues,
  agencyClients,
} from '@/shared/data/agencyData';

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
    ? 'عن موهبة | وكالة موهبة للحلول الإبداعية والإنتاجية'
    : 'About Us | MWHEBA Agency Creative Solutions';
  const description = isArabic
    ? 'تعرف على وكالة موهبة للحلول الإبداعية: قصة تأسيسنا في الإسكندرية، رؤيتنا الاستراتيجية، قيمنا المؤسسية، وفريق عملنا المتخصص في بناء العلامات التجارية والمنصات الرقمية.'
    : 'Learn about MWHEBA Agency: Founded in Alexandria, Egypt. Our strategic vision, institutional values, leadership team, and proven track record across branding, web engineering, and media.';

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

export default async function AboutPage({
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

  return (
    <div className="about-page-wrapper">
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
                <span className="breadcrumbs-current" aria-current="page">
                  {isArabic ? 'عن موهبة' : 'About Us'}
                </span>
              </li>
            </ol>
          </nav>

          <span className="service-detail-eyebrow">
            <ShieldCheckIcon size={14} />
            <span>
              {isArabic
                ? 'وكالة موهبة للحلول الإبداعية // تأسست بالإسكندرية'
                : 'MWHEBA AGENCY // FOUNDED IN ALEXANDRIA, EGYPT'}
            </span>
          </span>

          <h1 className="service-detail-title">
            {isArabic
              ? 'من الفكر الاستراتيجي إلى الأثر المستدام'
              : 'From Strategic Vision to Lasting Brand Impact'}
          </h1>

          <p className="service-detail-summary">
            {isArabic
              ? 'كل مشروع يبدأ برؤية واضحة وتفكير استراتيجي وفهم كامل لأهدافك. من بناء العلامة التجارية إلى تطوير المنصات المتكاملة، نبتكر حلولاً مخصصة تصنع فارقاً حقيقياً في السوق وتترك أثراً يدوم.'
              : 'Every project starts with a clear vision, strategic thinking, and a deep understanding of your goals. From branding to full-stack web engineering and executive merchandise, we deliver tailored solutions that resonate and convert.'}
          </p>

          <div className="hero-actions">
            <Link
              href={isArabic ? '/ar/contact' : '/en/contact'}
              className="btn-primary btn-lg"
            >
              <span>{isArabic ? 'ابدأ مشروعك / طلب استشارة' : 'Start Your Project'}</span>
              <ArrowIcon size={16} />
            </Link>
            <Link
              href={isArabic ? '/ar/services' : '/en/services'}
              className="btn-secondary btn-lg"
            >
              <span>{isArabic ? 'استكشف خدماتنا الست' : 'Explore Our Capabilities'}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Key Metrics Strip */}
      <div className="container" style={{ marginBlock: '4rem' }}>
        <div className="metrics-grid" style={{ marginBlockEnd: '0' }}>
          {agencyAboutStats.map((stat, idx) => (
            <div key={idx} className="metric-item">
              <span className="metric-value">{stat.value}</span>
              <span className="metric-label">
                {isArabic ? stat.labelAr : stat.labelEn}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Agency Narrative & Story */}
      <section className="container" style={{ paddingBlock: '3rem 4rem' }}>
        <div className="story-grid">
          {/* Card 1: The Story & Heritage */}
          <div className="story-card">
            <span className="section-eyebrow">
              {isArabic ? 'قصتنا وتأسيسنا // الجذور والهوية' : 'OUR HERITAGE // FOUNDED IN ALEXANDRIA'}
            </span>
            <h2 className="section-title" style={{ fontSize: '1.5rem', marginBlockEnd: '1.25rem' }}>
              {isArabic
                ? 'عقد من الشغف والريادة في صناعة الهوية والتقنية'
                : 'A Decade of Strategic Craft & Technological Leadership'}
            </h2>
            <p style={{ fontSize: '1rem', lineHeight: '1.8', color: 'var(--text-secondary)', marginBlockEnd: '1.25rem' }}>
              {isArabic
                ? 'انطلقت وكالة موهبة من مدينة الإسكندرية برؤية واضحة تهدف إلى سد الفجوة بين الإبداع البصري والهندسة البرمجية المتطورة. على مدار أكثر من 10 سنوات، تطورنا لنصبح شريكاً استراتيجياً موثوقاً لكبرى المؤسسات والشركات الناشئة الطموحة في مصر والعالم العربي.'
                : 'Founded in Alexandria, MWHEBA Agency was established with a singular vision: bridging the gap between high-caliber creative design, software engineering, and precision physical production. Over a decade, we have evolved into a trusted growth partner for leading enterprises.'}
            </p>
            <p style={{ fontSize: '1rem', lineHeight: '1.8', color: 'var(--text-secondary)', margin: 0 }}>
              {isArabic
                ? 'نؤمن أن النجاح لا يتحقق بالصدفة، بل بالتخطيط الدقيق، وفهم عمق السوق، والتنفيذ الفني الذي لا يرضى بالحلول الوسط.'
                : 'We believe enduring brand equity is not accidental — it is engineered through disciplined market insights, strategic alignment, and meticulous execution.'}
            </p>
          </div>

          {/* Card 2: Strategic Philosophy & One Team */}
          <div className="story-card" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <span className="section-eyebrow">
              {isArabic ? 'فلسفتنا المؤسسية // برعاية موهبة' : 'OUR PHILOSOPHY // ONE POWERFUL SOLUTION'}
            </span>
            <h2 className="section-title" style={{ fontSize: '1.5rem', marginBlockEnd: '1.25rem' }}>
              {isArabic
                ? 'رؤية واحدة، فريق واحد، حل متكامل يحقق النتائج'
                : 'One Vision. One Team. Measurable Outcomes.'
              }
            </h2>
            <p style={{ fontSize: '1rem', lineHeight: '1.8', color: 'var(--text-secondary)', marginBlockEnd: '1.5rem' }}>
              {isArabic
                ? 'من الأفكار الجريئة إلى التنفيذ الموثوق — موهبة تتولى المنظومة بالكامل. نوفر على عملائنا تشتت التعامل مع جهات متعددة، عبر دمج فرق الهوية البصرية، هندسة الويب، تصوير الميديا، التسويق الرقمي، والتوريدات والطباعة تحت إدارة موحدة تضمن تناغم الرسالة وسرعة الإنجاز.'
                : 'From bold ideas to bulletproof execution — MWHEBA handles it all. We eliminate vendor fragmentation by uniting brand architects, full-stack engineers, filmmakers, growth marketers, and merchandise fabricators under unified governance.'}
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <CheckIcon size={16} style={{ color: 'var(--status-success)' }} />
                <span>{isArabic ? 'مسؤولية واحدة وضمان متكامل للمشروع' : 'Single Point of Strategic Accountability'}</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <CheckIcon size={16} style={{ color: 'var(--status-success)' }} />
                <span>{isArabic ? 'التزام حازم بالمواعيد والمواصفات الفنية' : 'Strict Delivery Timelines & Technical Governance'}</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <CheckIcon size={16} style={{ color: 'var(--status-success)' }} />
                <span>{isArabic ? 'تسليم كامل ملفات المصدر وحقوق الملكية' : 'Full Source Code & Master IP Asset Ownership'}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. The 6 Core Values */}
      <section className="container" style={{ paddingBlock: '3rem 5rem' }}>
        <div className="section-header" style={{ maxWidth: '800px', marginBlockEnd: '3rem' }}>
          <span className="section-eyebrow">
            {isArabic ? 'ثقافة العمل // قيمنا الراسخة' : 'CULTURE & PILLARS // OUR CORE VALUES'}
          </span>
          <h2 className="section-title">
            {isArabic
              ? 'المبادئ والمعايير التي تقود كل قرار نتخذه'
              : 'The Core Principles Guiding Every Creative & Technical Decision'}
          </h2>
          <p style={{ fontSize: '1.0625rem', color: 'var(--text-secondary)', marginBlock: '0.75rem 0', lineHeight: 1.7 }}>
            {isArabic
              ? 'نؤمن أن أعظم الإنجازات تأتي من التعاون الصادق، والبحث عن الابتكار، والالتزام بأعلى المعايير الأخلاقية والمهنية.'
              : 'We believe the greatest breakthroughs emerge from honest collaboration, relentless innovation, and uncompromising professional integrity.'}
          </p>
        </div>

        <div className="values-grid-6">
          {agencyValues.map((val, idx) => (
            <div key={idx} className="value-card" style={{ boxShadow: 'var(--shadow-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-accent)', letterSpacing: '0.04em' }}>
                  0{idx + 1} // {val.titleEn.toUpperCase()}
                </span>
                <span style={{ color: 'var(--brand-primary)' }}>
                  <AwardIcon size={18} />
                </span>
              </div>
              <h3 className="value-title">{isArabic ? val.titleAr : val.titleEn}</h3>
              <p className="value-desc">{isArabic ? val.descAr : val.descEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Enterprise Trust & 22 Client Logos */}
      <section className="clients-section">
        <div className="container">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: '800px', marginInline: 'auto' }}>
            <span className="section-eyebrow">
              {isArabic ? 'شركاء النجاح // ثقة المؤسسات' : 'ENTERPRISE TRUST // CLIENTS WE’VE EMPOWERED'}
            </span>
            <h2 className="section-title">
              {isArabic
                ? 'من الشركات الناشئة الطموحة إلى العلامات التجارية الكبرى — الجميع يثق بـ موهبة'
                : 'From Ambitious Startups to Industry Leaders — Trusted by Brands'}
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBlock: '0.75rem 0', lineHeight: 1.7 }}>
              {isArabic
                ? 'أكثر من 100 علامة تجارية وكيان تجاري اعتمدت على موهبة في بناء هويتها، وتطوير منصاتها، وتوريد هداياها ومطبوعاتها.'
                : 'Over 100 forward-thinking enterprises and institutions rely on MWHEBA for authoritative branding and engineering.'}
            </p>
          </div>

          <div className="clients-grid-22" style={{ marginBlockStart: '3rem' }}>
            {agencyClients.map((client) => (
              <div
                key={client.id}
                className="client-logo-item"
                title={isArabic ? client.nameAr : client.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={client.logoPath}
                  alt={isArabic ? client.nameAr : client.name}
                  className="client-logo-img"
                  loading="lazy"
                  width={140}
                  height={44}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Conversion CTA Banner */}
      <div className="container" style={{ paddingBlock: '4rem 5rem' }}>
        <section className="cta-banner-section">
          <div className="cta-banner-inner">
            <h2 className="cta-banner-title">
              {isArabic
                ? 'جاهز لبناء شراكة ناجحة مع وكالة موهبة؟'
                : 'Ready to Build a Winning Partnership With MWHEBA?'}
            </h2>
            <p className="cta-banner-desc">
              {isArabic
                ? 'فريقنا الاستشاري متواجد للإجابة على استفساراتك ومساعدتك على اتخاذ القرارات الإبداعية والتقنية الأكثر فاعلية لنمو أعمالك.'
                : 'Our senior directors are ready to analyze your challenges and structure the ideal creative, technological, or merchandising solution.'}
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
                <span>{isArabic ? 'تواصل مع فريقنا الآن' : 'Connect With Our Directors'}</span>
                <ArrowIcon size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
