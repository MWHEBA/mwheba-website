import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import configPromise from '@/payload.config';

/**
 * Shared HTTP wrapper for payment endpoints: resolves the authenticated user from the
 * session (never from the request body) and maps service errors ("CODE: message" + statusCode) to JSON.
 */
export async function handlePaymentRequest(
  req: NextRequest,
  run: (ctx: { payload: any; user: any; body: any }) => Promise<unknown>
) {
  try {
    const payload = await getPayload({ config: configPromise });
    let user: any = null;
    try {
      const auth = await payload.auth({ headers: req.headers });
      user = auth?.user ?? null;
    } catch {
      user = null;
    }

    let body: any = {};
    const rawBody = await req.text();
    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { success: false, error: 'INVALID_JSON: Malformed JSON payload.' },
          { status: 400 }
        );
      }
    }

    const result = await run({ payload, user, body });
    return NextResponse.json({ success: true, ...(result as object) });
  } catch (error: any) {
    const statusCode = typeof error?.statusCode === 'number' ? error.statusCode : 400;
    return NextResponse.json(
      { success: false, error: error?.message || 'PAYMENT_OPERATION_FAILED' },
      { status: statusCode }
    );
  }
}
