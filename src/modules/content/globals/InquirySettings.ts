import type { GlobalConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export const InquirySettings: GlobalConfig = {
  slug: 'inquiry-settings',
  label: 'Lead Capture & Notification Settings',
  access: {
    read: ({ req }) => hasRole(req.user, ['super_admin', 'marketer']),
    update: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'recipientEmail',
      type: 'text',
      defaultValue: 'sales@mwheba.com',
      required: true,
      label: 'Sales Team Notification Recipient Email',
    },
    {
      name: 'emailSubjectTemplate',
      type: 'text',
      defaultValue: '[MWHEBA Lead] استفسار مشروع جديد من {{fullName}} ({{companyName}})',
      required: true,
      label: 'Notification Email Subject Template',
    },
    {
      name: 'emailBodyTemplate',
      type: 'textarea',
      defaultValue: 'تم استلام استفسار مشروع جديد من العميل:\nالاسم: {{fullName}}\nالشركة: {{companyName}}\nالبريد: {{email}}\nالهاتف: {{phone}}\nالخدمة: {{serviceInterest}}\nالميزانية: {{estimatedBudget}}\nالتفاصيل:\n{{projectDetails}}',
      required: true,
      label: 'Notification Email Body Template',
    },
    {
      name: 'enableRealDispatch',
      type: 'checkbox',
      defaultValue: false,
      label: 'Enable Live Real Email Dispatch',
    },
  ],
};
