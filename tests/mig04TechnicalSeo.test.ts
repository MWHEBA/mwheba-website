import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('next/font/google', () => ({
  Cairo: () => ({ variable: 'mock-font-cairo' }),
}));
import {
  generateOrganizationSchema,
  generateLocalBusinessSchema,
  generateProductSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  getVerifiedLogoUrl,
} from '../src/shared/lib/schemaGenerator';
import { buildBilingualMetadata, SITE_URL } from '../src/shared/lib/seo';
import { safeJsonLdReplacer } from '../src/shared/lib/safeJsonLd';
import FrontendLayout from '../src/app/(frontend)/[locale]/layout';
import ProductDetailPage from '../src/app/(frontend)/[locale]/store/[slug]/page';

describe('MIG-04: Technical SEO, Verified Schema.org & Rendered Page Structured Data', () => {
  describe('1. Schema Generator Zero-Placeholder & Physical Asset Verification', () => {
    it('verifies that the logo URL points to an actual physical file on disk', () => {
      const logoUrl = getVerifiedLogoUrl();
      expect(logoUrl).toBeDefined();

      const relPath = logoUrl.replace(SITE_URL, 'public');
      const fullPath = path.resolve(process.cwd(), relPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const buf = fs.readFileSync(fullPath);
      expect(buf.length).toBeGreaterThan(1000);
    });

    it('generates Organization schema with ZERO fake telephone and ZERO fake address', () => {
      const arOrg = generateOrganizationSchema('ar');
      expect(arOrg['@context']).toBe('https://schema.org');
      expect(arOrg['@type']).toBe('Organization');
      expect(arOrg.name).toContain('موهبة');
      expect(arOrg.url).toBe(`${SITE_URL}/ar`);
      expect(arOrg.logo).toBe(`${SITE_URL}/brand/logo-wide.png`);

      // STRICT ZERO-ASSUMPTION CHECKS
      expect(arOrg.telephone).toBeUndefined();
      expect(arOrg.address).toBeUndefined();
      expect(arOrg.contactPoint).toBeUndefined();
      expect(JSON.stringify(arOrg)).not.toContain('0000-0000');
      expect(JSON.stringify(arOrg)).not.toContain('الطيران');

      const enOrg = generateOrganizationSchema('en');
      expect(enOrg.name).toBe('MWHEBA Corporate Agency');
      expect(enOrg.telephone).toBeUndefined();
    });

    it('generates LocalBusiness schema omitting unverified address, geo, and hours unless explicitly passed', () => {
      // Calling without verified options must omit unverified physical fields
      const unverified = generateLocalBusinessSchema('ar');
      expect(unverified['@type']).toBe('ProfessionalService');
      expect(unverified.priceRange).toBe('EGP');
      expect(unverified.telephone).toBeUndefined();
      expect(unverified.address).toBeUndefined();
      expect(unverified.geo).toBeUndefined();
      expect(unverified.openingHoursSpecification).toBeUndefined();

      // Calling with explicit verified options emits them
      const verified = generateLocalBusinessSchema('ar', {
        telephone: '+20-2-22600000',
        address: {
          streetAddress: 'Verified Street',
          addressLocality: 'Cairo',
          addressRegion: 'Cairo',
          addressCountry: 'EG',
        },
      });
      expect(verified.telephone).toBe('+20-2-22600000');
      expect(verified.address?.streetAddress).toBe('Verified Street');
    });

    it('generates Product schema without defaulting availability to InStock if undefined', () => {
      // 1. inStock undefined -> availability MUST BE omitted
      const unknownStock = generateProductSchema(
        {
          name: 'دفتر أعمال جلدي تنفيذي',
          slug: 'luxury-leather-notebook',
          priceEgp: 320,
        },
        'ar',
      );
      expect(unknownStock.offers.availability).toBeUndefined();
      expect(unknownStock.offers.price).toBe('320.00');

      // 2. inStock explicitly true -> InStock
      const inStock = generateProductSchema(
        {
          name: 'فلاسك حراري',
          slug: 'executive-thermal-flask',
          priceEgp: 450,
          inStock: true,
        },
        'ar',
      );
      expect(inStock.offers.availability).toBe('https://schema.org/InStock');

      // 3. inStock explicitly false -> OutOfStock
      const outOfStock = generateProductSchema(
        {
          name: 'منتج منتهي',
          slug: 'out-of-stock-item',
          priceEgp: 100,
          inStock: false,
        },
        'ar',
      );
      expect(outOfStock.offers.availability).toBe('https://schema.org/OutOfStock');
    });

    it('generates Article schema with ZERO fake default dates', () => {
      // 1. Without publishedAt -> datePublished MUST BE omitted (never invented)
      const noDate = generateArticleSchema(
        {
          title: 'دليل الشركات لاختيار الهدايا الترويجية',
          slug: 'custom-promotional-gifts-roi',
        },
        'ar',
      );
      expect(noDate.datePublished).toBeUndefined();
      expect(noDate.dateModified).toBeUndefined();
      expect(JSON.stringify(noDate)).not.toContain('2026-01-01');

      // 2. With authentic date -> emitted faithfully
      const withDate = generateArticleSchema(
        {
          title: 'دليل الشركات',
          slug: 'custom-promotional-gifts-roi',
          publishedAt: '2026-02-15T10:00:00+02:00',
        },
        'ar',
      );
      expect(withDate.datePublished).toBe('2026-02-15T10:00:00+02:00');
    });
  });

  describe('2. Direct Page Component Rendered JSON-LD Verification', () => {
    it('FrontendLayout renders valid Organization JSON-LD in document head', async () => {
      const layoutJsx = await FrontendLayout({
        children: React.createElement('div', null, 'Content'),
        params: Promise.resolve({ locale: 'ar' }),
      });

      expect(React.isValidElement(layoutJsx)).toBe(true);

      // Inspect <head> script tag
      const headElement = React.Children.toArray((layoutJsx as any).props.children).find(
        (child: any) => child.type === 'head',
      ) as any;
      expect(headElement).toBeDefined();

      const scriptElement = React.Children.toArray(headElement.props.children).find(
        (child: any) => child.props?.id === 'organization-jsonld',
      ) as any;

      expect(scriptElement).toBeDefined();
      expect(scriptElement.props.type).toBe('application/ld+json');

      const rawHtml = scriptElement.props.dangerouslySetInnerHTML.__html;
      const parsed = JSON.parse(rawHtml);

      expect(parsed['@type']).toBe('Organization');
      expect(parsed.name).toContain('موهبة');
      expect(parsed.email).toBe('info@mwheba.com');
      expect(parsed.logo).toBe(`${SITE_URL}/brand/logo-wide.png`);

      // Verify ZERO fake data in rendered page output
      expect(rawHtml).not.toContain('0000-0000');
      expect(rawHtml).not.toContain('الطيران');
      expect(parsed.telephone).toBeUndefined();
      expect(parsed.address).toBeUndefined();
    });

    it('ProductDetailPage renders valid Product and Breadcrumb JSON-LD from authentic product data', async () => {
      const pageJsx = await ProductDetailPage({
        params: Promise.resolve({ locale: 'ar', slug: 'executive-thermal-flask' }),
      });

      expect(React.isValidElement(pageJsx)).toBe(true);

      const children = React.Children.toArray((pageJsx as any).props.children);
      const productScript = children.find(
        (child: any) => child.props?.id === 'product-jsonld',
      ) as any;
      const breadcrumbsScript = children.find(
        (child: any) => child.props?.id === 'product-breadcrumbs-jsonld',
      ) as any;

      expect(productScript).toBeDefined();
      expect(breadcrumbsScript).toBeDefined();

      const productJson = JSON.parse(productScript.props.dangerouslySetInnerHTML.__html);
      expect(productJson['@type']).toBe('Product');
      expect(productJson.name).toBe('كوب حراري ذكي مخصص (Executive Thermal Flask)');
      expect(productJson.offers.price).toBe('250.00');
      expect(productJson.offers.priceCurrency).toBe('EGP');
      expect(productJson.offers.availability).toBe('https://schema.org/InStock');

      const breadcrumbsJson = JSON.parse(breadcrumbsScript.props.dangerouslySetInnerHTML.__html);
      expect(breadcrumbsJson['@type']).toBe('BreadcrumbList');
      expect(breadcrumbsJson.itemListElement.length).toBe(3);
      expect(breadcrumbsJson.itemListElement[0].name).toBe('الرئيسية');
      expect(breadcrumbsJson.itemListElement[2].name).toBe('كوب حراري ذكي مخصص (Executive Thermal Flask)');
    });
  });

  describe('3. Metadata, Canonical & Hreflang Tag Verification', () => {
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
      expect(languages['x-default']).toBe(`${SITE_URL}/ar/store`);
    });
  });

  describe('4. JSON-LD Safe HTML Injection Escaping', () => {
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
