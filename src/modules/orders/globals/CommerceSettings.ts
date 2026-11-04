import type { GlobalConfig } from 'payload';
import { hasRole } from '../../identity/access/roles';

export interface TariffSchedule {
  tariffStatus: 'provisional' | 'owner_approved';
  cairoAndGizaFee: number;
  alexandriaFee: number;
  otherGovernoratesFee: number;
  officePickupFee: number;
  standardFallbackFee: number;
}

export type ProductionPolicy = 'require_payment_clearance' | 'allow_immediate_production';

export interface CommerceSettingsData {
  tariffStatus: 'provisional' | 'owner_approved';
  cairoAndGizaFee: number;
  alexandriaFee: number;
  otherGovernoratesFee: number;
  officePickupFee: number;
  standardFallbackFee: number;
  productionPolicy: ProductionPolicy;
  emailDispatchMode: 'deferred_review' | 'live_smtp';
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  fromEmail?: string | null;
  changeLog?: Array<{
    changedBy: string;
    changedAt: string;
    changesSummary: string;
  }>;
}

export const CommerceSettings: GlobalConfig = {
  slug: 'commerce-settings',
  label: 'Commerce & Operations Settings',
  access: {
    // Only super_admin, finance, and operations can inspect settings; only super_admin can modify them
    read: ({ req }) => hasRole(req.user, ['super_admin', 'finance', 'operations']),
    update: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  admin: {
    group: 'Settings',
    description:
      'Runtime operational controls for delivery tariffs (D-015), pre-production payment policy, and notification dispatch.',
  },
  fields: [
    {
      type: 'collapsible',
      label: 'Delivery Tariff Schedule (D-015)',
      fields: [
        {
          name: 'tariffStatus',
          type: 'select',
          defaultValue: 'provisional',
          required: true,
          options: [
            { label: 'Provisional (Testing Fixture - Pending Owner Approval)', value: 'provisional' },
            { label: 'Owner Approved (Final Tariff Schedule)', value: 'owner_approved' },
          ],
          admin: {
            description: 'Status of the delivery tariff schedule per DECISIONS.md D-015.',
          },
        },
        {
          name: 'cairoAndGizaFee',
          type: 'number',
          defaultValue: 80,
          required: true,
          label: 'Cairo & Giza Delivery Fee (EGP)',
        },
        {
          name: 'alexandriaFee',
          type: 'number',
          defaultValue: 90,
          required: true,
          label: 'Alexandria Delivery Fee (EGP)',
        },
        {
          name: 'otherGovernoratesFee',
          type: 'number',
          defaultValue: 120,
          required: true,
          label: 'Delta & Canal Governorates Delivery Fee (EGP)',
        },
        {
          name: 'officePickupFee',
          type: 'number',
          defaultValue: 0,
          required: true,
          label: 'Agency Office Pickup Fee (EGP) (0 = Free)',
        },
        {
          name: 'standardFallbackFee',
          type: 'number',
          defaultValue: 150,
          required: true,
          label: 'Standard Fallback / Upper Egypt Delivery Fee (EGP)',
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Production & Bank Transfer Policy',
      fields: [
        {
          name: 'productionPolicy',
          type: 'select',
          defaultValue: 'allow_immediate_production',
          required: true,
          options: [
            {
              label: 'Permissive (Review/Dev Mode): Allow Immediate Physical Production Before Bank Clearance',
              value: 'allow_immediate_production',
            },
            {
              label: 'Strict (Production Mode): Require Bank Transfer Payment Clearance Before Production',
              value: 'require_payment_clearance',
            },
          ],
          admin: {
            description:
              'Determines whether factory physical production jobs can advance to in_printing before finance verifies the corporate bank transfer.',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Notifications & Email Dispatch',
      fields: [
        {
          name: 'emailDispatchMode',
          type: 'select',
          defaultValue: 'deferred_review',
          required: true,
          options: [
            {
              label: 'Deferred Review (Record as pending outbox; do not dispatch live SMTP)',
              value: 'deferred_review',
            },
            { label: 'Live SMTP (Dispatch real outbound notification emails)', value: 'live_smtp' },
          ],
        },
        { name: 'smtpHost', type: 'text', label: 'SMTP Server Host' },
        { name: 'smtpPort', type: 'number', label: 'SMTP Server Port' },
        { name: 'smtpUser', type: 'text', label: 'SMTP Username' },
        { name: 'fromEmail', type: 'text', label: 'From Address' },
      ],
    },
    {
      name: 'changeLog',
      type: 'json',
      defaultValue: [],
      admin: {
        readOnly: true,
        description: 'Server-recorded append-only audit trail of operational setting adjustments.',
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, req }) => {
        if (!originalDoc) return data;
        const changes: string[] = [];
        const trackFields = [
          'tariffStatus',
          'cairoAndGizaFee',
          'alexandriaFee',
          'otherGovernoratesFee',
          'officePickupFee',
          'standardFallbackFee',
          'productionPolicy',
          'emailDispatchMode',
        ] as const;

        for (const f of trackFields) {
          if (data[f] !== undefined && data[f] !== originalDoc[f]) {
            changes.push(`${f}: ${originalDoc[f]} -> ${data[f]}`);
          }
        }

        if (changes.length > 0) {
          const userStr = req?.user ? `user:#${req.user.id}` : 'system';
          const newEntry = {
            changedBy: userStr,
            changedAt: new Date().toISOString(),
            changesSummary: changes.join(', '),
          };
          data.changeLog = [
            ...(Array.isArray(originalDoc.changeLog) ? originalDoc.changeLog : []),
            newEntry,
          ];
        }
        return data;
      },
    ],
  },
};
