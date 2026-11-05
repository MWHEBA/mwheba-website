import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CartProvider } from '@/modules/cart-checkout/context/CartContext';
import { Header } from '@/shared/ui/layout/Header';
import { Footer } from '@/shared/ui/layout/Footer';
import { MobileDrawer } from '@/shared/ui/layout/MobileDrawer';

describe('Phase 10.5: Navigation, Header & Footer Polish Suite', () => {
  describe('Header Component', () => {
    it('renders the top announcement bar with Alexandria HQ, direct phone, and WhatsApp', async () => {
      const headerAr = await Header({ locale: 'ar' });
      const htmlAr = renderToString(<CartProvider>{headerAr}</CartProvider>);

      expect(htmlAr).toContain('header-top-bar');
      expect(htmlAr).toContain('ميامي، الإسكندرية، مصر');
      expect(htmlAr).toContain('01010944010');
      expect(htmlAr).toContain('https://wa.me/201010944010');
      expect(htmlAr).toContain('الأحد – الخميس | 10:00 ص – 6:00 م');

      const headerEn = await Header({ locale: 'en' });
      const htmlEn = renderToString(<CartProvider>{headerEn}</CartProvider>);
      expect(htmlEn).toContain('Alexandria, Egypt');
      expect(htmlEn).toContain('Sun – Thu | 10:00 AM – 6:00 PM');
    });

    it('renders desktop navigation with Services, About, Store, and Contact', async () => {
      const header = await Header({ locale: 'ar' });
      const html = renderToString(<CartProvider>{header}</CartProvider>);

      expect(html).toContain('/ar/services');
      expect(html).toContain('الخدمات');
      expect(html).toContain('/ar/about');
      expect(html).toContain('عن موهبة');
      expect(html).toContain('/ar/store');
      expect(html).toContain('/ar/contact');
    });
  });

  describe('Footer Component', () => {
    it('renders all 5 official social channels with verified URLs and accessible labels', () => {
      const html = renderToString(<Footer locale="ar" />);

      expect(html).toContain('https://www.facebook.com/mwhebaeg');
      expect(html).toContain('https://www.instagram.com/mwhebaeg');
      expect(html).toContain('https://www.linkedin.com/company/mwhebaeg');
      expect(html).toContain('https://www.behance.net/mwhebaeg');
      expect(html).toContain('https://x.com/mwhebaeg');
    });

    it('renders authentic Alexandria HQ coordinates, direct phone lines, and operating hours', () => {
      const html = renderToString(<Footer locale="ar" />);

      expect(html).toContain('ميامي، شارع إسكندر إبراهيم، الإسكندرية، مصر');
      expect(html).toContain('tel:+201010944010');
      expect(html).toContain('01010944010');
      expect(html).toContain('01229609292');
      expect(html).toContain('info@mwheba.com');
      expect(html).toContain('الأحد - الخميس | 10:00 ص - 6:00 م');
    });

    it('renders all 6 services with direct subpage links in the services column', () => {
      const html = renderToString(<Footer locale="ar" />);

      expect(html).toContain('/ar/services/brand-identity');
      expect(html).toContain('/ar/services/web-development');
      expect(html).toContain('/ar/services/ui-ux-design');
      expect(html).toContain('/ar/services/digital-marketing');
      expect(html).toContain('/ar/services/media-production');
      expect(html).toContain('/ar/services/printing');
    });
  });

  describe('MobileDrawer Component', () => {
    it('renders closed mobile drawer toggle with accessible attributes', () => {
      const items = [
        { href: '/ar/services', label: 'الخدمات' },
        { href: '/ar/about', label: 'عن موهبة' },
      ];
      const html = renderToString(
        <MobileDrawer
          locale="ar"
          items={items}
          otherLocaleHref="/en"
          otherLocaleLabel="English"
        />
      );

      expect(html).toContain('drawer-toggle-btn');
      expect(html).toContain('aria-expanded="false"');
    });
  });
});
