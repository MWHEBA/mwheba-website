export interface InquiryInput {
  fullName: string;
  email: string;
  phone: string;
  companyName?: string;
  serviceInterest: 'branding' | 'marketing' | 'merchandise' | 'media' | 'general';
  estimatedBudget?: 'under_50k' | '50k_150k' | '150k_500k' | 'above_500k' | 'undisclosed';
  projectDetails: string;
  honeypot?: string;
  locale: 'ar' | 'en';
}

const phoneRegex = /^(\+?20|0)?1[0125]\d{8}$|^\+?[0-9\s\-()]{8,20}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validServices = ['branding', 'marketing', 'merchandise', 'media', 'general'] as const;
const validBudgets = ['under_50k', '50k_150k', '150k_500k', 'above_500k', 'undisclosed'] as const;

export function validateInquiryInput(input: any): {
  success: boolean;
  data?: InquiryInput;
  errors?: Record<string, string[]>;
  message?: string;
} {
  const errors: Record<string, string[]> = {};

  const fullName = typeof input?.fullName === 'string' ? input.fullName.trim() : '';
  if (!fullName || fullName.length < 2) {
    errors.fullName = ['الاسم يجب أن يحتوي على حرفين على الأقل'];
  } else if (fullName.length > 100) {
    errors.fullName = ['الاسم لا يجب أن يتجاوز 100 حرف'];
  }

  const email = typeof input?.email === 'string' ? input.email.trim() : '';
  if (!email || !emailRegex.test(email)) {
    errors.email = ['يرجى إدخال بريد إلكتروني صالح'];
  }

  const phone = typeof input?.phone === 'string' ? input.phone.trim() : '';
  if (!phone || !phoneRegex.test(phone)) {
    errors.phone = ['يرجى إدخال رقم هاتف صحيح'];
  }

  const companyName = typeof input?.companyName === 'string' ? input.companyName.trim() : undefined;

  const serviceInterest = input?.serviceInterest;
  if (!validServices.includes(serviceInterest)) {
    errors.serviceInterest = ['يرجى اختيار الخدمة المطلوبة'];
  }

  const estimatedBudget = validBudgets.includes(input?.estimatedBudget) ? input.estimatedBudget : undefined;

  const projectDetails = typeof input?.projectDetails === 'string' ? input.projectDetails.trim() : '';
  if (!projectDetails || projectDetails.length < 10) {
    errors.projectDetails = ['يرجى تقديم تفاصيل أكثر عن المشروع (10 أحرف على الأقل)'];
  } else if (projectDetails.length > 3000) {
    errors.projectDetails = ['تفاصيل المشروع لا يجب أن تتجاوز 3000 حرف'];
  }

  const honeypot = typeof input?.honeypot === 'string' ? input.honeypot.trim() : undefined;
  const locale = input?.locale === 'en' ? 'en' : 'ar';

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
      message: 'بيانات النموذج غير مكتملة أو غير صحيحة.',
    };
  }

  return {
    success: true,
    data: {
      fullName,
      email,
      phone,
      companyName: companyName || undefined,
      serviceInterest,
      estimatedBudget,
      projectDetails,
      honeypot,
      locale,
    },
  };
}

export const inquirySchema = {
  safeParse: (input: unknown) => {
    const res = validateInquiryInput(input);
    if (!res.success) {
      return {
        success: false as const,
        error: {
          flatten: () => ({ fieldErrors: res.errors || {} }),
        },
      };
    }
    return {
      success: true as const,
      data: res.data!,
    };
  },
};
