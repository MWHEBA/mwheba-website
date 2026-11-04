/**
 * Legacy Portfolio Projects Data
 * Built around verified client logo accounts from docs/audit/03-content-and-media-audit.md
 * NOTE: Live site v1 contained 0 case studies (Our Projects was an empty grid shell).
 * These entries are strictly categorized as DRAFTS pending stakeholder case study submission.
 * Zero unverified statistics or fabricated numbers are included.
 */

export interface LegacyPortfolioItem {
  slug: string;
  serviceCategory: 'branding' | 'digital_marketing' | 'corporate_gifts' | 'media_production';
  featured: boolean;
  year: number;
  sourceOrigin: 'case_study_draft_pending_owner_data';
  sourceReference: string;
  approvalStatus: 'pending_case_study_data';
  ar: {
    title: string;
    clientName: string;
    industry: string;
    summary: string;
    coverImageAlt: string;
    narrative: string;
    deliverables: { item: string }[];
    results: { metric: string; label: string }[];
  };
  en: {
    title: string;
    clientName: string;
    industry: string;
    summary: string;
    coverImageAlt: string;
    narrative: string;
    deliverables: { item: string }[];
    results: { metric: string; label: string }[];
  };
}

export const legacyPortfolioData: LegacyPortfolioItem[] = [
  {
    slug: 'oxford-brand-identity-system',
    serviceCategory: 'branding',
    featured: true,
    year: 2025,
    sourceOrigin: 'case_study_draft_pending_owner_data',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 3.C Client Logo #1 (Oxford)',
    approvalStatus: 'pending_case_study_data',
    ar: {
      title: 'الهوية المؤسسية لمجموعة أوكسفورد التعليمية (مسودة دراسة حالة)',
      clientName: 'مجموعة أوكسفورد التعليمية',
      industry: 'التعليم الدولي والتدريب المتخصص',
      summary:
        'مسودة دراسة حالة مقترحة ترتكز على الشعار الموثق للعميل، بانتظار تزويد فريق العمل بالتفاصيل التشغيلية وسرد التحدي والحل المعتمد.',
      coverImageAlt: 'شعار وهوية مجموعة أوكسفورد التعليمية',
      narrative:
        'ملاحظة توثيقية: تم تأكيد وجود شعار مجموعة أوكسفورد ضمن عملاء الوكالة المعتمدين في فحص الموقع الأصلي (AUD-03: Section 3.C). تفاصيل المشروع وسياق التنفيذ قيد استكمال المالك والمراجعة التحريرية.',
      deliverables: [
        { item: 'الهوية البصرية وتطبيقات العلامة' },
        { item: 'المطبوعات المؤسسية والقرطاسية' },
      ],
      results: [],
    },
    en: {
      title: 'Oxford Education Group Brand Identity (Draft Case Study)',
      clientName: 'Oxford Educational Group',
      industry: 'Higher Education & Executive Training',
      summary:
        'Proposed draft case study anchored on verified client logo from live site audit, pending stakeholder submission of detailed operational background.',
      coverImageAlt: 'Oxford Educational Group verified brand mark and collateral',
      narrative:
        'Audit Provenance Note: Oxford logo presence verified via live site audit (AUD-03: Section 3.C). Detailed project narrative and execution milestones are pending stakeholder review.',
      deliverables: [
        { item: 'Visual Identity & Brand Applications' },
        { item: 'Corporate Stationery Collaterals' },
      ],
      results: [],
    },
  },
  {
    slug: 'bico-misr-industrial-packaging',
    serviceCategory: 'corporate_gifts',
    featured: true,
    year: 2025,
    sourceOrigin: 'case_study_draft_pending_owner_data',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 3.C Client Logo #2 (Bico Misr)',
    approvalStatus: 'pending_case_study_data',
    ar: {
      title: 'أنظمة التغليف والهدايا الترويجية لشركة بيكو مصر (مسودة دراسة حالة)',
      clientName: 'شركة بيكو مصر للتجارة والصناعة',
      industry: 'الصناعات الهندسية والتجارة الدولية',
      summary:
        'مسودة دراسة حالة مقترحة لمنتجات وتغليف هدايا بيكو مصر، بانتظار اعتماد الأرقام والمواصفات الفنية النهائية من إدارة العمليات.',
      coverImageAlt: 'شعار ومنتجات التغليف لشركة بيكو مصر',
      narrative:
        'ملاحظة توثيقية: تم توثيق شعار شركة بيكو مصر كعميل معتمد في فحص الموقع السابق (AUD-03: Section 3.C). تفاصيل أحجام الشحنات وسردية المشروع تخضع لموافقة المالك ولا تُنشر كأرقام قطعية.',
      deliverables: [
        { item: 'عبوات وتغليف الهدايا المؤسسية' },
        { item: 'المطبوعات الفنية والكتالوجات' },
      ],
      results: [],
    },
    en: {
      title: 'Bico Misr Industrial Packaging & Promotional Sets (Draft Case Study)',
      clientName: 'Bico Misr Industrial & Trading Co.',
      industry: 'Engineering & International Distribution',
      summary:
        'Proposed draft case study for Bico Misr branded packaging collaterals, pending stakeholder verification of technical specifications.',
      coverImageAlt: 'Bico Misr corporate mark and packaging collaterals',
      narrative:
        'Audit Provenance Note: Bico Misr client mark cataloged in live site audit (AUD-03: Section 3.C). Production volumes and case metrics require stakeholder confirmation prior to publication.',
      deliverables: [
        { item: 'Executive Gift Boxes & Packaging' },
        { item: 'Technical Product Catalogs' },
      ],
      results: [],
    },
  },
  {
    slug: 'truedent-medical-digital-transformation',
    serviceCategory: 'corporate_gifts',
    featured: false,
    year: 2024,
    sourceOrigin: 'case_study_draft_pending_owner_data',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 3.C Client Logo #5 (TrueDent)',
    approvalStatus: 'pending_case_study_data',
    ar: {
      title: 'المطبوعات الطبية المعتمدة لمراكز ترو دنت (مسودة دراسة حالة)',
      clientName: 'مراكز ترو دنت لطب وزراعة الأسنان',
      industry: 'الرعاية الصحية والمراكز الطبية التخصصية',
      summary:
        'مسودة دراسة حالة مقترحة لتوريدات المطبوعات الطبية والزي الموحد، بانتظار التحقق من بيانات المشروع التفصيلية.',
      coverImageAlt: 'شعار ومطبوعات مراكز ترو دنت الطبية',
      narrative:
        'ملاحظة توثيقية: تم توثيق شعار ترو دنت كعميل معتمد في تقرير الفحص (AUD-03: Section 3.C). دراسة الحالة تُحفظ كمسودة غير منشورة لحين اعتماد المالك.',
      deliverables: [
        { item: 'المطبوعات والملفات الطبية' },
        { item: 'الزي الطبي الموحد' },
      ],
      results: [],
    },
    en: {
      title: 'TrueDent Clinical Stationery & Branded Apparel (Draft Case Study)',
      clientName: 'TrueDent Specialized Dental Centers',
      industry: 'Specialized Healthcare & Dental Surgery',
      summary:
        'Proposed draft case study for clinical documentation and custom apparel, pending stakeholder verification.',
      coverImageAlt: 'TrueDent dental centers brand mark and clinic stationery',
      narrative:
        'Audit Provenance Note: TrueDent client mark verified via audit (AUD-03: Section 3.C). Narrative details remain in draft status pending owner sign-off.',
      deliverables: [
        { item: 'Clinical Folders & Documentation' },
        { item: 'Professional Medical Apparel' },
      ],
      results: [],
    },
  },
];
