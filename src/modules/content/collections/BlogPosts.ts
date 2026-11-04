import type { CollectionConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';
import { generatePreviewToken } from '../lib/previewTokens';

export const BlogPosts: CollectionConfig = {
  slug: 'blog-posts',
  labels: {
    singular: 'Blog Post',
    plural: 'Blog Posts',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'author', 'category', '_status', 'updatedAt'],
    preview: (doc, { locale }) => {
      const slug = (doc?.slug as string) || '';
      const token = generatePreviewToken({ slug: `blog/${slug}`, locale });
      return `/api/preview?token=${token}&slug=${encodeURIComponent(`blog/${slug}`)}&locale=${encodeURIComponent(locale)}`;
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
      label: 'Article Title',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'URL Identifier (e.g. "b2b-corporate-branding-trends-2026")',
    },
    {
      name: 'author',
      type: 'text',
      required: true,
      defaultValue: 'فريق موهبة التحريري',
      label: 'Author Name',
    },
    {
      name: 'publishedAt',
      type: 'text',
      label: 'Publication Date Display (e.g. "نوفمبر 2026", "Nov 2026")',
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'branding',
      options: [
        { label: 'الهوية البصرية والعلامة التجارية (Branding & Identity)', value: 'branding' },
        { label: 'التسويق الرقمي واستراتيجيات النمو (Digital Marketing)', value: 'marketing' },
        { label: 'الهدايا المؤسسية والطباعة (Corporate Gifts & Print)', value: 'merchandise' },
        { label: 'الإنتاج الإعلامي والمرئي (Media & Creative Production)', value: 'media' },
      ],
      label: 'Topic Category',
    },
    {
      name: 'readingTimeMinutes',
      type: 'number',
      min: 1,
      defaultValue: 4,
      label: 'Estimated Reading Time in Minutes',
    },
    {
      name: 'excerpt',
      type: 'textarea',
      required: true,
      localized: true,
      label: 'Executive Summary / Excerpt',
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
      label: 'Cover Image Alt Text (SEO & Accessibility)',
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      localized: true,
      label: 'Full Article Content Body',
    },
    {
      name: 'tags',
      type: 'array',
      localized: true,
      label: 'Topic Tags & Keywords',
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
          label: 'Tag Name',
        },
      ],
    },
    {
      name: 'sourceOrigin',
      type: 'select',
      defaultValue: 'editorial_review_draft',
      options: [
        { label: 'مسودة تحريرية مقترحة للمراجعة (Editorial Proposal Draft)', value: 'editorial_review_draft' },
        { label: 'محتوى مُرحّل موثق من الموقع السابق (Legacy Migrated Content)', value: 'legacy_migrated' },
      ],
      admin: {
        description: 'مصدر المادة التحريرية وسند توثيقها.',
      },
    },
    {
      name: 'sourceReference',
      type: 'text',
      admin: {
        description: 'رقم وثيقة التدقيق أو مستند المصدر المعتمد.',
      },
    },
    {
      name: 'approvalStatus',
      type: 'select',
      defaultValue: 'pending_editorial_review',
      options: [
        { label: 'قيد مراجعة المالك وهيئة التحرير (Pending Editorial Review)', value: 'pending_editorial_review' },
        { label: 'معتمد للنشر (Approved for Publishing)', value: 'approved_for_publishing' },
      ],
      admin: {
        description: 'حالة الاعتماد التحريري قبل النشر النهائي.',
      },
    },
    {
      name: 'meta',
      type: 'group',
      label: 'SEO Overrides',
      fields: [
        {
          name: 'title',
          type: 'text',
          localized: true,
          label: 'Meta Title',
        },
        {
          name: 'description',
          type: 'textarea',
          localized: true,
          label: 'Meta Description',
        },
      ],
    },
  ],
};
