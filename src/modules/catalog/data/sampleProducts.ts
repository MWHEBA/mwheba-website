import type { ProductItem } from '@/modules/cart-checkout/logic/moqEngine';

export interface CatalogProduct extends ProductItem {
  slug: string;
  category: 'giveaways' | 'stationery' | 'services';
  categoryAr: string;
  categoryEn: string;
  descriptionAr: string;
  descriptionEn: string;
  imageUrl: string;
  variants: {
    id: string;
    nameAr: string;
    nameEn: string;
    sku: string;
    colorHex?: string;
  }[];
  specifications: {
    labelAr: string;
    labelEn: string;
    valueAr: string;
    valueEn: string;
  }[];
  customizationOptions: {
    id: string;
    labelAr: string;
    labelEn: string;
    fee: number;
  }[];
}

export const sampleProducts: Record<string, CatalogProduct> = {
  'flask-01': {
    id: 'flask-01',
    slug: 'executive-thermal-flask',
    title: 'كوب حراري ذكي مخصص (Executive Thermal Flask)',
    itemType: 'physical',
    minOrderQuantity: 10,
    basePrice: 250,
    customizationFee: 35,
    category: 'giveaways',
    categoryAr: 'هدايا الشركات الفاخرة',
    categoryEn: 'Executive Giveaways',
    descriptionAr:
      'كوب حراري مصنوع من الفولاذ المقاوم للصدأ 316 مزدوج الجدار مع عزل حراري يدوم 12 ساعة، قابل للحفر بالليزر الدقيق أو الطباعة الحرارية الملونة لهوية شركتك.',
    descriptionEn:
      'Double-walled 316 stainless steel thermal vacuum flask preserving temperature for 12 hours. Precision laser engraving or full-color UV print for your corporate brand.',
    imageUrl: '/brand/logo-mark.webp',
    variants: [
      { id: 'v-blue', nameAr: 'أزرق بترولي مؤسسي', nameEn: 'Corporate Petrol Blue', sku: 'FLK-BLU-01', colorHex: '#01578a' },
      { id: 'v-black', nameAr: 'أسود مطفي كلاسيكي', nameEn: 'Matte Executive Black', sku: 'FLK-BLK-01', colorHex: '#0f172a' },
      { id: 'v-silver', nameAr: 'فضي مصقول', nameEn: 'Brushed Silver', sku: 'FLK-SLV-01', colorHex: '#94a3b8' },
    ],
    specifications: [
      { labelAr: 'السعة', labelEn: 'Capacity', valueAr: '500 مل', valueEn: '500 ml' },
      { labelAr: 'الخامة', labelEn: 'Material', valueAr: 'فولاذ 316 آمن غذائياً', valueEn: 'Food-grade 316 Steel' },
      { labelAr: 'العزل', labelEn: 'Insulation', valueAr: '12 ساعة ساخن / 24 ساعة بارد', valueEn: '12h Hot / 24h Cold' },
      { labelAr: 'الحد الأدنى للطلب', labelEn: 'Minimum Order Quantity', valueAr: '10 قطع', valueEn: '10 Units' },
    ],
    customizationOptions: [
      { id: 'laser', labelAr: 'حفر ليزر دقيق دائم (+35 ج.م/قطعة)', labelEn: 'Precision Laser Engraving (+35 EGP/unit)', fee: 35 },
      { id: 'uv', labelAr: 'طباعة سلك سكرين بالألوان الكاملة (+45 ج.م/قطعة)', labelEn: 'Full-color UV Screen Print (+45 EGP/unit)', fee: 45 },
    ],
  },
  'notebook-01': {
    id: 'notebook-01',
    slug: 'luxury-leather-notebook',
    title: 'دفتر ملاحظات جلدي فاخر مع قلم معدني (Luxury Notebook & Pen)',
    itemType: 'physical',
    minOrderQuantity: 10,
    basePrice: 180,
    customizationFee: 25,
    category: 'stationery',
    categoryAr: 'الأدوات والمطبوعات المكتبية',
    categoryEn: 'Corporate Stationery',
    descriptionAr:
      'دفتر إداري بغلاف جلدي إيطالي فاخر مع 192 صفحة ورق عاجي 100 جم مع قلم معدني متناسق، متاح للبصم الحراري (Debossing) أو الطباعة الحريرية للشعار.',
    descriptionEn:
      'Executive notebook with premium Italian faux-leather cover, 192 pages of 100gsm ivory paper, accompanied by a matching weighted metal pen. Hot foil debossing or silkscreen logo.',
    imageUrl: '/brand/logo-mark.webp',
    variants: [
      { id: 'v-navy', nameAr: 'كحلي إداري', nameEn: 'Executive Navy', sku: 'NTB-NVY-01', colorHex: '#013b5e' },
      { id: 'v-crimson', nameAr: 'أحمر قرميدي فخم', nameEn: 'Rich Crimson', sku: 'NTB-CRM-01', colorHex: '#b91c1c' },
      { id: 'v-tan', nameAr: 'هافان طبيعي', nameEn: 'Natural Tan', sku: 'NTB-TAN-01', colorHex: '#d97706' },
    ],
    specifications: [
      { labelAr: 'المقاس', labelEn: 'Size', valueAr: 'A5 (148 × 210 مم)', valueEn: 'A5 (148 × 210 mm)' },
      { labelAr: 'عدد الصفحات', labelEn: 'Pages', valueAr: '192 صفحة مسطرة', valueEn: '192 Ruled Pages' },
      { labelAr: 'نوع الورق', labelEn: 'Paper Grade', valueAr: 'عاجي عالي الجودة 100 جم', valueEn: '100gsm Ivory Paper' },
      { labelAr: 'الحد الأدنى للطلب', labelEn: 'Minimum Order Quantity', valueAr: '10 قطع', valueEn: '10 Units' },
    ],
    customizationOptions: [
      { id: 'deboss', labelAr: 'بصم حراري غائر للعلامة (+25 ج.م/قطعة)', labelEn: 'Blind Hot Debossing (+25 EGP/unit)', fee: 25 },
      { id: 'foil-gold', labelAr: 'بصم ذهبي معدني فاخر (+30 ج.م/قطعة)', labelEn: 'Gold Foil Stamping (+30 EGP/unit)', fee: 30 },
    ],
  },
  'service-01': {
    id: 'service-01',
    slug: 'corporate-identity-system',
    title: 'باقة تصميم الهوية المؤسسية الكاملة (Complete Brand Architecture)',
    itemType: 'service',
    minOrderQuantity: 1,
    basePrice: 15000,
    customizationFee: 0,
    category: 'services',
    categoryAr: 'خدمات الهوية الرقمية',
    categoryEn: 'Brand Strategy & Identity',
    descriptionAr:
      'تطوير نظام علامة تجارية متكامل يشمل دراسة استراتيجية العلامة، تصميم الرموز والخطوط، مصفوفة الألوان، الدليل الإرشادي الكامل (Brand Guidelines)، وتطبيقات المطبوعات والمراسلات.',
    descriptionEn:
      'Full corporate brand system development including strategy discovery, mark engineering, custom typography palette, comprehensive brand guidelines manual, and complete business stationery package.',
    imageUrl: '/brand/logo-mark.webp',
    variants: [
      { id: 'v-core', nameAr: 'الباقة المؤسسية الشاملة', nameEn: 'Comprehensive Enterprise Package', sku: 'SRV-ID-01' },
    ],
    specifications: [
      { labelAr: 'مدة التنفيذ', labelEn: 'Timeline', valueAr: '14 - 21 يوم عمل', valueEn: '14 - 21 Business Days' },
      { labelAr: 'مراحل العمل', labelEn: 'Phases', valueAr: '3 مراحل تسليم معتمدة', valueEn: '3 Verified Milestones' },
      { labelAr: 'صيغ التسليم', labelEn: 'Deliverables', valueAr: 'AI, PDF, SVG, WebP + دليل الهوية', valueEn: 'AI, PDF, SVG, WebP + Manual' },
      { labelAr: 'الحد الأدنى', labelEn: 'Minimum Commitment', valueAr: 'عقد واحد ثابت', valueEn: '1 Fixed Scope Contract' },
    ],
    customizationOptions: [],
  },
};
