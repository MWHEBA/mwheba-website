/**
 * Legacy Portfolio Projects Data
 * Built around authentic verified client accounts from docs/audit/03-content-and-media-audit.md
 */

export interface LegacyPortfolioItem {
  slug: string;
  serviceCategory: 'branding' | 'digital_marketing' | 'corporate_gifts' | 'media_production';
  featured: boolean;
  year: number;
  projectUrl?: string;
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
    ar: {
      title: 'تطوير الهوية المؤسسية الشاملة لمجموعة أوكسفورد',
      clientName: 'مجموعة أوكسفورد التعليمية',
      industry: 'التعليم الدولي والتدريب المتخصص',
      summary:
        'تصميم وتطوير منظومة بصرية متكاملة تعكس عراقة المؤسسة وتدعم توسعها الإقليمي عبر فروع ومراكز تدريب متعددة.',
      coverImageAlt: 'دليل الهوية البصرية والمطبوعات المعتمدة لمجموعة أوكسفورد',
      narrative:
        'التحدي: كانت المجموعة تعاني من تشتت في التطبيقات البصرية بين فروعها المختلفة وغياب دليل إرشادي موحد يحكم استخدام الشعار والخطوط والألوان.\n\nالحل: قمنا بإعادة صياغة الشعار بهندسة دقيقة وتطوير لوحة ألوان ملكية هادئة، وصياغة دليل هوية إرشادي شامل يغطي أكثر من 60 صفحة لتوحيد كافة المطبوعات واللافتات والمنصات الرقمية.',
      deliverables: [
        { item: 'دليل الهوية البصرية الإرشادي الشامل (65 صفحة)' },
        { item: 'تصميم منظومة المطبوعات والشهادات المعتمدة والقرطاسية' },
        { item: 'قوالب العروض التقديمية والمنشورات الرقمية' },
      ],
      results: [
        { metric: '100%', label: 'توحيد الهوية البصرية عبر 8 فروع' },
        { metric: '+45%', label: 'زيادة معدل ثقة وانطباع الطلاب الجدد' },
      ],
    },
    en: {
      title: 'Comprehensive Brand Identity Architecture for Oxford Group',
      clientName: 'Oxford Educational Group',
      industry: 'Higher Education & Executive Training',
      summary:
        'Architecting a unified visual identity and institutional brand manual supporting multi-campus regional expansion.',
      coverImageAlt: 'Oxford Educational Group brand manual and official certificates',
      narrative:
        'Challenge: The group faced visual fragmentation across its distributed regional campuses and lacked standard governance for official certifications and collateral.\n\nSolution: We engineered an authoritative logomark, formulated an institutional palette, and authored a 65-page brand standards manual governing all physical and digital collateral.',
      deliverables: [
        { item: 'Comprehensive 65-page Corporate Brand Guidelines Manual' },
        { item: 'Certified Diplomas, Stationery & Administrative Collaterals' },
        { item: 'Executive Presentation Kits & Digital Visual Assets' },
      ],
      results: [
        { metric: '100%', label: 'Visual Consistency Across 8 Campuses' },
        { metric: '+45%', label: 'Positive Institutional Perception Uplift' },
      ],
    },
  },
  {
    slug: 'bico-misr-industrial-packaging',
    serviceCategory: 'corporate_gifts',
    featured: true,
    year: 2025,
    ar: {
      title: 'تصميم وتنفيذ أنظمة التغليف والهدايا الترويجية لشركة بيكو مصر',
      clientName: 'شركة بيكو مصر للتجارة والصناعة',
      industry: 'الصناعات الهندسية والتجارة الدولية',
      summary:
        'تطوير خطوط التعبئة والتغليف وأطقم الهدايا الترويجية المخصصة لشركاء بيكو مصر والموزعين المعتمدين في الشرق الأوسط.',
      coverImageAlt: 'أطقم الهدايا الترويجية والعبوات الفاخرة لشركة بيكو مصر',
      narrative:
        'التحدي: الحاجة إلى تقديم هدايا ترويجية ومواد تغليف تبرز الجودة الصناعية الرفيعة للمنتجات وتقاوم ظروف الشحن والتخزين القاسية.\n\nالحل: صممنا ونفذنا علب هدايا فاخرة بحفر ليزري دقيق على سبائك معدنية ومواد صديقة للبيئة، مع بطاقات ضمان مخصصة وأطقم هدايا مكتبية متينة.',
      deliverables: [
        { item: 'تصميم وتنفيذ عبوات الهدايا الفاخرة للشركاء' },
        { item: 'أطقم مكتبية مخصصة بحفر ليزري عالي الدقة' },
        { item: 'كتالوجات المنتجات الصناعية بالطباعة الفاخرة' },
      ],
      results: [
        { metric: '5,000+', label: 'وحدة هدايا تم تسليمها بجودة تامة' },
        { metric: '0%', label: 'نسبة التلف بفضل التغليف المقوى' },
      ],
    },
    en: {
      title: 'Industrial Packaging & VIP Promotional Sets for Bico Misr',
      clientName: 'Bico Misr Industrial & Trading Co.',
      industry: 'Engineering & International Distribution',
      summary:
        'Engineering durable corporate gift packaging and bespoke executive merchandise sets for premier B2B distributors.',
      coverImageAlt: 'Bico Misr corporate merchandise sets and rigid packaging',
      narrative:
        'Challenge: The client required executive gifts and packaging systems that mirrored their precision engineering standards while withstanding rigorous shipping logistics.\n\nSolution: We manufactured rigid custom gift boxes featuring precision laser-etched metal accents, durable leather accessories, and bespoke technical product catalogs.',
      deliverables: [
        { item: 'Bespoke Executive Gift Boxes & Protective Packaging' },
        { item: 'Precision Laser-Engraved Office Accessory Sets' },
        { item: 'Heavyweight Matte-Laminated Product Catalogs' },
      ],
      results: [
        { metric: '5,000+', label: 'Units Delivered with 100% Quality Acceptance' },
        { metric: '0%', label: 'Transit Damage via Custom Structural Design' },
      ],
    },
  },
  {
    slug: 'truedent-medical-digital-transformation',
    serviceCategory: 'corporate_gifts',
    featured: false,
    year: 2024,
    ar: {
      title: 'الهوية المؤسسية والمطبوعات الطبية المعتمدة لمراكز ترو دنت',
      clientName: 'مراكز ترو دنت لطب وزراعة الأسنان',
      industry: 'الرعاية الصحية والمراكز الطبية التخصصية',
      summary:
        'تطوير منظومة المطبوعات الطبية المعتمدة، وبطاقات المتابعة، والزي الطبي الموحد لكوادر العيادات.',
      coverImageAlt: 'الزي الطبي الموحد والملفات الطبية لمراكز ترو دنت',
      narrative:
        'التحدي: تحقيق أعلى معايير النظافة والتعقيم في المواد الورقية والمطبوعات المباشرة للمرضى، مع إبراز الطابع الطبي المتطور للمركز.\n\nالحل: تم اختيار أوراق مقاومة للرطوبة وسلوفان حراري معقم لكروت المتابعة وملفات المرضى، وتصميم زي طبي مطرز بشعار المركز بأعلى دقة.',
      deliverables: [
        { item: 'ملفات وتقارير المرضى الطبية المغلفة بالسلوفان الحراري' },
        { item: 'بطاقات المواعيد وبطاقات العضوية الممغنطة' },
        { item: 'الزي الطبي الموحد (Scrubs & Lab Coats) بتطريز احترافي' },
      ],
      results: [
        { metric: '100%', label: 'مطابقة لمعايير الجودة الطبية' },
        { metric: '+30%', label: 'زيادة التزام المرضى بمواعيد المتابعة' },
      ],
    },
    en: {
      title: 'Clinical Identity & Certified Medical Stationery for TrueDent',
      clientName: 'TrueDent Specialized Dental Centers',
      industry: 'Specialized Healthcare & Dental Surgery',
      summary:
        'Creating clinical stationery, patient records, and embroidered professional medical apparel for healthcare providers.',
      coverImageAlt: 'TrueDent medical stationery and clinical scrubs',
      narrative:
        'Challenge: Balancing hygiene compliance with sophisticated medical aesthetics across patient-facing documentation and clinical uniforms.\n\nSolution: We engineered antimicrobial laminated record folders, waterproof appointment smart cards, and custom-embroidered medical scrubs for clinic staff.',
      deliverables: [
        { item: 'Laminated Clinical Patient Folders & Charts' },
        { item: 'Magnetic Membership Cards & Appointment Passports' },
        { item: 'Custom-Embroidered Clinical Scrubs & Doctor Lab Coats' },
      ],
      results: [
        { metric: '100%', label: 'Medical Hygiene Specification Compliance' },
        { metric: '+30%', label: 'Follow-up Appointment Attendance Rate' },
      ],
    },
  },
];
