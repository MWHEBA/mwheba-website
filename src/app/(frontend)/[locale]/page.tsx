import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidLocale } from '@/shared/lib/i18n';
import {
  BrandingIcon,
  MerchandiseIcon,
  WebPlatformsIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@/shared/ui/icons';

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

  return (
    <div className="container">
      {/* Hero Section */}
      <section className="hero-section">
        <div>
          <span className="hero-eyebrow">
            <ShieldCheckIcon size={14} />
            <span>{isArabic ? 'وكالة دعاية وإنتاج للشركات والمؤسسات' : 'B2B Creative Agency & Corporate Merchandise'}</span>
          </span>
        </div>

        <h1 className="hero-title">
          {isArabic
            ? 'تصميم الهوية التجارية، تطوير المنصات وهدايا الشركات'
            : 'Brand Architecture, Digital Platforms & Corporate Merchandise'}
        </h1>

        <p className="hero-description">
          {isArabic
            ? 'نساعد الشركات الرائدة على بناء حضور رقمي استثنائي، وتوريد هدايا ترويجية ومطبوعات دعائية مخصصة بأعلى معايير الجودة والالتزام الهندسي بالحد الأدنى للطلب (MOQ).'
            : 'We empower ambitious enterprises with authoritative branding, modern web platforms, and tailored corporate merchandise manufactured to rigorous standards.'}
        </p>

        <div className="hero-actions">
          <Link
            href={isArabic ? '/ar/design-system' : '/en/design-system'}
            className="btn-primary btn-lg"
          >
            <span>{isArabic ? 'استكشف نظام التصميم والمكونات' : 'Explore Design System'}</span>
            <ArrowIcon size={16} />
          </Link>
          <Link
            href={isArabic ? '/ar/services' : '/en/services'}
            className="btn-secondary btn-lg"
          >
            {isArabic ? 'الخدمات الرقمية والإنتاجية' : 'Digital Services'}
          </Link>
        </div>
      </section>

      {/* Metrics Strip */}
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-value">10+</span>
          <span className="metric-label">
            {isArabic ? 'سنوات من الخبرة الإنتاجية والهندسية' : 'Years of Production Engineering'}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-value">100%</span>
          <span className="metric-label">
            {isArabic ? 'التزام حازم بضوابط الحد الأدنى (MOQ)' : 'Server-Enforced MOQ Governance'}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-value">100+</span>
          <span className="metric-label">
            {isArabic ? 'كيان تجاري ومؤسسة في السوق المصري' : 'Enterprise Clients & Institutions'}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-value">WCAG AA</span>
          <span className="metric-label">
            {isArabic ? 'امتثال تام لمعايير سهولة الوصول والتباين' : 'Full Accessibility & Contrast Verified'}
          </span>
        </div>
      </div>

      {/* Feature Pillar Cards */}
      <section className="pillars-section">
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'مجالات العمل الرئيسية' : 'CORE CAPABILITIES'}
          </span>
          <h2 className="section-title">
            {isArabic ? 'حلول مؤسسية متكاملة للعلامات التجارية' : 'Integrated Enterprise Solutions'}
          </h2>
        </div>

        <div className="pillars-grid">
          {/* Pillar 1 */}
          <div className="pillar-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span className="pillar-num">01 // {isArabic ? 'الهوية المؤسسية' : 'BRAND IDENTITY'}</span>
              <span style={{ color: 'var(--brand-primary-dark)', display: 'inline-flex', padding: '0.5rem', backgroundColor: 'var(--status-info-bg)', borderRadius: 'var(--radius-sm)' }}>
                <BrandingIcon size={20} />
              </span>
            </div>
            <h3 className="pillar-title">
              {isArabic ? 'العلامات التجارية والمطبوعات' : 'Corporate Identity Systems'}
            </h3>
            <p className="pillar-text">
              {isArabic
                ? 'تصميم أنظمة هوية متكاملة تشمل أدلة العلامة، الألوان، الخطوط، والمطبوعات الإدارية الموحدة.'
                : 'Complete brand guidelines, design systems, stationery, and corporate communication architecture.'}
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="pillar-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span className="pillar-num">02 // {isArabic ? 'هدايا الشركات' : 'COMMERCE & MOQ'}</span>
              <span style={{ color: 'var(--brand-primary-dark)', display: 'inline-flex', padding: '0.5rem', backgroundColor: 'var(--status-info-bg)', borderRadius: 'var(--radius-sm)' }}>
                <MerchandiseIcon size={20} />
              </span>
            </div>
            <h3 className="pillar-title">
              {isArabic ? 'التجارة وهدايا الـ B2B' : 'Wholesale Giveaways'}
            </h3>
            <p className="pillar-text">
              {isArabic
                ? 'أكواب حرارية، أدوات مكتبية، وهدايا دعائية مع حوكمة صارمة للحد الأدنى (10 قطع لكل منتج) وتخصيص الطباعة.'
                : 'Thermal mugs, notebooks, and corporate giveaways governed by rigid server-enforced minimum order quantities.'}
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="pillar-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <span className="pillar-num">03 // {isArabic ? 'هندسة المنصات' : 'WEB PLATFORMS'}</span>
              <span style={{ color: 'var(--brand-primary-dark)', display: 'inline-flex', padding: '0.5rem', backgroundColor: 'var(--status-info-bg)', borderRadius: 'var(--radius-sm)' }}>
                <WebPlatformsIcon size={20} />
              </span>
            </div>
            <h3 className="pillar-title">
              {isArabic ? 'هندسة الويب والمنصات' : 'Headless Architecture'}
            </h3>
            <p className="pillar-text">
              {isArabic
                ? 'منصات فائقة السرعة مبنية بأحدث تقنيات Next.js مع تكامل سلس لأنظمة إدارة المحتوى وقواعد بيانات آمنة.'
                : 'Enterprise-grade headless platforms powered by Next.js and PostgreSQL with strict accessibility and performance.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
