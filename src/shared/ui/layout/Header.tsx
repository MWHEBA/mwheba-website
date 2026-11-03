import Link from 'next/link';
import { MobileDrawer } from './MobileDrawer';
import { CartButton } from '@/modules/cart-checkout/ui/CartButton';
import { getBilingualNavigation } from '@/modules/content/ui/Navigation';

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
    <header className="site-header" role="banner">
      <div className="site-header-inner">
        {/* Brand identity anchor */}
        <Link href={homeHref} style={{ display: 'inline-flex', alignItems: 'center' }} aria-label={isArabic ? 'وكالة موهبة' : 'MWHEBA Agency'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-wide.webp"
            alt={isArabic ? 'وكالة موهبة للدعاية والإنتاج' : 'MWHEBA Agency'}
            height={36}
            style={{ height: '36px', width: 'auto', display: 'block' }}
          />
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav-desktop" aria-label={isArabic ? 'القائمة الرئيسية' : 'Main navigation'}>
          <ul className="nav-menu">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="nav-link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Actions & Controls */}
        <div className="header-actions">
          <CartButton locale={locale} />

          <Link
            href={otherLocaleHref}
            className="lang-switch-btn"
            aria-label={isArabic ? 'التبديل إلى اللغة الإنجليزية' : 'Switch to Arabic language'}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span>{otherLocaleLabel}</span>
          </Link>

          {/* Mobile Drawer Trigger & Panel */}
          <MobileDrawer
            locale={locale}
            items={navItems}
            otherLocaleHref={otherLocaleHref}
            otherLocaleLabel={otherLocaleLabel}
          />
        </div>
      </div>
    </header>
  );
}
