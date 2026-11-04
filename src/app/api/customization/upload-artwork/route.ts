import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { validateArtworkFile } from '@/modules/customization/lib/fileValidation';
import { saveArtworkFile } from '@/modules/customization/lib/privateStorage';

/**
 * POST /api/customization/upload-artwork
 * Dedicated endpoint for corporate clients to upload line-level branding and vector artwork.
 * Enforces:
 * 1. Active session (cookie or user login)
 * 2. Strict file size (max 50MB) and magic bytes content inspection
 * 3. Storage in persistent private filesystem outside public web root
 * 4. Record creation in ArtworkAssets collection with status pending_order
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

    const originalFilename = (file as any).name || 'artwork.dat';
    const buffer = Buffer.from(await file.arrayBuffer());

    // 3. Strict Content & Magic Bytes Validation
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

    // 4. Save to Private Directory outside public_html
    const { storageKey } = await saveArtworkFile(buffer, validation.originalFilename);

    // 5. Create ArtworkAssets Collection Record
    const asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey,
        originalFilename: validation.originalFilename,
        fileSize: validation.fileSize,
        mimeType: validation.mimeType,
        sha256: validation.sha256,
        status: 'pending_order',
        verificationStatus: 'valid',
        scanStatus: 'clean',
        ownerSession: sessionCartId ? String(sessionCartId) : undefined,
        cart: sessionCartId || undefined,
        lineItemId,
        uploader: authUser?.id || undefined,
      },
      depth: 0,
    });

    // 6. Optional: If lineItemId was provided, automatically bind to cart line item
    if (sessionCartId && lineItemId) {
      try {
        const cart = await payload.findByID({
          collection: 'carts',
          id: sessionCartId,
          depth: 0,
        });

        if (cart && Array.isArray(cart.items)) {
          let updated = false;
          const updatedItems = cart.items.map((item: any) => {
            if (item.id === lineItemId) {
              updated = true;
              return {
                ...item,
                artworkAssetId: String(asset.id),
              };
            }
            return item;
          });

          if (updated) {
            await payload.update({
              collection: 'carts',
              id: sessionCartId,
              data: {
                items: updatedItems,
              },
              depth: 0,
            });
          }
        }
      } catch (err: any) {
        // Non-blocking for upload response, logged for diagnostic audit
        console.warn(`Line item binding warning for cart ${sessionCartId}:`, err?.message);
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
