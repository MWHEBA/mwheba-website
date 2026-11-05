import Link from 'next/link';
import { getPayloadClient } from '@/lib/payload';

export interface NavLinkItem {
  href: string;
  label: string;
  openInNewTab?: boolean;
}

export async function getBilingualNavigation(locale: string): Promise<{
  headerMenu: NavLinkItem[];
  footerColumns?: Array<{ title: string; links: NavLinkItem[] }>;
}> {
  const isArabic = locale === 'ar';

  const defaultHeader: NavLinkItem[] = isArabic
    ? [
        { href: '/ar', label: 'الرئيسية' },
        { href: '/ar/services', label: 'الخدمات' },
        { href: '/ar/about', label: 'عن موهبة' },
        { href: '/ar/store', label: 'المتجر والمنتجات' },
        { href: '/ar/portfolio', label: 'أعمالنا' },
        { href: '/ar/blog', label: 'المدونة' },
        { href: '/ar/contact', label: 'تواصل معنا' },
      ]
    : [
        { href: '/en', label: 'Home' },
        { href: '/en/services', label: 'Services' },
        { href: '/en/about', label: 'About Us' },
        { href: '/en/store', label: 'Store & Merchandise' },
        { href: '/en/portfolio', label: 'Portfolio' },
        { href: '/en/blog', label: 'Insights' },
        { href: '/en/contact', label: 'Contact' },
      ];

  try {
    const payload = await getPayloadClient();
    const nav = await payload.findGlobal({
      slug: 'navigation',
      locale: locale as any,
    });

    if (nav?.headerMenu && Array.isArray(nav.headerMenu) && nav.headerMenu.length > 0) {
      const mappedHeader = nav.headerMenu.map((item: any) => {
        let href = item.url;
        if (href.startsWith('/') && !href.startsWith('/ar') && !href.startsWith('/en')) {
          href = `/${locale}${href}`;
        }
        return {
          href,
          label: item.label,
          openInNewTab: Boolean(item.openInNewTab),
        };
      });

      return {
        headerMenu: mappedHeader,
      };
    }
  } catch (error) {
    // Fall back to default menu items
  }

  return {
    headerMenu: defaultHeader,
  };
}

export function NavigationMenu({ items }: { items: NavLinkItem[] }) {
  return (
    <ul className="nav-menu">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="nav-link"
            target={item.openInNewTab ? '_blank' : undefined}
            rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
