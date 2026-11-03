import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['name', 'email', 'roles'],
  },
  access: {
    admin: ({ req }) => Boolean(req.user?.roles?.includes('admin')),
    // Admin and finance can view all users; ordinary customers can only view their own profile
    read: ({ req }) => {
      if (!req.user) return false;
      if (req.user.roles?.includes('admin') || req.user.roles?.includes('finance')) {
        return true;
      }
      return { id: { equals: req.user.id } };
    },
    // Anyone can register as a customer (e.g. public checkout / signup), or admin can create users
    create: () => true,
    // Admin can update any user; users can only update their own profile
    update: ({ req }) => {
      if (!req.user) return false;
      if (req.user.roles?.includes('admin')) {
        return true;
      }
      return { id: { equals: req.user.id } };
    },
    // Only admin can delete user records
    delete: ({ req }) => Boolean(req.user?.roles?.includes('admin')),
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: false,
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      defaultValue: ['customer'],
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Finance Officer', value: 'finance' },
        { label: 'Operations Specialist', value: 'operations' },
        { label: 'Customer', value: 'customer' },
      ],
      required: true,
      access: {
        // Field-level access: ONLY administrators can set or update user roles
        create: ({ req }) => Boolean(req.user?.roles?.includes('admin') || req.context?.isSystemSeed),
        update: ({ req }) => Boolean(req.user?.roles?.includes('admin')),
      },
    },
  ],
  hooks: {
    beforeOperation: [
      ({ req, operation, args }: any) => {
        const isAdmin =
          Boolean(req.user?.roles?.includes('admin')) ||
          Boolean(req.context?.isSystemSeed);

        if (operation === 'update' && !isAdmin && args?.data?.roles) {
          throw new Error('Privilege Escalation Forbidden: Only administrators can modify user roles.');
        }

        if (operation === 'create' && !isAdmin && args?.data) {
          args.data.roles = ['customer'];
        }
      },
    ],
    beforeChange: [
      ({ req, operation, data, originalDoc }) => {
        const isAdmin =
          Boolean(req.user?.roles?.includes('admin')) ||
          Boolean(req.context?.isSystemSeed);

        if (operation === 'create') {
          // Public signup / non-admin creation MUST be strictly locked to ['customer']
          if (!isAdmin) {
            data.roles = ['customer'];
          }
        }

        if (operation === 'update') {
          // Non-admin users cannot alter roles under any circumstances
          if (!isAdmin) {
            if (data.roles && originalDoc) {
              const rolesChanged =
                data.roles.length !== originalDoc.roles?.length ||
                !data.roles.every((r: string) => originalDoc.roles?.includes(r));

              if (rolesChanged) {
                throw new Error('Privilege Escalation Forbidden: Only administrators can modify user roles.');
              }
            }
            // Always lock roles to originalDoc.roles if updated by non-admin
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
