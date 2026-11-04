/**
 * Legacy Blog Posts Data
 * Curated B2B knowledge article proposals replacing WordPress template demo junk per AUD-03.
 * NOTE: Live site audit confirmed that all legacy WordPress posts were template demos.
 * These articles are strictly categorized as DRAFTS pending editorial board and stakeholder review.
 */

export interface LegacyBlogPostItem {
  slug: string;
  category: 'branding' | 'marketing' | 'merchandise' | 'media';
  readingTimeMinutes: number;
  publishedAt: string;
  author: string;
  sourceOrigin: 'editorial_review_draft';
  sourceReference: string;
  approvalStatus: 'pending_editorial_review';
  ar: {
    title: string;
    excerpt: string;
    content: string;
    coverImageAlt: string;
    tags: string[];
  };
  en: {
    title: string;
    excerpt: string;
    content: string;
    coverImageAlt: string;
    tags: string[];
  };
}

export const legacyBlogPostsData: LegacyBlogPostItem[] = [
  {
    slug: 'b2b-corporate-branding-trends-2026',
    category: 'branding',
    readingTimeMinutes: 5,
    publishedAt: 'مسودة قيد المراجعة',
    author: 'فريق موهبة التحريري (مسودة مقترحة)',
    sourceOrigin: 'editorial_review_draft',
    sourceReference: 'Editorial proposal for MWHEBA 2.0 knowledge center (Replaces WP demo junk per AUD-03: Section 1)',
    approvalStatus: 'pending_editorial_review',
    ar: {
      title: 'أحدث اتجاهات الهوية البصرية والمطبوعات المؤسسية لعام 2026 (مسودة تحريرية)',
      excerpt:
        'مسودة مقال تحريري مقترح للمراجعة حول اتجاهات تصميم الهويات المؤسسية B2B واعتماد البساطة والهدوء البصري.',
      content: `[ملاحظة توثيقية: هذه المادة مسودة تحريرية مقترحة لإثراء مركز المعرفة وليست مادة منشورة من الموقع القديم، حيث أثبت فحص الموقع الأصلي (AUD-03) أن المقالات السابقة كانت بيانات تجريبية لقالب ووردبريس. لا يجوز نشرها إلا بعد اعتماد هيئة التحرير.]

شهدت صناعة الهويات المؤسسية في الآونة الأخيرة تحولاً جذرياً نحو التبسيط الأنيق والخطوط الواضحة والهدوء البصري، مبتعدة تماماً عن الزخرفة المفرطة أو التدرجات اللونية المعقدة.

في سوق الأعمال B2B، أصبحت الهوية البصرية تعبيراً مباشراً عن مصداقية المؤسسة واستقرارها المالي وقدرتها على تقديم حلول واضحة دون تعقيد. إن اختيار لوحة ألوان هادئة تعتمد على الألوان المسطحة المريحة للعين، إلى جانب خطوط طباعية رصينة ومساحات بيضاء متوازنة، يمنح العلامة التجارية حضوراً واثقاً أمام كبار العملاء والشركاء المؤسسيين.

علاوة على ذلك، تلعب المطبوعات المؤسسية الفاخرة دوراً محورياً في ترسيخ هذا الانطباع في اللقاءات المباشرة ومؤتمرات الأعمال، محولة الشعار من مجرد رسم رقمي إلى تجربة ملموسة تعبر عن الرقي والاحترافية.`,
      coverImageAlt: 'مسودة مقال الهوية البصرية لعام 2026',
      tags: ['الهوية البصرية', 'العلامة التجارية', 'مسودة للمراجعة'],
    },
    en: {
      title: 'Key Corporate Branding Trends for 2026 (Editorial Review Draft)',
      excerpt:
        'Proposed editorial knowledge piece exploring modern B2B visual identity shifts and calm minimalism.',
      content: `[Editorial Provenance Note: This article is a proposed draft submitted for stakeholder review. Live site audit AUD-03 verified that legacy WordPress blog posts were template demo data. This entry remains in draft status pending editorial approval.]

The enterprise branding landscape has decisively shifted toward calm minimalism, legibility, and restraint, discarding visual clutter and hyper-saturated gradients in favor of authoritative corporate balance.

In modern B2B commerce, visual architecture directly conveys financial stability, operational precision, and corporate credibility. Adopting flat, disciplined color palettes anchored in purposeful negative space communicates quiet confidence to enterprise decision-makers and institutional partners.`,
      coverImageAlt: 'Editorial review draft cover on corporate branding trends',
      tags: ['Corporate Identity', 'B2B Branding', 'Editorial Draft'],
    },
  },
  {
    slug: 'custom-promotional-gifts-roi',
    category: 'merchandise',
    readingTimeMinutes: 4,
    publishedAt: 'مسودة قيد المراجعة',
    author: 'فريق الهدايا المؤسسية (مسودة مقترحة)',
    sourceOrigin: 'editorial_review_draft',
    sourceReference: 'Editorial proposal for merchandise category (Replaces WP demo junk per AUD-03: Section 1)',
    approvalStatus: 'pending_editorial_review',
    ar: {
      title: 'العائد على الاستثمار من الهدايا الدعائية الفاخرة (مسودة تحريرية)',
      excerpt:
        'مسودة مقال تحليلي حول أثر الهدايا المؤسسية الوظيفية في تعزيز ولاء عملاء الشركات الكبرى.',
      content: `[ملاحظة توثيقية: مسودة تحريرية مقترحة بانتظار مراجعة هيئة التحرير والمالك قبل النشر.]

تعد الهدايا المؤسسية المخصصة إحدى أقوى أدوات بناء العلاقات طويلة الأجل في قطاع الأعمال (B2B)، ولكن بشرط أن تُختار وتُصنع بعناية تفوق المعايير التقليدية.

إن الفارق الجوهري بين هدية ترويجية تُلقى في الأدراج وأخرى تصبح جزءاً من الروتين اليومي للمدير التنفيذي يكمن في القيمة الوظيفية وجودة الخامات. عندما تهدي شريكك أدوات مكتبية متينة وعملية ومصنعة بعناية، فإن علامتك التجارية تصاحب أعماله اليومية باستمرار.`,
      coverImageAlt: 'مسودة مقال الهدايا المؤسسية والعائد الاستثماري',
      tags: ['الهدايا المؤسسية', 'B2B', 'مسودة تحريرية'],
    },
    en: {
      title: 'Strategic ROI of Executive Promotional Merchandise (Editorial Review Draft)',
      excerpt:
        'Proposed analytical draft evaluating how functional high-utility executive merchandise drives corporate retention.',
      content: `[Editorial Provenance Note: Proposed editorial piece in draft review status per Decision AUD-03.]

Bespoke promotional merchandise represents one of the most effective long-term relationship-building investments in B2B enterprise sales, provided that items are selected with utility and craftsmanship in mind.`,
      coverImageAlt: 'Editorial review draft cover on executive merchandise ROI',
      tags: ['Corporate Gifts', 'Client Retention', 'Editorial Draft'],
    },
  },
  {
    slug: 'b2b-digital-transformation-guide',
    category: 'marketing',
    readingTimeMinutes: 6,
    publishedAt: 'مسودة قيد المراجعة',
    author: 'فريق الاستشارات الرقمية (مسودة مقترحة)',
    sourceOrigin: 'editorial_review_draft',
    sourceReference: 'Editorial proposal for enterprise technology category (Replaces WP demo junk per AUD-03: Section 1)',
    approvalStatus: 'pending_editorial_review',
    ar: {
      title: 'خارطة طريق التحول الرقمي للشركات والتوريدات (مسودة تحريرية)',
      excerpt:
        'مسودة دليل استرشادي حول أتمتة أوامر الشراء والمطابقة المالية ومنصات التجارة المؤسسية.',
      content: `[ملاحظة توثيقية: مسودة تحريرية مقترحة بانتظار مراجعة المالك واعتماد النشر.]

لم يعد التحول الرقمي ترفاً تقنياً أو مشروعاً مؤجلاً لشركات التجارة والتوريدات في المنطقة، بل أصبح الركيزة الأساسية لاستمرار العمليات والنمو في ظل تسارع وتيرة الأعمال.

يبدأ التحول الرقمي الناجح بتوحيد البيانات وفصل الواجهات الأمامية عن الأنظمة الخلفية، مما يتيح للشركات بناء بوابات تعاقد وطلب سريعة تلبي احتياجات مسؤولي المشتريات بكل سلاسة.`,
      coverImageAlt: 'مسودة دليل التحول الرقمي للشركات',
      tags: ['التحول الرقمي', 'التجارة المؤسسية', 'مسودة للمراجعة'],
    },
    en: {
      title: 'Digital Modernization Blueprint for B2B Enterprises (Editorial Review Draft)',
      excerpt:
        'Proposed roadmap evaluating headless procurement portals, automated approval loops, and ledger accuracy.',
      content: `[Editorial Provenance Note: Proposed modernization draft under review per AUD-03.]

Digital modernization is no longer an optional innovation milestone for regional trading and supply organizations; it is the cornerstone of operational resilience and scalable growth.`,
      coverImageAlt: 'Editorial review draft cover on B2B digital transformation',
      tags: ['Digital Transformation', 'B2B Platforms', 'Editorial Draft'],
    },
  },
];
