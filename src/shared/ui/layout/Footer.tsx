import Link from 'next/link';

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
        </div>

        {/* Column 2: Core Services */}
        <div>
          <h3 className="footer-col-title">
            {isArabic ? 'الخدمات الرقمية' : 'Services'}
          </h3>
          <ul className="footer-links">
            <li>
              <Link href={isArabic ? '/ar/services/brand-identity' : '/en/services/brand-identity'}>
                {isArabic ? 'الهوية البصرية وتصميم العلامات' : 'Brand Identity'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/web-development' : '/en/services/web-development'}>
                {isArabic ? 'تطوير المواقع والمنصات' : 'Web Development'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/digital-marketing' : '/en/services/digital-marketing'}>
                {isArabic ? 'التسويق الرقمي وإدارة الحملات' : 'Digital Marketing'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/services/printing' : '/en/services/printing'}>
                {isArabic ? 'خدمات الطباعة الفاخرة' : 'Commercial Printing'}
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Corporate Merchandise */}
        <div>
          <h3 className="footer-col-title">
            {isArabic ? 'هدايا الشركات (B2B)' : 'Corporate Merchandise'}
          </h3>
          <ul className="footer-links">
            <li>
              <Link href={isArabic ? '/ar/merchandise/thermal-mugs' : '/en/merchandise/thermal-mugs'}>
                {isArabic ? 'الأكواب والمجات الحرارية' : 'Thermal & Ceramic Mugs'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/merchandise/notebooks' : '/en/merchandise/notebooks'}>
                {isArabic ? 'النوت بوك والأدوات المكتبية' : 'Notebooks & Stationery'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/merchandise/custom-giveaways' : '/en/merchandise/custom-giveaways'}>
                {isArabic ? 'هدايا المؤتمرات والفعاليات' : 'Event Giveaways'}
              </Link>
            </li>
            <li>
              <Link href={isArabic ? '/ar/merchandise/customization-guide' : '/en/merchandise/customization-guide'}>
                {isArabic ? 'دليل الطباعة والـ MOQ' : 'Customization & MOQ Guide'}
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Contact & Legal */}
        <div>
          <h3 className="footer-col-title">
            {isArabic ? 'المكتب والتواصل' : 'Contact & Headquarters'}
          </h3>
          <ul className="footer-links">
            <li>
              <span style={{ color: 'var(--text-inverted-muted)', fontSize: '0.875rem' }}>
                {isArabic ? 'القاهرة، جمهورية مصر العربية' : 'Cairo, Arab Republic of Egypt'}
              </span>
            </li>
            <li>
              <a href="mailto:info@mwheba.com">
                info@mwheba.com
              </a>
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
