import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isValidLocale, locales } from '@/shared/lib/i18n';
import { ContactInquiryForm } from '@/modules/content/ui/ContactInquiryForm';
import {
  ShieldCheckIcon,
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  ClockIcon,
  WhatsAppIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  AwardIcon,
} from '@/shared/ui/icons';

interface ContactPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'تواصل معنا واستفسارات المشروعات | وكالة موهبة'
    : 'Contact Us & Enterprise Inquiries | MWHEBA Agency';
  const description = isArabic
    ? 'تواصل مع مستشاري وكالة موهبة بالإسكندرية: هواتفنا (+2) 01010944010 - 01229609292، مقرنا بميامي شارع إسكندر إبراهيم، أو اطلب استشارة لتطوير علامتك التجارية ومنصاتك الرقمية.'
    : 'Connect with MWHEBA Agency directors in Alexandria, Egypt: direct phones (+2) 01010944010, Miami HQ, or submit your corporate brief for branding, web engineering, and merchandise.';

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

export default async function ContactPage({ params }: ContactPageProps) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const isArabic = locale === 'ar';
  const ArrowIcon = isArabic ? ArrowLeftIcon : ArrowRightIcon;

  return (
    <div className="contact-page-wrapper">
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
                  {isArabic ? 'تواصل معنا' : 'Contact Us'}
                </span>
              </li>
            </ol>
          </nav>

          <span className="service-detail-eyebrow">
            <ShieldCheckIcon size={14} />
            <span>
              {isArabic
                ? 'المقر الرئيسي وخدمة العملاء // الإسكندرية، مصر'
                : 'HEADQUARTERS & CLIENT ADVISORY // ALEXANDRIA, EGYPT'}
            </span>
          </span>

          <h1 className="service-detail-title">
            {isArabic ? 'هيا نتحدث عن مشروعك القادم' : 'Let’s Discuss Your Next Strategic Move'}
          </h1>

          <p className="service-detail-summary">
            {isArabic
              ? 'يسعدنا دائماً استقبال استفساراتكم وترتيب جلسات عمل استشارية لمناقشة أهداف علامتك التجارية، تطوير منصات الويب، إنتاج المحتوى السينمائي، أو توريد وتخصيص هدايا الشركات والمطبوعات بأعلى معايير الجودة.'
              : 'We welcome enterprise inquiries and are ready to host discovery sessions to review your brand objectives, web platform specifications, cinematic media, or tailored corporate merchandise.'}
          </p>
        </div>
      </section>

      {/* 2. Instant Action Quick-Connect Bar */}
      <div className="container" style={{ marginBlockStart: '3.5rem' }}>
        <div className="quick-action-bar">
          {/* Quick Call */}
          <a href="tel:+201010944010" className="quick-action-card">
            <div className="quick-action-icon">
              <PhoneIcon size={22} />
            </div>
            <div className="quick-action-content">
              <span className="quick-action-label">{isArabic ? 'اتصال هاتفي مباشر' : 'Direct Call'}</span>
              <span className="quick-action-value">(+2) 01010944010</span>
            </div>
          </a>

          {/* WhatsApp Direct */}
          <a
            href="https://wa.me/201010944010"
            target="_blank"
            rel="noopener noreferrer"
            className="quick-action-card"
          >
            <div className="quick-action-icon" style={{ color: 'var(--status-success)', backgroundColor: 'var(--status-success-bg)' }}>
              <WhatsAppIcon size={22} />
            </div>
            <div className="quick-action-content">
              <span className="quick-action-label">{isArabic ? 'محادثة فورية واتساب' : 'WhatsApp Chat'}</span>
              <span className="quick-action-value">{isArabic ? 'تواصل مع المستشار' : 'Chat With Advisory'}</span>
            </div>
          </a>

          {/* Official Email */}
          <a href="mailto:info@mwheba.com" className="quick-action-card">
            <div className="quick-action-icon">
              <MailIcon size={22} />
            </div>
            <div className="quick-action-content">
              <span className="quick-action-label">{isArabic ? 'البريد المؤسسي' : 'Corporate Email'}</span>
              <span className="quick-action-value">info@mwheba.com</span>
            </div>
          </a>
        </div>
      </div>

      {/* 3. Main Grid: Info Cards + Inquiry Form */}
      <section className="container" style={{ paddingBlockEnd: '6rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '3rem',
            alignItems: 'start',
          }}
        >
          {/* Left Column: Authentic Channels */}
          <div>
            <div className="section-header" style={{ marginBlockEnd: '2rem' }}>
              <span className="section-eyebrow">
                {isArabic ? 'قنوات الاتصال // المقر الرسمي' : 'OFFICIAL CHANNELS // HEADQUARTERS'}
              </span>
              <h2 className="section-title" style={{ fontSize: '1.5rem' }}>
                {isArabic ? 'بيانات التواصل والمقر' : 'Corporate Coordinates'}
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Headquarters Address Card */}
              <div className="contact-channel-card">
                <div className="contact-channel-icon">
                  <MapPinIcon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBlock: '0 0.35rem' }}>
                    {isArabic ? 'المقر الرئيسي بالإسكندرية' : 'Alexandria Headquarters'}
                  </h3>
                  <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--text-secondary)', margin: 0 }}>
                    {isArabic
                      ? 'ميامي، شارع إسكندر إبراهيم، الإسكندرية، جمهورية مصر العربية.'
                      : 'Miami, Iskander Ibrahim St., Alexandria, Egypt.'}
                  </p>
                </div>
              </div>

              {/* Direct Phone Lines Card */}
              <div className="contact-channel-card">
                <div className="contact-channel-icon">
                  <PhoneIcon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBlock: '0 0.35rem' }}>
                    {isArabic ? 'خطوط الاتصال الرسمية' : 'Telephone Lines'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <a href="tel:+201010944010" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>
                      (+2) 01010944010 (مكالمات + واتساب الأعمال)
                    </a>
                    <a href="tel:+201229609292" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>
                      (+2) 01229609292
                    </a>
                  </div>
                </div>
              </div>

              {/* Corporate Email Card */}
              <div className="contact-channel-card">
                <div className="contact-channel-icon">
                  <MailIcon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBlock: '0 0.35rem' }}>
                    {isArabic ? 'المراسلات الرسمية' : 'Official Correspondence'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{isArabic ? 'الاستفسارات العامة: ' : 'General Inquiries: '}</span>
                      <a href="mailto:info@mwheba.com" style={{ color: 'var(--brand-primary)' }}>info@mwheba.com</a>
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>{isArabic ? 'المبيعات والتعاقدات: ' : 'Enterprise Sales: '}</span>
                      <a href="mailto:sales@mwheba.com" style={{ color: 'var(--brand-primary)' }}>sales@mwheba.com</a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Hours Card */}
              <div className="contact-channel-card">
                <div className="contact-channel-icon">
                  <ClockIcon size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBlock: '0 0.35rem' }}>
                    {isArabic ? 'ساعات العمل الرسمية' : 'Operating Hours'}
                  </h3>
                  <p style={{ fontSize: '0.875rem', lineHeight: '1.7', color: 'var(--text-secondary)', margin: 0 }}>
                    {isArabic
                      ? 'الأحد – الخميس: 10:00 صباحاً – 6:00 مساءً (بتوقيت القاهرة).'
                      : 'Sunday – Thursday: 10:00 AM – 6:00 PM (Cairo Time).'}
                  </p>
                </div>
              </div>

              {/* SLA Response Guarantee Box */}
              <div className="guarantee-box">
                <h3 className="guarantee-box-title">
                  <AwardIcon size={20} />
                  <span>{isArabic ? 'التزام الاستجابة المؤسسية' : 'Enterprise SLA Commitment'}</span>
                </h3>
                <p className="guarantee-box-desc">
                  {isArabic
                    ? 'نلتزم في وكالة موهبة بمراجعة كافة طلبات المشروعات والاستشارات الواردة والرد خلال 24 ساعة عمل رسمية من قبل أحد الاستشاريين المتخصصين.'
                    : 'We guarantee reviewing all corporate inquiries and issuing an initial consultation assessment within 24 business hours.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Inquiry RFP Form */}
          <div>
            <div className="section-header" style={{ marginBlockEnd: '2rem' }}>
              <span className="section-eyebrow">
                {isArabic ? 'طلب استشارة // تحديد المتطلبات' : 'SUBMIT BRIEF // REQUEST QUOTATION'}
              </span>
              <h2 className="section-title" style={{ fontSize: '1.5rem' }}>
                {isArabic ? 'نموذج تسجيل استفسار مشروع' : 'Project Discovery Form'}
              </h2>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <ContactInquiryForm locale={locale as 'ar' | 'en'} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
