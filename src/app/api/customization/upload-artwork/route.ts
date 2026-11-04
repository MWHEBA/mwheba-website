import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { validateArtworkFile } from '@/modules/customization/lib/fileValidation';
import { saveArtworkFile, cleanupUploadedArtwork } from '@/modules/customization/lib/privateStorage';

/**
 * POST /api/customization/upload-artwork
 * Dedicated endpoint for corporate clients to upload line-level branding and vector artwork.
 * Enforces:
 * 1. Active session (cookie or user login)
 * 2. Pre-upload cart and line item validation (if lineItemId is supplied)
 * 3. Strict file size (max 50MB) and magic bytes content inspection
 * 4. Storage in persistent private filesystem outside public web root
 * 5. Record creation in ArtworkAssets collection via trusted context with scanStatus = 'unscanned'
 * 6. Atomic binding to cart item with guaranteed rollback on failure
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise });

    // 1. Session resolution
    const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
    const sessionCartId = readCartId(cookieVal);

    let authUser: any = null;
    try {
      const authResult = await payload.auth({ headers: req.headers });
      if (authResult?.user) {
        authUser = authResult.user;
      }
    } catch {
      // Guest session
    }

    if (!sessionCartId && !authUser) {
      return NextResponse.json(
        {
          error: 'SESSION_REQUIRED',
          message: 'Active cart session or login required to upload artwork files.',
        },
        { status: 401 }
      );
    }

    // 2. Parse Multipart Form Data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        {
          error: 'INVALID_FORM_DATA',
          message: 'Request must be multipart/form-data with a file field.',
        },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    const lineItemId = formData.get('lineItemId')?.toString()?.trim() || undefined;

    if (!file || typeof file === 'string' || !(file instanceof Blob)) {
      return NextResponse.json(
        {
          error: 'MISSING_FILE',
          message: 'Valid file field is required in multipart form data.',
        },
        { status: 400 }
      );
    }

    // 3. Pre-validate Cart & Line Item if requested BEFORE modifying disk or database
    let targetCart: any = null;
    if (lineItemId) {
      if (!sessionCartId) {
        return NextResponse.json(
          {
            error: 'CART_SESSION_REQUIRED',
            message: 'Line item binding requires an active cart session.',
          },
          { status: 400 }
        );
      }

      targetCart = await payload.findByID({
        collection: 'carts',
        id: sessionCartId,
        depth: 0,
      });

      if (!targetCart) {
        return NextResponse.json(
          {
            error: 'CART_NOT_FOUND',
            message: 'The cart associated with this session was not found.',
          },
          { status: 404 }
        );
      }

      const items = Array.isArray(targetCart.items) ? targetCart.items : [];
      const itemExists = items.some((item: any) => item.id === lineItemId);
      if (!itemExists) {
        return NextResponse.json(
          {
            error: 'LINE_ITEM_NOT_FOUND',
            message: `Line item '${lineItemId}' does not exist in the active cart.`,
          },
          { status: 422 }
        );
      }
    }

    const originalFilename = (file as any).name || 'artwork.dat';
    const buffer = Buffer.from(await file.arrayBuffer());

    // 4. Strict Content & Magic Bytes Validation
    const validation = validateArtworkFile(buffer, originalFilename, file.type);

    if (!validation.isValid) {
      if (validation.error?.includes('exceeds the maximum')) {
        return NextResponse.json(
          {
            error: 'FILE_TOO_LARGE',
            message: validation.error,
          },
          { status: 413 }
        );
      }

      return NextResponse.json(
        {
          error: 'INVALID_FILE_CONTENT',
          message: validation.error || 'File validation failed.',
        },
        { status: 422 }
      );
    }

    // 5. Save to Private Directory outside public_html
    const { storageKey } = await saveArtworkFile(buffer, validation.originalFilename);

    // 6. Create ArtworkAssets Collection Record via trusted context
    // Note: scanStatus is explicitly 'unscanned' because format/magic-byte validation is NOT an antivirus clearance.
    let asset: any;
    try {
      asset = await payload.create({
        collection: 'artwork-assets',
        data: {
          storageKey,
          originalFilename: validation.originalFilename,
          fileSize: validation.fileSize,
          mimeType: validation.mimeType,
          sha256: validation.sha256,
          status: 'pending_order',
          verificationStatus: 'valid',
          scanStatus: 'unscanned',
          ownerSession: sessionCartId ? String(sessionCartId) : undefined,
          cart: sessionCartId || undefined,
          lineItemId,
          uploader: authUser?.id || undefined,
        },
        context: { isTrustedUpload: true },
        depth: 0,
      });
    } catch (createErr: any) {
      await cleanupUploadedArtwork(storageKey);
      throw createErr;
    }

    // 7. Atomic Binding to Cart Line Item (if requested)
    if (targetCart && lineItemId) {
      const updatedItems = (targetCart.items || []).map((item: any) => {
        if (item.id === lineItemId) {
          return {
            ...item,
            artworkAssetId: String(asset.id),
          };
        }
        return item;
      });

      try {
        await payload.update({
          collection: 'carts',
          id: targetCart.id,
          data: {
            items: updatedItems,
          },
          depth: 0,
        });
      } catch (bindErr: any) {
        // ROLLBACK: Delete written file and created database record if cart update fails
        await cleanupUploadedArtwork(storageKey);
        await payload.delete({
          collection: 'artwork-assets',
          id: asset.id,
          context: { isTrustedUpload: true },
          overrideAccess: true,
        });

        return NextResponse.json(
          {
            error: 'CART_BINDING_FAILED',
            message: `Failed to bind artwork to cart line item: ${bindErr?.message || 'Database update error'}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        assetId: asset.id,
        filename: validation.originalFilename,
        fileSize: validation.fileSize,
        mimeType: validation.mimeType,
        sha256: validation.sha256,
        storageKey,
        scanStatus: 'unscanned',
        boundToLineItem: Boolean(lineItemId),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Artwork upload failed.',
      },
      { status: 500 }
    );
  }
}
