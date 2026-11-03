import type { Payload } from 'payload';
import { logger } from '../../../shared/lib/logger';

export const MAX_EMAIL_RETRY_ATTEMPTS = 3;

export interface InquiryData {
  id: string | number;
  fullName: string;
  email: string;
  phone: string;
  companyName?: string | null;
  serviceInterest: string;
  estimatedBudget?: string | null;
  projectDetails: string;
  createdAt?: string;
  emailDeliveryAttempts?: number;
  emailDeliveryStatus?: string;
}

export interface DispatchResult {
  status: 'sent' | 'failed' | 'skipped_review_mode' | 'already_sent' | 'requires_manual_followup';
  recipient: string;
  subject: string;
  error?: string;
}

export function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
  });
}

async function getInquirySettings(payload: Payload) {
  let recipientEmail = 'sales@mwheba.com';
  let subjectTemplate = '[MWHEBA Lead] استفسار مشروع جديد من {{fullName}} ({{companyName}})';
  let bodyTemplate =
    'تم استلام استفسار مشروع جديد من العميل:\nالاسم: {{fullName}}\nالشركة: {{companyName}}\nالبريد: {{email}}\nالهاتف: {{phone}}\nالخدمة: {{serviceInterest}}\nالميزانية: {{estimatedBudget}}\nالتفاصيل:\n{{projectDetails}}';
  let enableRealDispatch = false;

  try {
    const settings = await payload.findGlobal({
      slug: 'inquiry-settings' as any,
    });
    if (settings) {
      if (settings.recipientEmail) recipientEmail = settings.recipientEmail;
      if (settings.emailSubjectTemplate) subjectTemplate = settings.emailSubjectTemplate;
      if (settings.emailBodyTemplate) bodyTemplate = settings.emailBodyTemplate;
      if (typeof settings.enableRealDispatch === 'boolean') {
        enableRealDispatch = settings.enableRealDispatch;
      }
    }
  } catch (err: any) {
    logger.warn('Could not read inquiry-settings global, using default values', { error: err.message });
  }

  return { recipientEmail, subjectTemplate, bodyTemplate, enableRealDispatch };
}

/**
 * Dispatches notification for a newly saved inquiry.
 * IMPORTANT: This function NEVER throws. If dispatch fails, it records the failure on the inquiry document for future retry.
 */
export async function dispatchInquiryNotification(
  payload: Payload,
  inquiry: InquiryData
): Promise<DispatchResult> {
  const { recipientEmail, subjectTemplate, bodyTemplate, enableRealDispatch } =
    await getInquirySettings(payload);

  const subject = interpolateTemplate(subjectTemplate, {
    fullName: inquiry.fullName,
    companyName: inquiry.companyName || 'فردي / غير محدد',
    serviceInterest: inquiry.serviceInterest,
  });

  const body = interpolateTemplate(bodyTemplate, {
    fullName: inquiry.fullName,
    companyName: inquiry.companyName || 'فردي / غير محدد',
    email: inquiry.email,
    phone: inquiry.phone,
    serviceInterest: inquiry.serviceInterest,
    estimatedBudget: inquiry.estimatedBudget || 'غير محدد',
    projectDetails: inquiry.projectDetails,
  });

  // If real dispatch is disabled (review mode active), record skipped status
  if (!enableRealDispatch) {
    logger.info('Inquiry email dispatch skipped: Review mode active', {
      inquiryId: inquiry.id,
      recipientEmail,
      subject,
    });

    try {
      await payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: {
          emailDeliveryStatus: 'skipped_review_mode',
          emailRecipient: recipientEmail,
          emailDeliveryAttempts: 1,
        },
      });
    } catch (updateErr: any) {
      logger.warn('Failed to update inquiry status to skipped_review_mode', { error: updateErr.message });
    }

    return {
      status: 'skipped_review_mode',
      recipient: recipientEmail,
      subject,
    };
  }

  // Real dispatch mode
  try {
    logger.info('Attempting live email dispatch for inquiry', { inquiryId: inquiry.id, recipientEmail });

    await payload.sendEmail({
      to: recipientEmail,
      subject,
      text: body,
    });

    await payload.update({
      collection: 'inquiries',
      id: inquiry.id,
      data: {
        emailDeliveryStatus: 'sent',
        emailRecipient: recipientEmail,
        emailDeliveredAt: new Date().toISOString(),
        emailDeliveryAttempts: 1,
        emailDeliveryError: null,
      },
    });

    return {
      status: 'sent',
      recipient: recipientEmail,
      subject,
    };
  } catch (sendErr: any) {
    const errorMsg = sendErr?.message || 'Unknown email dispatch error';
    logger.error('Inquiry email dispatch failed. Lead remains securely saved in database for retry.', {
      inquiryId: inquiry.id,
      recipientEmail,
      error: errorMsg,
    });

    try {
      await payload.update({
        collection: 'inquiries',
        id: inquiry.id,
        data: {
          emailDeliveryStatus: 'failed',
          emailDeliveryError: errorMsg,
          emailRecipient: recipientEmail,
          emailDeliveryAttempts: 1,
        },
      });
    } catch (updateErr: any) {
      logger.warn('Failed to update inquiry status to failed', { error: updateErr.message });
    }

    return {
      status: 'failed',
      recipient: recipientEmail,
      subject,
      error: errorMsg,
    };
  }
}

/**
 * Retries a failed inquiry email notification with strict deduplication prevention.
 * If already sent, it does not send again.
 * If attempts exceed MAX_EMAIL_RETRY_ATTEMPTS, it flags the inquiry as 'requires_manual_followup'.
 */
export async function retryFailedInquiryNotification(
  payload: Payload,
  inquiryId: string | number
): Promise<DispatchResult> {
  const inquiry = (await payload.findByID({
    collection: 'inquiries',
    id: inquiryId,
  })) as any;

  if (!inquiry) {
    throw new Error(`Inquiry ${inquiryId} not found`);
  }

  // Deduplication guard: Never re-send an email that was already sent successfully
  if (inquiry.emailDeliveryStatus === 'sent') {
    logger.info('Deduplication guard: Inquiry notification already sent, skipping duplicate dispatch', {
      inquiryId,
    });
    return {
      status: 'already_sent',
      recipient: inquiry.emailRecipient || '',
      subject: 'Already delivered',
    };
  }

  const currentAttempts = Number(inquiry.emailDeliveryAttempts || 0);

  // If already reached max attempts, flag for manual follow-up without retrying
  if (currentAttempts >= MAX_EMAIL_RETRY_ATTEMPTS) {
    logger.warn('Inquiry email reached maximum retry attempts. Flagging for manual sales follow-up.', {
      inquiryId,
      currentAttempts,
    });

    await payload.update({
      collection: 'inquiries',
      id: inquiryId,
      data: {
        emailDeliveryStatus: 'requires_manual_followup',
      },
    });

    return {
      status: 'requires_manual_followup',
      recipient: inquiry.emailRecipient || 'sales@mwheba.com',
      subject: 'Max attempts reached',
      error: 'Max retry attempts reached without mail server delivery',
    };
  }

  const { recipientEmail, subjectTemplate, bodyTemplate, enableRealDispatch } =
    await getInquirySettings(payload);

  const subject = interpolateTemplate(subjectTemplate, {
    fullName: inquiry.fullName,
    companyName: inquiry.companyName || 'فردي / غير محدد',
    serviceInterest: inquiry.serviceInterest,
  });

  const body = interpolateTemplate(bodyTemplate, {
    fullName: inquiry.fullName,
    companyName: inquiry.companyName || 'فردي / غير محدد',
    email: inquiry.email,
    phone: inquiry.phone,
    serviceInterest: inquiry.serviceInterest,
    estimatedBudget: inquiry.estimatedBudget || 'غير محدد',
    projectDetails: inquiry.projectDetails,
  });

  if (!enableRealDispatch) {
    return {
      status: 'skipped_review_mode',
      recipient: recipientEmail,
      subject,
    };
  }

  const newAttempts = currentAttempts + 1;

  try {
    logger.info('Retrying live email dispatch for inquiry', {
      inquiryId,
      attempt: newAttempts,
      recipientEmail,
    });

    await payload.sendEmail({
      to: recipientEmail,
      subject,
      text: body,
    });

    await payload.update({
      collection: 'inquiries',
      id: inquiryId,
      data: {
        emailDeliveryStatus: 'sent',
        emailRecipient: recipientEmail,
        emailDeliveredAt: new Date().toISOString(),
        emailDeliveryAttempts: newAttempts,
        emailDeliveryError: null,
      },
    });

    return {
      status: 'sent',
      recipient: recipientEmail,
      subject,
    };
  } catch (sendErr: any) {
    const errorMsg = sendErr?.message || 'Retry email dispatch failed';
    const isExhausted = newAttempts >= MAX_EMAIL_RETRY_ATTEMPTS;
    const finalStatus = isExhausted ? 'requires_manual_followup' : 'failed';

    logger.error('Retry email dispatch failed', {
      inquiryId,
      newAttempts,
      finalStatus,
      error: errorMsg,
    });

    await payload.update({
      collection: 'inquiries',
      id: inquiryId,
      data: {
        emailDeliveryStatus: finalStatus,
        emailDeliveryError: errorMsg,
        emailDeliveryAttempts: newAttempts,
      },
    });

    return {
      status: finalStatus,
      recipient: recipientEmail,
      subject,
      error: errorMsg,
    };
  }
}
