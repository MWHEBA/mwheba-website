import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { parseRedirectCsv, type RedirectEntry } from '../src/scripts/migration/compileRedirectMap';
import { edgeRedirectEngine, normalizePath } from '../src/modules/redirects/edgeRedirectEngine';
import { proxy as middleware } from '../src/proxy';

describe('MIG-03: Edge Redirect Engine & 4-Tier URL Status Governance', () => {
  const csvPath = path.resolve(process.cwd(), 'docs/audit/05-redirect-map.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const allEntries: RedirectEntry[] = parseRedirectCsv(csvContent);

  it('audited CSV contains exactly 54 discovered URLs', () => {
    expect(allEntries.length).toBe(54);

    const counts = {
      PRESERVE: 0,
      REDIRECT_301: 0,
      GONE_410: 0,
      REQUIRES_REVIEW: 0,
    };

    for (const entry of allEntries) {
      counts[entry.action]++;
    }

    expect(counts.PRESERVE).toBe(2);
    expect(counts.REDIRECT_301).toBe(41);
    expect(counts.GONE_410).toBe(10);
    expect(counts.REQUIRES_REVIEW).toBe(1);
  });

  describe('Direct Engine Evaluation for all 54 Discovered URLs', () => {
    for (const entry of allEntries) {
      it(`evaluates ${entry.action} correctly for: ${entry.legacyUrl}`, () => {
        const url = new URL(entry.legacyUrl);
        const result = edgeRedirectEngine.evaluate(url.pathname, url.search);

        if (entry.action === 'PRESERVE') {
          expect(result.action).toBe('PRESERVE');
          expect(result.statusCode).toBe(200);
        } else if (entry.action === 'GONE_410') {
          expect(result.action).toBe('GONE_410');
          expect(result.statusCode).toBe(410);
        } else if (entry.action === 'REDIRECT_301') {
          expect(result.action).toBe('REDIRECT_301');
          expect(result.statusCode).toBe(301);
          expect(result.destination).toBe(entry.targetPath);

          // Assert target has no trailing slash (unless root or contains query string)
          const targetPathOnly = entry.targetPath.split('?')[0];
          if (targetPathOnly.length > 1) {
            expect(targetPathOnly.endsWith('/')).toBe(false);
          }

          // Single Hop Guarantee: Destination must NOT itself be a 301 redirect
          const secondHop = edgeRedirectEngine.evaluate(targetPathOnly);
          expect(secondHop.action).not.toBe('REDIRECT_301');
          expect(secondHop.action).not.toBe('GONE_410');
        } else if (entry.action === 'REQUIRES_REVIEW') {
          expect(result.action).toBe('REQUIRES_REVIEW');
          // Strict: Must NEVER be a 301 permanent redirect pending review
          expect(result.statusCode).toBe(302);
          expect(result.statusCode).not.toBe(301);
          expect(result.destination).toBe(entry.targetPath);
        }
      });
    }
  });

  describe('Arabic Percent-Encoding vs Decoded UTF-8 Path Fidelity', () => {
    it('handles decoded Arabic service path identically to percent-encoded path', () => {
      const decodedPath = '/ar/خدماتنا/تطوير-المواقع/';
      const encodedPath = encodeURI(decodedPath);

      const decodedResult = edgeRedirectEngine.evaluate(decodedPath);
      const encodedResult = edgeRedirectEngine.evaluate(encodedPath);

      expect(decodedResult.statusCode).toBe(301);
      expect(encodedResult.statusCode).toBe(301);
      expect(decodedResult.destination).toBe('/ar/services/web-development');
      expect(encodedResult.destination).toBe('/ar/services/web-development');
    });

    it('handles decoded Arabic legal document path identically to percent-encoded path', () => {
      const decodedPath = '/ar/سياسة-الخصوصية/';
      const encodedPath = encodeURI(decodedPath);

      const decodedResult = edgeRedirectEngine.evaluate(decodedPath);
      const encodedResult = edgeRedirectEngine.evaluate(encodedPath);

      expect(decodedResult.destination).toBe('/ar/privacy-policy');
      expect(encodedResult.destination).toBe('/ar/privacy-policy');
    });
  });

  describe('Query String Preservation & Merging', () => {
    it('merges incoming query parameters onto destination with existing query string', () => {
      const pathname = '/portfolio-category/brand-identity/';
      const search = '?utm_source=google&utm_campaign=legacy';

      const result = edgeRedirectEngine.evaluate(pathname, search);
      expect(result.statusCode).toBe(301);
      expect(result.destination).toContain('/en/portfolio?category=brand-identity');
      expect(result.destination).toContain('utm_source=google');
      expect(result.destination).toContain('utm_campaign=legacy');
    });

    it('preserves query parameters on routes without pre-existing query string', () => {
      const pathname = '/services/brand-identity/';
      const search = '?ref=partner';

      const result = edgeRedirectEngine.evaluate(pathname, search);
      expect(result.statusCode).toBe(301);
      expect(result.destination).toBe('/en/services/brand-identity?ref=partner');
    });
  });

  describe('Next.js Middleware Integration', () => {
    it('returns HTTP 410 with X-Robots-Tag: noindex for legacy demo blog post', () => {
      const req = new NextRequest('https://mwheba.com/test-blog-2/');
      const res = middleware(req);

      expect(res.status).toBe(410);
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it('returns HTTP 410 for legacy demo WooCommerce product', () => {
      const req = new NextRequest('https://mwheba.com/product/vintage-typewriter/');
      const res = middleware(req);

      expect(res.status).toBe(410);
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    });

    it('returns HTTP 301 redirect with immutable cache header for active legacy service', () => {
      const req = new NextRequest('https://mwheba.com/services/web-development/');
      const res = middleware(req);

      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://mwheba.com/en/services/web-development');
      expect(res.headers.get('Cache-Control')).toContain('max-age=31536000');
    });

    it('returns HTTP 301 for legacy Arabic homepage trailing slash normalization', () => {
      const req = new NextRequest('https://mwheba.com/ar/');
      const res = middleware(req);

      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://mwheba.com/ar');
    });

    it('returns HTTP 302 with no-store for unreviewed/provisional routes (REQUIRES_REVIEW)', () => {
      const req = new NextRequest('https://mwheba.com/product/social-media-managemnt-package/');
      const res = middleware(req);

      expect(res.status).toBe(302);
      expect(res.status).not.toBe(301);
      expect(res.headers.get('location')).toBe('https://mwheba.com/en/services/digital-marketing');
      expect(res.headers.get('Cache-Control')).toContain('no-store');
      expect(res.headers.get('X-Redirect-Status')).toBe('pending_owner_review');
    });

    it('passes through domain root and preserved system files', () => {
      const rootReq = new NextRequest('https://mwheba.com/');
      const rootRes = middleware(rootReq);
      expect(rootRes.status).toBe(200);

      const robotsReq = new NextRequest('https://mwheba.com/robots.txt');
      const robotsRes = middleware(robotsReq);
      expect(robotsRes.status).toBe(200);
    });

    it('passes through internal Next.js assets and API routes', () => {
      const apiReq = new NextRequest('https://mwheba.com/api/health');
      const apiRes = middleware(apiReq);
      expect(apiRes.status).toBe(200);

      const staticReq = new NextRequest('https://mwheba.com/_next/static/chunk.js');
      const staticRes = middleware(staticReq);
      expect(staticRes.status).toBe(200);
    });
  });
});
