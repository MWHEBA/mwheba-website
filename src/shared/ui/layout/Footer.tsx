import Link from 'next/link';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  BehanceIcon,
  TwitterXIcon,
  ArrowUpRightIcon,
} from '@/shared/ui/icons';

interface FooterProps {
  locale: string;
}

export function Footer({ locale }: FooterProps) {
  const isArabic = locale === 'ar';
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer site-footer reveal-on-scroll" data-aos="fade-up-sm" role="contentinfo">
      <div className="container" style={{ maxWidth: '1480px' }}>
        {/* 1. Top Section: Positioning & Social Channels */}
        <div className="footer-top">
          <div>
            <div className="eyebrow">
              {isArabic ? 'فكر إبداعي. أثر ملموس.' : 'CREATIVE THINKING. TANGIBLE IMPACT.'}
            </div>
            <p className="footer-tagline">
              {isArabic
                ? 'استوديو إبداعي مستقل وشريك معتمد لتوريد هدايا ومطبوعات الشركات الفاخرة في مصر والشرق الأوسط.'
                : 'Independent creative agency & corporate merchandise studio serving forward-thinking enterprises.'}
            </p>
            <div className="footer-contact-strip">
              <span>{isArabic ? 'ميامي، شارع إسكندر إبراهيم، الإسكندرية، مصر' : 'Miami, Iskander Ibrahim St., Alexandria, Egypt'}</span>
              <span>·</span>
              <a href="tel:+201010944010" dir="ltr">01010944010</a>
              <span>-</span>
              <a href="tel:+201229609292" dir="ltr">01229609292</a>
              <span>·</span>
              <a href="mailto:info@mwheba.com">info@mwheba.com</a>
              <span>·</span>
              <span>{isArabic ? 'الأحد - الخميس | 10:00 ص - 6:00 م' : 'Sun - Thu | 10:00 AM - 6:00 PM'}</span>
            </div>
          </div>

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

        {/* 2. Structured Link Columns (Disciplines & Corporate Navigation) */}
        <div className="footer-links-grid">
          <div>
            <h3 className="footer-col-title">
              {isArabic ? 'مجالات العمل الست' : 'Our 6 Disciplines'}
            </h3>
            <ul className="footer-nav-list">
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

          <div>
            <h3 className="footer-col-title">
              {isArabic ? 'الاستوديو والمنتجات' : 'Studio & Corporate Store'}
            </h3>
            <ul className="footer-nav-list">
              <li>
                <Link href={isArabic ? '/ar/services' : '/en/services'}>
                  {isArabic ? 'مركز الخدمات الرئيسي' : 'Services Overview'}
                </Link>
              </li>
              <li>
                <Link href={isArabic ? '/ar/store' : '/en/store'}>
                  {isArabic ? 'متجر هدايا الشركات (B2B)' : 'Corporate Store (B2B)'}
                </Link>
              </li>
              <li>
                <Link href={isArabic ? '/ar/portfolio' : '/en/portfolio'}>
                  {isArabic ? 'معرض الأعمال والمشاريع' : 'Selected Work'}
                </Link>
              </li>
              <li>
                <a href="#process">
                  {isArabic ? 'منهجية العمل' : 'How It Works'}
                </a>
              </li>
              <li>
                <Link href={isArabic ? '/ar/blog' : '/en/blog'}>
                  {isArabic ? 'المقالات والأفكار' : 'Insights & Articles'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="footer-col-title">
              {isArabic ? 'المؤسسة والشفافية' : 'Company & Legal'}
            </h3>
            <ul className="footer-nav-list">
              <li>
                <Link href={isArabic ? '/ar/about' : '/en/about'}>
                  {isArabic ? 'عن موهبة وفريق العمل' : 'About MWHEBA'}
                </Link>
              </li>
              <li>
                <Link href={isArabic ? '/ar/contact' : '/en/contact'}>
                  {isArabic ? 'تواصل معنا واستشرنا' : 'Contact & Inquiries'}
                </Link>
              </li>
              <li>
                <Link href={isArabic ? '/ar/privacy-policy' : '/en/privacy-policy'}>
                  {isArabic ? 'سياسة الخصوصية والشروط' : 'Privacy Policy & Terms'}
                </Link>
              </li>
              <li>
                <Link href="/admin">
                  {isArabic ? 'بوابة إدارة المحتوى' : 'Admin Portal'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* 3. Monumental Brand Headline (From mwheba-visual-redesign-v6-smooth.html) */}
        <h2 className="display footer-brand-display">
          MWHEBA<span style={{ color: 'var(--color-brand-red)' }}>.</span>
        </h2>

        {/* 4. Elegant Minimal Bottom Bar */}
        <div className="footer-bottom">
          <span>
            © {currentYear} {isArabic ? 'وكالة موهبة للدعاية والإنتاج. جميع الحقوق محفوظة.' : 'MWHEBA Agency. All rights reserved.'}
          </span>
          <span className="footer-bottom-tag">
            DESIGNED TO MAKE AN IMPACT · ALEXANDRIA, EGYPT
          </span>
          <a href="#top" className="footer-back-to-top">
            {isArabic ? 'العودة للأعلى ↑' : 'BACK TO TOP ↑'}
          </a>
        </div>
      </div>
    </footer>
  );
}
