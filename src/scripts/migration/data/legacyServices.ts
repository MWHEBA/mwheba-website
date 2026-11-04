/**
 * Legacy Services & Corporate Pages Data
 * Extracted and normalized from live site audit: docs/audit/03-content-and-media-audit.md
 */

export interface LegacyServiceItem {
  slug: string;
  category: string;
  sourceOrigin: 'legacy_site_audit_verified';
  sourceReference: string;
  approvalStatus: 'verified_from_v1';
  ar: {
    title: string;
    subtitle: string;
    summary: string;
    features: string[];
    deliverables: string[];
    metaDescription: string;
  };
  en: {
    title: string;
    subtitle: string;
    summary: string;
    features: string[];
    deliverables: string[];
    metaDescription: string;
  };
}

export const legacyServicesData: LegacyServiceItem[] = [
  {
    slug: 'brand-identity',
    category: 'branding',
    sourceOrigin: 'legacy_site_audit_verified',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 2.A Core Services Copy (#5 Brand Identity)',
    approvalStatus: 'verified_from_v1',
    ar: {
      title: 'هوية العلامة التجارية',
      subtitle: 'بناء وتطوير الهويات المؤسسية المتكاملة للشركات والجهات الكبرى',
      summary:
        'نصمم ونطور الهويات البصرية للشركات من خلال دراسة دقيقة للسوق والجمهور المستهدف، وصياغة منظومة بصرية متكاملة تشمل الشعار، الخطوط، الألوان، دليل الاستخدام، والتطبيقات المكتبية.',
      features: [
        'دراسة وبحوث السوق والتموضع المؤسسي للعلامة',
        'تصميم الشعار وتحديد الرمزيات البصرية الحصرية',
        'اختيار الألوان والخطوط والأنماط المعيارية',
        'إعداد دليل الهوية الإرشادي الشامل (Brand Guidelines)',
        'تصميم المطبوعات والتطبيقات الرسمية والقرطاسية',
      ],
      deliverables: ['دليل الهوية الشامل (PDF)', 'حزمة ملفات الفيكتور (AI, EPS, SVG)', 'تطبيقات القرطاسية والمطبوعات'],
      metaDescription: 'خدمات تصميم وتطوير الهوية البصرية للشركات والمؤسسات من وكالة موهبة في مصر والشرق الأوسط.',
    },
    en: {
      title: 'Brand Identity Architecture',
      subtitle: 'Strategic brand identity systems and comprehensive visual guidelines for enterprises',
      summary:
        'We engineer distinctive enterprise brand identities rooted in market research, defining custom logomarks, typography hierarchies, corporate color palettes, and complete governance guidelines.',
      features: [
        'Strategic brand positioning and competitive landscape analysis',
        'Bespoke logomark and symbol engineering',
        'Typography hierarchy and institutional color palettes',
        'Comprehensive Brand Guidelines and visual standards manual',
        'Corporate stationery, signage, and collateral design',
      ],
      deliverables: ['Comprehensive Brand Manual (PDF)', 'Vector Asset Master Package (AI, EPS, SVG)', 'Corporate Stationery Collaterals'],
      metaDescription: 'Enterprise visual brand identity and corporate guideline design by MWHEBA Agency.',
    },
  },
  {
    slug: 'web-development',
    category: 'technology',
    sourceOrigin: 'legacy_site_audit_verified',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 2.A Core Services Copy (#3 Web Development)',
    approvalStatus: 'verified_from_v1',
    ar: {
      title: 'تطوير المواقع وتطبيقات الويب',
      subtitle: 'حلول برمجية مخصصة وعالية الأداء ترتكز على أحدث تقنيات الويب',
      summary:
        'نطور مواقع وتطبيقات ويب سريعة، آمنة، وقابلة للتوسع وفق أعلى المعايير التقنية، مع تجربة مستخدم سلسة وتوافق تام مع محركات البحث وأنظمة الدفع وإدارة المحتوى.',
      features: [
        'بنية برمجية معتمدة على Next.js و React و Node.js',
        'أنظمة إدارة محتوى مخصصة بدون قيود تقنية',
        'تحسين سرعة التحميل وتوافق Core Web Vitals القياسي',
        'تأمين المعاملات والبيانات بأعلى معايير الحماية والتشفير',
        'ربط متكامل مع بوابات الدفع الإلكتروني وواجهات الـ API',
      ],
      deliverables: ['كود مصدري منظم وموثق', 'نظام إدارة محتوى متكامل', 'شهادات التوافق وسرعة التحميل'],
      metaDescription: 'تطوير مواقع الشركات والمتاجر الإلكترونية المخصصة بأعلى معايير السرعة والأمان من وكالة موهبة.',
    },
    en: {
      title: 'Web Application & Software Development',
      subtitle: 'High-performance bespoke web applications engineered on modern enterprise architectures',
      summary:
        'We engineer modern, secure, and resilient web applications and corporate platforms built with Next.js, TypeScript, and headless architectures, guaranteeing exceptional Core Web Vitals and scalability.',
      features: [
        'Modern architecture based on Next.js, React, and TypeScript',
        'Tailored Headless CMS integration with granular access control',
        'Rigorous Core Web Vitals optimization and sub-second load times',
        'Enterprise-grade security, CSRF protection, and data encryption',
        'Seamless integration with payment gateways and third-party APIs',
      ],
      deliverables: ['Documented Production Codebase', 'Granular Admin Control Hub', 'Lighthouse & CWV Verification Audits'],
      metaDescription: 'Modern corporate web development and custom web application engineering by MWHEBA Agency.',
    },
  },
  {
    slug: 'ui-ux-design',
    category: 'design',
    sourceOrigin: 'legacy_site_audit_verified',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 2.A Core Services Copy (#1 UI/UX Design)',
    approvalStatus: 'verified_from_v1',
    ar: {
      title: 'تصميم واجهة وتجربة المستخدم (UI/UX)',
      subtitle: 'تصميم مسارات تفاعلية تركز على سلوك المستخدم وتحقيق أهداف العمل',
      summary:
        'نصمم واجهات وتجارب استخدام رقمية مريحة، مدروسة، وتعتمد على دراسة سلوك المستخدم الفعلي لتقليل الاحتكاك ورفع معدلات التحويل للمنتجات الرقمية والمواقع.',
      features: [
        'أبحاث المستخدم ورسم خرائط الرحلات وسيناريوهات الاستخدام',
        'تصميم الهياكل السلكية والنماذج الأولية التفاعلية (Wireframing & Prototyping)',
        'بناء أنظمة التصميم الموحدة (Design Systems)',
        'اختبارات قابلية الاستخدام وسهولة الوصول (WCAG Accessibility)',
        'تسليم دقيق لملفات التصميم مع مواصفات المطورين',
      ],
      deliverables: ['ملفات التصميم التفاعلية (Figma)', 'نظام التصميم والمكونات الموحدة', 'تقرير اختبارات سهولة الاستخدام'],
      metaDescription: 'تصميم واجهات وتجربة المستخدم UI/UX للمواقع والتطبيقات بأسلوب هادئ وأنيق ومهني من موهبة.',
    },
    en: {
      title: 'UI/UX Experience Design & Prototyping',
      subtitle: 'Calm, minimal, and conversion-optimized interfaces designed around user behavior',
      summary:
        'We design user experiences and digital interfaces that eliminate cognitive friction, aligning elegant typography and whitespace with structured interaction design to drive conversions.',
      features: [
        'User research, mental modeling, and interactive journey mapping',
        'Low-fidelity wireframing and high-fidelity interactive prototyping',
        'Scalable corporate design systems and component libraries',
        'WCAG AA accessibility validation and readability optimization',
        'Production-ready developer specifications in Figma',
      ],
      deliverables: ['Interactive Figma Source Systems', 'Comprehensive Component Library', 'UX Usability & Accessibility Audit'],
      metaDescription: 'Calm, corporate UI/UX interface and product design by MWHEBA Agency.',
    },
  },
  {
    slug: 'digital-marketing',
    category: 'marketing',
    sourceOrigin: 'legacy_site_audit_verified',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 2.A Core Services Copy (#4 Digital Marketing)',
    approvalStatus: 'verified_from_v1',
    ar: {
      title: 'التسويق الرقمي واستراتيجيات النمو',
      subtitle: 'إدارة الحملات الإعلانية الموجهة وتحقيق أعلى عائد على الاستثمار',
      summary:
        'نضع استراتيجيات تسويقية رقمية متكاملة للشركات تشمل الحملات الممولة المدفوعة على منصات ميتا وجوجل ولينكد إن، وتحسين محركات البحث، وصناعة المحتوى التحريري المؤثر.',
      features: [
        'تخطيط وإدارة الحملات الإعلانية المدفوعة (Meta, Google Ads, LinkedIn)',
        'تحسين الظهور العضوي في محركات البحث (Technical & Content SEO)',
        'إدارة التواجد المؤسسي على وسائل التواصل الاجتماعي',
        'صياغة الرسائل التسويقية والمحتوى الإبداعي',
        'تقارير تحليلية دورية دقيقة لقياس كفاءة الميزانيات والعائد',
      ],
      deliverables: ['خطة استراتيجية ربع سنوية', 'لوحات تحليلات مباشرة (Looker Studio)', 'تقارير أداء دورية'],
      metaDescription: 'خدمات التسويق الرقمي وإدارة الحملات الإعلانية الموجهة للشركات من وكالة موهبة.',
    },
    en: {
      title: 'Performance Digital Marketing & Growth',
      subtitle: 'Data-informed customer acquisition and brand visibility campaigns for B2B enterprises',
      summary:
        'We architect data-driven digital marketing programs combining targeted paid search and social campaigns with technical search engine optimization and authoritative editorial positioning.',
      features: [
        'Multi-channel performance campaigns (Google Ads, Meta, LinkedIn)',
        'Technical search engine optimization (SEO) and content authority',
        'Executive thought leadership and corporate social presence',
        'Conversion-oriented copywriting and visual asset creation',
        'Transparent attribution modeling and ROI analytics reporting',
      ],
      deliverables: ['Quarterly Strategic Playbook', 'Live Performance Dashboards', 'Comprehensive Attribution Reports'],
      metaDescription: 'B2B digital marketing, search engine optimization, and paid acquisition by MWHEBA Agency.',
    },
  },
  {
    slug: 'media-production',
    category: 'media',
    sourceOrigin: 'legacy_site_audit_verified',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 2.A Core Services Copy (#2 Media Production)',
    approvalStatus: 'verified_from_v1',
    ar: {
      title: 'الإنتاج الإعلامي والمرئي',
      subtitle: 'تصوير احترافي وإنتاج سينمائي يوثق قصص نجاح العلامات التجارية',
      summary:
        'نقدم خدمات الإنتاج المرئي والمحتوى السينمائي من تصوير المنتجات، الأفلام الوثائقية المؤسسية، مقاطع الرسوم المتحركة (Motion Graphics)، والتغطيات الإعلامية للمؤتمرات.',
      features: [
        'تصوير فوتوغرافي تجاري وصناعي عالي الدقة للمنتجات والمنشآت',
        'إنتاج الأفلام الوثائقية والإعلانات السينمائية المؤسسية',
        'الرسوم المتحركة والموشن جرافيك ثنائي وثلاثي الأبعاد',
        'المونتاج الرقمي، وتدريج الألوان، والهندسة الصوتية',
        'التغطية الإعلامية للمؤتمرات والمعارض والفعاليات الكبرى',
      ],
      deliverables: ['أفلام ترويجية جاهزة للبث بدقة 4K', 'مكتبة صور احترافية عالية الجودة', 'نسخ محسنة لمنصات التواصل'],
      metaDescription: 'إنتاج إعلامي وسينمائي وتصوير منتجات وأفلام وثائقية للشركات من وكالة موهبة.',
    },
    en: {
      title: 'Cinematic Media & Video Production',
      subtitle: 'Corporate cinematography, documentary brand reels, and high-impact commercial photography',
      summary:
        'We produce high-caliber visual media, from corporate documentary stories and commercial product photography to motion graphics and live executive summit coverage.',
      features: [
        'Commercial studio and on-site industrial photography',
        'Corporate documentaries, brand films, and cinema commercials',
        '2D and 3D motion graphics and narrative explainer animations',
        'Professional editing, DaVinci Resolve color grading, and sound design',
        'Multi-camera summit and enterprise event documentation',
      ],
      deliverables: ['Master 4K Cinema Delivery Files', 'High-Resolution Media Asset Library', 'Platform-Optimized Social Cuts'],
      metaDescription: 'Corporate cinematography, commercial photography, and brand storytelling by MWHEBA Agency.',
    },
  },
  {
    slug: 'printing',
    category: 'printing',
    sourceOrigin: 'legacy_site_audit_verified',
    sourceReference: 'docs/audit/03-content-and-media-audit.md: Section 2.A Core Services Copy (#6 Printing & Giveaways)',
    approvalStatus: 'verified_from_v1',
    ar: {
      title: 'الطباعة التجارية والهدايا المؤسسية',
      subtitle: 'حلول طباعة متقدمة وهدايا دعائية راقية تليق بكبرى المؤسسات',
      summary:
        'نوفر خدمات الطباعة الأوفست والرقمية الفاخرة، تصنيع وتوريد الهدايا الترويجية الراقية، الأزياء واليونيفورم الموحد، وتجهيز أجنحة المعارض بأعلى مستويات الجودة ودقة الألوان.',
      features: [
        'الطباعة الورقية الفاخرة للكتالوجات، البروشورات، والتقارير السنوية',
        'توريد وتخصيص الهدايا الترويجية (VIP Corporate Giveaways)',
        'حفر الليزر، والطباعة الحرارية، والطباعة بالأشعة فوق البنفسجية (UV)',
        'الأزياء المهنية واليونيفورم المؤسسي المخصص للكوادر والفرق',
        'تصنيع وتنفيذ منصات العرض وأجنحة المعارض والمؤتمرات',
      ],
      deliverables: ['عينات وبروفات ألوان قبل الإنتاج', 'شحنات مفحوصة لضبط الجودة', 'تغليف مؤسسي محكم'],
      metaDescription: 'الطباعة التجارية الفاخرة وتوريد الهدايا الترويجية واليونيفورم للشركات من موهبة.',
    },
    en: {
      title: 'Commercial Printing & Corporate Merchandise',
      subtitle: 'High-end commercial offset printing, bespoke executive giveaways, and uniform manufacturing',
      summary:
        'We manufacture premium printed materials, bespoke corporate promotional merchandise, luxury corporate giveaways, staff apparel, and exhibition stands with strict color and material fidelity.',
      features: [
        'Commercial offset & digital printing for catalogs and annual reports',
        'Curated executive gift sets and custom VIP promotional merchandise',
        'Precision laser engraving, screen printing, and flatbed UV printing',
        'Corporate staff uniforms and technical workwear with custom branding',
        'Exhibition booth fabrication, display panels, and directional signage',
      ],
      deliverables: ['Pre-Production Physical Proof Mockups', 'Quality-Inspected Bulk Shipments', 'Protective Corporate Packaging'],
      metaDescription: 'Commercial printing, corporate giveaways, and branded merchandise manufacturing by MWHEBA Agency.',
    },
  },
];
