import Link from 'next/link';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  BehanceIcon,
  TwitterXIcon,
} from '@/shared/ui/icons';

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const isArabic = locale === 'ar';
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        {/* Column 1: Agency Brand */}
        <div>
          <div style={{ marginBlockEnd: '1.25rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-wide-inverted.webp"
              alt={isArabic ? 'وكالة موهبة للدعاية والإنتاج' : 'MWHEBA Agency'}
              height={34}
              style={{ height: '34px', width: 'auto', display: 'block' }}
            />
          </div>
          <p style={{ color: 'var(--text-inverted-muted)', fontSize: '0.875rem', lineHeight: '1.7', margin: 0 }}>
            {isArabic
              ? 'وكالة رائدة متخصصة في بناء الهويات التجارية، تطوير المنصات الرقمية، توريد وتصنيع هدايا الشركات والمطبوعات الدعائية المخصصة.'
              : 'Premier corporate agency specialized in brand identity, digital platforms, corporate giveaways, and customized commercial merchandise.'}
          </p>

          {/* Official Social Media Channels */}
          <div className="footer-social-links" aria-label={isArabic ? 'قنوات التواصل الاجتماعي الرسمية' : 'Official Social Channels'}>
            <a
              href="https://www.facebook.com/mwhebaeg"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
              aria-label="Facebook"
            >
              <FacebookIcon size={16} />
            </a>
            <a
              href="https://www.instagram.com/mwhebaeg"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
              aria-label="Instagram"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href="https://www.linkedin.com/company/mwhebaeg"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
              aria-label="LinkedIn"
            >
              <LinkedInIcon size={16} />
            </a>
            <a
              href="https://www.behance.net/mwhebaeg"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
              aria-label="Behance"
            >
              <BehanceIcon size={16} />
            </a>
            <a
              href="https://x.com/mwhebaeg"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social-btn"
              aria-label="X (Twitter)"
            >
              <TwitterXIcon size={16} />
            </a>
          </div>
        </div>

        {/* Column 2: Core Services */}
        <div>
          <h3 className="footer-col-title">
            {isArabic ? 'خدماتنا الست' : 'Our 6 Disciplines'}
          </h3>
          <ul className="footer-links">
            <li>
              <Link href={isArabic ? '/ar/services/brand-identity' : '/en/services/brand-identity'}>
                {isArabic ? 'هوية العلامة التجارية' : 'Brand Identity'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/web-development' : '/en/services/web-development'}>
                {isArabic ? 'استضافة وتطوير المواقع' : 'Web Development'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/ui-ux-design' : '/en/services/ui-ux-design'}>
                {isArabic ? 'تصميم واجهة المستخدم UI/UX' : 'UI/UX Design'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/digital-marketing' : '/en/services/digital-marketing'}>
                {isArabic ? 'التسويق الرقمي واستراتيجيات النمو' : 'Digital Marketing'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/media-production' : '/en/services/media-production'}>
                {isArabic ? 'الإنتاج الإعلامي والمرئي' : 'Media Production'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/printing' : '/en/services/printing'}>
                {isArabic ? 'الطباعة وهدايا الشركات' : 'Printing & Merchandise'}
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Corporate Merchandise & About */}
        <div>
          <h3 className="footer-col-title">
            {isArabic ? 'روابط هامة' : 'Quick Links'}
          </h3>
          <ul className="footer-links">
            <li>
              <Link href={isArabic ? '/ar/about' : '/en/about'}>
                {isArabic ? 'عن موهبة وقصتنا' : 'About MWHEBA'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services' : '/en/services'}>
                {isArabic ? 'مركز الخدمات الرئيسي' : 'Services Hub'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/store' : '/en/store'}>
                {isArabic ? 'متجر هدايا الشركات (B2B)' : 'B2B Merchandise Store'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/portfolio' : '/en/portfolio'}>
                {isArabic ? 'أعمالنا ومشاريعنا' : 'Client Case Studies'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/blog' : '/en/blog'}>
                {isArabic ? 'المدونة ومقالات النمو' : 'Insights & Articles'}
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Contact & Legal */}
        <div>
          <h3 className="footer-col-title">
            {isArabic ? 'المقر والتواصل المباشر' : 'Headquarters & Contact'}
          </h3>
          <ul className="footer-links">
            <li>
              <span style={{ color: 'var(--text-inverted-muted)', fontSize: '0.875rem' }}>
                {isArabic ? 'ميامي، شارع إسكندر إبراهيم، الإسكندرية، مصر.' : 'Miami, Iskander Ibrahim St., Alexandria, Egypt.'}
              </span>
            </li>
            <li>
              <a href="tel:+201010944010" style={{ color: 'var(--text-inverted)', fontWeight: 600 }}>
                (+2) 01010944010 - 01229609292
              </a>
            </li>
            <li>
              <a href="mailto:info@mwheba.com">
                info@mwheba.com
              </a>
            </li>
            <li>
              <span style={{ color: 'var(--text-inverted-muted)', fontSize: '0.8125rem' }}>
                {isArabic ? 'الأحد - الخميس | 10:00 ص - 6:00 م' : 'Sun - Thu | 10:00 AM - 6:00 PM'}
              </span>
            </li>
            <li>
              <Link href={isArabic ? '/ar/privacy-policy' : '/en/privacy-policy'}>
                {isArabic ? 'سياسة الخصوصية والشروط' : 'Privacy & Terms'}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="site-footer-bottom">
        <div>
          © {currentYear} {isArabic ? 'وكالة موهبة للدعاية والإنتاج. جميع الحقوق محفوظة.' : 'MWHEBA Agency. All rights reserved.'}
        </div>
        <div style={{ display: 'flex', gap: '1.25rem' }}>
          <Link href={isArabic ? '/ar' : '/en'}>
            {isArabic ? 'الرئيسية' : 'Home'}
          </Link>
          <Link href={isArabic ? '/en' : '/ar'}>
            {isArabic ? 'English Version' : 'النسخة العربية'}
          </Link>
          <Link href="/admin">
            {isArabic ? 'لوحة الإدارة' : 'Admin Portal'}
          </Link>
        </div>
      </div>
    </footer>
  );
}
