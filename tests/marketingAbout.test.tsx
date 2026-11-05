import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AboutPage, { generateMetadata, generateStaticParams } from '@/app/(frontend)/[locale]/about/page';
import { agencyAboutStats, agencyValues, agencyClients } from '@/shared/data/agencyData';

describe('Phase 10.3: About Page Suite (/about)', () => {
  it('generates static params for all supported locales', () => {
    const params = generateStaticParams();
    expect(params).toEqual([{ locale: 'ar' }, { locale: 'en' }]);
  });

  it('generates authentic metadata for Arabic and English', async () => {
    const metaAr = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
    expect(metaAr.title).toContain('عن موهبة');
    expect(metaAr.description).toContain('وكالة موهبة للحلول الإبداعية');

    const metaEn = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(metaEn.title).toContain('About Us');
    expect(metaEn.description).toContain('MWHEBA Agency: Founded in Alexandria, Egypt');
  });

  it('renders the authentic heritage story and Alexandria roots', async () => {
    const component = await AboutPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(html).toContain('وكالة موهبة للحلول الإبداعية // تأسست بالإسكندرية');
    expect(html).toContain('من الفكر الاستراتيجي إلى الأثر المستدام');
    expect(html).toContain('انطلقت وكالة موهبة من مدينة الإسكندرية');
    expect(html).toContain('رؤية واحدة، فريق واحد، حل متكامل يحقق النتائج');
    expect(html).toContain('عن موهبة');
  });

  it('renders all 4 extended agency performance metrics', async () => {
    const component = await AboutPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(agencyAboutStats.length).toBe(4);
    for (const stat of agencyAboutStats) {
      expect(html).toContain(stat.value);
      expect(html).toContain(stat.labelAr);
    }
  });

  it('renders all 6 authentic corporate values with full descriptions', async () => {
    const component = await AboutPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(agencyValues.length).toBe(6);
    expect(html).toContain('العمل الجماعي أولاً');
    expect(html).toContain('التركيز على العملاء');
    expect(html).toContain('التميز دائماً');
    expect(html).toContain('خلق القيمة الحقيقية');
    expect(html).toContain('القيادة بشجاعة');
    expect(html).toContain('الإتقان فوق التوقعات');
  });

  it('renders all 22 client logos on the about page', async () => {
    const component = await AboutPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(agencyClients.length).toBe(22);
    for (const client of agencyClients) {
      expect(html).toContain(client.logoPath);
    }
  });

  it('renders the high-impact conversion CTA banner', async () => {
    const component = await AboutPage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(html).toContain('جاهز لبناء شراكة ناجحة مع وكالة موهبة؟');
    expect(html).toContain('تواصل مع فريقنا الآن');
    expect(html).toContain('/ar/contact');
  });
});
