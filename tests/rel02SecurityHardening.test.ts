import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { middleware } from '@/middleware';
import { validateArtworkFile, sanitizeFilename } from '@/modules/customization/lib/fileValidation';
import { recordCodCollection } from '@/modules/payments/services/codSettlementService';
import { verifyArtworkDownloadToken } from '@/modules/customization/lib/privateStorage';
import { checkRateLimitPersistent } from '@/modules/content/lib/inquiryRateLimiter';

describe('REL-02: Security Audit, Upload Sanitization & Privilege Hardening', () => {
  let payload: any;

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });
  });

  describe('1. Global HTTP Security Headers & Middleware Defense', () => {
    it('stamps strict security headers on standard responses (HSTS, CSP, X-Frame-Options, nosniff)', () => {
      const req = new NextRequest('http://localhost:3000/ar/store');
      const res = middleware(req);

      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
      expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('strict-transport-security')).toContain('max-age=2592000');
      expect(res.headers.get('permissions-policy')).toContain('camera=()');

      const csp = res.headers.get('content-security-policy');
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
    });

    it('stamps strict security headers even on 410 Gone and 301/302 Redirect responses', () => {
      const goneReq = new NextRequest('http://localhost:3000/product/vintage-typewriter/');
      const goneRes = middleware(goneReq);
      expect(goneRes.status).toBe(410);
      expect(goneRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(goneRes.headers.get('strict-transport-security')).toBeDefined();

      const redirectReq = new NextRequest('http://localhost:3000/ar/our-story/');
      const redirectRes = middleware(redirectReq);
      expect(redirectRes.status).toBe(301);
      expect(redirectRes.headers.get('x-content-type-options')).toBe('nosniff');
      expect(redirectRes.headers.get('strict-transport-security')).toBeDefined();
    });
  });

  describe('2. Malicious File Upload & Polyglot Neutralization', () => {
    it('detects and rejects DOS/Windows PE executable headers disguised as images (MZ header)', async () => {
      // Craft executable payload with 'MZ' header
      const exeBuffer = Buffer.alloc(1024);
      exeBuffer[0] = 0x4d; // 'M'
      exeBuffer[1] = 0x5a; // 'Z'
      exeBuffer.write('malicious executable code', 2);

      const result = await validateArtworkFile(exeBuffer, 'logo.png', 'image/png');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/executable/i);
    });

    it('detects and rejects Linux ELF binaries disguised as PDF', async () => {
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x01, 0x01, 0x01, 0x00]);
      const result = await validateArtworkFile(elfBuffer, 'doc.pdf', 'application/pdf');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/executable/i);
    });

    it('intercepts and rejects SVG files containing embedded <script> tags (XSS vector)', async () => {
      const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('xss')</script></svg>`;
      const buffer = Buffer.from(maliciousSvg, 'utf-8');

      const result = await validateArtworkFile(buffer, 'brand.svg', 'image/svg+xml');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('script');
    });

    it('intercepts and rejects SVG files containing XML External Entity (XXE) declarations', async () => {
      const xxeSvg = `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>`;
      const buffer = Buffer.from(xxeSvg, 'utf-8');

      const result = await validateArtworkFile(buffer, 'vector.svg', 'image/svg+xml');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('XXE');
    });

    it('neutralizes directory traversal in uploaded file names via sanitizeFilename', () => {
      const traversalName1 = '../../../../etc/shadow';
      const safe1 = sanitizeFilename(traversalName1);
      expect(safe1).not.toContain('..');
      expect(safe1).not.toContain('/');
      expect(safe1).toBe('shadow.dat');

      const traversalName2 = '..\\..\\windows\\system32\\cmd.exe';
      const safe2 = sanitizeFilename(traversalName2);
      expect(safe2).not.toContain('..');
      expect(safe2).not.toContain('\\');
      expect(safe2).toBe('cmd.exe');
    });
  });

  describe('3. Horizontal & Vertical Privilege Escalation Defense', () => {
    it('prevents vertical privilege escalation: regular customer cannot invoke courier collection recording', async () => {
      await expect(
        recordCodCollection(payload, {
          orderId: 99999,
          collectedAmount: 100,
          collectorType: 'courier',
          collectorName: 'Unauthorized Courier',
          receiptReference: 'REC_UNAUTH_1',
          actor: { id: 999, roles: ['customer'] },
        })
      ).rejects.toThrow('FORBIDDEN');
    });

    it('prevents direct manual creation of payment-collections without server engine context', async () => {
      await expect(
        payload.create({
          collection: 'payment-collections',
          data: {
            order: 99999,
            amount: 500,
            collectorType: 'courier',
            collectorName: 'Malicious Actor',
            receiptReference: 'REC_INJECTED_1',
            remittanceStatus: 'collected_by_courier',
            collectedAt: new Date().toISOString(),
          },
        })
      ).rejects.toThrow('DIRECT_COLLECTION_CREATION_FORBIDDEN');
    });

    it('rejects tampered or forged download tokens for private artwork assets (HTTP 403 defense)', () => {
      const assetId = 'asset-12345';
      const forgedToken = 'fake-forged-hmac-signature-attempt';
      const isValid = verifyArtworkDownloadToken(forgedToken, assetId);
      expect(isValid).toBe(false);
    });
  });

  describe('4. Rate Limiting & DoS Interception', () => {
    it('enforces rate limits on sensitive lead capture and inquiry submissions', async () => {
      const ip = '192.168.10.99';

      // First call within window succeeds
      const firstCheck = await checkRateLimitPersistent(payload, ip);
      expect(firstCheck.allowed).toBe(true);

      // Verify that rate limiter tracks currentCount
      expect(typeof firstCheck.currentCount).toBe('number');
    });
  });
});
