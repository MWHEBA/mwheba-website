import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { isValidLocale } from '@/shared/lib/i18n';
import { ServiceBriefForm, type BriefJobSummary } from '@/modules/fulfillment/ui/ServiceBriefForm';

// Per-customer, session-dependent page: never statically rendered or cached.
export const dynamic = 'force-dynamic';

interface BriefPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: BriefPageProps): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  return {
    title: isArabic ? 'Brief الخدمة | وكالة موهبة' : 'Service Brief | MWHEBA Agency',
    robots: { index: false, follow: false },
  };
}

const idOf = (rel: any) => (typeof rel === 'object' && rel !== null ? rel.id : rel);

export default async function ServiceBriefPage({ params }: BriefPageProps) {
  const { locale, id } = await params;
  if (!isValidLocale(locale)) notFound();

  const payload = await getPayload({ config: configPromise });

  let user: any = null;
  try {
    const auth = await payload.auth({ headers: await headers() });
    user = auth?.user ?? null;
  } catch {
    user = null;
  }

  // Unauthenticated visitors only see the sign-in panel; nothing about the order is disclosed.
  if (!user) {
    return <ServiceBriefForm locale={locale} orderId={id} orderNumber={null} authenticated={false} jobs={[]} />;
  }

  const order: any = await payload.findByID({ collection: 'orders', id, depth: 0 }).catch(() => null);
  if (!order || String(idOf(order.customer)) !== String(user.id)) {
    notFound();
  }

  const jobDocs = await payload.find({
    collection: 'fulfillment-jobs',
    where: { and: [{ order: { equals: order.id } }, { track: { equals: 'service' } }] },
    sort: 'lineIndex',
    limit: 50,
    depth: 0,
  });
  const jobs: BriefJobSummary[] = (jobDocs.docs as any[]).map((job) => ({
    id: job.id,
    title: job.productTitle || `#${job.id}`,
    status: job.status,
  }));

  return (
    <ServiceBriefForm
      locale={locale}
      orderId={order.id}
      orderNumber={order.orderNumber ?? null}
      authenticated
      jobs={jobs}
    />
  );
}
