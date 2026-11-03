'use client';

import React, { useState, useTransition } from 'react';
import { submitInquiry, type SubmitInquiryResult } from '../actions/submitInquiry';

interface ContactInquiryFormProps {
  locale: 'ar' | 'en';
}

export function ContactInquiryForm({ locale }: ContactInquiryFormProps) {
  const isArabic = locale === 'ar';
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SubmitInquiryResult | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    serviceInterest: 'branding',
    estimatedBudget: '',
    projectDetails: '',
    honeypot: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setFieldErrors({});

    startTransition(async () => {
      const res = await submitInquiry({
        ...formData,
        locale,
      });

      setResult(res);
      if (res.errors) {
        setFieldErrors(res.errors);
      } else if (res.success) {
        // Reset form
        setFormData({
          fullName: '',
          email: '',
          phone: '',
          companyName: '',
          serviceInterest: 'branding',
          estimatedBudget: '',
          projectDetails: '',
          honeypot: '',
        });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Honeypot field (hidden from real users, attractive to spam bots) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: 'none',
          height: 0,
          width: 0,
          overflow: 'hidden',
          margin: 0,
          padding: 0,
        }}
      >
        <label htmlFor="company_website_url">Leave this empty</label>
        <input
          id="company_website_url"
          type="text"
          name="honeypot"
          value={formData.honeypot}
          onChange={handleChange}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Status Feedback Messages */}
      {result && result.success && (
        <div
          role="status"
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--status-success-bg, #f0fdf4)',
            border: '1px solid var(--status-success, #22c55e)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--status-success, #166534)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}
        >
          {result.message}
        </div>
      )}

      {result && !result.success && (
        <div
          role="alert"
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--status-error-bg, #fef2f2)',
            border: '1px solid var(--status-error, #ef4444)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--status-error, #991b1b)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}
        >
          {result.message}
        </div>
      )}

      {/* Row 1: Full Name & Work Email */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div>
          <label
            htmlFor="inquiry-fullName"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isArabic ? 'الاسم الكامل *' : 'Full Name *'}
          </label>
          <input
            id="inquiry-fullName"
            type="text"
            name="fullName"
            required
            value={formData.fullName}
            onChange={handleChange}
            placeholder={isArabic ? 'مثال: محمد الشريف' : 'e.g. John Doe'}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid ${fieldErrors.fullName ? 'var(--status-error, #ef4444)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {fieldErrors.fullName && (
            <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--status-error, #ef4444)' }}>
              {fieldErrors.fullName[0]}
            </span>
          )}
        </div>

        <div>
          <label
            htmlFor="inquiry-email"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isArabic ? 'البريد الإلكتروني المهني *' : 'Work Email *'}
          </label>
          <input
            id="inquiry-email"
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder={isArabic ? 'name@company.com' : 'name@company.com'}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid ${fieldErrors.email ? 'var(--status-error, #ef4444)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {fieldErrors.email && (
            <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--status-error, #ef4444)' }}>
              {fieldErrors.email[0]}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Phone Number & Company Name */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div>
          <label
            htmlFor="inquiry-phone"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isArabic ? 'رقم الهاتف / الواتساب *' : 'Phone / WhatsApp *'}
          </label>
          <input
            id="inquiry-phone"
            type="tel"
            name="phone"
            required
            value={formData.phone}
            onChange={handleChange}
            placeholder={isArabic ? '+20 100 000 0000' : '+20 100 000 0000'}
            dir="ltr"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid ${fieldErrors.phone ? 'var(--status-error, #ef4444)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none',
              textAlign: isArabic ? 'right' : 'left',
              boxSizing: 'border-box',
            }}
          />
          {fieldErrors.phone && (
            <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--status-error, #ef4444)' }}>
              {fieldErrors.phone[0]}
            </span>
          )}
        </div>

        <div>
          <label
            htmlFor="inquiry-companyName"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isArabic ? 'اسم الشركة أو المؤسسة' : 'Company / Organization Name'}
          </label>
          <input
            id="inquiry-companyName"
            type="text"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            placeholder={isArabic ? 'شركة موهبة' : 'Company Inc.'}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Row 3: Service Interest & Estimated Budget */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        <div>
          <label
            htmlFor="inquiry-serviceInterest"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isArabic ? 'الخدمة الرئيسية المطلوبة *' : 'Primary Service Needed *'}
          </label>
          <select
            id="inquiry-serviceInterest"
            name="serviceInterest"
            value={formData.serviceInterest}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid ${fieldErrors.serviceInterest ? 'var(--status-error, #ef4444)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            <option value="branding">{isArabic ? 'بناء وتطوير الهوية المؤسسية (Branding)' : 'Branding & Visual Identity'}</option>
            <option value="marketing">{isArabic ? 'التسويق الرقمي وإدارة الحملات (Marketing)' : 'Digital Marketing & Growth'}</option>
            <option value="merchandise">{isArabic ? 'الهدايا المؤسسية والطباعة الترويجية (Merchandise)' : 'Corporate Merchandise & Gifts'}</option>
            <option value="media">{isArabic ? 'الإنتاج الإعلامي والمرئي (Media & Production)' : 'Media & Video Production'}</option>
            <option value="general">{isArabic ? 'استشارة عامة لمشروع متكامل (General Consultation)' : 'General Corporate Consultation'}</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="inquiry-estimatedBudget"
            style={{
              display: 'block',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isArabic ? 'الميزانية التقديرية (ج.م)' : 'Estimated Budget (EGP)'}
          </label>
          <select
            id="inquiry-estimatedBudget"
            name="estimatedBudget"
            value={formData.estimatedBudget}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.9375rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            <option value="">{isArabic ? 'اختر الميزانية المتوقعة...' : 'Select anticipated budget...'}</option>
            <option value="under_50k">{isArabic ? 'أقل من 50,000 ج.م' : 'Under 50,000 EGP'}</option>
            <option value="50k_150k">{isArabic ? '50,000 - 150,000 ج.م' : '50,000 - 150,000 EGP'}</option>
            <option value="150k_500k">{isArabic ? '150,000 - 500,000 ج.م' : '150,000 - 500,000 EGP'}</option>
            <option value="above_500k">{isArabic ? 'أكثر من 500,000 ج.م' : 'Above 500,000 EGP'}</option>
            <option value="undisclosed">{isArabic ? 'غير محدد حاليًا / نناقشها لاحقًا' : 'Undisclosed / Discuss later'}</option>
          </select>
        </div>
      </div>

      {/* Row 4: Project Details */}
      <div>
        <label
          htmlFor="inquiry-projectDetails"
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {isArabic ? 'تفاصيل المشروع وأهدافه *' : 'Project Details & Objectives *'}
        </label>
        <textarea
          id="inquiry-projectDetails"
          name="projectDetails"
          required
          rows={5}
          value={formData.projectDetails}
          onChange={handleChange}
          placeholder={
            isArabic
              ? 'اشرح أهدافك، المخرجات المطلوبة، الجدول الزمني المتوقع، وأي تفاصيل أخرى تساعدنا في تقديم مقترح دقيق...'
              : 'Describe your goals, desired deliverables, target timeline, and any specifics to help us prepare a tailored proposal...'
          }
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-primary)',
            border: `1px solid ${fieldErrors.projectDetails ? 'var(--status-error, #ef4444)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontSize: '0.9375rem',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {fieldErrors.projectDetails && (
          <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--status-error, #ef4444)' }}>
            {fieldErrors.projectDetails[0]}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: '0.85rem 2rem',
          backgroundColor: isPending ? 'var(--bg-muted)' : 'var(--brand-primary)',
          color: 'var(--text-inverse, #ffffff)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.9375rem',
          fontWeight: 700,
          cursor: isPending ? 'not-allowed' : 'pointer',
          alignSelf: isArabic ? 'flex-start' : 'flex-start',
          transition: 'background-color 0.2s ease',
        }}
      >
        {isPending
          ? isArabic
            ? 'جاري إرسال الطلب...'
            : 'Submitting Inquiry...'
          : isArabic
            ? 'إرسال طلب المشروع'
            : 'Submit Project Inquiry'}
      </button>
    </form>
  );
}
