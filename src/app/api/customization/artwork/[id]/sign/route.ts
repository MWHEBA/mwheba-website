import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { CART_COOKIE_NAME, cartRelationId } from '@/modules/cart-checkout/services/cartStorage';
import { applyCartCookie, resolveCartRequest } from '@/modules/cart-checkout/services/cartRequest';
import { hasRole } from '@/modules/identity/access/roles';
import { createArtworkDownloadToken } from '@/modules/customization/lib/privateStorage';
import type { ArtworkAsset } from '@/payload-types';

/**
 * POST /api/customization/artwork/:id/sign
 * Generates an authorized, time-limited (15-min) download URL for private artwork assets.
 * Caller must be:
 * - The owner of the active cart associated with the asset
 * - The authenticated uploader
 * - Staff with super_admin or operations role (finance and creative roles are NOT granted production-file access here)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let guestCookie: Awaited<ReturnType<typeof resolveCartRequest>>['guestCookie'] = null;
  const respond = (body: object, status = 200) =>
    applyCartCookie(NextResponse.json(body, { status }), guestCookie);

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID', message: 'Asset ID is required.' }, { status: 400 });
    }

    const payload = await getPayload({ config: configPromise });

    let asset: ArtworkAsset | null;
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
    try {
      const { user: authUser } = await payload.auth({ headers: req.headers });
      if (authUser) {
        if (hasRole(authUser, ['super_admin', 'operations'])) {
          isAuthorized = true;
        } else if (cartRelationId(asset.uploader) === authUser.id) {
          isAuthorized = true;
        }
      }
    } catch {
      // Guest session check
    }

    // 2. Check the verified active cart if staff and uploader permissions did not apply.
    if (!isAuthorized) {
      const session = await resolveCartRequest(payload, {
        headers: req.headers,
        signedCartCookie: req.cookies.get(CART_COOKIE_NAME)?.value,
      });
      guestCookie = session.guestCookie;
      if (session.cart) {
        // An authenticated request can reassign this pending asset during cart reconciliation.
        const currentAsset = session.user && session.guestCookie === 'clear'
          ? await payload.findByID({ collection: 'artwork-assets', id: asset.id, depth: 0, disableErrors: true })
          : asset;
        isAuthorized = Boolean(currentAsset &&
          String(cartRelationId(currentAsset.cart) ?? currentAsset.ownerSession) === String(session.cart.id));
      }
    }

    if (!isAuthorized) {
      return respond(
        {
          error: 'FORBIDDEN_ARTWORK_ACCESS',
          message: 'You do not have permission to generate download links for this artwork asset.',
        },
        403
      );
    }

    // 3. Generate 15-Minute Signed Download Token
    const { token, expiresIn } = createArtworkDownloadToken(asset.id, 900);
    const downloadUrl = `/api/customization/artwork/${asset.id}/download?token=${token}`;

    return respond({
      success: true,
      assetId: asset.id,
      url: downloadUrl,
      expiresIn,
    });
  } catch (err: any) {
    return respond(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to sign artwork download link.',
      },
      500
    );
  }
}
