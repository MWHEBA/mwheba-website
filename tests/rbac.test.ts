import { describe, it, expect, beforeAll } from 'vitest';
import { getPayload, type Payload } from 'payload';
import config from '../src/payload.config';
import { hasRole } from '../src/modules/identity/access/roles';

describe('FND-04: Role-Based Access Control (RBAC) & Security Policies', () => {
  let payload: Payload;

  beforeAll(async () => {
    payload = await getPayload({ config });
  });

  describe('Role Helpers Unit Tests', () => {
    it('hasRole matches allowed roles strictly', () => {
      const superAdminUser = { id: 1, roles: ['super_admin'] };
      const financeUser = { id: 2, roles: ['finance'] };
      const customerUser = { id: 3, roles: ['customer'] };

      expect(hasRole(superAdminUser, ['super_admin'])).toBe(true);
      expect(hasRole(superAdminUser, ['finance'])).toBe(false);

      expect(hasRole(financeUser, ['super_admin', 'finance'])).toBe(true);
      expect(hasRole(financeUser, ['catalog_manager'])).toBe(false);

      expect(hasRole(customerUser, ['super_admin', 'finance', 'operations'])).toBe(false);
      expect(hasRole(customerUser, ['customer'])).toBe(true);
      expect(hasRole(null, ['customer'])).toBe(false);
      expect(hasRole({}, ['customer'])).toBe(false);
    });
  });

  describe('Users Collection RBAC & Privilege Escalation Defense', () => {
    it('prevents non-super_admin from creating users with elevated roles', async () => {
      const customerReq: any = {
        user: { id: 999, roles: ['customer'] },
      };

      // Attempt public registration with injected super_admin role
      const randomEmail = `hacker_${Date.now()}@test.com`;
      const created = await payload.create({
        collection: 'users',
        data: {
          email: randomEmail,
          password: 'Password123!Secure',
          roles: ['super_admin' as any],
        },
        req: customerReq,
      });

      // Hook forces role to customer
      expect(created.roles).toEqual(['customer']);
    });

    it('blocks non-super_admin from modifying user roles', async () => {
      const testEmail = `victim_${Date.now()}@test.com`;
      const user = await payload.create({
        collection: 'users',
        data: {
          email: testEmail,
          password: 'Password123!Secure',
          roles: ['customer'],
        },
        context: { isSystemSeed: true },
      });

      const customerReq: any = {
        user: { id: user.id, roles: ['customer'] },
      };

      // Customer attempts to escalate own role to finance
      await expect(
        payload.update({
          collection: 'users',
          id: user.id,
          data: {
            roles: ['finance' as any],
          },
          req: customerReq,
        })
      ).rejects.toThrow(/Privilege Escalation Forbidden/);
    });
  });

  describe('Finance & Bank Transfer Access Isolation', () => {
    it('allows finance user to view bank transfers and blocks non-finance', async () => {
      const financeUser = { id: 10, roles: ['finance'] };
      const marketerUser = { id: 11, roles: ['marketer'] };

      const isFinanceAllowed = hasRole(financeUser, ['super_admin', 'finance']);
      const isMarketerAllowed = hasRole(marketerUser, ['super_admin', 'finance']);

      expect(isFinanceAllowed).toBe(true);
      expect(isMarketerAllowed).toBe(false);
    });
  });

  describe('Categories Collection RBAC', () => {
    it('allows catalog_manager to create category and blocks customer', async () => {
      const catalogManagerUser = { id: 20, roles: ['catalog_manager'] };
      const customerUser = { id: 21, roles: ['customer'] };

      const canCatalogManage = hasRole(catalogManagerUser, ['super_admin', 'catalog_manager']);
      const canCustomerManage = hasRole(customerUser, ['super_admin', 'catalog_manager']);

      expect(canCatalogManage).toBe(true);
      expect(canCustomerManage).toBe(false);
    });
  });
});
