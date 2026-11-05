import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isValidLocale } from '@/shared/lib/i18n';
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
import {
  agencyClients,
  agencyServices,
  agencyWorkflow,
  agencyStats,
  agencyValues,
} from '@/shared/data/agencyData';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'وكالة موهبة | العلامات التجارية المبتكرة تبدأ من هنا'
    : 'MWHEBA Agency | Intelligent Brands Start Here';
  const description = isArabic
    ? 'وكالة رائدة في مصر لخدمات تصميم الهوية التجارية، تطوير منصات الويب، إنتاج الوسائط السينمائية، التسويق الرقمي، وتوريد هدايا ومطبوعات الشركات.'
    : 'Leading creative agency in Egypt delivering brand architecture, bespoke web development, media production, performance marketing, and corporate merchandise.';

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

export default async function HomePage({
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

  // Icon mapping helper for 6 services
  const renderServiceIcon = (iconName: string) => {
    switch (iconName) {
      case 'branding':
        return <BrandingIcon size={24} />;
      case 'web':
        return <WebPlatformsIcon size={24} />;
      case 'media':
        return <MediaIcon size={24} />;
      case 'uiux':
        return <UiUxIcon size={24} />;
      case 'marketing':
        return <MarketingIcon size={24} />;
      case 'printing':
        return <MerchandiseIcon size={24} />;
      default:
        return <BrandingIcon size={24} />;
    }
  };

  return (
    <div className="home-page-container">
      {/* 1. Hero Section */}
      <div className="container">
        <section className="hero-section">
          <div>
            <span className="hero-eyebrow">
              <ShieldCheckIcon size={14} />
              <span>
                {isArabic
                  ? 'مرحباً بكم في وكالة موهبة // حلول إبداعية وإنتاجية متكاملة'
                  : 'Welcome to MWHEBA Agency // Integrated B2B Creative Solutions'}
              </span>
            </span>
          </div>

          <h1 className="hero-title">
            {isArabic
              ? 'العلامات التجارية المبتكرة تبدأ من هنا'
              : 'Intelligent Brands Start Here'}
          </h1>

          <p className="hero-description">
            {isArabic
              ? 'نساعد الشركات والمؤسسات الطموحة على بناء حضور رقمي وبصري استثنائي وتحقيق نتائج ملموسة عبر تصميم الهويات التجارية، تطوير منصات الويب الحديثة، إنتاج المحتوى المرئي، وحملات النمو الرقمي، إلى جانب توريد وتصنيع هدايا الشركات والمطبوعات الدعائية بأعلى معايير الجودة والالتزام الهندسي بالحد الأدنى للطلب (MOQ).'
              : 'We empower forward-thinking enterprises with authoritative brand architecture, bespoke web platforms, cinematic media production, targeted digital growth, and tailored corporate merchandise manufactured to rigorous standards.'}
          </p>

          <div className="hero-actions">
            <Link
              href={isArabic ? '/ar/contact' : '/en/contact'}
              className="btn-primary btn-lg"
            >
              <span>{isArabic ? 'ابدأ مشروعك / طلب استشارة' : 'Start Your Project'}</span>
              <ArrowIcon size={16} />
            </Link>

            <a href="#services" className="btn-secondary btn-lg">
              <span>{isArabic ? 'استكشف خدماتنا الست' : 'Explore Our 6 Disciplines'}</span>
            </a>

            <Link
              href={isArabic ? '/ar/store' : '/en/store'}
              className="btn-outline btn-lg"
            >
              <span>{isArabic ? 'متجر هدايا الشركات (B2B)' : 'Corporate Store (B2B)'}</span>
            </Link>
          </div>
        </section>

        {/* 2. Key Metrics Strip */}
        <div className="metrics-grid">
          {agencyStats.map((stat, idx) => (
            <div key={idx} className="metric-item">
              <span className="metric-value">{stat.value}</span>
              <span className="metric-label">
                {isArabic ? stat.labelAr : stat.labelEn}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Core Services Grid */}
      <section id="services" className="container" style={{ marginBlockEnd: '6rem' }}>
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'مجالات العمل الرئيسية // خدماتنا' : 'CORE CAPABILITIES // OUR SERVICES'}
          </span>
          <h2 className="section-title">
            {isArabic
              ? 'حلول مؤسسية متكاملة للعلامات التجارية'
              : 'Integrated Enterprise Solutions'}
          </h2>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              maxWidth: '680px',
              marginBlock: '0.75rem 0',
              lineHeight: 1.7,
            }}
          >
            {isArabic
              ? 'منظومة خدمات تجمع بين الفكر الاستراتيجي، التصميم الإبداعي، التقنيات الحديثة، والإنتاج الملموس تحت سقف واحد.'
              : 'A unified ecosystem uniting strategic thinking, creative design, modern technology, and tangible production under one roof.'}
          </p>
        </div>

        <div className="services-grid-6">
          {agencyServices.map((service, index) => {
            const stepNum = `0${index + 1}`;
            const targetHref =
              service.slug === 'printing'
                ? isArabic
                  ? '/ar/store'
                  : '/en/store'
                : isArabic
                ? `/ar/services/${service.slug}`
                : `/en/services/${service.slug}`;

            return (
              <Link
                key={service.id}
                href={targetHref}
                className="service-card"
                aria-label={isArabic ? service.titleAr : service.titleEn}
              >
                <div className="service-card-header">
                  <div className="service-card-icon">
                    {renderServiceIcon(service.iconName)}
                  </div>
                  <span className="service-card-num">
                    {stepNum} // {service.iconName.toUpperCase()}
                  </span>
                </div>

                <h3 className="service-card-title">
                  {isArabic ? service.titleAr : service.titleEn}
                </h3>

                <h4 className="service-card-subtitle">
                  {isArabic ? service.subtitleAr : service.subtitleEn}
                </h4>

                <p className="service-card-desc">
                  {isArabic ? service.descriptionAr : service.descriptionEn}
                </p>

                <ul className="service-card-features">
                  {(isArabic ? service.featuresAr : service.featuresEn).map(
                    (feat, fIdx) => (
                      <li key={fIdx} className="service-card-feature-item">
                        <span style={{ color: 'var(--status-success)', flexShrink: 0, marginTop: '2px' }}>
                          <CheckIcon size={14} />
                        </span>
                        <span>{feat}</span>
                      </li>
                    )
                  )}
                </ul>

                <div className="service-card-link">
                  <span>
                    {service.slug === 'printing'
                      ? isArabic
                        ? 'تصفح منتجات وهدايا الـ B2B'
                        : 'Explore B2B Merchandise'
                      : isArabic
                      ? 'تفاصيل الخدمة والنطاق'
                      : 'Explore Service Scope'}
                  </span>
                  <ArrowIcon size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 4. Enterprise Client Logos Wall (22 Authentic Logos) */}
      <section className="clients-section">
        <div className="container">
          <div className="section-header" style={{ textAlign: 'center', maxWidth: '800px', marginInline: 'auto' }}>
            <span className="section-eyebrow">
              {isArabic ? 'شركاء النجاح // ثقة المؤسسات' : 'ENTERPRISE TRUST // CLIENTS WE’VE EMPOWERED'}
            </span>
            <h2 className="section-title">
              {isArabic
                ? 'من الشركات الناشئة الطموحة إلى العلامات الكبرى — الجميع يثق بـ موهبة'
                : 'From Ambitious Startups to Industry Leaders — Trusted by Brands'}
            </h2>
            <p
              style={{
                fontSize: '1rem',
                color: 'var(--text-secondary)',
                marginBlock: '0.75rem 0',
                lineHeight: 1.7,
              }}
            >
              {isArabic
                ? 'أكثر من 100 علامة تجارية وكيان تجاري اعتمدت على موهبة في تطوير حضورها وتوريد هداياها ومطبوعاتها.'
                : 'Over 100 enterprises and forward-thinking brands rely on MWHEBA for branding, engineering, and merchandise.'}
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

      {/* 5. Creative & Technical Process Workflow */}
      <section className="workflow-section">
        <div className="container">
          <div className="section-header">
            <span className="section-eyebrow">
              {isArabic ? 'سير العمل // منهجية موهبة' : 'HOW WE WORK // THE MWHEBA PROCESS'}
            </span>
            <h2 className="section-title">
              {isArabic
                ? 'رؤية واحدة، فريق واحد، حل واحد يحقق النتائج'
                : 'One Vision, One Team, Measurable Outcomes'}
            </h2>
            <p
              style={{
                fontSize: '1.0625rem',
                color: 'var(--text-secondary)',
                maxWidth: '700px',
                marginBlock: '0.75rem 0',
                lineHeight: 1.7,
              }}
            >
              {isArabic
                ? 'من الأفكار الجريئة إلى التنفيذ الموثوق — نتبع منهجية هندسية واضحة تضمن تسليم المشاريع بدقة متناهية.'
                : 'From ambitious ideas to reliable delivery — our engineering rigor ensures projects launch on time and on spec.'}
            </p>
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

      {/* 6. Corporate Values */}
      <section className="container" style={{ marginBlockEnd: '5rem' }}>
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'ثقافة موهبة // قيمنا الراسخة' : 'AGENCY CULTURE // CORE VALUES'}
          </span>
          <h2 className="section-title">
            {isArabic
              ? 'نؤمن أن أعظم الإنجازات تأتي من التعاون والتميز المستمر'
              : 'Breakthroughs Built on Collaboration & Relentless Excellence'}
          </h2>
        </div>

        <div className="values-grid-4">
          {agencyValues.map((val, idx) => (
            <div key={idx} className="value-card">
              <h3 className="value-title">
                {isArabic ? val.titleAr : val.titleEn}
              </h3>
              <p className="value-desc">
                {isArabic ? val.descAr : val.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. High-Impact Corporate CTA Banner */}
      <div className="container">
        <section className="cta-banner-section">
          <div className="cta-banner-inner">
            <h2 className="cta-banner-title">
              {isArabic ? 'قم بتحويل علامتك التجارية اليوم!' : 'Transform Your Brand Today'}
            </h2>
            <p className="cta-banner-desc">
              {isArabic
                ? 'نصمم الهويات الرقمية، نطور المنصات المتقدمة، ونقود حملات النمو، ونورّد هدايا ومطبوعات الشركات بأعلى معايير الدقة والالتزام.'
                : 'We design brand architectures, engineer advanced platforms, lead growth campaigns, and manufacture executive merchandise with unwavering precision.'}
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
                <span>{isArabic ? 'تواصل مع فريقنا الآن' : 'Contact Our Directors'}</span>
                <ArrowIcon size={16} />
              </Link>
              <Link
                href={isArabic ? '/ar/store' : '/en/store'}
                className="btn-outline btn-lg"
                style={{
                  color: 'var(--text-inverted)',
                  borderColor: 'var(--border-strong)',
                }}
              >
                <span>{isArabic ? 'استعرض متجر الهدايا (B2B)' : 'Browse B2B Store'}</span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
