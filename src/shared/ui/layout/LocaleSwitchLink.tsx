'use client';

import React, { Suspense, type ComponentProps } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CATALOG_FILTER_KEYS } from '@/modules/catalog/services/catalogFilters';

type LocaleSwitchLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & { href: string };

function StoreLocaleSwitchLink({ href, ...props }: LocaleSwitchLinkProps) {
  const searchParams = useSearchParams();
  const storeParams = new URLSearchParams();
  for (const key of CATALOG_FILTER_KEYS) {
    searchParams.getAll(key).forEach((value) => storeParams.append(key, value));
  }
  const query = storeParams.toString();
  return <Link {...props} href={`${href}/store${query ? `?${query}` : ''}`} prefetch={false} />;
}

function LocaleSwitchDestination(props: LocaleSwitchLinkProps) {
  const pathname = usePathname();
  if (pathname === '/ar/store' || pathname === '/en/store') {
    return <StoreLocaleSwitchLink {...props} />;
  }
  return <Link {...props} />;
}

export function LocaleSwitchLink(props: LocaleSwitchLinkProps) {
  return (
    <Suspense fallback={<Link {...props} />}>
      <LocaleSwitchDestination {...props} />
    </Suspense>
  );
}
