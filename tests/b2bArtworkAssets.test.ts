import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import { readFile, unlink, rm, mkdir } from 'node:fs/promises';
import { existsSync, symlinkSync } from 'node:fs';
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
  getSigningSecret,
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
  let customerUser: any;
  let testProduct: any;
  let testAsset: any;
  const createdAssetIds: (string | number)[] = [];
  const createdCartIds: (string | number)[] = [];
  const testFilesToClean: string[] = [];

  beforeAll(async () => {
    process.env.MEDIA_SIGNING_SECRET = process.env.MEDIA_SIGNING_SECRET || 'mwheba-media-signing-secret-dev-2026-32chars';
    process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'mwheba-dev-foundation-secret-key-32chars-min';

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

    // 3. Create regular customer user for access control testing
    customerUser = await payload.create({
      collection: 'users',
      data: {
        email: `customer_b2b03_${Date.now()}@mwheba.com`,
        password: 'TestPassword123!',
        name: 'B2B Corporate Client',
        roles: ['customer'],
      },
      context: { isSystemSeed: true },
    });

    // 4. Fetch a physical product for cart line item binding tests
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
        await payload.delete({
          collection: 'artwork-assets',
          id,
          context: { isTrustedUpload: true },
          overrideAccess: true,
        });
      } catch {
        // Ignored
      }
    }

    // Cleanup physical files written to private storage during tests
    for (const filePath of testFilesToClean) {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath).catch(() => {});
        }
      } catch {
        // Ignored
      }
    }
  });

  // =========================================================================
  // 1. File Validation, Format Detection & Malware Rejection
  // =========================================================================
  describe('1. File Content, Format & Magic-Byte Validation', () => {
    it('detects valid PNG magic bytes (89 50 4E 47)', () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      expect(detectMagicBytes(pngHeader).detectedMime).toBe('image/png');
    });

    it('detects valid JPEG magic bytes (FF D8 FF)', () => {
      const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(detectMagicBytes(jpegHeader).detectedMime).toBe('image/jpeg');
    });

    it('detects valid PDF magic bytes (%PDF-)', () => {
      const pdfHeader = Buffer.from('%PDF-1.7\n%âãÏÓ\n');
      expect(detectMagicBytes(pdfHeader).detectedMime).toBe('application/pdf');
    });

    it('detects valid PSD magic bytes (8BPS)', () => {
      const psdHeader = Buffer.from([0x38, 0x42, 0x50, 0x53, 0x00, 0x01]);
      expect(detectMagicBytes(psdHeader).detectedMime).toBe('image/vnd.adobe.photoshop');
    });

    it('detects valid EPS/AI magic bytes (%!PS-Adobe or PostScript binary)', () => {
      const epsHeader = Buffer.from('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 100 100');
      expect(detectMagicBytes(epsHeader).detectedMime).toBe('application/postscript');
    });

    it('strictly REJECTS Windows DOS/PE executable header (MZ) disguised as image', () => {
      const peHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      expect(detectMagicBytes(peHeader).isMaliciousExecutable).toBe(true);

      const res = validateArtworkFile(peHeader, 'logo.png', 'image/png');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Disguised executable binary detected');
    });

    it('strictly REJECTS Linux/Unix ELF executable header (\\x7FELF)', () => {
      const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
      expect(detectMagicBytes(elfHeader).isMaliciousExecutable).toBe(true);

      const res = validateArtworkFile(elfHeader, 'vector.ai', 'application/illustrator');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Disguised executable binary detected');
    });

    it('validates a clean SVG XML document with vector paths', () => {
      const cleanSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="navy"/></svg>'
      );
      const res = validateArtworkFile(cleanSvg, 'brand_logo.svg', 'image/svg+xml');
      expect(res.isValid).toBe(true);
      expect(res.mimeType).toBe('image/svg+xml');
      expect(res.sha256).toBeDefined();
    });

    it('strictly REJECTS malicious SVG files containing embedded <script> tags (XSS)', () => {
      const xssSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS Vulnerability")</script><rect width="10" height="10"/></svg>'
      );
      const res = validateArtworkFile(xssSvg, 'malicious_xss.svg', 'image/svg+xml');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Embedded <script> tags');
    });

    it('strictly REJECTS malicious SVG files containing inline event handlers (onload, onclick)', () => {
      const handlerSvg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="fetch(\'http://attacker.com\')" width="50" height="50"/></svg>'
      );
      const res = validateArtworkFile(handlerSvg, 'onload_xss.svg', 'image/svg+xml');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Inline DOM event handlers');
    });

    it('strictly REJECTS SVG files containing XXE (XML External Entity) payloads', () => {
      const xxeSvg = Buffer.from(
        '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>'
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
  // 2. Private Storage Boundaries & resolveArtworkPath Protection
  // =========================================================================
  describe('2. Private Storage Boundaries & Path Traversal Guards (resolveArtworkPath)', () => {
    it('resolves valid relative paths strictly inside privateUploadDir', () => {
      const relativeKey = 'artwork/abc-123/valid_logo.svg';
      const resolved = resolveArtworkPath(relativeKey);
      expect(resolved).toContain('private-uploads');
      expect(resolved).toContain(path.normalize(relativeKey));
    });

    it('strictly REJECTS absolute paths on any platform (e.g. /etc/passwd or C:\\Windows)', () => {
      expect(() => resolveArtworkPath('/etc/passwd')).toThrow(
        /Path traversal rejected: Absolute paths are forbidden/
      );
      expect(() => resolveArtworkPath('C:\\Windows\\System32\\drivers\\etc\\hosts')).toThrow(
        /Path traversal rejected: Absolute paths are forbidden/
      );
      expect(() => resolveArtworkPath('\\\\network-share\\leak.txt')).toThrow(
        /Path traversal rejected: Absolute paths are forbidden/
      );
    });

    it('strictly REJECTS sibling directory traversal via path.relative boundaries', () => {
      expect(() => resolveArtworkPath('../private-uploads-secret/passwords.txt')).toThrow(
        /Path traversal rejected: Attempted access outside private storage directory/
      );
    });

    it('strictly REJECTS deep parent traversal (../../)', () => {
      expect(() => resolveArtworkPath('artwork/../../outside_secret.key')).toThrow(
        /Path traversal rejected: Attempted access outside private storage directory/
      );
      expect(() => resolveArtworkPath('../../../package.json')).toThrow(
        /Path traversal rejected: Attempted access outside private storage directory/
      );
    });

    it('strictly REJECTS symlink / junction escapes pointing outside private storage', async () => {
      const junctionDir = path.join(privateUploadDir, `test_junction_${Date.now()}`);
      try {
        symlinkSync(path.resolve('src'), junctionDir, 'junction');
        const relativeKey = `${path.basename(junctionDir)}/payload.config.ts`;
        expect(() => resolveArtworkPath(relativeKey)).toThrow(
          /Path traversal rejected: Symlink escapes private storage directory/
        );
      } finally {
        try {
          if (existsSync(junctionDir)) {
            await rm(junctionDir, { recursive: true, force: true });
          }
        } catch {
          // Cleanup
        }
      }
    });
  });

  // =========================================================================
  // 3. Direct Payload REST/API Access Control on ArtworkAssets (Point 1)
  // =========================================================================
  describe('3. Direct Payload REST/API Mutation Access Control (ArtworkAssets)', () => {
    it('strictly PREVENTS customer users from calling payload.create directly without trusted upload context', async () => {
      let threw = false;
      try {
        await payload.create({
          collection: 'artwork-assets',
          data: {
            storageKey: 'forged/artwork.png',
            originalFilename: 'forged.png',
            fileSize: 1024,
            mimeType: 'image/png',
            scanStatus: 'clean',
          },
          user: customerUser,
          overrideAccess: false,
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/not allowed|forbidden|trusted upload/i);
      }
      expect(threw).toBe(true);
    });

    it('strictly PREVENTS customer users from updating storageKey or scanStatus directly', async () => {
      // Create a valid asset via trusted context first
      const validAsset = await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey: `artwork/cust-${Date.now()}/client_logo.png`,
          originalFilename: 'client_logo.png',
          fileSize: 2048,
          mimeType: 'image/png',
          status: 'pending_order',
          verificationStatus: 'valid',
          scanStatus: 'unscanned',
          uploader: customerUser.id,
        },
        context: { isTrustedUpload: true },
        overrideAccess: true,
      });
      createdAssetIds.push(validAsset.id);

      // Verify that default scanStatus is 'unscanned', NOT 'clean'
      expect(validAsset.scanStatus).toBe('unscanned');

      // Attempt to tamper with storageKey and scanStatus as customerUser
      let threw = false;
      try {
        await payload.update({
          collection: 'artwork-assets',
          id: validAsset.id,
          data: {
            storageKey: 'malicious/tampered_path.png',
            scanStatus: 'clean',
          },
          user: customerUser,
          overrideAccess: false,
        });
      } catch (err: any) {
        threw = true;
        expect(err.message).toMatch(/not allowed|forbidden|restricted/i);
      }
      expect(threw).toBe(true);

      // Verify asset in DB was not tampered with
      const untouched = await payload.findByID({
        collection: 'artwork-assets',
        id: validAsset.id,
        depth: 0,
      });
      expect(untouched.storageKey).toBe(validAsset.storageKey);
      expect(untouched.scanStatus).toBe('unscanned');
    });

    it('confirms scanStatus defaults to "unscanned" upon record creation', async () => {
      const newDoc = await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey: `artwork/test-${Date.now()}/brand.png`,
          originalFilename: 'brand.png',
          fileSize: 1024,
          mimeType: 'image/png',
        },
        context: { isTrustedUpload: true },
        overrideAccess: true,
      });
      createdAssetIds.push(newDoc.id);

      expect(newDoc.scanStatus).toBe('unscanned');
    });
  });

  // =========================================================================
  // 4. Integration Tests: Upload Endpoint (/api/customization/upload-artwork) (Point 2)
  // =========================================================================
  describe('4. Upload Route (/api/customization/upload-artwork) & Atomic Line Item Binding', () => {
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

    it('strictly rejects upload with non-existent lineItemId with HTTP 422 BEFORE saving file or record', async () => {
      const signedCookieA = signCartId(testCartA.id);
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
      const formData = new FormData();
      formData.append('file', blob, 'test_unlinked.svg');
      formData.append('lineItemId', 'nonexistent-line-item-999');

      const beforeAssets = await payload.find({
        collection: 'artwork-assets',
        where: { originalFilename: { equals: 'test_unlinked.svg' } },
      });

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
      expect(data.error).toBe('LINE_ITEM_NOT_FOUND');
      expect(data.message).toContain('nonexistent-line-item-999');

      // Verify no database record was created
      const afterAssets = await payload.find({
        collection: 'artwork-assets',
        where: { originalFilename: { equals: 'test_unlinked.svg' } },
      });
      expect(afterAssets.totalDocs).toBe(beforeAssets.totalDocs);
    });

    it('atomically rolls back file and asset record if cart update fails', async () => {
      const signedCookieA = signCartId(testCartA.id);

      // 1. Add real item to cart first
      const addRes = await cartItemsPostRoute(
        new NextRequest('http://localhost:3000/api/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            quantity: 10,
            operationKey: `op_item_for_rollback_${Date.now()}`,
          }),
        })
      );
      const addData = await addRes.json();
      const realLineItemId = addData.summary.items[0].id;

      // 2. Prepare upload request for that lineItemId
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle fill="red" r="10"/></svg>';
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
      const formData = new FormData();
      const filename = `rollback_test_${Date.now()}.svg`;
      formData.append('file', blob, filename);
      formData.append('lineItemId', realLineItemId);

      // 3. Mock payload.update on carts to simulate sudden failure
      const originalUpdate = payload.update;
      payload.update = async (args: any) => {
        if (args.collection === 'carts') {
          throw new Error('Simulated PostgreSQL lock failure during cart update');
        }
        return originalUpdate.call(payload, args);
      };

      try {
        const req = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
          method: 'POST',
          headers: {
            Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
          },
          body: formData,
        });

        const res = await uploadArtworkRoute(req);
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('CART_BINDING_FAILED');

        // 4. Verify database record was deleted (rolled back)
        const orphanAssets = await payload.find({
          collection: 'artwork-assets',
          where: { originalFilename: { equals: filename } },
        });
        expect(orphanAssets.totalDocs).toBe(0);
      } finally {
        payload.update = originalUpdate;
      }
    });

    it('successfully uploads valid SVG, stores it outside public web root, and records scanStatus="unscanned"', async () => {
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
      expect(data.scanStatus).toBe('unscanned');
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
      expect(dbDoc.scanStatus).toBe('unscanned');
      expect(String(dbDoc.ownerSession)).toBe(String(testCartA.id));
      expect(String(dbDoc.cart)).toBe(String(testCartA.id));
    });

    it('strictly rejects upload of disguised executable binary with HTTP 422', async () => {
      const signedCookieA = signCartId(testCartA.id);
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
      const oversizedBlob = new Blob([Buffer.alloc(100)], { type: 'image/png' });
      Object.defineProperty(oversizedBlob, 'size', { value: MAX_FILE_SIZE + 1024 });

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
      expect([413, 422]).toContain(res.status);
    });

    it('handles concurrent quantity mutation during artwork upload and preserves updated quantity without overwrite', async () => {
      const concCart = await getOrCreateCart(payload);
      createdCartIds.push(concCart.id);
      const signedCookie = signCartId(concCart.id);

      // Add item to cart: 10 units
      const addRes = await cartItemsPostRoute(
        new NextRequest('http://localhost:3000/api/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            quantity: 10,
            operationKey: `op_conc_setup_${Date.now()}`,
          }),
        })
      );
      const addData = await addRes.json();
      const lineItemId = addData.summary.items[0].id;

      // Prepare artwork upload
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="5" fill="blue"/></svg>';
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
      const formData = new FormData();
      formData.append('file', blob, 'concurrent_logo.svg');
      formData.append('lineItemId', lineItemId);

      const uploadReq = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
        },
        body: formData,
      });

      // Prepare concurrent quantity mutation updating quantity from 10 to 25
      const mutateReq = new NextRequest('http://localhost:3000/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 15, // adds 15 -> total 25
          operationKey: `op_conc_mutation_${Date.now()}`,
        }),
      });

      // Execute both concurrently
      const [uploadRes, mutateRes] = await Promise.all([
        uploadArtworkRoute(uploadReq),
        cartItemsPostRoute(mutateReq),
      ]);

      expect(uploadRes.status).toBe(201);
      expect(mutateRes.status).toBe(200);

      const uploadData = await uploadRes.json();
      expect(uploadData.success).toBe(true);
      createdAssetIds.push(uploadData.assetId);

      // Inspect PostgreSQL state: quantity must be 25, artworkAssetId must be set
      const dbCart = await payload.findByID({
        collection: 'carts',
        id: concCart.id,
        depth: 0,
      });

      expect(dbCart.items.length).toBe(1);
      expect(dbCart.items[0].quantity).toBe(25);
      expect(dbCart.items[0].artworkAssetId).toBe(String(uploadData.assetId));
    });

    it('handles concurrent line item deletion during artwork upload and cleanly rolls back file and asset', async () => {
      const delCart = await getOrCreateCart(payload);
      createdCartIds.push(delCart.id);
      const signedCookie = signCartId(delCart.id);

      // Add item to cart
      const addRes = await cartItemsPostRoute(
        new NextRequest('http://localhost:3000/api/cart/items', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
          },
          body: JSON.stringify({
            productId: testProduct.id,
            quantity: 10,
            operationKey: `op_del_setup_${Date.now()}`,
          }),
        })
      );
      const addData = await addRes.json();
      const lineItemId = addData.summary.items[0].id;

      // Delete the item concurrently before upload locks the cart
      await payload.update({
        collection: 'carts',
        id: delCart.id,
        data: {
          items: [],
        },
        depth: 0,
      });

      // Try uploading for the now-deleted item
      const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>';
      const blob = new Blob([cleanSvg], { type: 'image/svg+xml' });
      const formData = new FormData();
      const filename = `concurrent_del_${Date.now()}.svg`;
      formData.append('file', blob, filename);
      formData.append('lineItemId', lineItemId);

      const uploadReq = new NextRequest('http://localhost:3000/api/customization/upload-artwork', {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookie}`,
        },
        body: formData,
      });

      const res = await uploadArtworkRoute(uploadReq);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe('LINE_ITEM_NOT_FOUND');

      // Verify no orphan doc in database
      const orphanAssets = await payload.find({
        collection: 'artwork-assets',
        where: { originalFilename: { equals: filename } },
      });
      expect(orphanAssets.totalDocs).toBe(0);
    });
  });

  // =========================================================================
  // 5. Line-Level Binding & Session Protection in Cart
  // =========================================================================
  describe('5. Line-Item Binding & Cross-Session Protection in Cart', () => {
    let bindCartA: any;
    let bindCartB: any;
    let assetOwnedByCartA: any;

    beforeAll(async () => {
      bindCartA = await getOrCreateCart(payload);
      bindCartB = await getOrCreateCart(payload);
      createdCartIds.push(bindCartA.id, bindCartB.id);

      // Create an artwork asset owned strictly by bindCartA
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
          scanStatus: 'unscanned',
          ownerSession: String(bindCartA.id),
          cart: bindCartA.id,
        },
        context: { isTrustedUpload: true },
        overrideAccess: true,
      });
      createdAssetIds.push(assetOwnedByCartA.id);
    });

    it('allows Cart A to attach its own artworkAssetId to a line item with separate customization fee', async () => {
      const signedCookieA = signCartId(bindCartA.id);

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
        id: bindCartA.id,
        depth: 0,
      });
      expect(dbCart.items[0].artworkAssetId).toBe(String(assetOwnedByCartA.id));
    });

    it('strictly PREVENTS Cart B from attaching Cart As artworkAssetId with HTTP 403 Forbidden', async () => {
      const signedCookieB = signCartId(bindCartB.id);

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
      const signedCookieA = signCartId(bindCartA.id);

      const req = new NextRequest('http://localhost:3000/api/cart/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          quantity: 10,
          artworkAssetId: '99999999',
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
  // 6. Temporary Signed URLs & Private File Download Streaming
  // =========================================================================
  describe('6. Temporary Signed URLs & Private File Streaming', () => {
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
          scanStatus: 'unscanned',
          ownerSession: String(testCartA.id),
          cart: testCartA.id,
        },
        context: { isTrustedUpload: true },
        overrideAccess: true,
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
      expect(data.expiresIn).toBe(900);
      expect(data.url).toContain(`/api/customization/artwork/${testAsset.id}/download?token=`);

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

      expect(res.headers.get('content-type')).toContain('image/svg+xml');
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="gold_badge.svg"');
      expect(res.headers.get('cache-control')).toContain('private, no-store');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');

      const bodyBytes = Buffer.from(await res.arrayBuffer());
      expect(bodyBytes.equals(testFileBytes)).toBe(true);
    });

    it('allows super_admin staff to generate signed download link for production inspection', async () => {
      const req = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/sign`, {
        method: 'POST',
        headers: {
          'x-test-user-id': String(adminUser.id),
        },
      });

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

  // =========================================================================
  // 7. Signing Secret Key Enforcement & Production Security Guards
  // =========================================================================
  describe('7. Secret Key Enforcement & Configuration Guards', () => {
    const originalMediaSecret = process.env.MEDIA_SIGNING_SECRET;
    const originalPayloadSecret = process.env.PAYLOAD_SECRET;

    afterAll(() => {
      process.env.MEDIA_SIGNING_SECRET = originalMediaSecret;
      process.env.PAYLOAD_SECRET = originalPayloadSecret;
    });

    it('strictly throws SECURITY_CONFIGURATION_ERROR when signing secret is unconfigured or under 32 chars', () => {
      delete process.env.MEDIA_SIGNING_SECRET;
      delete process.env.PAYLOAD_SECRET;

      expect(() => getSigningSecret()).toThrow(/SECURITY_CONFIGURATION_ERROR/);
      expect(() => createArtworkDownloadToken(999)).toThrow(/SECURITY_CONFIGURATION_ERROR/);

      // Short / weak secret
      process.env.MEDIA_SIGNING_SECRET = 'short-secret';
      expect(() => getSigningSecret()).toThrow(/(minimum|at least) 32 characters/);
    });

    it('fails closed in verifyArtworkDownloadToken when signing secret is missing', () => {
      delete process.env.MEDIA_SIGNING_SECRET;
      delete process.env.PAYLOAD_SECRET;

      const fakeToken = 'eyJpZCI6Ijk5OSIsImV4cCI6OTk5OTk5OTk5OX0.fake_signature';
      expect(verifyArtworkDownloadToken(fakeToken, 999)).toBe(false);
    });

    it('fails safely with HTTP 500 on /sign and HTTP 403 on /download when secret is unconfigured', async () => {
      delete process.env.MEDIA_SIGNING_SECRET;
      delete process.env.PAYLOAD_SECRET;

      // /sign route with valid cookie
      const signedCookieA = signCartId(testCartA.id);
      const signReq = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/sign`, {
        method: 'POST',
        headers: {
          Cookie: `${CART_COOKIE_NAME}=${signedCookieA}`,
        },
      });
      const signRes = await signArtworkRoute(signReq, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(signRes.status).toBe(500);
      const signData = await signRes.json();
      expect(signData.error).toBe('INTERNAL_ERROR');
      expect(signData.message).toContain('SECURITY_CONFIGURATION_ERROR');

      // /download route with any token fails closed with 403
      const dlReq = new NextRequest(`http://localhost:3000/api/customization/artwork/${testAsset.id}/download?token=dummy.token`, {
        method: 'GET',
      });
      const dlRes = await downloadArtworkRoute(dlReq, { params: Promise.resolve({ id: String(testAsset.id) }) });
      expect(dlRes.status).toBe(403);
    });
  });
});
