/**
 * MWHEBA 2.0 | Corporate Transactional Email Templates
 * Calming, minimal, professional email markup engineered for cross-client compatibility
 * (Outlook, Gmail, Apple Mail) using semantic table layouts and flat brand colors.
 */

export interface EmailLayoutOptions {
  locale?: 'ar' | 'en';
  title: string;
  preheader?: string;
  contentHtml: string;
}

/**
 * Shared responsive email wrapper
 */
export function wrapEmailLayout(options: EmailLayoutOptions): string {
  const isAr = options.locale !== 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const textAlign = isAr ? 'right' : 'left';
  const fontStack = isAr
    ? "'Segoe UI', Tahoma, Arial, sans-serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: ${fontStack}; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 12px !important; }
      .email-content { padding: 20px 16px !important; }
      .data-cell { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc;">
  ${options.preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${options.preheader}</div>` : ''}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; width: 100%;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0f172a; text-align: ${textAlign}; border-top-left-radius: 8px; border-top-right-radius: 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="text-align: ${textAlign};">
                    <span style="color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.5px;">MWHEBA</span>
                    <span style="color: #94a3b8; font-size: 13px; margin-${isAr ? 'right' : 'left'}: 8px;">${isAr ? 'وكالة الدعاية والإنتاج الإعلاني' : 'Advertising & Media Agency'}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="email-content" style="background-color: #ffffff; padding: 36px 32px; text-align: ${textAlign}; color: #1e293b; font-size: 15px; line-height: 1.6; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">
              ${options.contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 32px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.5; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; border: 1px solid #e2e8f0; border-top: none;">
              <p style="margin: 0 0 8px 0;"><strong>${isAr ? 'وكالة موهبة للدعاية والإعلان' : 'MWHEBA Advertising Agency'}</strong></p>
              <p style="margin: 0 0 8px 0;">${isAr ? 'جمهورية مصر العربية — خدمة الشركات والتوريدات B2B' : 'Arab Republic of Egypt — Enterprise B2B Services'}</p>
              <p style="margin: 0; color: #94a3b8;">${isAr ? 'هذه الرسالة آلية ومعتمدة من نظام MWHEBA 2.0.' : 'This is an automated operational notification from MWHEBA 2.0.'}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Corporate Lead Notification Template (Sent to agency sales team)
 */
export function buildLeadNotificationEmail(lead: {
  fullName: string;
  companyName?: string | null;
  email: string;
  phone: string;
  serviceInterest: string;
  estimatedBudget?: string | null;
  projectDetails: string;
}): { subject: string; html: string; text: string } {
  const subject = `[MWHEBA Lead] استفسار مشروع جديد: ${lead.fullName} (${lead.companyName || 'فردي'})`;

  const contentHtml = `
    <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">استفسار مشروع جديد من عميل مؤسسي</h2>
    <p style="margin: 0 0 24px 0; color: #475569;">تم تسجيل استفسار جديد عبر الموقع الرسمي. فيما يلي بيانات التواصل وتفاصيل المشروع:</p>
    
    <table role="presentation" width="100%" cellspacing="0" cellpadding="8" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td width="30%" style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">اسم العميل:</td>
        <td style="color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0;">${lead.fullName}</td>
      </tr>
      <tr>
        <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">الشركة / المؤسسة:</td>
        <td style="color: #0f172a; border-bottom: 1px solid #e2e8f0;">${lead.companyName || 'فردي / غير محدد'}</td>
      </tr>
      <tr>
        <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">البريد الإلكتروني:</td>
        <td style="color: #0f172a; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${lead.email}" style="color: #0284c7; text-decoration: none;">${lead.email}</a></td>
      </tr>
      <tr>
        <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">رقم الهاتف:</td>
        <td style="color: #0f172a; border-bottom: 1px solid #e2e8f0; direction: ltr; text-align: right;">${lead.phone}</td>
      </tr>
      <tr>
        <td style="color: #64748b; font-weight: 600; border-bottom: 1px solid #e2e8f0;">الخدمة المطلوبة:</td>
        <td style="color: #0f172a; border-bottom: 1px solid #e2e8f0;">${lead.serviceInterest}</td>
      </tr>
      <tr>
        <td style="color: #64748b; font-weight: 600;">الميزانية التقديرية:</td>
        <td style="color: #0f172a;">${lead.estimatedBudget || 'غير محددة'}</td>
      </tr>
    </table>

    <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 15px; font-weight: 600;">تفاصيل ومتطلبات المشروع:</h3>
    <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; color: #334155; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${lead.projectDetails}</div>
  `;

  const text = `استفسار جديد من: ${lead.fullName} (${lead.companyName || 'فردي'})\nالبريد: ${lead.email}\nالهاتف: ${lead.phone}\nالخدمة: ${lead.serviceInterest}\nالميزانية: ${lead.estimatedBudget || 'غير محددة'}\n\nالتفاصيل:\n${lead.projectDetails}`;

  return {
    subject,
    html: wrapEmailLayout({ locale: 'ar', title: subject, contentHtml }),
    text,
  };
}

/**
 * 2. Order Confirmation Email (Sent to customer after checkout)
 */
export function buildOrderConfirmationEmail(order: {
  orderNumber: string;
  customerName: string;
  totalEgp: number;
  paymentMethod: string;
  hasPhysicalItems: boolean;
  hasServices: boolean;
  bankDetails?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    iban: string;
  };
}): { subject: string; html: string; text: string } {
  const subject = `تأكيد استلام طلبك رقم #${order.orderNumber} — وكالة موهبة`;

  let paymentInstructions = '';
  if (order.paymentMethod === 'bank_transfer' && order.bankDetails) {
    paymentInstructions = `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 16px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #1e40af; font-size: 14px; font-weight: 700;">بيانات التحويل البنكي المعتمدة:</h4>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #1e3a8a;"><strong>اسم البنك:</strong> ${order.bankDetails.bankName}</p>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #1e3a8a;"><strong>اسم صاحب الحساب:</strong> ${order.bankDetails.accountHolder}</p>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #1e3a8a; direction: ltr; text-align: right;"><strong>رقم الحساب:</strong> ${order.bankDetails.accountNumber}</p>
        <p style="margin: 0; font-size: 13px; color: #1e3a8a; direction: ltr; text-align: right;"><strong>رقم الآيبان (IBAN):</strong> ${order.bankDetails.iban}</p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #3b82f6;">يرجى رفع إيصال التحويل البنكي من صفحة طلبك للبدء الفوري في التنفيذ بعد اعتماد المالية.</p>
      </div>
    `;
  } else if (order.paymentMethod === 'cash_on_delivery') {
    paymentInstructions = `
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin: 20px 0; color: #334155; font-size: 13px;">
        <strong>طريقة السداد:</strong> الدفع عند الاستلام لمندوب الشحن بعد معاينة الشحنة وتوقيع إيصال الاستلام الرسمي.
      </div>
    `;
  }

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">شكرًا لك، تم تسجيل طلبك بنجاح</h2>
    <p style="margin: 0 0 20px 0; color: #475569;">مرحبًا <strong>${order.customerName}</strong>، تم استلام طلبك رقم <strong>#${order.orderNumber}</strong> وهو قيد المراجعة والمعالجة التشغيلية.</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">إجمالي الطلب النهائي المجمد:</p>
      <p style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 700;">${order.totalEgp.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style="font-size: 14px; font-weight: 500; color: #64748b;">جنيه مصري</span></p>
    </div>

    ${paymentInstructions}

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b;">يمكنك متابعة حالة تنفيذ وتجهيز الطلب ورفع البريف من خلال حسابك في البوابة الإلكترونية.</p>
  `;

  const text = `مرحبًا ${order.customerName}، تم استلام طلبك #${order.orderNumber} بإجمالي ${order.totalEgp} ج.م.`;

  return {
    subject,
    html: wrapEmailLayout({ locale: 'ar', title: subject, contentHtml }),
    text,
  };
}

/**
 * 3. Artwork Proof Review Notification (Sent to customer when proof is ready)
 */
export function buildProofReadyNotificationEmail(proof: {
  orderNumber: string;
  customerName: string;
  productName: string;
  reviewUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `بروفة الطباعة جاهزة للاعتماد — طلب #${proof.orderNumber}`;

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">بروفة التصميم والطباعة جاهزة للاعتماد</h2>
    <p style="margin: 0 0 16px 0; color: #475569;">عزيزي <strong>${proof.customerName}</strong>، قام الفريق الفني بتجهيز بروفة الطباعة لمنتج: <strong>${proof.productName}</strong> المرتبط بطلبكم رقم <strong>#${proof.orderNumber}</strong>.</p>
    
    <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 6px; padding: 14px; margin-bottom: 24px; color: #854d0e; font-size: 13px;">
      <strong>تنبيه فني:</strong> لن تبدأ ماكينات الإنتاج بالطباعة الفعلية حتى يتم اعتماد البروفة رسميًا من طرفكم.
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
      <tr>
        <td align="center" style="border-radius: 6px; background-color: #0f172a;">
          <a href="${proof.reviewUrl}" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 28px; display: inline-block; border-radius: 6px;">معاينة واعتماد البروفة</a>
        </td>
      </tr>
    </table>
  `;

  const text = `بروفة الطباعة لمنتج ${proof.productName} (طلب #${proof.orderNumber}) جاهزة للاعتماد: ${proof.reviewUrl}`;

  return {
    subject,
    html: wrapEmailLayout({ locale: 'ar', title: subject, contentHtml }),
    text,
  };
}

/**
 * 4. Bank Transfer Clearance Notification (Sent when finance verifies wire)
 */
export function buildBankTransferClearedEmail(clearance: {
  orderNumber: string;
  customerName: string;
  clearedAmountEgp: number;
}): { subject: string; html: string; text: string } {
  const subject = `تم تأكيد سداد التحويل البنكي — طلب #${clearance.orderNumber}`;

  const contentHtml = `
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px; font-weight: 700;">تم تأكيد واعتماد التحويل البنكي</h2>
    <p style="margin: 0 0 16px 0; color: #475569;">مرحبًا <strong>${clearance.customerName}</strong>، نود إفادتكم بأن الإدارة المالية اعتمدت سداد التحويل البنكي لطلبكم رقم <strong>#${clearance.orderNumber}</strong> بقيمة <strong>${clearance.clearedAmountEgp.toFixed(2)} ج.م</strong>.</p>
    
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px; margin-bottom: 20px; color: #166534; font-size: 13px;">
      تم تحديث حالة السداد رسميًا إلى <strong>مدفوع (Paid)</strong>، وتم تحويل بنود الطلب إلى خطوط الإنتاج والتجهيز.
    </div>
  `;

  const text = `تم تأكيد سداد التحويل البنكي لطلبك #${clearance.orderNumber} بمبلغ ${clearance.clearedAmountEgp} ج.م.`;

  return {
    subject,
    html: wrapEmailLayout({ locale: 'ar', title: subject, contentHtml }),
    text,
  };
}
