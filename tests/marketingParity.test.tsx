import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import HomePage, { generateMetadata } from '@/app/(frontend)/[locale]/page';
import { agencyClients, agencyServices, agencyWorkflow } from '@/shared/data/agencyData';

describe('Phase 10.1: Homepage Parity & Agency Corporate Marketing Suite', () => {
  it('generates accurate authentic metadata for Arabic and English', async () => {
    const metaAr = await generateMetadata({ params: Promise.resolve({ locale: 'ar' }) });
    expect(metaAr.title).toContain('العلامات التجارية المبتكرة تبدأ من هنا');
    expect(metaAr.description).toContain('وكالة رائدة في مصر');

    const metaEn = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });
    expect(metaEn.title).toContain('Intelligent Brands Start Here');
    expect(metaEn.description).toContain('Leading creative agency in Egypt');
  });

  it('renders authentic Hero section in Arabic with correct headline, copy, and CTAs', async () => {
    const component = await HomePage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    // Hero title
    expect(html).toContain('العلامات التجارية المبتكرة تبدأ من هنا');
    // Hero eyebrow
    expect(html).toContain('مرحباً بكم في وكالة موهبة');
    // CTAs
    expect(html).toContain('ابدأ مشروعك / طلب استشارة');
    expect(html).toContain('/ar/contact');
    expect(html).toContain('استكشف خدماتنا الست');
    expect(html).toContain('متجر هدايا الشركات (B2B)');
    expect(html).toContain('/ar/store');
  });

  it('renders authentic Hero section in English with correct headline, copy, and CTAs', async () => {
    const component = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
    const html = renderToString(component);

    expect(html).toContain('Intelligent Brands Start Here');
    expect(html).toContain('Welcome to MWHEBA Agency');
    expect(html).toContain('Start Your Project');
    expect(html).toContain('/en/contact');
    expect(html).toContain('Explore Our 6 Disciplines');
    expect(html).toContain('Corporate Store (B2B)');
    expect(html).toContain('/en/store');
  });

  it('renders all 6 core agency services on the homepage', async () => {
    const componentAr = await HomePage({ params: Promise.resolve({ locale: 'ar' }) });
    const htmlAr = renderToString(componentAr);

    // Verify all 6 services are present in Arabic
    expect(htmlAr).toContain('هوية العلامة التجارية');
    expect(htmlAr).toContain('استضافة وتطوير المواقع');
    expect(htmlAr).toContain('إنتاج الوسائط والفيديو');
    expect(htmlAr).toContain('تصميم واجهة وتجربة المستخدم');
    expect(htmlAr).toContain('التسويق الرقمي واستراتيجيات النمو');
    expect(htmlAr).toContain('الطباعة وهدايا كبار الشخصيات');

    // Printing links to /ar/store
    expect(htmlAr).toContain('/ar/store');
    // Brand identity links to /ar/services/brand-identity
    expect(htmlAr).toContain('/ar/services/brand-identity');

    const componentEn = await HomePage({ params: Promise.resolve({ locale: 'en' }) });
    const htmlEn = renderToString(componentEn);

    expect(htmlEn).toContain('Brand Identity Systems');
    expect(htmlEn).toContain('Web Development &amp; Platforms');
    expect(htmlEn).toContain('Media &amp; Video Production');
    expect(htmlEn).toContain('UI/UX Experience Design');
    expect(htmlEn).toContain('Performance Digital Marketing');
    expect(htmlEn).toContain('Printing &amp; Corporate Merchandise');
  });

  it('renders all 22 authentic enterprise client logos with valid attributes', async () => {
    const component = await HomePage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(agencyClients.length).toBe(22);

    for (const client of agencyClients) {
      expect(html).toContain(client.logoPath);
      expect(html).toContain(client.nameAr);
    }
  });

  it('renders the 4-step creative and technical workflow process', async () => {
    const component = await HomePage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(agencyWorkflow.length).toBe(4);
    expect(html).toContain('01');
    expect(html).toContain('02');
    expect(html).toContain('03');
    expect(html).toContain('04');
    expect(html).toContain('اكتشاف الأفكار وتحليل المتطلبات');
    expect(html).toContain('التخطيط الاستراتيجي وهندسة الحل');
    expect(html).toContain('التنفيذ الإبداعي والبرمجي المتكامل');
    expect(html).toContain('الإطلاق الفني والتسليم والقياس');
  });

  it('renders the high-impact conversion CTA banner', async () => {
    const component = await HomePage({ params: Promise.resolve({ locale: 'ar' }) });
    const html = renderToString(component);

    expect(html).toContain('قم بتحويل علامتك التجارية اليوم!');
    expect(html).toContain('تواصل مع فريقنا الآن');
    expect(html).toContain('استعرض متجر الهدايا (B2B)');
  });
});
