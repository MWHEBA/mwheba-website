import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME } from '@/modules/cart-checkout/services/cartStorage';
import { readCartId } from '@/modules/cart-checkout/logic/cartSession';
import { hasRole } from '@/modules/identity/access/roles';
import { createArtworkDownloadToken } from '@/modules/customization/lib/privateStorage';

/**
 * POST /api/customization/artwork/:id/sign
 * Generates an authorized, time-limited (15-min) download URL for private artwork assets.
 * Caller must be:
 * - The session owner (matching guest cart session cookie)
 * - The authenticated uploader
 * - Staff with super_admin or operations role
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID', message: 'Asset ID is required.' }, { status: 400 });
    }

    const payload = await getPayload({ config: configPromise });

    let asset: any;
    try {
      asset = await payload.findByID({
        collection: 'artwork-assets',
        id,
        depth: 0,
      });
    } catch {
      return NextResponse.json({ error: 'ASSET_NOT_FOUND', message: 'Artwork asset not found.' }, { status: 404 });
    }

    if (!asset) {
      return NextResponse.json({ error: 'ASSET_NOT_FOUND', message: 'Artwork asset not found.' }, { status: 404 });
    }

    // 1. Check Authenticated User Roles
    let isAuthorized = false;
    let authUser: any = null;
    try {
      const authResult = await payload.auth({ headers: req.headers });
      if (authResult?.user) {
        authUser = authResult.user;
        if (hasRole(authUser, ['super_admin', 'operations', 'finance'])) {
          isAuthorized = true;
        } else if (asset.uploader && String(asset.uploader) === String(authUser.id)) {
          isAuthorized = true;
        }
      }
    } catch {
      // Guest session check
    }

    // 2. Check Guest Session Ownership via Signed Cookie
    if (!isAuthorized) {
      const cookieVal = req.cookies.get(CART_COOKIE_NAME)?.value;
      const sessionCartId = readCartId(cookieVal);

      if (sessionCartId) {
        const ownerSessionMatches = asset.ownerSession && String(asset.ownerSession) === String(sessionCartId);
        const cartIdMatches = asset.cart && String(asset.cart) === String(sessionCartId);
        if (ownerSessionMatches || cartIdMatches) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: 'FORBIDDEN_ARTWORK_ACCESS',
          message: 'You do not have permission to generate download links for this artwork asset.',
        },
        { status: 403 }
      );
    }

    // 3. Generate 15-Minute Signed Download Token
    const { token, expiresIn } = createArtworkDownloadToken(asset.id, 900);
    const downloadUrl = `/api/customization/artwork/${asset.id}/download?token=${token}`;

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      url: downloadUrl,
      expiresIn,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to sign artwork download link.',
      },
      { status: 500 }
    );
  }
}
