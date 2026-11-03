import type { CollectionConfig } from 'payload';
import { hasRole, isAdmin, isFinance } from '../access/roles';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
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
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['customer'],
      options: [
        { label: 'Super Administrator', value: 'super_admin' },
        { label: 'Marketer / Content Editor', value: 'marketer' },
        { label: 'Catalog Manager', value: 'catalog_manager' },
        { label: 'Operations Specialist', value: 'operations' },
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
    beforeOperation: [
      ({ req, operation, args }: any) => {
        const isSuperAdmin =
          Boolean(hasRole(req.user, ['super_admin'])) ||
          Boolean(req.context?.isSystemSeed);

        if (operation === 'update' && !isSuperAdmin && args?.data?.roles) {
          throw new Error('Privilege Escalation Forbidden: Only super administrators can modify user roles.');
        }

        if (operation === 'create' && !isSuperAdmin && args?.data) {
          args.data.roles = ['customer'];
        }
      },
    ],
    beforeChange: [
      ({ req, operation, data, originalDoc }) => {
        const isSuperAdmin =
          Boolean(hasRole(req.user, ['super_admin'])) ||
          Boolean(req.context?.isSystemSeed);

        if (operation === 'create') {
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
        return data;
      },
    ],
  },
};
