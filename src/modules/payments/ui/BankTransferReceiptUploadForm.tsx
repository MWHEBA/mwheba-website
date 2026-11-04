'use client';

/**
 * MWHEBA 2.0 | Customer Bank Transfer Receipt Upload Form (PAY-03)
 *
 * Allows customers to submit their bank transfer payment proof after placing an order.
 * - Displays official bank coordinates (when active) or pre-launch review coordination notice.
 * - Uploads receipt slip (PDF / PNG / JPEG) securely to private artwork-assets.
 * - Submits bank transfer reference and claimed amount to /api/payments/bank-transfer/submit.
 *
 * Rules:
 * - Only CSS variables from :root (never hardcode hex or rgb).
 * - Flat colors only, zero gradients.
 * - Calm, minimal, elegant corporate design.
 * - Bilingual Arabic / English.
 */

import React, { useState } from 'react';

interface BankTransferReceiptUploadFormProps {
  orderId: string | number;
  orderNumber?: string | null;
  orderTotal: number;
  bankDetails?: {
    status: 'pending_configuration' | 'active';
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
    swiftCode?: string | null;
    instapayHandle?: string | null;
    bankInstructions?: string | null;
  } | null;
  locale?: string;
  onSuccess?: (result: any) => void;
}

export function BankTransferReceiptUploadForm({
  orderId,
  orderNumber,
  orderTotal,
  bankDetails,
  locale = 'ar',
  onSuccess,
}: BankTransferReceiptUploadFormProps) {
  const isArabic = locale === 'ar';

  const [bankReferenceCode, setBankReferenceCode] = useState('');
  const [claimedAmount, setClaimedAmount] = useState(String(orderTotal));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Max 15MB
      if (file.size > 15 * 1024 * 1024) {
        setFeedback({
          type: 'error',
          message: isArabic
            ? 'حجم الملف يتجاوز الحد الأقصى المسموح به (15 ميجابايت).'
            : 'File size exceeds maximum permitted limit (15MB).',
        });
        return;
      }
      setSelectedFile(file);
      setFeedback(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const ref = bankReferenceCode.trim();
    if (!ref) {
      setFeedback({
        type: 'error',
        message: isArabic
          ? 'يرجى إدخال رقم العملية أو المرجع البنكي المدون في إشعار التحويل.'
          : 'Please enter the transaction reference code from your bank transfer slip.',
      });
      return;
    }

    const numAmount = parseFloat(claimedAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFeedback({
        type: 'error',
        message: isArabic
          ? 'يرجى إدخال مبلغ إيداع صحيح.'
          : 'Please enter a valid deposit amount.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let receiptStorageKey: string | undefined;
      let receiptFileId: string | number | undefined;

      // 1. If a file is selected, upload to private assets
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/customization/upload-artwork', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          throw new Error(
            uploadData.error || (isArabic ? 'فشل رفع ملف الإشعار البنكي.' : 'Failed to upload bank receipt file.')
          );
        }

        receiptStorageKey = uploadData.storageKey;
        receiptFileId = uploadData.assetId;
      }

      // 2. Submit bank transfer verification request
      const submitRes = await fetch('/api/payments/bank-transfer/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          claimedAmount: numAmount,
          bankReferenceCode: ref,
          receiptStorageKey,
          receiptFileId,
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok || !submitData.success) {
        throw new Error(
          submitData.error || (isArabic ? 'فشل تسجيل إشعار التحويل البنكي.' : 'Failed to register bank transfer.')
        );
      }

      setIsSubmitted(true);
      setFeedback({
        type: 'success',
        message: isArabic
          ? 'تم استلام بيانات التحويل البنكي وإشعار الإيداع بنجاح. الطلب الآن قيد المراجعة والمطابقة المالية.'
          : 'Bank transfer details and receipt received successfully. Your order is now under finance verification.',
      });

      if (onSuccess) {
        onSuccess(submitData);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || (isArabic ? 'حدث خطأ أثناء إرسال الإشعار.' : 'An unexpected error occurred.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        padding: '1.5rem',
        maxWidth: '720px',
        margin: '0 auto',
      }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Title */}
      <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
          {isArabic ? 'إرسال إشعار السداد البنكي للطلب' : 'Submit Bank Transfer Payment Proof'}
        </h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {orderNumber ? `${isArabic ? 'طلب رقم:' : 'Order:'} ${orderNumber}` : `#${orderId}`} • {Number(orderTotal).toLocaleString()} {isArabic ? 'ج.م' : 'EGP'}
        </p>
      </div>

      {/* Official Bank Coordinates Card */}
      <div
        style={{
          padding: '1rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8125rem',
          marginBottom: '1.5rem',
        }}
      >
        {bankDetails?.status === 'active' ? (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '0.5rem' }}>
              {isArabic ? 'بيانات الحساب البنكي الرسمي المعتمد للتحويل:' : 'Official Corporate Bank Wire Coordinates:'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
              {bankDetails.bankName && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'البنك' : 'Bank'}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{bankDetails.bankName}</strong>
                </div>
              )}
              {bankDetails.accountName && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'المستفيد' : 'Beneficiary'}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{bankDetails.accountName}</strong>
                </div>
              )}
              {bankDetails.accountNumber && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>{isArabic ? 'رقم الحساب' : 'Account No.'}</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.accountNumber}</strong>
                </div>
              )}
              {bankDetails.iban && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>IBAN</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.iban}</strong>
                </div>
              )}
              {bankDetails.swiftCode && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>SWIFT</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.swiftCode}</strong>
                </div>
              )}
              {bankDetails.instapayHandle && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block' }}>Instapay</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{bankDetails.instapayHandle}</strong>
                </div>
              )}
            </div>
            {bankDetails.bankInstructions && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem' }}>
                {bankDetails.bankInstructions}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <div style={{ fontWeight: 600, color: 'var(--brand-primary-dark)', marginBottom: '0.25rem' }}>
              {isArabic ? 'تنسيق التحويل البنكي المؤسسي:' : 'Corporate Bank Wire Coordination:'}
            </div>
            <div>
              {isArabic
                ? 'بيانات الحساب البنكي والتنسيق المالي يتم تزويدكم بها مع الفاتورة المعتمدة بعد مراجعة الطلب لضمان دقة العمليات قبل الإطلاق الرسمي.'
                : 'Bank wire coordinates and financial invoice coordination are provided following order review prior to official launch.'}
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.25rem',
            fontSize: '0.875rem',
            border: `1px solid ${feedback.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)'}`,
            backgroundColor: feedback.type === 'success' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)',
            color: feedback.type === 'success' ? 'var(--status-success)' : 'var(--status-danger)',
          }}
        >
          {feedback.message}
        </div>
      )}

      {isSubmitted ? (
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--status-info-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--brand-primary)', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--brand-primary-dark)', marginBottom: '0.5rem' }}>
            {isArabic ? '✓ تم تقديم الإشعار بنجاح' : '✓ Payment Proof Submitted'}
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isArabic
              ? 'يقوم الفريق المالي بمطابقة الإيداع مع كشف الحساب البنكي، وسيتم تحديث حالة الطلب إلى (مدفوع) فور اكتمال المطابقة.'
              : 'Our finance team is currently reconciling the deposit with official bank statements. Order will update to (Paid) upon clearance.'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Bank Reference */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              {isArabic ? 'رقم العملية أو المرجع البنكي المدون بالإيصال *' : 'Bank Reference / Transaction Code *'}
            </label>
            <input
              type="text"
              required
              value={bankReferenceCode}
              placeholder={isArabic ? 'مثال: CIB-TXN-20261104-987' : 'e.g. CIB-TXN-20261104-987'}
              onChange={(e) => setBankReferenceCode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
              }}
            />
          </div>

          {/* Claimed Amount */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              {isArabic ? 'المبلغ المحول فعليًا (ج.م) *' : 'Actual Transferred Amount (EGP) *'}
            </label>
            <input
              type="number"
              required
              step="any"
              value={claimedAmount}
              onChange={(e) => setClaimedAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '0.9375rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
              {isArabic ? `المبلغ المطلوب سداده بالكامل: ${Number(orderTotal).toLocaleString()} ج.م` : `Required total to settle: ${Number(orderTotal).toLocaleString()} EGP`}
            </span>
          </div>

          {/* Receipt File Upload */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              {isArabic ? 'إرفاق إشعار الإيداع أو التحويل (PDF أو صورة)' : 'Attach Deposit Slip / Transfer Receipt (PDF or Image)'}
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileChange}
              style={{
                width: '100%',
                padding: '0.5rem 0',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
              {isArabic ? 'الملف يُحفظ مشفرًا في مستودع آمن ومخصص للمطابقة المالية فقط.' : 'Receipt file is stored securely in private object storage for finance reconciliation only.'}
            </span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--brand-primary)',
              color: 'var(--text-inverse)',
              fontWeight: 700,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting
              ? isArabic ? 'جارٍ رفع الإشعار وإرسال البيانات...' : 'Submitting Receipt...'
              : isArabic ? 'تأكيد إرسال إشعار التحويل البنكي' : 'Submit Bank Transfer Proof'}
          </button>
        </form>
      )}
    </div>
  );
}