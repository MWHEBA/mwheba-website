import type { Access } from 'payload';

export type UserRole =
  | 'super_admin'
  | 'marketer'
  | 'catalog_manager'
  | 'operations'
  | 'creative_director'
  | 'finance'
  | 'customer';

export const hasRole = (user: any, roles: UserRole[]): boolean => {
  if (!user || !Array.isArray(user.roles)) return false;
  return roles.some((role) => user.roles.includes(role));
};

export const isAdmin: Access = ({ req: { user } }) => {
  return hasRole(user, ['super_admin']);
};

export const isFinance: Access = ({ req: { user } }) => {
  return hasRole(user, ['super_admin', 'finance']);
};

export const isOperations: Access = ({ req: { user } }) => {
  return hasRole(user, ['super_admin', 'operations']);
};

export const isCatalogManager: Access = ({ req: { user } }) => {
  return hasRole(user, ['super_admin', 'catalog_manager']);
};

export const isMarketer: Access = ({ req: { user } }) => {
  return hasRole(user, ['super_admin', 'marketer']);
};

export const isSelfOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false;
  if (hasRole(user, ['super_admin'])) return true;
  return {
    id: {
      equals: user.id,
    },
  };
};
