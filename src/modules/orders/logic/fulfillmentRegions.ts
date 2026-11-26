const egyptianRegions = [
  ['EG-C', 'القاهرة', 'Cairo', 'محافظة القاهرة'],
  ['EG-GZ', 'الجيزة', 'Giza', 'محافظة الجيزة'],
  ['EG-ALX', 'الإسكندرية', 'Alexandria', 'الاسكندرية', 'محافظة الإسكندرية'],
  ['EG-DK', 'الدقهلية', 'Dakahlia', 'Daqahlia'],
  ['EG-BA', 'البحر الأحمر', 'Red Sea'],
  ['EG-BH', 'البحيرة', 'Beheira', 'Behera'],
  ['EG-FYM', 'الفيوم', 'Fayoum', 'Faiyum', 'Fayum'],
  ['EG-GH', 'الغربية', 'Gharbia'],
  ['EG-IS', 'الإسماعيلية', 'Ismailia'],
  ['EG-MNF', 'المنوفية', 'Monufia', 'Menoufia'],
  ['EG-MN', 'المنيا', 'Minya', 'Menia'],
  ['EG-KB', 'القليوبية', 'Qalyubia', 'Qalyubiya'],
  ['EG-WAD', 'الوادي الجديد', 'New Valley'],
  ['EG-SUZ', 'السويس', 'Suez'],
  ['EG-SHR', 'الشرقية', 'Sharqia', 'Sharkia'],
  ['EG-ASN', 'أسوان', 'Aswan'],
  ['EG-AST', 'أسيوط', 'Asyut', 'Assiut'],
  ['EG-BNS', 'بني سويف', 'Beni Suef'],
  ['EG-PTS', 'بورسعيد', 'Port Said', 'بور سعيد'],
  ['EG-DT', 'دمياط', 'Damietta'],
  ['EG-JS', 'جنوب سيناء', 'South Sinai'],
  ['EG-KFS', 'كفر الشيخ', 'Kafr El Sheikh', 'Kafr El-Sheikh'],
  ['EG-MT', 'مطروح', 'Matrouh', 'Marsa Matrouh'],
  ['EG-LX', 'الأقصر', 'Luxor'],
  ['EG-KN', 'قنا', 'Qena'],
  ['EG-SIN', 'شمال سيناء', 'North Sinai'],
  ['EG-SHG', 'سوهاج', 'Sohag'],
] as const;

export type FulfillmentRegionCode = (typeof egyptianRegions)[number][0];

export interface BilingualFulfillmentText {
  ar: string;
  en: string;
}

export interface FulfillmentRegion {
  code: FulfillmentRegionCode;
  label: BilingualFulfillmentText;
}

export const fulfillmentRegions: FulfillmentRegion[] = egyptianRegions.map(([code, ar, en]) => ({
  code,
  label: { ar, en },
}));

function normalizedRegionLabel(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase().replace(/[أإآ]/g, 'ا');
}

const regionByLegacyLabel = new Map<string, FulfillmentRegionCode>(
  egyptianRegions.flatMap(([code, ar, en, ...aliases]) =>
    [code, ar, en, `${ar} (${en})`, ...aliases].map((label) => [normalizedRegionLabel(label), code]),
  ),
);

export function normalizeFulfillmentRegion(value: unknown): FulfillmentRegionCode | undefined {
  return typeof value === 'string' ? regionByLegacyLabel.get(normalizedRegionLabel(value)) : undefined;
}
