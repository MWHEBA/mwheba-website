import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLocale } from '@/shared/lib/i18n';
import { ContactInquiryForm } from '@/modules/content/ui/ContactInquiryForm';

interface ContactPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: ContactPageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isValidLocale(locale)) return {};

  const isArabic = locale === 'ar';
  const title = isArabic
    ? 'تواصل معنا واستفسارات المشروعات | وكالة موهبة'
    : 'Contact Us & Project Inquiries | MWHEBA Agency';
  const description = isArabic
    ? 'تواصل مع مستشاري وكالة موهبة لمناقشة هوية شركتك، حملاتك التسويقية، أو طلبات الهدايا المؤسسية والإنتاج المرئي في مصر والشرق الأوسط.'
    : 'Get in touch with MWHEBA Agency consultants to discuss your brand identity, growth campaigns, corporate gifts, and video production.';

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

  return (
    <div className="contact-page-wrapper" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header Banner */}
      <section
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-default)',
          paddingBlock: '4.5rem 4rem',
        }}
      >
        <div className="container" style={{ maxWidth: '1000px', marginInline: 'auto', textAlign: 'center', paddingInline: '1.5rem' }}>
          <span
            style={{
              display: 'inline-block',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-muted)',
              color: 'var(--brand-primary)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}
          >
            {isArabic ? 'بدء شراكة جديدة' : 'Start a Partnership'}
          </span>
          <h1
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              lineHeight: 1.25,
              margin: '0 0 1.25rem 0',
            }}
          >
            {isArabic ? 'دعنا نبني هوية تلهم السوق وتحقق النمو' : 'Let Us Build an Inspiring, Enduring Brand'}
          </h1>
          <p
            style={{
              fontSize: '1.125rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              maxWidth: '750px',
              margin: '0 auto',
            }}
          >
            {isArabic
              ? 'شاركنا تفاصيل مشروعك أو أهداف شركتك القادمة، وسيقوم فريق الاستشارات التسويقية والإنتاجية بدراسة الاحتياجات والتواصل معك لترتيب جلسة عمل.'
              : 'Share your upcoming project goals, and our strategic advisory and production team will review your requirements and schedule an in-depth discovery call.'}
          </p>
        </div>
      </section>

      {/* Main Grid: Info + Form */}
      <div className="container" style={{ maxWidth: '1140px', marginInline: 'auto', paddingInline: '1.5rem', paddingBlock: '4rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '3rem',
            alignItems: 'start',
          }}
        >
          {/* Direct Agency Coordinates */}
          <div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
              }}
            >
              {isArabic ? 'قنوات التواصل المباشرة' : 'Direct Channels'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {isArabic ? 'المقر الرئيسي' : 'Headquarters'}
                </div>
                <div>{isArabic ? 'القاهرة، جمهورية مصر العربية' : 'Cairo, Arab Republic of Egypt'}</div>
              </div>

              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {isArabic ? 'البريد المؤسسي' : 'Corporate Email'}
                </div>
                <div>sales@mwheba.com</div>
              </div>

              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  {isArabic ? 'ساعات العمل' : 'Working Hours'}
                </div>
                <div>{isArabic ? 'الأحد - الخميس: 9:00 ص - 6:00 م (بتوقيت القاهرة)' : 'Sunday - Thursday: 9:00 AM - 6:00 PM (Cairo Time)'}</div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div>
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '1.5rem',
              }}
            >
              {isArabic ? 'طلب استشارة أو عرض أسعار' : 'Request a Proposal or Consultation'}
            </h2>
            <ContactInquiryForm locale={locale as 'ar' | 'en'} />
          </div>
        </div>
      </div>
    </div>
  );
}
