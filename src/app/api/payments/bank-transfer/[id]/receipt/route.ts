import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';
import { hasRole } from '@/modules/identity/access/roles';
import { resolveArtworkPath } from '@/modules/customization/lib/privateStorage';

/**
 * GET /api/payments/bank-transfer/:id/receipt
 * Secure, authorized receipt document viewer for finance officers and order owners.
 *
 * Authorization rules:
 * - Unauthenticated visitors: 401 UNAUTHORIZED
 * - Authorized roles ('finance', 'super_admin'): 200 OK (can inspect any receipt)
 * - Order owner (customer who placed the order linked to this transfer): 200 OK
 * - Other customers / unauthorized staff: 403 FORBIDDEN
 * - Non-existent transfer or missing receipt: 404 NOT FOUND
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'MISSING_ID', message: 'Bank transfer ID is required.' },
        { status: 400 }
      );
    }

    const payload = await getPayload({ config: configPromise });

    // 1. Authenticate caller
    let authUser: any = null;
    try {
      const authResult = await payload.auth({ headers: req.headers });
      authUser = authResult?.user || null;
    } catch {
      authUser = null;
    }

    if (!authUser) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required to inspect bank deposit receipts.' },
        { status: 401 }
      );
    }

    // 2. Fetch the bank transfer record
    let transfer: any;
    try {
      transfer = await payload.findByID({
        collection: 'bank-transfers' as any,
        id,
        depth: 1,
      });
    } catch {
      return NextResponse.json(
        { error: 'TRANSFER_NOT_FOUND', message: `Bank transfer #${id} does not exist.` },
        { status: 404 }
      );
    }

    if (!transfer) {
      return NextResponse.json(
        { error: 'TRANSFER_NOT_FOUND', message: `Bank transfer #${id} does not exist.` },
        { status: 404 }
      );
    }

    // 3. Authorization check: finance, super_admin, or order owner
    const isPrivileged = hasRole(authUser, ['super_admin', 'finance']);

    const order = typeof transfer.order === 'object' && transfer.order !== null ? transfer.order : null;
    const orderCustomerId = order?.customer
      ? typeof order.customer === 'object' && order.customer !== null
        ? order.customer.id
        : order.customer
      : null;

    const isOrderOwner = Boolean(orderCustomerId && String(orderCustomerId) === String(authUser.id));

    if (!isPrivileged && !isOrderOwner) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Access denied: You are not authorized to inspect this bank receipt.' },
        { status: 403 }
      );
    }

    // 4. Resolve storage key
    let storageKey = transfer.receiptStorageKey;

    if (!storageKey && transfer.receiptFile) {
      const assetDoc =
        typeof transfer.receiptFile === 'object' && transfer.receiptFile !== null
          ? transfer.receiptFile
          : null;
      if (assetDoc?.storageKey) {
        storageKey = assetDoc.storageKey;
      }
    }

    if (!storageKey) {
      return NextResponse.json(
        { error: 'RECEIPT_NOT_ATTACHED', message: 'No receipt file or storage key is attached to this transfer.' },
        { status: 404 }
      );
    }

    // 5. Resolve absolute filesystem path with path traversal protection
    let filePath: string;
    try {
      filePath = resolveArtworkPath(storageKey);
    } catch (err: any) {
      return NextResponse.json(
        { error: 'INVALID_STORAGE_PATH', message: err?.message || 'Invalid storage path.' },
        { status: 400 }
      );
    }

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'FILE_NOT_FOUND', message: 'The receipt document could not be found on storage.' },
        { status: 404 }
      );
    }

    // 6. Read file and determine MIME type
    const fileBuffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    }

    const safeFilename = path.basename(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${safeFilename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: error?.message || 'Failed to serve receipt.' },
      { status: 500 }
    );
  }
}
