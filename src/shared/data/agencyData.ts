/**
 * Authentic MWHEBA Agency Data Architecture
 * Sourced directly from live site audit: https://mwheba.com/
 * docs/audit/02-url-inventory.csv & docs/audit/03-content-and-media-audit.md
 */

export interface AgencyClient {
  id: string;
  name: string;
  nameAr: string;
  logoPath: string;
}

export interface AgencyServiceItem {
  id: string;
  slug: string;
  iconName: 'branding' | 'web' | 'media' | 'uiux' | 'marketing' | 'printing';
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  featuresAr: string[];
  featuresEn: string[];
}

export interface WorkflowStep {
  step: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

export interface AgencyStat {
  value: string;
  labelAr: string;
  labelEn: string;
}

export interface AgencyValue {
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
}

/**
 * 22 Authentic Enterprise Clients cataloged from live site mwheba.com
 */
export const agencyClients: AgencyClient[] = [
  { id: 'oxford', name: 'Oxford Group', nameAr: 'مجموعة أوكسفورد التعليمية', logoPath: '/clients/oxford.webp' },
  { id: 'bico-misr', name: 'Bico Misr', nameAr: 'بيكو مصر للتغليف والهندسة', logoPath: '/clients/bico-misr.webp' },
  { id: 'nasec', name: 'NASEC Security', nameAr: 'ناسك للحلول الأمنية', logoPath: '/clients/nasec.webp' },
  { id: 'abo-fares', name: 'Abo Fares', nameAr: 'مطاعم أبو فارس السوري', logoPath: '/clients/abo-fares.webp' },
  { id: 'truedent', name: 'TrueDent Dental', nameAr: 'مراكز ترو دينت لطب الأسنان', logoPath: '/clients/truedent.webp' },
  { id: 'maher', name: 'Maher Group', nameAr: 'مجموعة ماهر الصناعية', logoPath: '/clients/maher.webp' },
  { id: 'tejanos', name: 'Tejanos', nameAr: 'سلسلة تيجانوس', logoPath: '/clients/tejanos.webp' },
  { id: 'al-asala', name: 'Al-Asala', nameAr: 'الأصالة للتجارة والاستثمار', logoPath: '/clients/al-asala.webp' },
  { id: 'egy-trans', name: 'Egy-Trans', nameAr: 'إيجي ترانس للشحن الدولي', logoPath: '/clients/egy-trans.webp' },
  { id: 'orouba', name: 'Orouba', nameAr: 'العروبة للاستثمار والتطوير', logoPath: '/clients/orouba.webp' },
  { id: 'pyramids', name: 'Pyramids', nameAr: 'بيراميدز للتوريدات والخدمات', logoPath: '/clients/pyramids.webp' },
  { id: 'so5n-w-say7', name: 'so5n w say7', nameAr: 'مطاعم سخن و سايح', logoPath: '/clients/so5n-w-say7.webp' },
  { id: 'eyefree', name: 'EyeFree Optics', nameAr: 'مراكز آي فري للبصريات', logoPath: '/clients/eyefree.webp' },
  { id: 'chicken-chester', name: 'Chicken Chester', nameAr: 'سلسلة تشيكن تشيستر', logoPath: '/clients/chicken-chester.webp' },
  { id: 'acc', name: 'ACC Contracting', nameAr: 'المقاولون العرب ACC', logoPath: '/clients/acc.webp' },
  { id: 'ashrakat', name: 'Ashrakat', nameAr: 'مؤسسة أشرقت للخدمات الطبية', logoPath: '/clients/ashrakat.webp' },
  { id: 'essp', name: 'ESSP Logistics', nameAr: 'إي إس إس بي للوجستيات', logoPath: '/clients/essp.webp' },
  { id: 'al-kobtan', name: 'Al-Kobtan Marine', nameAr: 'القبطان للخدمات البحرية والتوريدات', logoPath: '/clients/al-kobtan.webp' },
  { id: 'mega-pharm', name: 'Mega-Pharm', nameAr: 'ميجا فارم للأدوية والمستلزمات', logoPath: '/clients/mega-pharm.webp' },
  { id: 'trust-dental', name: 'Trust Dental', nameAr: 'تراست لطب وزراعة الأسنان', logoPath: '/clients/trust-dental.webp' },
  { id: 'shatby', name: 'Shatby Hospital Care', nameAr: 'مؤسسة الشاطبي الطبية', logoPath: '/clients/shatby.webp' },
  { id: 'ami', name: 'AMI Industries', nameAr: 'إيه إم آي للصناعات المتطورة', logoPath: '/clients/ami.webp' },
];

/**
 * 6 Core Agency Pillars
 */
export const agencyServices: AgencyServiceItem[] = [
  {
    id: 'brand-identity',
    slug: 'brand-identity',
    iconName: 'branding',
    titleAr: 'هوية العلامة التجارية',
    titleEn: 'Brand Identity Systems',
    subtitleAr: 'بناء وتطوير الهويات المؤسسية المتكاملة للشركات والجهات الكبرى',
    subtitleEn: 'Strategic brand identity systems and comprehensive visual guidelines',
    descriptionAr: 'نصمم ونطور الهويات البصرية للشركات من خلال دراسة دقيقة للسوق والجمهور المستهدف، وصياغة منظومة بصرية متكاملة تشمل الشعار، الخطوط، الألوان، ودليل الاستخدام.',
    descriptionEn: 'We engineer distinctive enterprise brand identities rooted in market research, defining custom logomarks, typography hierarchies, and governance guidelines.',
    featuresAr: ['أدلة المعايير البصرية (Brand Guidelines)', 'تصميم الشعارات الحصرية ورموز العلامة', 'الألوان والخطوط والأنماط المعيارية', 'تطبيقات القرطاسية والمطبوعات الإدارية'],
    featuresEn: ['Comprehensive Brand Guidelines Manual', 'Bespoke Logomark & Symbol Engineering', 'Institutional Typography & Color Standards', 'Corporate Stationery & Signage Collateral'],
  },
  {
    id: 'web-development',
    slug: 'web-development',
    iconName: 'web',
    titleAr: 'استضافة وتطوير المواقع',
    titleEn: 'Web Development & Platforms',
    subtitleAr: 'حلول برمجية مخصصة وعالية الأداء ترتكز على أحدث تقنيات الويب',
    subtitleEn: 'High-performance bespoke web applications and platforms engineered on modern architectures',
    descriptionAr: 'نطور مواقع وتطبيقات ويب سريعة، آمنة، وقابلة للتوسع وفق أعلى المعايير التقنية، مع تجربة مستخدم سلسة وتوافق تام مع محركات البحث وأنظمة الدفع.',
    descriptionEn: 'We engineer modern, secure, and resilient web applications built with Next.js, TypeScript, and headless architectures, guaranteeing exceptional Core Web Vitals.',
    featuresAr: ['بنية برمجية معتمدة على Next.js الحديثة', 'سرعة تحميل فائقة وتوافق Core Web Vitals', 'أنظمة إدارة محتوى مخصصة بدون قيود', 'تأمين المعاملات والربط مع بوابات الدفع'],
    featuresEn: ['Modern Next.js & TypeScript Architecture', 'Sub-second Core Web Vitals Performance', 'Granular Tailored CMS Management', 'Enterprise Security & Payment Gateway Integration'],
  },
  {
    id: 'media-production',
    slug: 'media-production',
    iconName: 'media',
    titleAr: 'إنتاج الوسائط والفيديو',
    titleEn: 'Media & Video Production',
    subtitleAr: 'تصوير احترافي وإنتاج سينمائي يوثق قصص نجاح العلامات التجارية',
    subtitleEn: 'Corporate cinematography, documentary brand reels, and high-impact commercial photography',
    descriptionAr: 'نقدم خدمات الإنتاج المرئي والمحتوى السينمائي من تصوير المنتجات، الأفلام الوثائقية المؤسسية، مقاطع الرسوم المتحركة (Motion Graphics)، والتغطيات الإعلامية.',
    descriptionEn: 'We produce high-caliber visual media, from corporate documentary stories and commercial product photography to motion graphics and live executive summit coverage.',
    featuresAr: ['تصوير سينمائي وإعلانات تجارية بدقة 4K', 'الرسوم المتحركة والموشن جرافيك 2D/3D', 'تصوير المنتجات والمنشآت الصناعية', 'المونتاج الرقمي والهندسة الصوتية الاحترافية'],
    featuresEn: ['Broadcast-Ready 4K Commercials & Films', '2D & 3D Narrative Motion Graphics', 'Studio & On-Site Industrial Photography', 'Professional Color Grading & Sound Design'],
  },
  {
    id: 'ui-ux-design',
    slug: 'ui-ux-design',
    iconName: 'uiux',
    titleAr: 'تصميم واجهة وتجربة المستخدم',
    titleEn: 'UI/UX Experience Design',
    subtitleAr: 'تصميم مسارات تفاعلية تركز على سلوك المستخدم وتحقيق أهداف العمل',
    subtitleEn: 'Calm, minimal, and conversion-optimized interfaces designed around user behavior',
    descriptionAr: 'نصمم واجهات وتجارب استخدام رقمية مريحة، مدروسة، وتعتمد على دراسة سلوك المستخدم الفعلي لتقليل الاحتكاك ورفع معدلات التحويل للمنتجات الرقمية.',
    descriptionEn: 'We design digital interfaces that eliminate cognitive friction, aligning typography and balanced whitespace with structured interaction design to drive conversions.',
    featuresAr: ['أبحاث المستخدم ورسم خرائط الرحلات', 'الهياكل السلكية والنماذج التفاعلية (Figma)', 'بناء وتوحيد أنظمة التصميم (Design Systems)', 'امتثال تام لمعايير سهولة الوصول WCAG AA'],
    featuresEn: ['User Journey & Behavioral Mental Modeling', 'Interactive High-Fidelity Figma Prototyping', 'Scalable Corporate Design Systems', 'Full WCAG AA Accessibility Compliance'],
  },
  {
    id: 'digital-marketing',
    slug: 'digital-marketing',
    iconName: 'marketing',
    titleAr: 'التسويق الرقمي واستراتيجيات النمو',
    titleEn: 'Performance Digital Marketing',
    subtitleAr: 'إدارة الحملات الإعلانية الموجهة وتحقيق أعلى عائد على الاستثمار',
    subtitleEn: 'Data-informed customer acquisition and brand visibility campaigns for enterprises',
    descriptionAr: 'نضع استراتيجيات تسويقية رقمية متكاملة للشركات تشمل الحملات الممولة على منصات ميتا وجوجل ولينكد إن، وتحسين محركات البحث، وصناعة المحتوى المؤثر.',
    descriptionEn: 'We architect data-driven digital marketing programs combining targeted paid search and social campaigns with technical SEO and authoritative positioning.',
    featuresAr: ['حملات إعلانية موجهة (Google Ads, Meta, LinkedIn)', 'تحسين محركات البحث التقني والمحتوى (SEO)', 'إدارة الحسابات والتواجد المؤسسي الرسمي', 'لوحات تحليلات مباشرة وتقارير العائد على الإنفاق'],
    featuresEn: ['Multi-Channel Paid Acquisition Campaigns', 'Technical SEO & Content Authority', 'Executive Social Media Presence', 'Transparent ROI Analytics & Attribution Dashboards'],
  },
  {
    id: 'printing',
    slug: 'printing',
    iconName: 'printing',
    titleAr: 'الطباعة وهدايا كبار الشخصيات',
    titleEn: 'Printing & Corporate Merchandise',
    subtitleAr: 'حلول طباعة متقدمة وهدايا دعائية راقية تليق بكبرى المؤسسات',
    subtitleEn: 'High-end commercial printing, bespoke executive giveaways, and uniform manufacturing',
    descriptionAr: 'نوفر خدمات الطباعة الأوفست والرقمية الفاخرة، تصنيع وتوريد الهدايا الترويجية الراقية، الأزياء واليونيفورم الموحد، وتجهيز أجنحة المعارض بأعلى مستويات الجودة.',
    descriptionEn: 'We manufacture premium printed materials, bespoke corporate promotional merchandise, luxury corporate giveaways, staff apparel, and exhibition stands with strict fidelity.',
    featuresAr: ['توريد وتخصيص هدايا الشركات (VIP Giveaways)', 'حفر الليزر والطباعة الحرارية والأشعة UV', 'الطباعة الورقية الفاخرة للكتالوجات والتقارير', 'الأزياء المهنية واليونيفورم الموحد للفرق'],
    featuresEn: ['Curated Executive VIP Gift Sets & Merchandise', 'Precision Laser Engraving & UV Printing', 'Commercial Offset & Digital Print Collateral', 'Custom Corporate Uniforms & Workwear'],
  },
];

/**
 * 4-Step Agency Creative & Technical Process
 */
export const agencyWorkflow: WorkflowStep[] = [
  {
    step: '01',
    titleAr: 'اكتشاف الأفكار وتحليل المتطلبات',
    titleEn: 'Discovery & Requirement Analysis',
    descAr: 'جلسات عمل استشارية معمقة لفهم أهداف مشروعك، دراسة الجمهور التنافسي، وتحديد المتطلبات بدقة هندسية.',
    descEn: 'In-depth consultation sessions to assess brand goals, analyze competitive landscapes, and formulate clear technical briefs.',
  },
  {
    step: '02',
    titleAr: 'التخطيط الاستراتيجي وهندسة الحل',
    titleEn: 'Strategy & Solution Architecture',
    descAr: 'صياغة خارطة طريق واضحة تجمع بين التصميم المبتكر والمسارات البرمجية ومواصفات الإنتاج الأكثر كفاءة.',
    descEn: 'Formulating structured roadmaps combining creative direction, robust software architecture, and production specs.',
  },
  {
    step: '03',
    titleAr: 'التنفيذ الإبداعي والبرمجي المتكامل',
    titleEn: 'Creative Execution & Engineering',
    descAr: 'تحويل الخطط إلى واقع ملموس بدقة عالية في صياغة الأكواد والتصاميم مع بروفات واختبارات معيارية مستمرة.',
    descEn: 'Bringing concepts to reality through precise development, meticulous design crafts, and rigorous testing.',
  },
  {
    step: '04',
    titleAr: 'الإطلاق الفني والتسليم والقياس',
    titleEn: 'Launch, Quality Delivery & Growth',
    descAr: 'تسليم المنتجات أو إطلاق المنصات بأعلى معايير الجودة مع تدريب الكوادر ودعم مستمر لقياس مؤشرات النجاح.',
    descEn: 'Seamless platform deployment or physical delivery with rigorous quality audits, staff handover, and growth tracking.',
  },
];

/**
 * Key Performance Metrics
 */
export const agencyStats: AgencyStat[] = [
  {
    value: '10+',
    labelAr: 'سنوات من الخبرة الإبداعية والإنتاجية',
    labelEn: 'Years of Creative & Production Engineering',
  },
  {
    value: '100+',
    labelAr: 'كيان تجاري ومؤسسة في مصر والشرق الأوسط',
    labelEn: 'Enterprise Clients & Institutions',
  },
  {
    value: '6',
    labelAr: 'تخصصات متكاملة تحت مظلة وكالة واحدة',
    labelEn: 'Integrated Disciplines Under One Roof',
  },
  {
    value: '100%',
    labelAr: 'التزام بجودة التنفيذ والضوابط المعيارية',
    labelEn: 'Strict Quality & Production Governance',
  },
];

/**
 * Extended Stats for About Page
 */
export const agencyAboutStats: AgencyStat[] = [
  {
    value: '10+',
    labelAr: 'سنوات في العمل والريادة',
    labelEn: 'Years in Business & Industry Leadership',
  },
  {
    value: '100+',
    labelAr: 'مشاريع ناجحة وكيانات كبرى',
    labelEn: 'Successful Projects & Enterprise Clients',
  },
  {
    value: '25+',
    labelAr: 'مستشاراً ومصمماً ومطوراً بالوكالة',
    labelEn: 'Creative Directors & Software Engineers',
  },
  {
    value: '5+',
    labelAr: 'بلدان يتم تقديم الخدمة فيها بالمنطقة',
    labelEn: 'Countries Served Across MENA',
  },
];

/**
 * 6 Authentic Corporate Values from live site mwheba.com
 */
export const agencyValues: AgencyValue[] = [
  {
    titleAr: 'العمل الجماعي أولاً',
    titleEn: 'Teamwork First',
    descAr: 'نحن نتعاون في كل قسم لبناء حلول رقمية وإبداعية أفضل وأذكى وأسرع لعملائنا.',
    descEn: 'We collaborate across every department to build better, smarter, and faster digital solutions.',
  },
  {
    titleAr: 'التركيز على العملاء',
    titleEn: 'Client-Centricity',
    descAr: 'يركز كل قرار نتخذه على تقديم قيمة طويلة الأجل ومستدامة لنمو عملائنا في السوق.',
    descEn: 'Every decision we make is focused on delivering long-term, sustainable value for our clients’ growth.',
  },
  {
    titleAr: 'التميز دائماً',
    titleEn: 'Relentless Excellence',
    descAr: 'نحن نتجاوز الحدود، ونصقل التفاصيل، ونسعى لتحقيق المعايير العالية في كل خطوة إبداعية وتقنية.',
    descEn: 'We push limits, refine details, and chase high standards in every creative and technical step.',
  },
  {
    titleAr: 'خلق القيمة الحقيقية',
    titleEn: 'Value Creation',
    descAr: 'نحن لا نقوم بإرسال مجرد مخرجات عابرة — بل نصيغ حلولاً مفيدة تحل التحديات التجارية الحقيقية.',
    descEn: 'We don’t just ship outputs — we craft meaningful solutions that solve real business challenges.',
  },
  {
    titleAr: 'القيادة بشجاعة',
    titleEn: 'Courageous Leadership',
    descAr: 'نتصرف بجرأة، ونحتضن التغيير والابتكار، ونواجه التحديات المعقدة بثقة وعمل استشرافي.',
    descEn: 'We act boldly, embrace change, and face complexity with confidence and forward-thinking action.',
  },
  {
    titleAr: 'الإتقان فوق التوقعات',
    titleEn: 'Finished Beyond Expectations',
    descAr: 'نتابع ونصقل النتائج النهائية ونتأكد من أن كل مشروع يتم تسليمه بجودة تفوق توقعات شريكنا.',
    descEn: 'We follow through, polish final results, and make sure every project ends above client expectations.',
  },
];
