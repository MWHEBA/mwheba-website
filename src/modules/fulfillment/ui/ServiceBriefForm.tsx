'use client';

import React, { useState } from 'react';
import { Badge, Button } from '@/shared/ui/primitives';

export interface BriefJobSummary {
  id: number;
  title: string;
  status: string;
}

interface ServiceBriefFormProps {
  locale: string;
  orderId: number | string;
  orderNumber: string | null;
  authenticated: boolean;
  jobs: BriefJobSummary[];
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--brand-primary-dark)',
  marginBottom: '0.25rem',
};

const cardStyle: React.CSSProperties = {
  padding: '1.5rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-default)',
  backgroundColor: 'var(--bg-surface)',
};

/**
 * Customer creative-brief intake for fixed-price service packages (B2B-05, D-003).
 * Requires an authenticated customer session; the server re-verifies order ownership on every request.
 */
export function ServiceBriefForm({ locale, orderId, orderNumber, authenticated, jobs }: ServiceBriefFormProps) {
  const isArabic = locale === 'ar';
  const pendingJobs = jobs.filter((job) => job.status === 'pending_brief');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  // Derived from props so a late-arriving job list (e.g. after sign-in) is never ignored
  const jobId = pendingJobs.some((job) => job.id === selectedJobId) ? selectedJobId : pendingJobs[0]?.id ?? null;
  const [targetAudience, setTargetAudience] = useState('');
  const [brandValues, setBrandValues] = useState('');
  const [existingGuidelines, setExistingGuidelines] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) throw new Error(isArabic ? 'بيانات الدخول غير صحيحة.' : 'Invalid email or password.');
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const uploadAttachment = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/customization/upload-artwork', {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.assetId) {
      throw new Error(data.message || data.error || `Upload failed for ${file.name}`);
    }
    return String(data.assetId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jobId === null) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const attachmentAssetIds: string[] = [];
      for (const file of files) {
        attachmentAssetIds.push(await uploadAttachment(file));
      }
      const res = await fetch(`/api/orders/${orderId}/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          jobId,
          answers: { targetAudience, brandValues, existingGuidelines, notes },
          attachmentAssetIds,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to submit brief');
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const errorBox = error && (
    <div
      role="alert"
      style={{
        marginTop: '1rem',
        padding: '0.85rem 1rem',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--status-error-bg)',
        border: '1px solid var(--status-error)',
        color: 'var(--status-error)',
        fontSize: '0.875rem',
        fontWeight: 600,
      }}
    >
      {error}
    </div>
  );

  return (
    <div className="container" style={{ paddingBlock: '4rem 6rem', maxWidth: '760px' }} dir={isArabic ? 'rtl' : 'ltr'}>
      <header style={{ marginBottom: '2rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--brand-primary-dark)' }}>
          {isArabic ? 'استقبال مشروع خدمة' : 'SERVICE INTAKE'}
          {orderNumber ? ` // ${orderNumber}` : ''}
        </span>
        <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.35rem 0 0.75rem' }}>
          {isArabic ? 'بيانات الـ Brief الإبداعي' : 'Creative Brief'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
          {isArabic
            ? 'ساعدنا نفهم علامتك التجارية وجمهورك قبل بدء العمل على باقة الخدمة.'
            : 'Tell us about your brand and audience before work on your service package begins.'}
        </p>
      </header>

      {!authenticated && (
        <form onSubmit={handleLogin} style={cardStyle}>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0 0 0.5rem' }}>
            {isArabic ? 'سجّل الدخول لإرسال الـ Brief' : 'Sign in to submit your brief'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: 0 }}>
            {isArabic ? 'استخدم الحساب الذي أنشأته عند تأكيد الطلب.' : 'Use the account you created when you placed the order.'}
          </p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={labelStyle}>{isArabic ? 'البريد الإلكتروني' : 'Email'}</label>
              <input type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>{isArabic ? 'كلمة المرور' : 'Password'}</label>
              <input type="password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={fieldStyle} />
            </div>
          </div>
          {errorBox}
          <div style={{ marginTop: '1rem' }}>
            <Button variant="primary" size="md" type="submit" loading={isLoggingIn} loadingText={isArabic ? 'جاري الدخول...' : 'Signing in...'}>
              {isArabic ? 'دخول' : 'Sign in'}
            </Button>
          </div>
        </form>
      )}

      {authenticated && isSubmitted && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <Badge variant="success">{isArabic ? 'تم الاستلام' : 'Received'}</Badge>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: '0.75rem 0' }}>
            {isArabic ? 'تم استلام وتسجيل الـ Brief' : 'Your brief has been received and recorded'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
            {isArabic
              ? 'تم تسجيل الـ Brief على طلبك. سيراجعه فريق الإبداع من لوحة العمليات.'
              : 'The brief is saved on your order. The creative team will review it from their operations queue.'}
          </p>
        </div>
      )}

      {authenticated && !isSubmitted && jobs.length === 0 && (
        <div style={cardStyle}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {isArabic ? 'لا توجد خدمات في هذا الطلب تحتاج Brief.' : 'This order has no service package that needs a brief.'}
          </p>
        </div>
      )}

      {authenticated && !isSubmitted && jobs.length > 0 && pendingJobs.length === 0 && (
        <div style={cardStyle}>
          <Badge variant="success">{isArabic ? 'تم الإرسال مسبقًا' : 'Already submitted'}</Badge>
          <p style={{ margin: '0.75rem 0 0', color: 'var(--text-secondary)' }}>
            {isArabic ? 'تم إرسال الـ Brief لهذا الطلب من قبل.' : 'A brief has already been submitted for this order.'}
          </p>
        </div>
      )}

      {authenticated && !isSubmitted && pendingJobs.length > 0 && (
        <form onSubmit={handleSubmit} style={{ ...cardStyle, display: 'grid', gap: '1.1rem' }}>
          {pendingJobs.length > 1 && (
            <div>
              <label style={labelStyle}>{isArabic ? 'الخدمة' : 'Service package'}</label>
              <select value={jobId ?? ''} onChange={(e) => setSelectedJobId(Number(e.target.value))} style={fieldStyle}>
                {pendingJobs.map((job) => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
              </select>
            </div>
          )}
          {pendingJobs.length === 1 && (
            <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)' }}>{pendingJobs[0].title}</div>
          )}

          <div>
            <label style={labelStyle}>{isArabic ? 'الجمهور المستهدف *' : 'Target audience *'}</label>
            <textarea required rows={3} maxLength={4000} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>{isArabic ? 'قيم العلامة التجارية *' : 'Brand values *'}</label>
            <textarea required rows={3} maxLength={4000} value={brandValues} onChange={(e) => setBrandValues(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>{isArabic ? 'إرشادات الهوية الحالية (اختياري)' : 'Existing guidelines (optional)'}</label>
            <textarea rows={3} maxLength={4000} value={existingGuidelines} onChange={(e) => setExistingGuidelines(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>{isArabic ? 'ملاحظات إضافية (اختياري)' : 'Additional notes (optional)'}</label>
            <textarea rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>{isArabic ? 'مواد مرجعية (حتى 10 ملفات، اختياري)' : 'Reference materials (up to 10 files, optional)'}</label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
              style={fieldStyle}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {isArabic
                ? 'الملفات تُحفظ بشكل خاص ولا تُنشر على الموقع.'
                : 'Files are stored privately and are never published on the site.'}
            </div>
          </div>

          {errorBox}

          <div>
            <Button
              variant="primary"
              size="lg"
              type="submit"
              loading={isSubmitting}
              loadingText={isArabic ? 'جاري الإرسال...' : 'Submitting...'}
              style={{ width: '100%', fontWeight: 700 }}
            >
              {isArabic ? 'إرسال الـ Brief' : 'Submit brief'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
