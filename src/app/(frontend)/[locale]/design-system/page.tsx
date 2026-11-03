import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isValidLocale } from '@/shared/lib/i18n';
import {
  Button,
  Input,
  Textarea,
  Select,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
  Alert,
} from '@/shared/ui/primitives';
import { InteractiveProductSpecimen } from '@/shared/ui/commerce/InteractiveProductSpecimen';
import { ShieldCheckIcon, CheckIcon } from '@/shared/ui/icons';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isArabic = locale === 'ar';
  return {
    title: isArabic
      ? 'دليل المكونات والتصميم المؤسسي | وكالة موهبة'
      : 'Corporate UI Component Specimen | MWHEBA Agency',
    description: isArabic
      ? 'المواصفات البصرية لمكونات واجهة المستخدم وتجارة الشركات في وكالة موهبة.'
      : 'High-precision corporate UI component library for MWHEBA Agency and Commerce.',
  };
}

export default async function DesignSystemShowcasePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) {
    notFound();
  }

  const isArabic = locale === 'ar';

  return (
    <div className="container" style={{ paddingBlock: '4.5rem 6rem' }}>
      {/* Specimen Header */}
      <header className="specimen-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBlockEnd: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
            {isArabic ? 'نظام التصميم الموحد // موهبة 2.0' : 'DESIGN SYSTEM SPECIMEN // MWHEBA 2.0'}
          </span>
          <Badge variant="neutral">DES-03</Badge>
          <Badge variant="success">WCAG AA Verified</Badge>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--brand-primary-dark)', marginBlock: '0 0.75rem', lineHeight: 1.15 }}>
          {isArabic ? 'مكونات الواجهة وتجارة الشركات' : 'Corporate Component Architecture'}
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', margin: 0, maxWidth: '720px', lineHeight: 1.7 }}>
          {isArabic
            ? 'بنية بصرية هادئة تعتمد كلياً على الألوان المسطحة وتوكنز :root، مع مساحات بيضاء متوازنة وأطر رقيقة دقيقة، متوافقة تماماً مع إمكانية الوصول والتنقل بلوحة المفاتيح.'
            : 'Minimal, calm corporate aesthetic driven exclusively by :root tokens, flat colors, generous whitespace, and strict WCAG accessibility contracts.'}
        </p>
      </header>

      {/* Module 1: Token Architecture */}
      <section className="specimen-module">
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'توكنز الألوان المعتمدة' : 'DESIGN TOKENS & CONTRAST'}
          </span>
          <h2 className="section-title">
            {isArabic ? 'منظومة الألوان المسطحة ونسب التباين' : 'Color System & Contrast Ratios'}
          </h2>
        </div>

        <div className="token-grid">
          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--brand-primary)' }} />
            <div className="token-info">
              <div className="token-name">--brand-primary</div>
              <div className="token-meta">
                <span>#01578a</span>
                <span>7.69:1 (AAA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--brand-primary-dark)' }} />
            <div className="token-info">
              <div className="token-name">--brand-primary-dark</div>
              <div className="token-meta">
                <span>#013b5e</span>
                <span>11.74:1 (AAA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--brand-primary-light)' }} />
            <div className="token-info">
              <div className="token-name">--brand-primary-light</div>
              <div className="token-meta">
                <span>#0273b5</span>
                <span>5.09:1 (AA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--brand-accent)' }} />
            <div className="token-info">
              <div className="token-name">--brand-accent</div>
              <div className="token-meta">
                <span>#b91c1c</span>
                <span>6.44:1 (AA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--text-secondary)' }} />
            <div className="token-info">
              <div className="token-name">--text-secondary</div>
              <div className="token-meta">
                <span>#334155</span>
                <span>9.61:1 (AAA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--status-success)' }} />
            <div className="token-info">
              <div className="token-name">--status-success</div>
              <div className="token-meta">
                <span>#15803d</span>
                <span>4.62:1 (AA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--status-warning)' }} />
            <div className="token-info">
              <div className="token-name">--status-warning</div>
              <div className="token-meta">
                <span>#b45309</span>
                <span>4.66:1 (AA)</span>
              </div>
            </div>
          </div>

          <div className="token-swatch">
            <div className="token-preview" style={{ backgroundColor: 'var(--status-error)' }} />
            <div className="token-info">
              <div className="token-name">--status-error</div>
              <div className="token-meta">
                <span>#ed1c24</span>
                <span>4.38:1 (AA Large)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Module 2: Interactive Actions */}
      <section className="specimen-module">
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'إجراءات التفاعل' : 'INTERACTIVE ACTIONS'}
          </span>
          <h2 className="section-title">
            {isArabic ? 'منظومة الأزرار' : 'Button Hierarchy'}
          </h2>
        </div>

        <div className="specimen-canvas-alt">
          {/* Variants */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBlockEnd: '2rem' }}>
            <Button variant="primary">
              {isArabic ? 'إجراء رئيسي' : 'Primary Action'}
            </Button>
            <Button variant="secondary">
              {isArabic ? 'إجراء ثانوي' : 'Secondary Action'}
            </Button>
            <Button variant="accent">
              {isArabic ? 'إجراء تمييزي' : 'Accent Button'}
            </Button>
            <Button variant="outline">
              {isArabic ? 'إطار هادئ' : 'Outline'}
            </Button>
            <Button variant="ghost">
              {isArabic ? 'زر نصي' : 'Ghost Action'}
            </Button>
          </div>

          {/* States & Sizing */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', paddingTop: '1.75rem', borderTop: '1px solid var(--border-default)' }}>
            <Button variant="primary" size="sm">
              {isArabic ? 'صغير (34px)' : 'Small (34px)'}
            </Button>
            <Button variant="primary" size="md">
              {isArabic ? 'متوسط (40px)' : 'Medium (40px)'}
            </Button>
            <Button variant="primary" size="lg">
              {isArabic ? 'كبير (48px)' : 'Large (48px)'}
            </Button>
            <Button variant="primary" loading loadingText={isArabic ? 'جاري التحقق...' : 'Verifying...'}>
              {isArabic ? 'إرسال' : 'Submit'}
            </Button>
            <Button variant="secondary" disabled>
              {isArabic ? 'معطل' : 'Disabled'}
            </Button>
          </div>
        </div>
      </section>

      {/* Module 3: Form Controls */}
      <section className="specimen-module">
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'إدخال البيانات والمؤسسات' : 'DATA ENTRY & FORM CONTROLS'}
          </span>
          <h2 className="section-title">
            {isArabic ? 'حقول الاستمارات وربط الأخطاء' : 'Form Controls with Error Association'}
          </h2>
        </div>

        <div className="specimen-canvas">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <Input
              id="spec-company-name"
              label={isArabic ? 'اسم الشركة / المؤسسة' : 'Company Name'}
              placeholder={isArabic ? 'مثال: شركة مصر الدولية للتجارة' : 'e.g. Nile International Ltd.'}
              helperText={isArabic ? 'يُستخدم لإصدار عروض الأسعار الرسمية والتعاقد.' : 'Used for official B2B quotations and contracts.'}
              required
            />

            <Input
              id="spec-work-email"
              label={isArabic ? 'البريد الإلكتروني للعمل' : 'Work Email'}
              defaultValue="invalid-format@"
              error={isArabic ? 'يرجى إدخال عنوان بريد إلكتروني صالح للمؤسسة.' : 'Please enter a valid enterprise email address.'}
              required
            />

            <Input
              id="spec-tax-id"
              label={isArabic ? 'الرقم الضريبي المعتمد (ثابت)' : 'Verified Tax ID (Fixed)'}
              defaultValue="EG-829-104-552"
              disabled
              helperText={isArabic ? 'سجل ضريبي مؤكد من وزارة المالية.' : 'Tax registration validated with authorities.'}
            />

            <Select
              id="spec-service-tier"
              label={isArabic ? 'حجم الطلب المتوقع (الدفعة الأولى)' : 'Initial Order Volume'}
              options={[
                { value: 'tier-1', label: isArabic ? 'طلب تجريبي (10 – 50 قطعة)' : 'Pilot Order (10 – 50 units)' },
                { value: 'tier-2', label: isArabic ? 'توريد متوسط (51 – 250 قطعة)' : 'Mid-Scale Supply (51 – 250 units)' },
                { value: 'tier-3', label: isArabic ? 'توريد مؤتمرات كبرى (251 – 1,000 قطعة)' : 'Enterprise Events (251 – 1,000 units)' },
              ]}
            />

            <div style={{ gridColumn: '1 / -1' }}>
              <Textarea
                id="spec-branding-notes"
                label={isArabic ? 'تعليمات الطباعة وتخصيص الشعار' : 'Custom Branding & Print Notes'}
                placeholder={isArabic ? 'حدد مواضع الحفر بالليزر، مقاسات الشعار، وألوان Pantone المطلوبة...' : 'Specify laser engraving positions, logo dimensions, and Pantone colors...'}
                helperText={isArabic ? 'يتم مراجعة هذه التعليمات بواسطة فريق الإنتاج الفني قبل بدء التصنيع.' : 'Reviewed by production engineers prior to commercial run.'}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Module 4: Commerce Cards & Stepper */}
      <section className="specimen-module">
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'عناصر التجارة وهدايا الشركات' : 'COMMERCE SPECIMENS'}
          </span>
          <h2 className="section-title">
            {isArabic ? 'كروت المنتجات والخدمات وعداد الكميات' : 'Product Cards, Services & Stepper'}
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem' }}>
          {/* Live Interactive Product Card with Tiered Pricing & Toast */}
          <InteractiveProductSpecimen locale={locale} />

          {/* Fixed-Price Digital Package Card */}
          <Card>
            <CardHeader>
              <Badge variant="info">{isArabic ? 'باقة تعاقدية' : 'Fixed-Price Package'}</Badge>
              <CardTitle style={{ marginTop: '0.875rem' }}>
                {isArabic ? 'باقة تصميم الهوية البصرية المتكاملة' : 'Complete Corporate Brand Identity'}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.7', margin: 0 }}>
                {isArabic
                  ? 'تصميم الشعار، منظومة الألوان والخطوط، دليل استخدام الهوية، المطبوعات الإدارية، ونماذج المراسلات الرقمية المعتمدة.'
                  : 'Logo mark architecture, color science, typography guidelines, stationery system, and complete brand documentation.'}
              </p>

              <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--brand-primary-dark)', letterSpacing: '-0.02em' }}>
                  15,000 {isArabic ? 'ج.م' : 'EGP'}
                </span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {isArabic ? '/ تسليم نهائي موثق' : '/ fixed scope contract'}
                </span>
              </div>
            </CardBody>
            <CardFooter style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="accent" size="sm">
                {isArabic ? 'طلب عرض سعر فني' : 'Request Proposal'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Module 5: Notifications & Feedback */}
      <section className="specimen-module">
        <div className="section-header">
          <span className="section-eyebrow">
            {isArabic ? 'التنبيهات وحالات النظام' : 'SYSTEM STATUS & NOTIFICATIONS'}
          </span>
          <h2 className="section-title">
            {isArabic ? 'التنبيهات والشارات' : 'Badges & System Feedback'}
          </h2>
        </div>

        <div className="specimen-canvas" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Badges Strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <Badge variant="neutral">{isArabic ? 'مسودة' : 'Draft'}</Badge>
            <Badge variant="info">{isArabic ? 'قيد المراجعة' : 'In Review'}</Badge>
            <Badge variant="success">{isArabic ? 'تم التأكيد' : 'Confirmed'}</Badge>
            <Badge variant="warning">{isArabic ? 'تنبيه حد أدنى' : 'MOQ Notice'}</Badge>
            <Badge variant="error">{isArabic ? 'مرفوض' : 'Rejected'}</Badge>
          </div>

          {/* Alerts Stack */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Alert variant="info" title={isArabic ? 'إشعار الحساب المؤسسي' : 'Enterprise Account Notice'}>
              {isArabic
                ? 'يتم إصدار الفواتير الضريبية المعتمدة طبقاً لمنظومة الضرائب المصرية لجميع الطلبات المؤسسية.'
                : 'Approved tax documentation is automatically generated for all authenticated enterprise accounts.'}
            </Alert>

            <Alert variant="warning" title={isArabic ? 'تنبيه الحد الأدنى للطلب (MOQ)' : 'Minimum Order Quantity Notice'}>
              {isArabic
                ? 'يتطلب تصنيع هذا المنتج حداً أدنى لا يقل عن 10 قطع في السلة لإتاحة بدء إجراءات الدفع والإنتاج.'
                : 'This item requires a minimum order quantity of 10 units before payment and production dispatch.'}
            </Alert>

            <Alert variant="success" title={isArabic ? 'تم تأكيد أمر التوريد' : 'Order Successfully Placed'}>
              {isArabic
                ? 'تم تسجيل طلب التوريد رقم #EGY-9201 بنجاح، جاري إعداد مسودة الطباعة الفنية للمراجعة.'
                : 'Purchase order #EGY-9201 has been registered. Pre-production proofs are being prepared for approval.'}
            </Alert>
          </div>
        </div>
      </section>
    </div>
  );
}
