import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME, cartRelationId, isRetiredCart, withCartLock } from '@/modules/cart-checkout/services/cartStorage';
import { applyCartCookie, resolveCartRequest } from '@/modules/cart-checkout/services/cartRequest';
import { validateArtworkFile } from '@/modules/customization/lib/fileValidation';
import { saveArtworkFile, cleanupUploadedArtwork } from '@/modules/customization/lib/privateStorage';
import type { ArtworkAsset } from '@/payload-types';

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
  let guestCookie: Awaited<ReturnType<typeof resolveCartRequest>>['guestCookie'] = null;
  const respond = (body: object, status = 200) =>
    applyCartCookie(NextResponse.json(body, { status }), guestCookie);

  try {
    const payload = await getPayload({ config: configPromise });

    // 1. Session resolution
    const { cart, user: authUser, guestCookie: cookie } = await resolveCartRequest(payload, {
      headers: req.headers,
      signedCartCookie: req.cookies.get(CART_COOKIE_NAME)?.value,
    });
    guestCookie = cookie;
    const sessionCartId = cart?.id;
    const sessionCustomerId = cartRelationId(cart?.customer) ?? null;

    if (!sessionCartId && !authUser) {
      return respond(
        {
          error: 'SESSION_REQUIRED',
          message: 'Active cart session or login required to upload artwork files.',
        },
        401
      );
    }

    // 2. Parse Multipart Form Data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return respond(
        {
          error: 'INVALID_FORM_DATA',
          message: 'Request must be multipart/form-data with a file field.',
        },
        400
      );
    }

    const file = formData.get('file');
    const lineItemId = formData.get('lineItemId')?.toString()?.trim() || undefined;

    if (!file || typeof file === 'string' || !(file instanceof Blob)) {
      return respond(
        {
          error: 'MISSING_FILE',
          message: 'Valid file field is required in multipart form data.',
        },
        400
      );
    }

    // 3. Pre-validate Cart & Line Item if requested BEFORE modifying disk or database
    if (lineItemId) {
      if (!cart) {
        return respond(
          {
            error: 'CART_SESSION_REQUIRED',
            message: 'Line item binding requires an active cart session.',
          },
          400
        );
      }

      const itemExists = cart.items?.some((item) => item.id === lineItemId);
      if (!itemExists) {
        return respond(
          {
            error: 'LINE_ITEM_NOT_FOUND',
            message: `Line item '${lineItemId}' does not exist in the active cart.`,
          },
          422
        );
      }
    }

    const originalFilename = file.name || 'artwork.dat';
    const buffer = Buffer.from(await file.arrayBuffer());

    // 4. Strict Content & Magic Bytes Validation
    const validation = validateArtworkFile(buffer, originalFilename, file.type);

    if (!validation.isValid) {
      if (validation.error?.includes('exceeds the maximum')) {
        return respond(
          {
            error: 'FILE_TOO_LARGE',
            message: validation.error,
          },
          413
        );
      }

      return respond(
        {
          error: 'INVALID_FILE_CONTENT',
          message: validation.error || 'File validation failed.',
        },
        422
      );
    }

    // 5. Save to Private Directory outside public_html
    const { storageKey } = await saveArtworkFile(buffer, validation.originalFilename);

    // 6. Create ArtworkAssets Collection Record via trusted context
    let asset: ArtworkAsset;
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
          ownerSession: sessionCartId && sessionCustomerId === null ? String(sessionCartId) : undefined,
          cart: sessionCartId || undefined,
          lineItemId,
          uploader: authUser?.id || undefined,
        },
        context: { isTrustedUpload: true },
        depth: 0,
      });
    } catch (createErr) {
      await cleanupUploadedArtwork(storageKey);
      throw createErr;
    }

    // 7. Atomic Binding to Cart Line Item under withCartLock (re-reading fresh cart state)
    if (lineItemId && sessionCartId) {
      try {
        await withCartLock(payload, sessionCartId, async (lockCtx) => {
          // Re-fetch fresh cart under PostgreSQL advisory lock to ensure latest items & concurrent mutations
          const freshCart = await payload.findByID({
            collection: 'carts',
            id: sessionCartId,
            depth: 0,
            disableErrors: true,
          });

          if (!freshCart || freshCart.purchasedAt || isRetiredCart(freshCart)
            || (cartRelationId(freshCart.customer) ?? null) !== sessionCustomerId
            || (!sessionCustomerId && freshCart.secret !== cart?.secret)) {
            throw Object.assign(new Error('Cart session was not found.'), { code: 'CART_NOT_FOUND' });
          }

          const currentItems = freshCart.items ?? [];
          if (!currentItems.some((item) => item.id === lineItemId)) {
            throw Object.assign(
              new Error(`Line item '${lineItemId}' was concurrently removed or does not exist.`),
              { code: 'LINE_ITEM_REMOVED_CONCURRENTLY' }
            );
          }

          // Preserve all concurrent mutations (e.g. updated quantity, removed other items)
          // and update strictly the target line item's artworkAssetId
          const updatedItems = currentItems.map((item) => {
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
        });
      } catch (bindErr: any) {
        // AMBIGUOUS / FAILED UPDATE RECOVERY:
        // Before deleting the uploaded file or asset record, check PostgreSQL database
        // to verify whether the cart update actually committed despite the exception.
        let isActuallyLinked = false;
        let verificationSucceeded = false;

        try {
          const savedAsset = await payload.findByID({
            collection: 'artwork-assets',
            id: asset.id,
            depth: 0,
          });
          const assetCartId = cartRelationId(savedAsset?.cart);
          const verifyCart = await payload.findByID({
            collection: 'carts',
            id: assetCartId ?? sessionCartId,
            depth: 0,
          });

          if (verifyCart && savedAsset) {
            verificationSucceeded = true;
            const boundItem = verifyCart.items?.find(
              (item) => item.id === (savedAsset.lineItemId ?? lineItemId) && String(item.artworkAssetId) === String(asset.id)
            );
            if (boundItem || savedAsset.status === 'committed_order') {
              isActuallyLinked = true;
            }
          }
        } catch (verifyErr: any) {
          console.warn('Failed to verify cart linkage during upload rollback recovery:', verifyErr?.message);
        }

        if (isActuallyLinked) {
          // DATABASE COMMITTED: The line item is already linked to this artwork asset in PostgreSQL.
          // NEVER delete the file or asset. Safely recover and return HTTP 201 success.
          return respond(
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
            201
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
          return respond(
            {
              error: 'LINE_ITEM_NOT_FOUND',
              message: bindErr.message,
            },
            422
          );
        }

        if (bindErr.code === 'CART_NOT_FOUND') {
          return respond({ error: 'CART_NOT_FOUND', message: bindErr.message }, 404);
        }

        return respond(
          {
            error: 'CART_BINDING_FAILED',
            message: `Failed to bind artwork to cart line item: ${bindErr?.message || 'Database update error'}`,
          },
          500
        );
      }
    }

    return respond(
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
      201
    );
  } catch (err: any) {
    return respond(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Artwork upload failed.',
      },
      500
    );
  }
}
