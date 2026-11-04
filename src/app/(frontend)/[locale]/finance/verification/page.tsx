import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { isValidLocale } from '@/shared/lib/i18n';
import { hasRole } from '@/modules/identity/access/roles';
import { FinanceVerificationPanel, type BankTransferItem } from '@/modules/payments/ui/FinanceVerificationPanel';

export const dynamic = 'force-dynamic';

interface FinancePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: FinancePageProps): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  return {
    title: isArabic ? 'لوحة المراجعة والمطابقة المالية | وكالة موهبة' : 'Finance Verification Portal | MWHEBA Agency',
    robots: { index: false, follow: false },
  };
}

export default async function FinanceVerificationPage({ params }: FinancePageProps) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const isArabic = locale === 'ar';
  const payload = await getPayload({ config: configPromise });

  let user: any = null;
  try {
    const auth = await payload.auth({ headers: await headers() });
    user = auth?.user ?? null;
  } catch {
    user = null;
  }

  // 1. Unauthenticated Gate
  if (!user) {
    return (
      <div className="container" style={{ paddingBlock: '5rem', maxWidth: '580px', textAlign: 'center' }}>
        <div style={{ padding: '2rem', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '0.5rem' }}>
            {isArabic ? 'تسجيل دخول الإدارة المالية' : 'Finance Sign-In Required'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {isArabic
              ? 'يرجى تسجيل الدخول بحساب مصرح له (Finance أو Super Admin) للوصول إلى لوحة مراجعة ومطابقة التحويلات البنكية.'
              : 'Please sign in with authorized credentials (Finance or Super Admin) to access bank transfer verification.'}
          </p>
          <Link
            href={`/${locale}/account`}
            className="btn-primary"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            {isArabic ? 'تسجيل الدخول ←' : 'Sign In →'}
          </Link>
        </div>
      </div>
    );
  }

  // 2. Strict RBAC Gate: finance or super_admin ONLY
  if (!hasRole(user, ['super_admin', 'finance'])) {
    return (
      <div className="container" style={{ paddingBlock: '5rem', maxWidth: '580px', textAlign: 'center' }}>
        <div style={{ padding: '2rem', border: '1px solid var(--status-danger)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--status-danger-bg)' }}>
          <div style={{ fontSize: '2rem', color: 'var(--status-danger)', marginBottom: '0.5rem' }}>⚠</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--status-danger)', marginBottom: '0.5rem' }}>
            {isArabic ? '403 - غير مصرح لك بالوصول' : '403 - Access Forbidden'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>
            {isArabic
              ? 'هذه اللوحة مخصصة حصريًا لمسؤولي الإدارة المالية لمطابقة إشعارات الإيداع البنكي مع الحسابات الرسمية.'
              : 'This portal is restricted exclusively to authorized finance officers for bank reconciliation.'}
          </p>
        </div>
      </div>
    );
  }

  // 3. Authorized -> Fetch bank transfers with linked order details
  const transfersDoc = await payload.find({
    collection: 'bank-transfers',
    sort: '-createdAt',
    limit: 100,
    depth: 1,
  });

  const transfers: BankTransferItem[] = (transfersDoc.docs as any[]).map((doc) => {
    const linkedOrder = typeof doc.order === 'object' && doc.order !== null ? doc.order : null;
    const orderId = linkedOrder?.id || doc.order;
    const orderTotal = Number(linkedOrder?.total || linkedOrder?.amount || doc.claimedAmount || 0);

    return {
      id: doc.id,
      orderId,
      orderNumber: linkedOrder?.orderNumber || `#${orderId}`,
      orderTotal,
      claimedAmount: Number(doc.claimedAmount || 0),
      confirmedAmount: doc.confirmedAmount ? Number(doc.confirmedAmount) : undefined,
      bankReferenceCode: doc.bankReferenceCode,
      internalReconciliationCode: doc.internalReconciliationCode,
      receiptStorageKey: doc.receiptStorageKey,
      receiptFileId: typeof doc.receiptFile === 'object' && doc.receiptFile !== null ? doc.receiptFile.id : doc.receiptFile,
      status: doc.status,
      rejectionReason: doc.rejectionReason,
      submittedAt: doc.createdAt,
    };
  });

  return (
    <div className="container" style={{ paddingBlock: '3rem 5rem' }}>
      <FinanceVerificationPanel
        transfers={transfers}
        locale={locale as 'ar' | 'en'}
      />
    </div>
  );
}