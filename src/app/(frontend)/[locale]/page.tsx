import Link from 'next/link';
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
  ArrowUpRightIcon,
} from '@/shared/ui/icons';
import {
  agencyClients,
  agencyServices,
  agencyWorkflow,
  agencyStats,
  agencyValues,
} from '@/shared/data/agencyData';
import {
  Eyebrow,
  VisualRibbon,
  Ticker,
  PathwaysGrid,
  LiveProofStage,
  ProductShowcaseCard,
  InquiryCtaSection,
  SelectedWorkSection,
  CorporateShortlistDrawer,
  AnimatedCounter,
  AnimatedText,
} from '@/shared/ui/studio';

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
      {/* 1. Studio Editorial Hero Section (Identical to mwheba-visual-redesign-v6-smooth.html) */}
      <section className="hero" id="top">
        <div className="container" style={{ width: '100%' }}>
          <div className="hero-copy">
            <div
              className="eyebrow reveal-on-scroll"
              data-aos="fade-up-sm"
              data-aos-delay="100"
            >
              {isArabic
                ? 'مرحباً بكم في وكالة موهبة // استوديو إبداعي ومنتجات دعائية للشركات'
                : 'Welcome to MWHEBA Agency // INDEPENDENT CREATIVE & MERCHANDISE STUDIO'}
            </div>

            <AnimatedText
              as="h1"
              className="display"
              delay={0.2}
              stagger={0.045}
              duration={0.65}
              text={isArabic ? 'العلامات التجارية المبتكرة تبدأ من هنا.' : 'Intelligent Brands Start Here.'}
            />

            <p
              className="hero-description reveal-on-scroll"
              data-aos="fade-up-sm"
              data-aos-delay="400"
            >
              {isArabic
                ? 'نساعد الشركات والمؤسسات الطموحة على بناء حضور رقمي وبصري استثنائي وتحقيق نتائج ملموسة عبر تصميم الهوية التجارية، تطوير منصات الويب الحديثة، إنتاج المحتوى المرئي، وحملات النمو الرقمي، إلى جانب توريد وتصنيع هدايا الشركات والمطبوعات الدعائية بأعلى معايير الجودة والالتزام الهندسي بالحد الأدنى للطلب (MOQ).'
                : 'We empower forward-thinking enterprises with Brand Architecture, Digital Platforms, cinematic media production, targeted digital growth, and tailored corporate merchandise manufactured to rigorous standards.'}
            </p>

            <div
              className="hero-actions reveal-on-scroll"
              data-aos="fade-up-sm"
              data-aos-delay="550"
            >
              <Link
                href={isArabic ? '/ar/contact' : '/en/contact'}
                className="dark-btn magnetic"
              >
                <span>{isArabic ? 'ابدأ مشروعك / طلب استشارة' : 'Start Your Project'}</span>
                <ArrowUpRightIcon size={16} />
              </Link>

              <a href="#services" className="link-btn">
                <span>{isArabic ? 'استكشف خدماتنا الست' : 'Explore Our 6 Disciplines'}</span>
              </a>

              <Link
                href={isArabic ? '/ar/store' : '/en/store'}
                className="link-btn"
              >
                <span>{isArabic ? 'متجر هدايا الشركات (B2B)' : 'Corporate Store (B2B)'}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Hero Visual Studio Showcase */}
        <div
          className="hero-visual reveal-on-scroll"
          id="heroVisual"
          data-aos="fade-in"
          data-aos-delay="150"
          aria-label="Studio composition of branded merchandise"
        >
          <div className="studio-floor"></div>
          <div
            className="object notebook reveal-on-scroll"
            data-aos="reveal-anim-left"
            data-aos-delay="300"
          >
            <span>MWHEBA<span style={{ color: 'var(--color-brand-red)' }}>.</span></span>
          </div>
          <div
            className="object mug reveal-on-scroll"
            data-aos="reveal-anim-up"
            data-aos-delay="450"
          >
            <div className="mug-lid"></div>
            <div className="mug-body"></div>
            <div className="mug-base"></div>
          </div>
          <div
            className="object giftbox reveal-on-scroll"
            data-aos="reveal-anim-right"
            data-aos-delay="600"
          ></div>
          <div
            className="floating-label tag1 reveal-on-scroll"
            data-aos="fade-up-sm"
            data-aos-delay="750"
          >
            <CheckIcon size={13} style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--color-brand-red)' }} />{' '}
            {isArabic ? 'مخصصة لهوية شركتك' : 'MADE FOR YOUR BRAND'}
          </div>
          <div
            className="floating-label tag2 reveal-on-scroll"
            data-aos="fade-up-sm"
            data-aos-delay="900"
          >
            {isArabic ? 'الحد الأدنى 10 وحدات' : 'MINIMUM 10 UNITS'}
          </div>
          <div
            className="floating-label tag3 reveal-on-scroll"
            data-aos="fade-up-sm"
            data-aos-delay="1050"
          >
            {isArabic ? 'من الفكرة إلى المنتج ↗' : 'FROM IDEA TO OBJECT ↗'}
          </div>
        </div>

        <div className="hero-index reveal-on-scroll" data-aos="fade-in" data-aos-delay="1200">
          01 / THE MWHEBA UNIVERSE
        </div>
        <a href="#pathways" className="scrollcue reveal-on-scroll" data-aos="fade-in" data-aos-delay="1200">
          <span>{isArabic ? 'مرر للاستكشاف' : 'SCROLL TO EXPLORE'}</span>
          <span className="line"></span> ↓
        </a>
      </section>

      {/* 2. Studio Capability Ticker */}
      <Ticker />

      {/* 3. Studio Visual Ribbon */}
      <VisualRibbon
        primaryText={isArabic ? 'صُممت لتتميز' : 'DESIGNED TO STAND OUT'}
        middleText={isArabic ? 'إبداع × تجارة مؤسسية' : 'CREATIVE × COMMERCE'}
        endText={isArabic ? 'صُنع في مصر' : 'MADE IN EGYPT'}
      />

      {/* 4. Dual Pathways (Two Sides. One Vision.) */}
      <section className="section" id="services">
        <div className="container">
          <div className="section-heading reveal-on-scroll">
            <div>
              <span className="section-number">{isArabic ? '02 / رؤية واحدة لمسارين' : '02 / TWO SIDES. ONE VISION.'}</span>
              <AnimatedText
                as="h2"
                className="display"
                delay={0.1}
                stagger={0.06}
                text={isArabic ? 'اجعلها لا تُنسى.' : 'MAKE IT UNFORGETTABLE.'}
              />
            </div>
            <p className="reveal-on-scroll" style={{ transitionDelay: '0.2s' }}>
              {isArabic
                ? 'سواء كنت تبني هوية علامتك التجارية أو تضعها في أيدي عملائك، نمنحك تجربة استثنائية متكاملة.'
                : 'Whether you are building a brand or putting it in someone’s hands, we make the entire experience feel considered.'}
            </p>
          </div>

        <PathwaysGrid
          items={[
            {
              number: isArabic ? '01 / الاستوديو الإبداعي' : '01 / THE CREATIVE STUDIO',
              title: isArabic ? 'أفكار تستحق الحديث عنها.' : 'Ideas worth talking about.',
              description: isArabic
                ? 'تصميم الهويات، المنصات الرقمية، الحملات الإعلانية وصناعة المحتوى لدفع أعمالك للأمام.'
                : 'Brand identity, campaigns, digital experiences and content built to move your business forward.',
              href: isArabic ? '/ar/services' : '/en/services',
              isDark: false,
            },
            {
              number: isArabic ? '02 / متجر هدايا الشركات' : '02 / THE CORPORATE STORE',
              title: isArabic ? 'منتجات تستحق الاقتناء.' : 'Objects worth keeping.',
              description: isArabic
                ? 'منتجات دعائية فاخرة، أطقم هدايا مكتبية متكاملة مصممة لأثر حقيقي ودائم.'
                : 'Premium branded merchandise, thoughtful gift sets and corporate swag, made for real-world impact.',
              href: isArabic ? '/ar/store' : '/en/store',
              isDark: true,
            },
          ]}
        />
        </div>
      </section>

      {/* 5. The Objects / Curated B2B Products (Matching mwheba-visual-redesign-v6-smooth.html) */}
      <section className="section" id="products" style={{ paddingTop: '35px' }}>
        <div className="container" style={{ maxWidth: '1550px' }}>
          <div className="section-heading reveal-on-scroll">
            <div>
              <span className="section-number">{isArabic ? '03 / المنتجات المختارة' : '03 / THE OBJECTS'}</span>
              <AnimatedText
                as="h2"
                className="display"
                delay={0.1}
                stagger={0.06}
                text={isArabic ? 'تصميم متقن. بين يديك.' : 'GOOD DESIGN. IN YOUR HANDS.'}
              />
            </div>
            <p className="reveal-on-scroll" style={{ transitionDelay: '0.2s' }}>
              {isArabic
                ? 'نماذج منتقاة من هدايا ومطبوعات الشركات. حدد الكمية المناسبة وأضفها لطلب عرض السعر.'
                : 'Explore a curated starting point. Choose quantities, build your shortlist and request a tailored corporate quote.'}
            </p>
          </div>

          <div className="products">
            <ProductShowcaseCard
              id="prod-thermal-tumbler"
              title="Executive Thermal Tumbler"
              category="BEST FOR DAILY USE"
              imageUrl="https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=850&q=85"
              minQuantity={10}
              delay={100}
            />
            <ProductShowcaseCard
              id="prod-signature-notebook"
              title="Signature Notebook Set"
              category="MOST VERSATILE"
              imageUrl="https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=850&q=85"
              minQuantity={10}
              delay={220}
            />
            <ProductShowcaseCard
              id="prod-tech-gift-kit"
              title="Executive Tech Gift Kit"
              category="EXECUTIVE EDITION"
              isTechKit={true}
              minQuantity={10}
              delay={340}
            />
          </div>

          <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '20px' }}>
            {isArabic
              ? 'الصور تمثل نماذج استرشادية. تتوفر خيارات التشطيب وتطريز الهوية والأسعار النهائية عند طلب عرض السعر.'
              : 'Visuals are illustrative references. Product availability, finishes, branding methods and prices are confirmed during quotation.'}
          </p>
        </div>
      </section>

      {/* 6. Live Mockup Proof Studio (Matching mwheba-visual-redesign-v6-smooth.html) */}
      <section className="section feature" id="customize">
        <div className="container">
          <LiveProofStage />
        </div>
      </section>

      {/* 7. Key Metrics Strip (With Animated Counter Micro-Interactions) */}
      <div className="container" style={{ marginBlockEnd: '5rem' }}>
        <div className="metrics-grid">
          {agencyStats.map((stat, idx) => {
            const numMatch = stat.value.match(/\d+/);
            const num = numMatch ? parseInt(numMatch[0], 10) : 0;
            const suffix = stat.value.replace(/\d+/, '');

            return (
              <div
                key={idx}
                className="metric-item reveal-on-scroll"
                data-aos="fade-up-sm"
                data-aos-delay={(idx + 1) * 100}
              >
                <span className="metric-value">
                  <AnimatedCounter value={num} suffix={suffix} locale={locale} />
                </span>
                <span className="metric-label">
                  {isArabic ? stat.labelAr : stat.labelEn}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. Core Services Grid */}
      <section id="capabilities" className="container" style={{ marginBlockEnd: '6rem' }}>
        <div className="section-header reveal-on-scroll" data-aos="reveal-anim-up">
          <Eyebrow>
            {isArabic ? '05 / مجالات العمل الرئيسية' : '05 / CORE CAPABILITIES'}
          </Eyebrow>
          <h2 className="section-title" style={{ marginBlockStart: '0.75rem' }}>
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
                className="service-card reveal-on-scroll"
                data-aos="fade-up-sm"
                data-aos-delay={(index + 1) * 100}
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

      {/* 9. Enterprise Client Logos Wall (22 Authentic Logos) */}
      <section className="clients-section">
        <div className="container">
          <div className="section-header reveal-on-scroll" data-aos="fade-up-sm" style={{ textAlign: 'center', maxWidth: '800px', marginInline: 'auto' }}>
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
            {agencyClients.map((client, cIdx) => (
              <div
                key={client.id}
                className="client-logo-item reveal-on-scroll"
                data-aos="fade-in"
                data-aos-delay={(cIdx % 6) * 60}
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

      {/* 10. Section 05 / Creative Possibilities (Selected Studio Work from v6) */}
      <SelectedWorkSection locale={locale} />

      {/* 11. Section 06 / NO COMPLICATIONS - Studio Process Workflow from v6 */}
      <section className="section" id="process" style={{ backgroundColor: 'var(--bg-surface)', padding: 'clamp(70px, 7vw, 110px) 0' }}>
        <div className="container">
          <div className="section-heading reveal-on-scroll">
            <div>
              <span className="section-number">
                {isArabic ? '06 / سير العمل والمنهجية' : '06 / NO COMPLICATIONS'}
              </span>
              <AnimatedText
                as="h2"
                className="display"
                delay={0.1}
                stagger={0.06}
                text={isArabic ? 'خطوات مدروسة. ونتائج استثنائية.' : 'SIMPLE PROCESS. SERIOUS IMPACT.'}
              />
            </div>
            <p className="reveal-on-scroll" style={{ transitionDelay: '0.2s' }}>
              {isArabic
                ? 'من الأفكار الجريئة إلى التنفيذ الموثوق — نتبع منهجية هندسية واضحة تضمن تسليم المشاريع بدقة متناهية.'
                : 'From ambitious ideas to reliable delivery — our engineering rigor ensures projects launch on time and on spec.'}
            </p>
          </div>

          <div className="process">
            {agencyWorkflow.map((flow, fIdx) => (
              <div
                key={flow.step}
                className="step reveal-on-scroll"
                data-aos="reveal-anim-up"
                data-aos-delay={(fIdx + 1) * 120}
                style={{ transitionDelay: `${fIdx * 0.1}s` }}
              >
                <span>{flow.step} / {isArabic ? flow.titleAr : flow.titleEn}</span>
                <h3>{isArabic ? flow.titleAr : flow.titleEn}</h3>
                <p>{isArabic ? flow.descAr : flow.descEn}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 12. Corporate Values */}
      <section className="container" style={{ marginBlockEnd: '5rem', marginBlockStart: '4rem' }}>
        <div className="section-header reveal-on-scroll" data-aos="fade-up-sm">
          <span className="section-eyebrow">
            {isArabic ? 'ثقافة موهبة // قيمنا الراسخة' : 'AGENCY CULTURE // CORE VALUES'}
          </span>
          <AnimatedText
            as="h2"
            className="section-title"
            delay={0.1}
            stagger={0.04}
            text={isArabic
              ? 'نؤمن أن أعظم الإنجازات تأتي من التعاون والتميز المستمر'
              : 'Breakthroughs Built on Collaboration & Relentless Excellence'}
          />
        </div>

        <div className="values-grid-4">
          {agencyValues.map((val, idx) => (
            <div
              key={idx}
              className="value-card reveal-on-scroll"
              data-aos="fade-up-sm"
              data-aos-delay={((idx % 4) + 1) * 100}
              style={{ transitionDelay: `${(idx % 4) * 0.08}s` }}
            >
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

      {/* 13. Section 07 / LET'S MAKE SOMETHING - High-Impact Interactive Inquiry CTA */}
      <InquiryCtaSection locale={locale} />

      {/* 14. Interactive Shortlist Drawer & Toast System from v6 */}
      <CorporateShortlistDrawer locale={locale} />
    </div>
  );
}
