import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME, withCartLock } from '@/modules/cart-checkout/services/cartStorage';
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
 * 6. Atomic binding to cart line item under withCartLock PostgreSQL advisory lock with safe rollback
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

    // 7. Atomic Binding to Cart Line Item under withCartLock (re-reading fresh cart state)
    if (lineItemId && sessionCartId) {
      let cartUpdated = false;

      try {
        await withCartLock(payload, sessionCartId, async (lockCtx) => {
          // Re-fetch fresh cart under PostgreSQL advisory lock to ensure latest items & concurrent mutations
          const freshCart = await payload.findByID({
            collection: 'carts',
            id: sessionCartId,
            depth: 0,
          });

          if (!freshCart) {
            const err: any = new Error('Cart session was not found.');
            err.code = 'CART_NOT_FOUND';
            throw err;
          }

          const currentItems = Array.isArray(freshCart.items) ? freshCart.items : [];
          const targetIndex = currentItems.findIndex((item: any) => item.id === lineItemId);

          if (targetIndex === -1) {
            const err: any = new Error(`Line item '${lineItemId}' was concurrently removed or does not exist.`);
            err.code = 'LINE_ITEM_REMOVED_CONCURRENTLY';
            throw err;
          }

          // Preserve all concurrent mutations (e.g. updated quantity, removed other items)
          // and update strictly the target line item's artworkAssetId
          const updatedItems = currentItems.map((item: any) => {
            if (item.id === lineItemId) {
              return {
                ...item,
                artworkAssetId: String(asset.id),
              };
            }
            return item;
          });

          await payload.update({
            collection: 'carts',
            id: sessionCartId,
            data: {
              items: updatedItems,
            },
            depth: 0,
          });

          lockCtx.markSaved();
          cartUpdated = true;
        });
      } catch (bindErr: any) {
        // AMBIGUOUS / FAILED UPDATE RECOVERY:
        // Before deleting the uploaded file or asset record, check PostgreSQL database
        // to verify whether the cart update actually committed despite the exception.
        let isActuallyLinked = false;
        let verificationSucceeded = false;

        try {
          const verifyCart = await payload.findByID({
            collection: 'carts',
            id: sessionCartId,
            depth: 0,
          });

          if (verifyCart && Array.isArray(verifyCart.items)) {
            verificationSucceeded = true;
            const boundItem = verifyCart.items.find(
              (item: any) => item.id === lineItemId && String(item.artworkAssetId) === String(asset.id)
            );
            if (boundItem) {
              isActuallyLinked = true;
            }
          }
        } catch (verifyErr: any) {
          console.warn('Failed to verify cart linkage during upload rollback recovery:', verifyErr?.message);
        }

        if (isActuallyLinked) {
          // DATABASE COMMITTED: The line item is already linked to this artwork asset in PostgreSQL.
          // NEVER delete the file or asset. Safely recover and return HTTP 201 success.
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
              boundToLineItem: true,
              recoveredFromGlitch: true,
            },
            { status: 201 }
          );
        }

        // ROLLBACK SAFETY:
        // Only delete file and asset if we verified that PostgreSQL does NOT reference this asset.
        if (verificationSucceeded && !isActuallyLinked) {
          await cleanupUploadedArtwork(storageKey);
          await payload.delete({
            collection: 'artwork-assets',
            id: asset.id,
            context: { isTrustedUpload: true },
            overrideAccess: true,
          });
        }

        if (bindErr.code === 'LINE_ITEM_REMOVED_CONCURRENTLY') {
          return NextResponse.json(
            {
              error: 'LINE_ITEM_NOT_FOUND',
              message: bindErr.message,
            },
            { status: 422 }
          );
        }

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
