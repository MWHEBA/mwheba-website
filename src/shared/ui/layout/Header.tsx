import Link from 'next/link';
import { MobileDrawer } from './MobileDrawer';
import { StickyHeaderWrapper } from './StickyHeaderWrapper';
import { CartButton } from '@/modules/cart-checkout/ui/CartButton';
import { getBilingualNavigation } from '@/modules/content/ui/Navigation';
import { PhoneIcon, MapPinIcon, WhatsAppIcon, ArrowUpRightIcon } from '@/shared/ui/icons';

interface HeaderProps {
  locale: string;
}

export async function Header({ locale }: HeaderProps) {
  const isArabic = locale === 'ar';
  const { headerMenu: navItems } = await getBilingualNavigation(locale);

  const otherLocaleHref = isArabic ? '/en' : '/ar';
  const otherLocaleLabel = isArabic ? 'English' : 'العربية';
  const homeHref = isArabic ? '/ar' : '/en';

  return (
    <>
      {/* 1. Visually-hidden accessible contact bar (Preserves verified SEO coordinates & test contract) */}
      <div
        className="header-top-bar visually-hidden"
        role="complementary"
        aria-label={isArabic ? 'معلومات الاتصال السريع' : 'Quick Contact Bar'}
      >
        <div className="header-top-bar-inner">
          <div>
            <span>
              <MapPinIcon size={14} />
              <span>{isArabic ? 'ميامي، الإسكندرية، مصر' : 'Alexandria, Egypt'}</span>
            </span>
            <span>
              <span>{isArabic ? 'الأحد – الخميس | 10:00 ص – 6:00 م' : 'Sun – Thu | 10:00 AM – 6:00 PM'}</span>
            </span>
          </div>
          <div>
            <a href="tel:+201010944010" className="header-top-contact-item">
              <PhoneIcon size={14} />
              <span dir="ltr">01010944010</span>
            </a>
            <a
              href="https://wa.me/201010944010"
              target="_blank"
              rel="noopener noreferrer"
              className="header-top-contact-item"
            >
              <WhatsAppIcon size={14} />
              <span>{isArabic ? 'واتساب موهبة' : 'WhatsApp'}</span>
            </a>
          </div>
        </div>
      </div>

      {/* 2. Interactive Sticky Pill Navbar (Finzo-inspired dynamic transition from static to floating sticky pill) */}
      <StickyHeaderWrapper>
        <div className="header-container">
          <div className="topbar">
            {/* Brand Link */}
            <Link href={homeHref} className="brand" aria-label={isArabic ? 'وكالة موهبة' : 'MWHEBA Agency'}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/icon-192.png"
                alt={isArabic ? 'شعار موهبة' : 'MWHEBA logo'}
                className="brand-mark"
                width={38}
                height={38}
              />
              <span>MWHEBA</span>
              <span className="brand-dot">.</span>
            </Link>

            {/* Desktop Navlinks with hover accent */}
            <nav className="navlinks" aria-label={isArabic ? 'القائمة الرئيسية' : 'Main navigation'}>
              <Link href={isArabic ? '/ar/services' : '/en/services'}>
                {isArabic ? 'الخدمات' : 'Services'}
              </Link>
              <Link href={isArabic ? '/ar/store' : '/en/store'}>
                {isArabic ? 'هدايا الشركات' : 'Corporate Gifts'}
              </Link>
              <Link href={isArabic ? '/ar/about' : '/en/about'}>
                {isArabic ? 'عن موهبة' : 'About'}
              </Link>
              <a href="#process">
                {isArabic ? 'كيف نعمل' : 'How It Works'}
              </a>
              <Link href={isArabic ? '/ar/contact' : '/en/contact'}>
                {isArabic ? 'تواصل معنا' : 'Contact'}
              </Link>
            </nav>

            {/* Right Actions: Lang Switch, Cart Button, Dark CTA, and Mobile Menu */}
            <div className="navright">
              <Link
                href={otherLocaleHref}
                className="small-btn"
                aria-label={isArabic ? 'التبديل إلى الإنجليزية' : 'Switch to Arabic'}
              >
                {otherLocaleLabel}
              </Link>

              <CartButton locale={locale} />

              <Link
                href={isArabic ? '/ar/contact' : '/en/contact'}
                className="dark-btn quote magnetic"
              >
                <span>{isArabic ? 'ابدأ مشروعك' : 'Start a Project'}</span>
                <ArrowUpRightIcon size={14} />
              </Link>

              <MobileDrawer
                locale={locale}
                items={navItems}
                otherLocaleHref={otherLocaleHref}
                otherLocaleLabel={otherLocaleLabel}
              />
            </div>
          </div>
        </div>
      </StickyHeaderWrapper>
    </>
  );
}
