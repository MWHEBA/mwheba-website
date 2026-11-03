import type { PayloadHandler } from 'payload';
import { processPaymobWebhook } from '../adapters/paymobEngine';

export const paymobWebhookHandler: PayloadHandler = async (req) => {
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;
  if (!hmacSecret) {
    return Response.json(
      { error: 'Server configuration error: PAYMOB_HMAC_SECRET is not configured in environment.' },
      { status: 500 }
    );
  }

  let body: any;
  try {
    if (typeof req.json === 'function') {
      body = await req.json();
    } else {
      body = (req as any).data;
    }
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Paymob passes HMAC as a query param `?hmac=...` or in custom header
  const url = new URL(req.url || '', 'http://localhost');
  const signature = url.searchParams.get('hmac') || req.headers?.get('x-paymob-signature') || '';

  if (!signature) {
    return Response.json({ error: 'Missing HMAC signature in query parameter (?hmac=) or header' }, { status: 401 });
  }

  if (!body || !body.obj) {
    return Response.json({ error: 'Invalid webhook payload structure' }, { status: 400 });
  }

  try {
    const result = await processPaymobWebhook({
      payload: req.payload,
      body,
      signature,
      hmacSecret,
    });

    const isError = result.status === 'REJECTED' || result.status === 'TAMPERED';
    return Response.json(result, { status: isError ? 400 : 200 });
  } catch (err: any) {
    return Response.json({ error: err.message || 'Internal processing error' }, { status: 500 });
  }
};
