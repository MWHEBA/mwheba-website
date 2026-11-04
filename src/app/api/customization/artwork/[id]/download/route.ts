import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import {
  verifyArtworkDownloadToken,
  resolveArtworkPath,
} from '@/modules/customization/lib/privateStorage';

/**
 * GET /api/customization/artwork/:id/download?token=...
 * Serves private artwork files with strict HMAC cryptographic validation.
 * Unauthenticated requests without a valid token receive HTTP 403 Forbidden.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        {
          error: 'TOKEN_REQUIRED',
          message: 'A signed cryptographic download token is required to access private artwork files.',
        },
        { status: 403 }
      );
    }

    if (!id || !verifyArtworkDownloadToken(token, id)) {
      return NextResponse.json(
        {
          error: 'INVALID_OR_EXPIRED_TOKEN',
          message: 'The download link is invalid, corrupted, or has expired.',
        },
        { status: 403 }
      );
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
      return NextResponse.json({ error: 'ASSET_NOT_FOUND', message: 'Asset not found.' }, { status: 404 });
    }

    if (!asset || !asset.storageKey) {
      return NextResponse.json({ error: 'ASSET_NOT_FOUND', message: 'Asset not found.' }, { status: 404 });
    }

    let filePath: string;
    try {
      filePath = resolveArtworkPath(asset.storageKey);
    } catch (err: any) {
      return NextResponse.json({ error: 'INVALID_STORAGE_PATH', message: err.message }, { status: 400 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(filePath);
    } catch {
      return NextResponse.json(
        {
          error: 'FILE_NOT_FOUND_ON_DISK',
          message: 'The requested artwork file was not found in storage.',
        },
        { status: 404 }
      );
    }

    const safeFilename = (asset.originalFilename || 'artwork.dat').replace(/["\\]/g, '_');

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to download artwork file.',
      },
      { status: 500 }
    );
  }
}
