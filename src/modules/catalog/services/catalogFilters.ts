import type { Locale } from '@/shared/lib/i18n';

export const CATALOG_FILTER_KEYS = ['category', 'tag', 'q', 'page'] as const;
export const CATALOG_MAX_PAGE = 1000;
export const CATALOG_SEARCH_MAX_LENGTH = 100;

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

interface CatalogFilters {
  category?: string;
  tag?: string;
  q?: string;
  page: number;
}

export function parseCatalogFilters(searchParams: CatalogSearchParams) {
  const filters: CatalogFilters = { page: 1 };
  let invalid = false;

  for (const key of CATALOG_FILTER_KEYS) {
    const value = searchParams[key];
    if (value === undefined) continue;

    if (typeof value !== 'string') {
      invalid = true;
      continue;
    }

    if (key === 'page') {
      const page = Number(value);
      if (/^[1-9]\d{0,3}$/.test(value) && page <= CATALOG_MAX_PAGE) filters.page = page;
      else invalid = true;
    } else if (key === 'q') {
      const query = value.trim();
      if (query && query.length <= CATALOG_SEARCH_MAX_LENGTH && !/[\p{Cc}]/u.test(query)) {
        filters.q = query;
      } else {
        invalid = true;
      }
    } else if (value.length > 0) {
      // Existing category slugs predate the tag slug convention and are matched exactly.
      filters[key] = value;
    } else {
      invalid = true;
    }
  }

  return { filters, invalid };
}

export function catalogHref(locale: Locale, filters: Partial<CatalogFilters> = {}): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.q) params.set('q', filters.q);
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  return `/${locale}/store${query ? `?${query}` : ''}`;
}
