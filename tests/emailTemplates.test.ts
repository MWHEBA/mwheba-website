import { describe, it, expect } from 'vitest';
import {
  wrapEmailLayout,
  buildLeadNotificationEmail,
  buildOrderConfirmationEmail,
  buildProofReadyNotificationEmail,
  buildBankTransferClearedEmail,
} from '@/shared/lib/emailTemplates';

describe('Corporate Transactional Email Templates', () => {
  it('wraps HTML content with responsive corporate email layout in Arabic and English', () => {
    const arHtml = wrapEmailLayout({
      locale: 'ar',
      title: 'رسالة تجريبية',
      preheader: 'مقدمة إشعار',
      contentHtml: '<p>محتوى تجريبي</p>',
    });

    expect(arHtml).toContain('dir="rtl"');
    expect(arHtml).toContain('lang="ar"');
    expect(arHtml).toContain('MWHEBA');
    expect(arHtml).toContain('محتوى تجريبي');
    expect(arHtml).toContain('مقدمة إشعار');

    const enHtml = wrapEmailLayout({
      locale: 'en',
      title: 'Test Message',
      contentHtml: '<p>Test English Content</p>',
    });

    expect(enHtml).toContain('dir="ltr"');
    expect(enHtml).toContain('lang="en"');
    expect(enHtml).toContain('Advertising & Media Agency');
  });

  it('generates corporate lead notification email with full contact data', () => {
    const leadEmail = buildLeadNotificationEmail({
      fullName: 'المهندس أحمد ممدوح',
      companyName: 'دلتا اللوجستية',
      email: 'a.mamdouh@delta-logistics.eg',
      phone: '+201012345678',
      serviceInterest: 'الهوية البصرية والمطبوعات',
      estimatedBudget: '50,000 - 100,000 ج.م',
      projectDetails: 'نحتاج توريد يونيفورم ومواد دعائية لـ 4 فروع جديدة.',
    });

    expect(leadEmail.subject).toContain('المهندس أحمد ممدوح');
    expect(leadEmail.subject).toContain('دلتا اللوجستية');
    expect(leadEmail.html).toContain('+201012345678');
    expect(leadEmail.html).toContain('a.mamdouh@delta-logistics.eg');
    expect(leadEmail.html).toContain('50,000 - 100,000 ج.م');
    expect(leadEmail.text).toContain('المهندس أحمد ممدوح');
  });

  it('generates bank transfer order confirmation email with verified bank wire instructions', () => {
    const orderEmail = buildOrderConfirmationEmail({
      orderNumber: 'ORD-2026-1049',
      customerName: 'سارة فوزي',
      totalEgp: 15450,
      paymentMethod: 'bank_transfer',
      hasPhysicalItems: true,
      hasServices: false,
      bankDetails: {
        bankName: 'البنك التجاري الدولي CIB',
        accountHolder: 'شركة موهبة للدعاية والإعلان',
        accountNumber: '100045892301',
        iban: 'EG45001000000000100045892301',
      },
    });

    expect(orderEmail.subject).toContain('ORD-2026-1049');
    expect(orderEmail.html).toContain('البنك التجاري الدولي CIB');
    expect(orderEmail.html).toContain('EG45001000000000100045892301');
    expect(orderEmail.html).toContain('15,450.00');
  });

  it('generates proof ready and bank clearance emails with clear action directives', () => {
    const proofEmail = buildProofReadyNotificationEmail({
      orderNumber: 'ORD-8821',
      customerName: 'خالد عبد الرحمن',
      productName: 'أكواب حرارية منقوشة بالليزر',
      reviewUrl: 'https://mwheba.com/ar/account/orders/8821/proof',
    });

    expect(proofEmail.subject).toContain('ORD-8821');
    expect(proofEmail.html).toContain('أكواب حرارية منقوشة بالليزر');
    expect(proofEmail.html).toContain('https://mwheba.com/ar/account/orders/8821/proof');

    const clearanceEmail = buildBankTransferClearedEmail({
      orderNumber: 'ORD-8821',
      customerName: 'خالد عبد الرحمن',
      clearedAmountEgp: 25000,
    });

    expect(clearanceEmail.subject).toContain('ORD-8821');
    expect(clearanceEmail.html).toContain('25000.00 ج.م');
    expect(clearanceEmail.html).toContain('مدفوع (Paid)');
  });
});
