import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ContactPage, { generateMetadata, generateStaticParams } from '@/app/(frontend)/[locale]/contact/page';

describe('Phase 10.4: High-Trust Contact Page Suite (/contact)', () => {
  it('generates static params for all supported locales', () => {
    const params = generateStaticParams();
    expect(params).toEqual([{ locale: 'ar' }, { locale: 'en' }]);
  });

  it('generates authentic metadata containing official Alexandria coordinates', async () => {
    const metaAr = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
    expect(metaAr.title).toContain('تواصل معنا');
    expect(metaAr.description).toContain('الإسكندرية');
    expect(metaAr.description).toContain('01010944010');
    expect(metaAr.description).toContain('ميامي');

    const metaEn = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(metaEn.title).toContain('Contact Us');
    expect(metaEn.description).toContain('Alexandria, Egypt');
    expect(metaEn.description).toContain('01010944010');
  });

  it('renders authentic Alexandria headquarters address in Arabic and English', async () => {
    const componentAr = await ContactPage({ params: Promise.resolve({ locale: 'ar' }) });
    const htmlAr = renderToString(componentAr);

    expect(htmlAr).toContain('المقر الرئيسي بالإسكندرية');
    expect(htmlAr).toContain('ميامي، شارع إسكندر إبراهيم، الإسكندرية');

    const componentEn = await ContactPage({ params: Promise.resolve({ locale: 'en' }) });
    const htmlEn = renderToString(componentEn);

    expect(htmlEn).toContain('Alexandria Headquarters');
    expect(htmlEn).toContain('Miami, Iskander Ibrahim St., Alexandria, Egypt');
  });

  it('renders official telephone lines and WhatsApp quick action buttons', async () => {
    const component = await ContactPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(html).toContain('tel:+201010944010');
    expect(html).toContain('01010944010');
    expect(html).toContain('01229609292');
    expect(html).toContain('https://wa.me/201010944010');
    expect(html).toContain('mailto:info@mwheba.com');
  });

  it('renders authentic working hours and enterprise SLA commitment', async () => {
    const component = await ContactPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(html).toContain('10:00 صباحاً – 6:00 مساءً');
    expect(html).toContain('الأحد – الخميس');
    expect(html).toContain('التزام الاستجابة المؤسسية');
    expect(html).toContain('24 ساعة عمل');
  });

  it('renders the embedded contact inquiry form with fields and CSRF/honeypot protection', async () => {
    const component = await ContactPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(html).toContain('fullName');
    expect(html).toContain('email');
    expect(html).toContain('phone');
    expect(html).toContain('companyName');
    expect(html).toContain('serviceInterest');
  });
});
