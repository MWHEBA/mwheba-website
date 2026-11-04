import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';
import { generatePreviewToken } from '../lib/previewTokens';

export const PortfolioProjects: CollectionConfig = {
  slug: 'portfolio-projects',
  labels: {
    singular: 'Portfolio Project',
    plural: 'Portfolio Projects',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'clientName', 'serviceCategory', '_status', 'updatedAt'],
    preview: (doc, { locale }) => {
      const slug = (doc?.slug as string) || '';
      const token = generatePreviewToken({ slug: `portfolio/${slug}`, locale });
      return `/api/preview?token=${token}&slug=${encodeURIComponent(`portfolio/${slug}`)}&locale=${encodeURIComponent(locale)}`;
    },
  },
  versions: {
    drafts: true,
  },
  access: {
    read: ({ req }) => {
      if (hasRole(req.user, ['super_admin', 'marketer'])) {
        return true;
      }
      return {
        _status: {
          equals: 'published',
        },
      };
    },
    create: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    update: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
      label: 'Project Title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'URL Identifier (e.g. "techcorp-brand-transformation")',
    },
    {
      name: 'clientName',
      type: 'text',
      required: true,
      localized: true,
      label: 'Client Name / Enterprise',
    },
    {
      name: 'industry',
      type: 'text',
      localized: true,
      label: 'Industry / Sector (e.g. Fintech, Healthcare, Luxury)',
    },
    {
      name: 'serviceCategory',
      type: 'select',
      required: true,
      defaultValue: 'branding',
      options: [
        { label: 'الهوية البصرية والعلامة التجارية (Branding & Identity)', value: 'branding' },
        { label: 'التسويق الرقمي والنمو (Digital Marketing)', value: 'digital_marketing' },
        { label: 'الهدايا المؤسسية والمطبوعات (Corporate Gifts)', value: 'corporate_gifts' },
        { label: 'الإنتاج المرئي والإعلامي (Media & Video)', value: 'media_production' },
      ],
      label: 'Primary Service Category',
    },
    {
      name: 'projectDate',
      type: 'text',
      label: 'Execution Timeline / Year (e.g. "2026", "Q1 2026")',
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      label: 'Highlight in Featured Showcase',
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
      localized: true,
      label: 'Executive Summary / Business Challenge',
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      label: 'Cover Image Asset',
    },
    {
      name: 'coverImageUrl',
      type: 'text',
      label: 'Cover Image URL (Direct / Fallback)',
    },
    {
      name: 'coverImageAlt',
      type: 'text',
      required: true,
      localized: true,
      label: 'Cover Image Alt Text (Required for Accessibility & SEO)',
    },
    {
      name: 'deliverables',
      type: 'array',
      localized: true,
      label: 'Key Deliverables',
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
          label: 'Deliverable Name',
        },
      ],
    },
    {
      name: 'results',
      type: 'array',
      localized: true,
      label: 'Business Outcomes & ROI Metrics',
      fields: [
        {
          name: 'metric',
          type: 'text',
          required: true,
          label: 'Metric Value (e.g. "+240%", "3.5x", "120K+")',
        },
        {
          name: 'label',
          type: 'text',
          required: true,
          label: 'Metric Description (e.g. "زيادة الوعي بالعلامة")',
        },
      ],
    },
    {
      name: 'narrative',
      type: 'textarea',
      localized: true,
      label: 'Case Study Narrative Story & Strategic Execution',
    },
    {
      name: 'sourceOrigin',
      type: 'select',
      defaultValue: 'case_study_draft_pending_owner_data',
      options: [
        { label: 'شعار عميل موثق + مسودة دراسة حالة قيد اعتماد المالك (Draft Pending Owner Data)', value: 'case_study_draft_pending_owner_data' },
        { label: 'دراسة حالة حقيقية معتمدة بأرقام موثقة (Verified & Documented Case Study)', value: 'verified_case_study' },
      ],
      admin: {
        description: 'مصدر دراسة الحالة والتحقق من واقعية الأرقام والمخرجات.',
      },
    },
    {
      name: 'sourceReference',
      type: 'text',
      admin: {
        description: 'مرجع التدقيق (مثال: docs/audit/03-content-and-media-audit.md: Section 3.C).',
      },
    },
    {
      name: 'approvalStatus',
      type: 'select',
      defaultValue: 'pending_case_study_data',
      options: [
        { label: 'معلق بانتظار أرقام وموافقة المالك (Pending Stakeholder Data)', value: 'pending_case_study_data' },
        { label: 'معتمد للنشر (Approved for Publishing)', value: 'approved_for_publishing' },
      ],
      admin: {
        description: 'حالة الاعتماد قبل النشر.',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      localized: true,
      label: 'Project Visual Gallery',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          label: 'Visual Asset',
        },
        {
          name: 'imageUrl',
          type: 'text',
          label: 'Image URL (Direct / Fallback)',
        },
        {
          name: 'alt',
          type: 'text',
          required: true,
          label: 'Image Alt Text (SEO & Accessibility)',
        },
        {
          name: 'caption',
          type: 'text',
          label: 'Caption / Context',
        },
      ],
    },
  ],
};
