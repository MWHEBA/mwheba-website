import type { CollectionConfig } from 'payload';

/**
 * B2B-01: Product Catalog, Variant Matrix & Service Modeling.
 * Extends @payloadcms/plugin-ecommerce products collection per DECISIONS.md (D-002, D-003, D-009, D-010, D-017, D-018).
 */

export const productsCollectionOverride = ({
  defaultCollection,
}: {
  defaultCollection: CollectionConfig;
}): CollectionConfig => {
  return {
    ...defaultCollection,
    admin: {
      ...defaultCollection.admin,
      useAsTitle: 'title',
      defaultColumns: [
        'title',
        'slug',
        'productType',
        'minOrderQuantity',
        'customizationFee',
        '_status',
        'updatedAt',
      ],
    },
    hooks: {
      ...defaultCollection.hooks,
      beforeValidate: [
        ...(defaultCollection.hooks?.beforeValidate || []),
        ({ data }) => {
          if (!data) return data;

          // Normalize and synchronize productType and itemType
          if (data.productType === 'fixed_service' || data.itemType === 'service') {
            data.productType = 'fixed_service';
            data.itemType = 'service';
            data.minOrderQuantity = 1;
            data.allowArtworkUpload = false;
          } else {
            data.productType = 'physical';
            data.itemType = 'physical';
            if (data.minOrderQuantity === undefined || data.minOrderQuantity === null) {
              data.minOrderQuantity = 10;
            } else if (
              typeof data.minOrderQuantity !== 'number' ||
              !Number.isInteger(data.minOrderQuantity) ||
              data.minOrderQuantity < 10
            ) {
              throw new Error(
                'Minimum order quantity for physical merchandise must be an integer of at least 10.'
              );
            }
            if (data.allowArtworkUpload === undefined) {
              data.allowArtworkUpload = true;
            }
          }

          return data;
        },
      ],
    },
    fields: (() => {
      const explicitFields: any[] = [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'slug',
          type: 'text',
          required: true,
          unique: true,
          index: true,
        },
        {
          name: 'basePrice',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Base price in EGP for products without complex variant pricing.',
          },
        },
        {
          name: 'productType',
          type: 'select',
          defaultValue: 'physical',
          options: [
            { label: 'Physical Merchandise', value: 'physical' },
            { label: 'Fixed Digital Service Package', value: 'fixed_service' },
          ],
          required: true,
          index: true,
        },
        {
          name: 'itemType',
          type: 'select',
          defaultValue: 'physical',
          options: [
            { label: 'Physical Merchandise', value: 'physical' },
            { label: 'Digital Service Package', value: 'service' },
          ],
          admin: {
            description: 'Compatibility alias for cart & MOQ calculation engine.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
        },
        {
          name: 'category',
          type: 'relationship',
          relationTo: 'categories',
          index: true,
        },
        {
          name: 'minOrderQuantity',
          type: 'number',
          defaultValue: 10,
          validate: (val: any, { siblingData, data }: any) => {
            const currentData = siblingData || data;
            const isService =
              currentData?.productType === 'fixed_service' ||
              currentData?.itemType === 'service';

            if (isService) {
              if (val !== undefined && val !== null && val !== 1) {
                return 'Service packages must have a minimum order quantity of strictly 1.';
              }
              return true;
            }

            if (val === undefined || val === null) {
              return true;
            }

            if (typeof val !== 'number' || !Number.isInteger(val)) {
              return 'Minimum order quantity for physical merchandise must be an integer.';
            }

            if (val < 10) {
              return 'Minimum order quantity for physical merchandise must be at least 10.';
            }

            return true;
          },
          admin: {
            description:
              'Minimum order quantity enforced across all variants (D-009). Strictly 10 for physical, 1 for services.',
          },
        },
        {
          name: 'allowArtworkUpload',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Whether customers can upload corporate vector artwork for this product (D-010).',
          },
        },
        {
          name: 'customizationFee',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Separate printing / branding charge itemized independently (D-017).',
          },
        },
        // Service Package specific fields
        {
          name: 'serviceDeliverables',
          type: 'array',
          admin: {
            condition: (data: any) =>
              data?.productType === 'fixed_service' || data?.itemType === 'service',
            description:
              'Structured deliverables included in this fixed-price agency service package.',
          },
          fields: [
            {
              name: 'deliverable',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'estimatedTurnaroundDays',
          type: 'number',
          admin: {
            condition: (data: any) =>
              data?.productType === 'fixed_service' || data?.itemType === 'service',
            description: 'Estimated business days for project intake and fulfillment.',
          },
        },
        {
          name: 'briefQuestions',
          type: 'array',
          admin: {
            condition: (data: any) =>
              data?.productType === 'fixed_service' || data?.itemType === 'service',
            description: 'Intake brief questionnaire presented to corporate client upon ordering.',
          },
          fields: [
            {
              name: 'question',
              type: 'text',
              required: true,
            },
            {
              name: 'required',
              type: 'checkbox',
              defaultValue: true,
            },
          ],
        },
      ];

      const explicitNames = new Set(
        explicitFields
          .map((f) => ('name' in f ? f.name : undefined))
          .filter(Boolean)
      );

      // Preserve native plugin fields (enableVariants, variantTypes, variants, prices, etc.)
      // and guarantee zero duplicate field names
      const preservedPluginFields = (defaultCollection.fields || []).filter(
        (f) => 'name' in f && !explicitNames.has((f as any).name)
      );

      return [...explicitFields, ...preservedPluginFields];
    })(),
  };
};
