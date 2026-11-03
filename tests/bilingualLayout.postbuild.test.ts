import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import next from 'next';

describe('DES-02: Bilingual Layout, Token Linkage & Admin CSS Isolation', () => {
  const rootDir = process.cwd();
  const manifestPath = path.join(rootDir, '.next', 'app-build-manifest.json');
  const arHtmlPath = path.join(rootDir, '.next', 'server', 'app', 'ar.html');
  const enHtmlPath = path.join(rootDir, '.next', 'server', 'app', 'en.html');

  it('prerenders Arabic HTML with lang="ar" and dir="rtl"', () => {
    expect(fs.existsSync(arHtmlPath)).toBe(true);
    const arHtml = fs.readFileSync(arHtmlPath, 'utf8');
    expect(arHtml).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
  });

  it('prerenders English HTML with lang="en" and dir="ltr"', () => {
    expect(fs.existsSync(enHtmlPath)).toBe(true);
    const enHtml = fs.readFileSync(enHtmlPath, 'utf8');
    expect(enHtml).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/);
  });

  it('bundles globals.css CSS tokens into the frontend build output', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const frontendChunks: string[] = manifest.pages['/(frontend)/[locale]/layout'] || [];
    const frontendCssChunks = frontendChunks.filter((c) => c.endsWith('.css'));
    expect(frontendCssChunks.length).toBeGreaterThan(0);

    const allFrontendCss = frontendCssChunks
      .map((chunk) => fs.readFileSync(path.join(rootDir, '.next', chunk), 'utf8'))
      .join('\n');
    expect(allFrontendCss).toContain('--bg-primary:#ffffff');
    expect(allFrontendCss).toContain('--brand-primary:#01578a');
    expect(allFrontendCss).toContain('--brand-primary-dark:#013b5e');
    expect(allFrontendCss).toContain('--brand-primary-light:#0273b5');
    expect(allFrontendCss).toContain('--brand-accent:#b91c1c');
    expect(allFrontendCss).toContain('--status-error:#ed1c24');
    expect(allFrontendCss).toContain('--status-warning:#b45309');
    expect(allFrontendCss).toContain('[dir=ltr],[dir=rtl]{text-align:start}');
  });

  it('maintains strict CSS isolation: Payload admin never imports frontend CSS bundle', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const frontendChunks: string[] = manifest.pages['/(frontend)/[locale]/layout'] || [];
    const frontendCssChunks = frontendChunks.filter((c) => c.endsWith('.css'));

    const adminPageChunks: string[] = manifest.pages['/(payload)/admin/[[...segments]]/page'] || [];
    const adminLayoutChunks: string[] = manifest.pages['/(payload)/layout'] || [];

    for (const chunk of frontendCssChunks) {
      expect(adminPageChunks).not.toContain(chunk);
      expect(adminLayoutChunks).not.toContain(chunk);
    }
  });

  describe('Live HTTP Server Locale Routing & Response Inspection', () => {
    let server: http.Server;
    let baseUrl: string;

    beforeAll(async () => {
      const app = next({
        dev: false,
        dir: rootDir,
      });
      await app.prepare();
      const handle = app.getRequestHandler();

      server = http.createServer((req, res) => {
        handle(req, res);
      });

      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as { port: number };
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    }, 30000);

    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('GET / responds with HTTP 200 serving default Arabic version (lang="ar", dir="rtl")', async () => {
      const res = await fetch(`${baseUrl}/`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
      expect(text).toContain('تصميم الهوية التجارية');
    });

    it('GET /ar responds with HTTP 200 serving explicit Arabic version (lang="ar", dir="rtl")', async () => {
      const res = await fetch(`${baseUrl}/ar`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
      expect(text).toContain('تصميم الهوية التجارية');
    });

    it('GET /en responds with HTTP 200 serving English version (lang="en", dir="ltr")', async () => {
      const res = await fetch(`${baseUrl}/en`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/);
      expect(text).toContain('Brand Architecture, Digital Platforms');
    });

    it('GET /ar/design-system responds with HTTP 200 serving Arabic UI primitives showcase', async () => {
      const res = await fetch(`${baseUrl}/ar/design-system`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);
      expect(text).toContain('مكونات الواجهة وتجارة الشركات');
      expect(text).toContain('stepper-input');
      expect(text).toContain('badge-warning');
    });

    it('GET /en/design-system responds with HTTP 200 serving English UI primitives showcase', async () => {
      const res = await fetch(`${baseUrl}/en/design-system`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/);
      expect(text).toContain('Corporate Component Architecture');
      expect(text).toContain('stepper-input');
      expect(text).toContain('badge-warning');
    });

    it('GET /invalid-locale responds with HTTP 404', async () => {
      const res = await fetch(`${baseUrl}/fr`);
      expect(res.status).toBe(404);
    });
  });
});
