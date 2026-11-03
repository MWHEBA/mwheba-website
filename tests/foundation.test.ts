import { describe, it, expect, beforeAll } from 'vitest';
import { createPrivateMediaToken, verifyPrivateMediaToken } from '../src/modules/customization/endpoints/privateMedia';
import { logger } from '../src/shared/lib/logger';
import { toIntegerPiastres } from '../src/modules/orders/logic/orderSnapshotEngine';

describe('FND-02 & FND-03: Foundation, Security & Currency Standards', () => {
  beforeAll(() => {
    process.env.MEDIA_SIGNING_SECRET = 'mwheba-media-signing-secret-dev-2026-32chars';
    process.env.PAYLOAD_SECRET = 'mwheba-dev-foundation-secret-key-32chars-min';
  });

  describe('Private Media Expiring HMAC Tokens', () => {
    it('creates and verifies valid token for asset id', () => {
      const assetId = 'artwork_123';
      const token = createPrivateMediaToken(assetId);

      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const isValid = verifyPrivateMediaToken(token, assetId);
      expect(isValid).toBe(true);
    });

    it('rejects tampered token', () => {
      const assetId = 'artwork_123';
      const token = createPrivateMediaToken(assetId);
      const tampered = token.slice(0, -3) + 'xyz';

      expect(verifyPrivateMediaToken(tampered, assetId)).toBe(false);
    });

    it('rejects expired token', () => {
      const assetId = 'artwork_123';
      const pastTime = Date.now() - 120 * 1000; // 2 minutes ago
      const token = createPrivateMediaToken(assetId, pastTime);

      expect(verifyPrivateMediaToken(token, assetId, Date.now())).toBe(false);
    });

    it('rejects token when queried with different asset id', () => {
      const token = createPrivateMediaToken('artwork_123');
      expect(verifyPrivateMediaToken(token, 'artwork_999')).toBe(false);
    });
  });

  describe('Currency & Integer Piastre Precision (D-017)', () => {
    it('converts exact 2-decimal EGP to integer piastres without float error', () => {
      expect(toIntegerPiastres(250)).toBe(25000);
      expect(toIntegerPiastres(35.5)).toBe(3550);
      expect(toIntegerPiastres(14.99)).toBe(1499);
      expect(toIntegerPiastres(0.05)).toBe(5);
    });

    it('rejects fractional piastres (more than 2 decimal places)', () => {
      expect(() => toIntegerPiastres(250.005)).toThrow(/FRACTIONAL_PIASTRE_PROHIBITED/);
      expect(() => toIntegerPiastres(10.1234)).toThrow(/FRACTIONAL_PIASTRE_PROHIBITED/);
    });

    it('rejects non-positive and non-finite numbers', () => {
      expect(() => toIntegerPiastres(0)).toThrow(/INVALID_MONETARY_AMOUNT/);
      expect(() => toIntegerPiastres(-10)).toThrow(/INVALID_MONETARY_AMOUNT/);
      expect(() => toIntegerPiastres(NaN)).toThrow(/INVALID_MONETARY_AMOUNT/);
      expect(() => toIntegerPiastres(Infinity)).toThrow(/INVALID_MONETARY_AMOUNT/);
    });
  });

  describe('Structured JSON Logging', () => {
    it('formats structured log entries without throwing', () => {
      expect(() => {
        logger.info('Test log entry', { module: 'foundation', orderId: 101 });
        logger.warn('Test warning', { module: 'foundation' });
      }).not.toThrow();
    });
  });
});
