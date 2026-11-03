import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { draftMode, headers } from 'next/headers';
import Link from 'next/link';
import { isValidLocale, type Locale } from '@/shared/lib/i18n';
import { getPayloadClient } from '@/lib/payload';
import { hasRole } from '@/modules/identity/access/roles';
import { BlockRenderer } from '@/modules/content/ui/BlockRenderer';

interface DynamicPageProps {
  params: Promise<{
    locale: string;
    slug: string[];
  }>;
}

export async function generateMetadata({ params }: DynamicPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) return {};

  const pageSlug = slug.join('/');
  const payload = await getPayloadClient();

  try {
    const res = await payload.find({
      collection: 'pages',
      where: {
        and: [
          { slug: { equals: pageSlug } },
          { _status: { equals: 'published' } },
        ],
      },
      locale: locale as Locale,
      limit: 1,
    });

    const page = res.docs?.[0];
    if (!page) return {};

    const metaTitle = page.meta?.title || page.title;
    const metaDesc = page.meta?.description || '';

    return {
      title: `${metaTitle} | ${locale === 'ar' ? 'وكالة موهبة' : 'MWHEBA Agency'}`,
      description: metaDesc,
      robots: page.meta?.noIndex ? { index: false, follow: false } : undefined,
    };
  } catch (e) {
    return {};
  }
}

export default async function DynamicCmsPage({ params }: DynamicPageProps) {
  const { locale, slug } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const pageSlug = slug.join('/');
  const isArabic = locale === 'ar';
  const { isEnabled: isDraftModeCookieActive } = await draftMode();
  const payload = await getPayloadClient();

  // Defense-in-depth: Re-verify editor session on draft render
  // If the editor has logged out, do NOT grant draft visibility even if draft mode cookie persists!
  let isAuthorizedEditor = false;
  if (isDraftModeCookieActive) {
    try {
      const reqHeaders = await headers();
      const { user } = await payload.auth({ headers: reqHeaders });
      if (user && hasRole(user, ['super_admin', 'marketer'])) {
        isAuthorizedEditor = true;
      }
    } catch {
      isAuthorizedEditor = false;
    }
  }

  // Draft content is strictly restricted to active draft mode AND authenticated authorized editor
  const shouldServeDraft = isDraftModeCookieActive && isAuthorizedEditor;

  // Query conditions based on draft mode and editor authentication
  const whereCondition: any = shouldServeDraft
    ? { slug: { equals: pageSlug } }
    : {
        and: [
          { slug: { equals: pageSlug } },
          { _status: { equals: 'published' } },
        ],
      };

  let page: any = null;
  try {
    const res = await payload.find({
      collection: 'pages',
      where: whereCondition,
      locale: locale as Locale,
      draft: shouldServeDraft,
      limit: 1,
    });
    page = res.docs?.[0] || null;
  } catch (error) {
    console.error('Error fetching CMS page:', error);
  }

  if (!page) {
    notFound();
  }

  return (
    <article className="cms-page-wrapper">
      {/* Draft Mode Active Inspection Banner */}
      {shouldServeDraft && (
        <aside
          role="alert"
          style={{
            backgroundColor: 'var(--status-warning-bg)',
            borderBottom: '1px solid var(--status-warning)',
            padding: '0.75rem 1.5rem',
            fontSize: '0.8125rem',
            color: 'var(--status-warning)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <span>⚠️</span>
            <span>
              {isArabic
                ? 'وضع معاينة المسودة (Draft Preview Mode) - أنت تستعرض مسودة غير منشورة للعامة'
                : 'Draft Preview Mode Active - Viewing unpublished editor draft'}
            </span>
          </div>

          <Link
            href={`/api/exit-preview?redirect=/${locale}/${pageSlug}`}
            style={{
              padding: '0.25rem 0.65rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--status-warning)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--status-warning)',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.75rem',
            }}
          >
            {isArabic ? 'إنهاء وضع المعاينة ✕' : 'Exit Preview ✕'}
          </Link>
        </aside>
      )}

      {/* Render Localized Blocks Sequence */}
      <BlockRenderer blocks={page.layout} locale={locale} />
    </article>
  );
}
