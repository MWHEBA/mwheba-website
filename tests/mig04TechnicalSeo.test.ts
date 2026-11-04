import { describe, it, expect } from 'vitest';
import {
  generateOrganizationSchema,
  generateLocalBusinessSchema,
  generateProductSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
} from '../src/shared/lib/schemaGenerator';
import { buildBilingualMetadata, SITE_URL } from '../src/shared/lib/seo';
import { safeJsonLdReplacer } from '../src/shared/lib/safeJsonLd';

describe('MIG-04: Technical SEO, Schema.org Structured Data & Hreflang Governance', () => {
  describe('1. Schema.org Structured Data Generation', () => {
    it('generates valid Organization schema with corporate credentials', () => {
      const arOrg = generateOrganizationSchema('ar');
      expect(arOrg['@context']).toBe('https://schema.org');
      expect(arOrg['@type']).toBe('Organization');
      expect(arOrg.name).toContain('موهبة');
      expect(arOrg.url).toBe(`${SITE_URL}/ar`);
      expect(arOrg.logo).toBe(`${SITE_URL}/brand/logo-wide.png`);
      expect(arOrg.contactPoint[0].areaServed).toBe('EG');

      const enOrg = generateOrganizationSchema('en');
      expect(enOrg.name).toBe('MWHEBA Corporate Agency');
      expect(enOrg.url).toBe(`${SITE_URL}/en`);
    });

    it('generates valid LocalBusiness / ProfessionalService schema for Cairo HQ', () => {
      const business = generateLocalBusinessSchema('ar');
      expect(business['@context']).toBe('https://schema.org');
      expect(business['@type']).toBe('ProfessionalService');
      expect(business.priceRange).toBe('EGP');
      expect(business.currenciesAccepted).toBe('EGP');
      expect(business.address.addressLocality).toBe('القاهرة');
      expect(business.address.addressCountry).toBe('EG');
      expect(business.geo.latitude).toBeCloseTo(30.0561, 2);
    });

    it('generates valid Product schema with EGP pricing and in-stock offers', () => {
      const productSchema = generateProductSchema(
        {
          name: 'فلاسك حراري تنفيذي فاخر',
          description: 'فلاسك من الفولاذ المقاوم للصدأ بشاشة حرارية ذكية مع حفر ليزر مخصص للشركات',
          slug: 'executive-thermal-flask',
          priceEgp: 450,
          sku: 'MWH-FLASK-01',
          inStock: true,
        },
        'ar',
      );

      expect(productSchema['@context']).toBe('https://schema.org');
      expect(productSchema['@type']).toBe('Product');
      expect(productSchema.name).toBe('فلاسك حراري تنفيذي فاخر');
      expect(productSchema.sku).toBe('MWH-FLASK-01');
      expect(productSchema.offers['@type']).toBe('Offer');
      expect(productSchema.offers.priceCurrency).toBe('EGP');
      expect(productSchema.offers.price).toBe('450.00');
      expect(productSchema.offers.availability).toBe('https://schema.org/InStock');
    });

    it('generates valid Article / BlogPosting schema for knowledge articles', () => {
      const articleSchema = generateArticleSchema(
        {
          title: 'دليل الشركات لاختيار وتوريد الهدايا الترويجية لعام 2026',
          description: 'دراسة شاملة حول استراتيجيات اختيار الهدايا المؤسسية وأثرها على ولاء العملاء',
          slug: 'custom-promotional-gifts-roi',
          publishedAt: '2026-02-15T10:00:00+02:00',
          authorName: 'فريق موهبة للإنتاج والطباعة',
        },
        'ar',
      );

      expect(articleSchema['@context']).toBe('https://schema.org');
      expect(articleSchema['@type']).toBe('BlogPosting');
      expect(articleSchema.headline).toContain('دليل الشركات');
      expect(articleSchema.publisher['@type']).toBe('Organization');
      expect(articleSchema.mainEntityOfPage['@type']).toBe('WebPage');
      expect(articleSchema.datePublished).toBe('2026-02-15T10:00:00+02:00');
    });

    it('generates valid BreadcrumbList schema with sequential positions', () => {
      const breadcrumb = generateBreadcrumbSchema([
        { name: 'الرئيسية', url: '/ar' },
        { name: 'المتجر المؤسسي', url: '/ar/store' },
        { name: 'فلاسك تنفيذي', url: '/ar/store/executive-thermal-flask' },
      ]);

      expect(breadcrumb['@context']).toBe('https://schema.org');
      expect(breadcrumb['@type']).toBe('BreadcrumbList');
      expect(breadcrumb.itemListElement.length).toBe(3);
      expect(breadcrumb.itemListElement[0].position).toBe(1);
      expect(breadcrumb.itemListElement[1].position).toBe(2);
      expect(breadcrumb.itemListElement[2].position).toBe(3);
      expect(breadcrumb.itemListElement[2].item).toBe(`${SITE_URL}/ar/store/executive-thermal-flask`);
    });
  });

  describe('2. Metadata, Canonical & Hreflang Tag Verification', () => {
    it('produces strict self-referencing canonical URLs without trailing slashes', () => {
      const metaAr = buildBilingualMetadata({
        title: 'حلول الهوية المؤسسية',
        description: 'تصميم هوية بصرية متكاملة للمؤسسات والشركات الكبرى في مصر والشرق الأوسط',
        path: '/services/brand-identity',
        locale: 'ar',
      });

      expect(metaAr.alternates?.canonical).toBe(`${SITE_URL}/ar/services/brand-identity`);
      expect(String(metaAr.alternates?.canonical).endsWith('/')).toBe(false);

      const metaEn = buildBilingualMetadata({
        title: 'Corporate Brand Identity Solutions',
        description: 'Comprehensive brand identity design for enterprises in Egypt and the MENA region',
        path: '/services/brand-identity',
        locale: 'en',
      });

      expect(metaEn.alternates?.canonical).toBe(`${SITE_URL}/en/services/brand-identity`);
      expect(String(metaEn.alternates?.canonical).endsWith('/')).toBe(false);
    });

    it('interlinks bidirectional hreflang tags including ar-EG, en-US, and x-default', () => {
      const meta = buildBilingualMetadata({
        title: 'المتجر المؤسسي',
        description: 'بوابة موهبة لتوريد الهدايا الترويجية المخصصة للشركات',
        path: '/store',
        locale: 'ar',
      });

      const languages = meta.alternates?.languages as Record<string, string>;
      expect(languages).toBeDefined();
      expect(languages['ar']).toBe(`${SITE_URL}/ar/store`);
      expect(languages['en']).toBe(`${SITE_URL}/en/store`);
      expect(languages['ar-EG']).toBe(`${SITE_URL}/ar/store`);
      expect(languages['en-US']).toBe(`${SITE_URL}/en/store`);
      expect(languages['x-default']).toBe(`${SITE_URL}/ar/store`); // Arabic is default
    });

    it('sets correct OpenGraph locales (ar_EG and alternate en_US)', () => {
      const metaAr = buildBilingualMetadata({
        title: 'تواصل معنا',
        description: 'تواصل مع فريق خبراء موهبة لبدء مشروعك القادم',
        path: '/contact',
        locale: 'ar',
      });

      expect(metaAr.openGraph?.locale).toBe('ar_EG');
      expect(metaAr.openGraph?.alternateLocale).toContain('en_US');
    });
  });

  describe('3. JSON-LD Safe HTML Injection Escaping', () => {
    it('safely escapes script breakout strings in JSON-LD payloads', () => {
      const maliciousData = {
        name: 'Evil Brand</script><script>alert("xss")</script>',
        description: 'Some text with <tags> & "quotes"',
      };

      const serialized = safeJsonLdReplacer(maliciousData);
      expect(serialized).not.toContain('</script>');
      expect(serialized).toContain('\\u003c/script\\u003e');
      expect(serialized).toContain('\\u0026');
    });
  });
});
