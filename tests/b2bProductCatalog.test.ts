import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { Categories } from '../src/modules/catalog/collections/Categories';

describe('B2B-01: Product Catalog, Variant Matrix & Service Modeling', () => {
  let payload: any;
  const createdProductIds: (string | number)[] = [];
  const createdCategoryIds: (string | number)[] = [];
  const createdVariantIds: (string | number)[] = [];

  const createdVariantTypeIds: (string | number)[] = [];
  const createdVariantOptionIds: (string | number)[] = [];

  beforeAll(async () => {
    payload = await getPayload({ config });
  }, 30000);

  afterAll(async () => {
    for (const id of createdVariantIds) {
      try {
        await payload.delete({ collection: 'variants', id });
      } catch {
        // Ignore deletion errors in teardown
      }
    }
    for (const id of createdProductIds) {
      try {
        await payload.delete({ collection: 'products', id });
      } catch {
        // Ignore deletion errors in teardown
      }
    }
    for (const id of createdVariantOptionIds) {
      try {
        await payload.delete({ collection: 'variantOptions', id });
      } catch {
        // Ignore deletion errors in teardown
      }
    }
    for (const id of createdVariantTypeIds) {
      try {
        await payload.delete({ collection: 'variantTypes', id });
      } catch {
        // Ignore deletion errors in teardown
      }
    }
    for (const id of createdCategoryIds) {
      try {
        await payload.delete({ collection: 'categories', id });
      } catch {
        // Ignore deletion errors in teardown
      }
    }
  });

  describe('Schema Definition & Field Structure', () => {
    it('verifies Categories collection schema and admin configuration', () => {
      expect(Categories.slug).toBe('categories');
      const fields = Categories.fields.map((f: any) => f.name);
      expect(fields).toContain('title');
      expect(fields).toContain('slug');
      expect(fields).toContain('description');
    });

    it('verifies Products collection has extended B2B fields and variant configuration', () => {
      const productCollection = payload.config.collections.find(
        (c: any) => c.slug === 'products'
      );
      expect(productCollection).toBeDefined();

      // Verify every field name is strictly unique (no duplicate field names)
      const fieldNames = productCollection.fields.map((f: any) => f.name).filter(Boolean);
      const uniqueFieldNames = new Set(fieldNames);
      expect(uniqueFieldNames.size).toBe(fieldNames.length);

      // Verify native plugin fields are preserved
      expect(fieldNames).toContain('enableVariants');
      expect(fieldNames).toContain('variantTypes');
      expect(fieldNames).toContain('variants');

      // Verify custom B2B fields are present
      expect(fieldNames).toContain('title');
      expect(fieldNames).toContain('slug');
      expect(fieldNames).toContain('description');
      expect(fieldNames).toContain('basePrice');
      expect(fieldNames).toContain('productType');
      expect(fieldNames).toContain('itemType');
      expect(fieldNames).toContain('category');
      expect(fieldNames).toContain('minOrderQuantity');
      expect(fieldNames).toContain('allowArtworkUpload');
      expect(fieldNames).toContain('customizationFee');
      expect(fieldNames).toContain('serviceDeliverables');
      expect(fieldNames).toContain('estimatedTurnaroundDays');
      expect(fieldNames).toContain('briefQuestions');
    });
  });

  describe('Physical Merchandise with Variants & Separate Printing Fee (D-002, D-009, D-010, D-017)', () => {
    it('creates a physical promotional merchandise product with 10 MOQ and separate customization fee', async () => {
      // 1. Create a category
      const category = await payload.create({
        collection: 'categories',
        data: {
          title: 'هدايا الشركات والمواد الترويجية',
          slug: 'corporate-giveaways-test',
          description: 'تصنيف الهدايا الترويجية والأكواب والمستلزمات المكتبية المخصصة.',
        },
      });
      createdCategoryIds.push(category.id);

      // 2. Create Variant Type (e.g. Color) and Variant Options (Black, Blue)
      const colorType = await payload.create({
        collection: 'variantTypes',
        data: {
          name: 'color',
          label: 'اللون (Color)',
        },
      });
      createdVariantTypeIds.push(colorType.id);

      const blackOption = await payload.create({
        collection: 'variantOptions',
        data: {
          variantType: colorType.id,
          label: 'أسود مطفي كلاسيكي',
          value: 'black',
        },
      });
      createdVariantOptionIds.push(blackOption.id);

      const blueOption = await payload.create({
        collection: 'variantOptions',
        data: {
          variantType: colorType.id,
          label: 'أزرق بترولي مؤسسي',
          value: 'petrol_blue',
        },
      });
      createdVariantOptionIds.push(blueOption.id);

      // 3. Create physical product with MOQ 10, customization fee 35 EGP, enableVariants: true, and variantTypes linked
      const product = await payload.create({
        collection: 'products',
        data: {
          title: 'كوب حراري ذكي مخصص (Executive Thermal Flask)',
          slug: 'exec-thermal-flask-b2b',
          description: 'كوب حراري عالي الجودة من الفولاذ 316 مع عزل حراري 12 ساعة وحفر ليزر مخصص للشعار.',
          basePrice: 250,
          enableVariants: true,
          variantTypes: [colorType.id],
          productType: 'physical',
          minOrderQuantity: 10,
          allowArtworkUpload: true,
          customizationFee: 35,
          category: category.id,
          _status: 'published',
        },
      });
      createdProductIds.push(product.id);

      // 4. Create variants linked to the product and options in native variants collection
      const v1 = await payload.create({
        collection: 'variants',
        data: {
          title: 'أسود مطفي كلاسيكي (Matte Black)',
          product: product.id,
          options: [blackOption.id],
          priceInEGP: 250,
          _status: 'published',
        },
      });
      createdVariantIds.push(v1.id);

      const v2 = await payload.create({
        collection: 'variants',
        data: {
          title: 'أزرق بترولي مؤسسي (Corporate Petrol Blue)',
          product: product.id,
          options: [blueOption.id],
          priceInEGP: 250,
          _status: 'published',
        },
      });
      createdVariantIds.push(v2.id);

      // 5. Query variants for this product
      const productVariants = await payload.find({
        collection: 'variants',
        where: {
          product: { equals: product.id },
        },
      });

      expect(product.id).toBeDefined();
      expect(product.title).toBe('كوب حراري ذكي مخصص (Executive Thermal Flask)');
      expect(product.slug).toBe('exec-thermal-flask-b2b');
      expect(product.productType).toBe('physical');
      expect(product.itemType).toBe('physical'); // Normalized by hook
      expect(product.minOrderQuantity).toBe(10); // Strictly 10 per D-009
      expect(product.allowArtworkUpload).toBe(true); // Custom vector upload permitted (D-010)
      expect(product.customizationFee).toBe(35); // Separate customization charge (D-017)
      expect(productVariants.docs.length).toBe(2);
      const variantTitles = productVariants.docs.map((v: any) => v.title);
      expect(variantTitles.some((t: string) => t.includes('أسود مطفي'))).toBe(true);
      expect(variantTitles.some((t: string) => t.includes('أزرق بترولي'))).toBe(true);
    });
  });

  describe('Fixed-Price Digital Service Package Modeling (D-003)', () => {
    it('creates an agency service package with deliverables, turnaround days, and intake questions', async () => {
      // 1. Create a service category
      const serviceCategory = await payload.create({
        collection: 'categories',
        data: {
          title: 'خدمات الهوية والتصميم المؤسسي',
          slug: 'branding-services-test',
          description: 'باقات الهوية التجارية والأدلة الإرشادية لشركات ومؤسسات B2B.',
        },
      });
      createdCategoryIds.push(serviceCategory.id);

      // 2. Create service package with deliverables and onboarding brief questions
      const serviceProduct = await payload.create({
        collection: 'products',
        data: {
          title: 'باقة الهوية التجارية الشاملة للمؤسسات',
          slug: 'corporate-identity-package-b2b',
          description: 'تصميم هوية بصرية كاملة تشمل الشعار الموجه، الخطوط، الألوان، وقوالب المطبوعات الرسمية.',
          basePrice: 15000,
          productType: 'fixed_service',
          category: serviceCategory.id,
          serviceDeliverables: [
            { deliverable: 'ملفات الشعار الموجه بالكامل بصيغ Vector (.AI, .EPS, .SVG, .PNG)' },
            { deliverable: 'دليل الهوية البصرية المؤسسية الشامل (Brand Guidelines PDF)' },
            { deliverable: 'تصميم قوالب القرطاسية والمراسلات الرسمية (Stationery Kit)' },
            { deliverable: 'نماذج وتطبيقات الهوية على الهدايا والزي الموحد' },
          ],
          estimatedTurnaroundDays: 14,
          briefQuestions: [
            { question: 'ما هو الاسم القانوني والتجاري المعتمد للشركة؟', required: true },
            { question: 'ما هي الصناعة والقطاع المستهدف الرئيسي لعملياتكم؟', required: true },
            { question: 'هل توجد تفضيلات لونية أو رموز محددة ترغبون بتضمينها أو تجنبها؟', required: false },
          ],
          _status: 'published',
        },
      });
      createdProductIds.push(serviceProduct.id);

      expect(serviceProduct.id).toBeDefined();
      expect(serviceProduct.title).toBe('باقة الهوية التجارية الشاملة للمؤسسات');
      expect(serviceProduct.productType).toBe('fixed_service');
      expect(serviceProduct.itemType).toBe('service'); // Auto-normalized by hook
      expect(serviceProduct.minOrderQuantity).toBe(1); // Services require quantity of 1 (not 10)
      expect(serviceProduct.allowArtworkUpload).toBe(false); // Services do not use merchandise artwork upload
      expect(serviceProduct.serviceDeliverables?.length).toBe(4);
      expect(serviceProduct.estimatedTurnaroundDays).toBe(14);
      expect(serviceProduct.briefQuestions?.length).toBe(3);
      expect(serviceProduct.briefQuestions[0].question).toContain('الاسم القانوني');
      expect(serviceProduct.briefQuestions[0].required).toBe(true);
      expect(serviceProduct.briefQuestions[2].required).toBe(false);
    });
  });

  describe('Server-Side Minimum Order Quantity (MOQ) Enforcement (D-009)', () => {
    it('rejects physical merchandise creation when minOrderQuantity is less than 10', async () => {
      await expect(
        payload.create({
          collection: 'products',
          data: {
            title: 'منتج غير صالح بكمية قليلة',
            slug: 'invalid-moq-product-less-than-10',
            productType: 'physical',
            minOrderQuantity: 5,
            basePrice: 100,
          },
        })
      ).rejects.toThrow(/at least 10/i);
    });

    it('rejects physical merchandise creation when minOrderQuantity is fractional / non-integer', async () => {
      await expect(
        payload.create({
          collection: 'products',
          data: {
            title: 'منتج غير صالح بكمية كسرية',
            slug: 'invalid-moq-product-fractional',
            productType: 'physical',
            minOrderQuantity: 12.5,
            basePrice: 100,
          },
        })
      ).rejects.toThrow(/integer/i);
    });

    it('enforces minOrderQuantity strictly to 1 for service packages even if different value is passed', async () => {
      const service = await payload.create({
        collection: 'products',
        data: {
          title: 'خدمة استشارية تجريبية',
          slug: 'service-moq-test',
          productType: 'fixed_service',
          minOrderQuantity: 10, // Attempted to pass 10, must be normalized to 1
          basePrice: 5000,
        },
      });
      createdProductIds.push(service.id);
      expect(service.minOrderQuantity).toBe(1);
      expect(service.productType).toBe('fixed_service');
      expect(service.itemType).toBe('service');
    });
  });

  describe('Product Query & Variant Resolution API', () => {
    it('queries published products and filters correctly by productType', async () => {
      const physicalProducts = await payload.find({
        collection: 'products',
        where: {
          productType: { equals: 'physical' },
          _status: { equals: 'published' },
        },
      });

      expect(physicalProducts.docs.length).toBeGreaterThanOrEqual(1);
      const foundPhysical = physicalProducts.docs.find(
        (p: any) => p.slug === 'exec-thermal-flask-b2b'
      );
      expect(foundPhysical).toBeDefined();
      expect(foundPhysical.customizationFee).toBe(35);

      const serviceProducts = await payload.find({
        collection: 'products',
        where: {
          productType: { equals: 'fixed_service' },
          _status: { equals: 'published' },
        },
      });

      expect(serviceProducts.docs.length).toBeGreaterThanOrEqual(1);
      const foundService = serviceProducts.docs.find(
        (p: any) => p.slug === 'corporate-identity-package-b2b'
      );
      expect(foundService).toBeDefined();
      expect(foundService.minOrderQuantity).toBe(1);
      expect(foundService.serviceDeliverables.length).toBe(4);
    });
  });
});
