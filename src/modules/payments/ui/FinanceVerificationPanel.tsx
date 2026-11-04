'use client';

/**
 * MWHEBA 2.0 | Corporate Finance Bank Transfer Verification Panel (PAY-03)
 *
 * Provides finance officers with a calm, minimal, corporate interface to review
 * incoming wire deposit receipts, verify exact piastre totals, and approve or
 * reject bank transfers with audit logging and reconciliation tracking.
 *
 * Rules followed:
 * - Only CSS variables from :root (never hardcode hex or rgb).
 * - Flat colors only, zero gradients.
 * - Arabic / English bilingual UI copy.
 */

import React, { useState } from 'react';

export interface BankTransferItem {
  id: string | number;
  orderId: string | number;
  orderNumber?: string;
  orderTotal: number;
  claimedAmount: number;
  confirmedAmount?: number;
  bankReferenceCode: string;
  internalReconciliationCode?: string;
  receiptStorageKey?: string;
  receiptFileId?: string | number;
  status: 'pending_verification' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedAt?: string;
  customerName?: string;
  customerEmail?: string;
}

interface FinanceVerificationPanelProps {
  transfers: BankTransferItem[];
  authToken?: string;
  onVerificationComplete?: (transferId: string | number, action: 'approve' | 'reject', result: any) => void;
  locale?: 'ar' | 'en';
}

export function FinanceVerificationPanel({
  transfers: initialTransfers,
  authToken,
  onVerificationComplete,
  locale = 'ar',
}: FinanceVerificationPanelProps) {
  const isArabic = locale === 'ar';
  const [transfers, setTransfers] = useState<BankTransferItem[]>(initialTransfers);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  // Per-transfer form state
  const [selectedTransferId, setSelectedTransferId] = useState<string | number | null>(
    initialTransfers.find((t) => t.status === 'pending_verification')?.id || null
  );
  const [confirmedAmount, setConfirmedAmount] = useState<string>('');
  const [reconciliationCode, setReconciliationCode] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [activeAction, setActiveAction] = useState<'approve' | 'reject'>('approve');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedTransfer = transfers.find((t) => String(t.id) === String(selectedTransferId));

  // Pre-fill confirmed amount when selecting a transfer
  const handleSelectTransfer = (transfer: BankTransferItem) => {
    setSelectedTransferId(transfer.id);
    setConfirmedAmount(String(transfer.orderTotal));
    setReconciliationCode('');
    setRejectionReason('');
    setFeedback(null);
  };

  const handleVerify = async (action: 'approve' | 'reject') => {
    if (!selectedTransfer) return;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const body: any = {
        transferId: selectedTransfer.id,
        action,
      };

      if (action === 'approve') {
        const numAmount = parseFloat(confirmedAmount);
        if (isNaN(numAmount) || numAmount <= 0) {
          throw new Error(isArabic ? 'يرجى إدخال مبلغ إيداع صحيح مؤكد.' : 'Please enter a valid confirmed deposit amount.');
        }
        if (!reconciliationCode.trim()) {
          throw new Error(isArabic ? 'كود مطابقة كشف الحساب البنكي إلزامي للاعتماد.' : 'Bank statement reconciliation code is required for approval.');
        }
        body.confirmedAmount = numAmount;
        body.internalReconciliationCode = reconciliationCode.trim();
      } else {
        if (!rejectionReason.trim()) {
          throw new Error(isArabic ? 'سبب الرفض إلزامي عند رفض التحويل.' : 'Rejection reason is required when rejecting.');
        }
        body.rejectionReason = rejectionReason.trim();
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `JWT ${authToken}`;
      }

      const res = await fetch('/api/payments/bank-transfer/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || (isArabic ? 'فشلت عملية المراجعة المالية' : 'Verification failed'));
      }

      // Update local state
      setTransfers((prev) =>
        prev.map((t) =>
          String(t.id) === String(selectedTransfer.id)
            ? {
                ...t,
                status: action === 'approve' ? 'approved' : 'rejected',
                confirmedAmount: action === 'approve' ? body.confirmedAmount : undefined,
                internalReconciliationCode: action === 'approve' ? body.internalReconciliationCode : undefined,
                rejectionReason: action === 'reject' ? body.rejectionReason : undefined,
              }
            : t
        )
      );

      setFeedback({
        type: 'success',
        message:
          action === 'approve'
            ? isArabic
              ? `تم اعتماد التحويل البنكي وتحديث الطلب #${selectedTransfer.orderId} إلى مدفوع (Paid).`
              : `Bank transfer approved. Order #${selectedTransfer.orderId} marked as paid.`
            : isArabic
              ? `تم رفض التحويل البنكي وتحديث حالة السداد إلى فشل (Failed).`
              : `Bank transfer rejected. Payment marked as failed.`,
      });

      if (onVerificationComplete) {
        onVerificationComplete(selectedTransfer.id, action, data);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || (isArabic ? 'حدث خطأ غير متوقع' : 'An error occurred'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingTransfers = transfers.filter((t) => t.status === 'pending_verification');
  const historyTransfers = transfers.filter((t) => t.status !== 'pending_verification');
  const displayedList = activeTab === 'pending' ? pendingTransfers : historyTransfers;

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        padding: '1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'inherit',
      }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)', margin: 0 }}>
            {isArabic ? 'لوحة المراجعة والمطابقة المالية للتحويلات البنكية (PAY-03)' : 'Corporate Bank Wire Finance Verification (PAY-03)'}
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isArabic ? 'مراجعة إشعارات الإيداع، مطابقة المبالغ بالقرش، والربط بكشف الحساب البنكي' : 'Audit deposit slips, verify exact penny totals, and reconcile with official bank statements'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: activeTab === 'pending' ? 'var(--brand-primary)' : 'var(--bg-secondary)',
              color: activeTab === 'pending' ? 'var(--text-inverse)' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            {isArabic ? `في انتظار المراجعة (${pendingTransfers.length})` : `Pending Review (${pendingTransfers.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-default)',
              backgroundColor: activeTab === 'history' ? 'var(--brand-primary)' : 'var(--bg-secondary)',
              color: activeTab === 'history' ? 'var(--text-inverse)' : 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
            }}
          >
            {isArabic ? `سجل المعاملات السابقة (${historyTransfers.length})` : `Settled History (${historyTransfers.length})`}
          </button>
        </div>
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

      {/* Main Grid: List on side, details/action in center */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 2fr', gap: '1.5rem' }}>
        {/* Transfers List */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: '0.875rem' }}>
            {activeTab === 'pending'
              ? isArabic ? 'التحويلات المعلقة' : 'Pending Transfers'
              : isArabic ? 'التحويلات المنتهية' : 'Completed Transfers'}
          </div>
          <div style={{ maxHeight: '560px', overflowY: 'auto' }}>
            {displayedList.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {isArabic ? 'لا توجد طلبات في هذا السجل حاليًا.' : 'No transfers found in this view.'}
              </div>
            ) : (
              displayedList.map((t) => {
                const isSelected = String(t.id) === String(selectedTransferId);
                return (
                  <div
                    key={t.id}
                    onClick={() => handleSelectTransfer(t)}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--status-info-bg)' : 'transparent',
                      cursor: 'pointer',
                      borderRight: isSelected ? '3px solid var(--brand-primary)' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--brand-primary-dark)' }}>
                        {t.bankReferenceCode}
                      </span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor:
                            t.status === 'approved'
                              ? 'var(--status-success-bg)'
                              : t.status === 'rejected'
                              ? 'var(--status-danger-bg)'
                              : 'var(--status-warning-bg)',
                          color:
                            t.status === 'approved'
                              ? 'var(--status-success)'
                              : t.status === 'rejected'
                              ? 'var(--status-danger)'
                              : 'var(--status-warning)',
                        }}
                      >
                        {t.status === 'approved'
                          ? isArabic ? 'معتمد' : 'Approved'
                          : t.status === 'rejected'
                          ? isArabic ? 'مرفوض' : 'Rejected'
                          : isArabic ? 'قيد المراجعة' : 'Pending'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {isArabic ? `طلب رقم: #${t.orderId}` : `Order: #${t.orderId}`}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{isArabic ? 'المبلغ المزعوم:' : 'Claimed:'}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{Number(t.claimedAmount).toLocaleString()} ج.م</strong>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Transfer Detail & Finance Action Card */}
        <div>
          {selectedTransfer ? (
            <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '1.5rem', backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {isArabic ? 'تفاصيل التحويل البنكي' : 'Bank Transfer Detail'}
                  </span>
                  <h3 style={{ margin: '0.25rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                    {selectedTransfer.bankReferenceCode}
                  </h3>
                </div>
                <div style={{ textAlign: isArabic ? 'left' : 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isArabic ? 'رقم الطلب' : 'Order ID'}</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>#{selectedTransfer.orderId}</div>
                </div>
              </div>

              {/* Data Summary Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem', backgroundColor: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{isArabic ? 'إجمالي الطلب المجمد' : 'Frozen Order Total'}</span>
                  <strong style={{ fontSize: '1.125rem', color: 'var(--brand-primary-dark)' }}>{Number(selectedTransfer.orderTotal).toLocaleString()} ج.م</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{isArabic ? 'المبلغ المزعوم من العميل' : 'Customer Claimed Amount'}</span>
                  <strong style={{ fontSize: '1.125rem', color: Number(selectedTransfer.claimedAmount) === Number(selectedTransfer.orderTotal) ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {Number(selectedTransfer.claimedAmount).toLocaleString()} ج.م
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{isArabic ? 'إشعار الإيداع المرفوع' : 'Uploaded Receipt Slip'}</span>
                  {selectedTransfer.receiptStorageKey ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--brand-primary)', fontFamily: 'monospace' }}>
                      {selectedTransfer.receiptStorageKey}
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{isArabic ? 'لم يُرفق ملف' : 'No file attached'}</span>
                  )}
                </div>
              </div>

              {/* Readonly info for already settled transfers */}
              {selectedTransfer.status !== 'pending_verification' ? (
                <div style={{ padding: '1rem', backgroundColor: selectedTransfer.status === 'approved' ? 'var(--status-success-bg)' : 'var(--status-danger-bg)', borderRadius: 'var(--radius-sm)', border: `1px solid ${selectedTransfer.status === 'approved' ? 'var(--status-success)' : 'var(--status-danger)'}` }}>
                  <div style={{ fontWeight: 700, color: selectedTransfer.status === 'approved' ? 'var(--status-success)' : 'var(--status-danger)', marginBottom: '0.5rem' }}>
                    {selectedTransfer.status === 'approved'
                      ? isArabic ? 'تمت المطابقة والاعتماد بنجاح' : 'Transfer Approved & Reconciled'
                      : isArabic ? 'تم رفض التحويل' : 'Transfer Rejected'}
                  </div>
                  {selectedTransfer.status === 'approved' && (
                    <div style={{ fontSize: '0.875rem' }}>
                      <div>{isArabic ? `المبلغ المؤكد: ${selectedTransfer.confirmedAmount} ج.م` : `Confirmed Amount: ${selectedTransfer.confirmedAmount} EGP`}</div>
                      <div>{isArabic ? `كود المطابقة البنكية: ${selectedTransfer.internalReconciliationCode}` : `Reconciliation Code: ${selectedTransfer.internalReconciliationCode}`}</div>
                    </div>
                  )}
                  {selectedTransfer.status === 'rejected' && (
                    <div style={{ fontSize: '0.875rem' }}>
                      <div>{isArabic ? `سبب الرفض: ${selectedTransfer.rejectionReason}` : `Rejection Reason: ${selectedTransfer.rejectionReason}`}</div>
                    </div>
                  )}
                </div>
              ) : (
                /* Finance Verification Form (Pending Only) */
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setActiveAction('approve')}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: activeAction === 'approve' ? 'var(--status-success)' : 'var(--bg-secondary)',
                        color: activeAction === 'approve' ? '#fff' : 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      {isArabic ? 'اعتماد ومطابقة (Approve)' : 'Approve & Settle'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveAction('reject')}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: activeAction === 'reject' ? 'var(--status-danger)' : 'var(--bg-secondary)',
                        color: activeAction === 'reject' ? '#fff' : 'var(--text-primary)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                      }}
                    >
                      {isArabic ? 'رفض التحويل (Reject)' : 'Reject Transfer'}
                    </button>
                  </div>

                  {activeAction === 'approve' ? (
                    <div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          {isArabic ? 'المبلغ الفعلي المؤكد بكشف الحساب (ج.م) *' : 'Confirmed Deposit Amount from Statement (EGP) *'}
                        </label>
                        <input
                          type="number"
                          value={confirmedAmount}
                          onChange={(e) => setConfirmedAmount(e.target.value)}
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
                          {isArabic ? 'يشترط التطابق التام بالقرش مع إجمالي الطلب.' : 'Exact integer piastre equality with order total is strictly required.'}
                        </span>
                      </div>

                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          {isArabic ? 'كود مطابقة كشف الحساب البنكي الداخلي *' : 'Internal Bank Statement Reconciliation Code *'}
                        </label>
                        <input
                          type="text"
                          value={reconciliationCode}
                          placeholder={isArabic ? 'مثال: CIB-STMT-2026-11-04-001' : 'e.g. CIB-STMT-2026-11-04-001'}
                          onChange={(e) => setReconciliationCode(e.target.value)}
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
                          {isArabic ? 'يمنع النظام تكرار نفس الكود لأي تحويل آخر لضمان عدم ازدواجية التسوية.' : 'System strictly prohibits reusing the same code across transfers.'}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleVerify('approve')}
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
                          ? isArabic ? 'جارٍ تسجيل الاعتماد والتسوية...' : 'Recording Settlement...'
                          : isArabic ? 'اعتماد التحويل المالي وتأكيد السداد (Approve)' : 'Confirm & Settle Transfer'}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                          {isArabic ? 'سبب الرفض المالي الموثق *' : 'Documented Financial Rejection Reason *'}
                        </label>
                        <textarea
                          rows={4}
                          value={rejectionReason}
                          placeholder={isArabic ? 'اذكر سبب الرفض (عدم ظهور الإيداع بكشف الحساب، اختلاف المبلغ، إلخ)' : 'State documented reason for rejection'}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-default)',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.875rem',
                            resize: 'vertical',
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleVerify('reject')}
                        style={{
                          width: '100%',
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'var(--status-danger)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.9375rem',
                          border: 'none',
                          cursor: isSubmitting ? 'not-allowed' : 'pointer',
                          opacity: isSubmitting ? 0.7 : 1,
                        }}
                      >
                        {isSubmitting
                          ? isArabic ? 'جارٍ تسجيل الرفض...' : 'Recording Rejection...'
                          : isArabic ? 'تأكيد رفض التحويل البنكي (Reject)' : 'Confirm Rejection'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)' }}>
              {isArabic ? 'يرجى اختيار تحويل بنكي من القائمة لعرض تفاصيله وإجراءات المراجعة.' : 'Please select a bank transfer to inspect and review.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}