import { createHash } from 'node:crypto';
import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { APIError, type CollectionConfig } from 'payload';
import { hasRole, isStorefrontCustomer } from '../access/roles';
import { accountLocale, normalizeCustomerEmail } from '../logic/accountPaths';
import { customerPasswordResetEmail, customerSiteOrigin, secureAccountCookie } from '../services/customerMail';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    cookies: { secure: secureAccountCookie(), sameSite: 'Lax' },
    forgotPassword: {
      expiration: 30 * 60 * 1000,
      generateEmailHTML: ({ req, token } = {}) => {
        if (!req || !token) throw new APIError('Password reset could not be started.', 400);
        if (req.context.storefrontAccount) return customerPasswordResetEmail(req.context, token);
        const origin = customerSiteOrigin();
        if (!origin) throw new Error('Password recovery requires a configured public site origin.');
        const adminPath = `${req.payload.config.routes.admin}${req.payload.config.admin.routes.reset}`;
        const url = new URL(`${adminPath}/${encodeURIComponent(token)}`, origin);
        return `<p>You requested a password reset.</p><a href="${url.href}">Reset your password</a>`;
      },
      generateEmailSubject: ({ req } = {}) => req?.context.storefrontAccount && accountLocale(req.context.customerLocale) === 'ar'
        ? 'إعادة تعيين كلمة المرور لحسابك'
        : 'Reset your password',
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'roles'],
  },
  access: {
    // Only internal staff roles can access the admin panel
    admin: ({ req }) =>
      hasRole(req.user, [
        'super_admin',
        'marketer',
        'catalog_manager',
        'operations',
        'creative_director',
        'finance',
      ]),
    // Super Admin and Finance can read all users; customers read only their own profile
    read: ({ req }) => {
      if (!req.user) return false;
      if (hasRole(req.user, ['super_admin', 'finance'])) {
        return true;
      }
      return { id: { equals: req.user.id } };
    },
    // Anyone can register as a customer (e.g. public checkout / signup), or admin can create staff
    create: () => true,
    // Super Admin can update any user; users can only update their own profile
    update: ({ req }) => {
      if (!req.user) return false;
      if (hasRole(req.user, ['super_admin'])) {
        return true;
      }
      return { id: { equals: req.user.id } };
    },
    // Only super_admin can delete user records
    delete: ({ req }) => hasRole(req.user, ['super_admin']),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: false,
    },
    {
      name: 'companyName',
      type: 'text',
      required: false,
      admin: {
        description: 'Corporate or business legal entity name',
      },
    },
    {
      name: 'taxId',
      type: 'text',
      required: false,
      admin: {
        description: 'Egyptian Tax Registration Number (الرقم الضريبي)',
      },
    },
    {
      name: 'defaultAddress',
      type: 'relationship',
      relationTo: 'addresses',
      index: true,
      access: { create: () => false },
      admin: { position: 'sidebar' },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['customer'],
      options: [
        { label: 'Super Administrator', value: 'super_admin' },
        { label: 'Marketer / Content Editor', value: 'marketer' },
        { label: 'Catalog Manager', value: 'catalog_manager' },
        { label: 'Operations Specialist (Production)', value: 'operations' },
        { label: 'Creative Director (Service Intake)', value: 'creative_director' },
        { label: 'Finance Officer', value: 'finance' },
        { label: 'Customer', value: 'customer' },
      ],
      required: true,
      access: {
        // Field-level access: ONLY super_admin can set or update user roles
        create: ({ req }) =>
          Boolean(hasRole(req.user, ['super_admin']) || req.context?.isSystemSeed),
        update: ({ req }) => Boolean(hasRole(req.user, ['super_admin'])),
      },
    },
  ],
  hooks: {
    beforeLogin: [({ req, user }) => {
      if (req.context.storefrontAccount && !isStorefrontCustomer({ ...user, collection: 'users' })) {
        throw new APIError('Invalid sign-in details.', 401);
      }
    }],
    beforeOperation: [
      async ({ req, operation, args }) => {
        const isSuperAdmin =
          Boolean(hasRole(req.user, ['super_admin'])) ||
          Boolean(req.context?.isSystemSeed);

        if (operation === 'update' && !isSuperAdmin && args.data?.roles) {
          throw new Error('Privilege Escalation Forbidden: Only super administrators can modify user roles.');
        }

        if (operation === 'create' && !isSuperAdmin && args.data) {
          args.data.roles = ['customer'];
        }

        if (operation === 'resetPassword') {
          // The pinned Payload operation reads the token before updating by user ID.
          // Serialize the read and update for this token across native and storefront routes.
          const token = args.data.token;
          if (typeof token !== 'string' || !/^[a-f0-9]{40}$/.test(token)) {
            throw new APIError('Invalid or expired reset token.', 400, undefined, true);
          }
          const db = req.payload.db as unknown as PostgresAdapter;
          const transactionID = await req.transactionID;
          const tx = transactionID == null ? undefined : db.sessions?.[transactionID]?.db;
          if (!tx) throw new APIError('Password reset is temporarily unavailable.', 503);
          const key = createHash('sha256').update(token).digest('hex');
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 422917))`);
          if (req.context.storefrontAccount) {
            const target = await req.payload.db.findOne({ collection: 'users', req, where: {
              resetPasswordToken: { equals: token },
              resetPasswordExpiration: { greater_than: new Date().toISOString() },
            } });
            if (!target || !isStorefrontCustomer({ ...target, collection: 'users' })) {
              throw new APIError('Invalid or expired reset token.', 400, undefined, true);
            }
          }
        }
      },
    ],
    beforeChange: [
      async ({ req, operation, data, originalDoc }) => {
        const isSuperAdmin =
          Boolean(hasRole(req.user, ['super_admin'])) ||
          Boolean(req.context?.isSystemSeed);

        if (operation === 'create') {
          delete data.defaultAddress;
          if (!isSuperAdmin) {
            data.roles = ['customer'];
          }
        }

        if (operation === 'update') {
          if (!isSuperAdmin) {
            if (data.roles && originalDoc) {
              const rolesChanged =
                data.roles.length !== originalDoc.roles?.length ||
                !data.roles.every((r: string) => originalDoc.roles?.includes(r));

              if (rolesChanged) {
                throw new Error('Privilege Escalation Forbidden: Only super administrators can modify user roles.');
              }
            }
            if (originalDoc) {
              data.roles = originalDoc.roles;
            }
          }
        }

        if (typeof data.email === 'string') data.email = normalizeCustomerEmail(data.email);
        if (operation === 'update' && data.defaultAddress != null) {
          const { docs } = await req.payload.find({
            collection: 'addresses', depth: 0, limit: 1, req,
            where: { id: { equals: data.defaultAddress }, customer: { equals: originalDoc.id } },
          });
          if (docs.length === 0) throw new APIError('The selected address is unavailable.', 404, undefined, true);
        }
        return data;
      },
    ],
  },
};
