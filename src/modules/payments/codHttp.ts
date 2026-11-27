import { getPayload, type Payload } from 'payload';
import { sameAccountOrigin } from '@/modules/identity/services/customerMail';
import { OrderLifecycleError } from '@/modules/orders/services/orderLifecycle';
import type { User } from '@/payload-types';
import config from '@/payload.config';
import { CodSettlementError } from './services/codSettlementService';

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function reject(code: string, error: string, status: number) {
  return respond({ success: false, code, error }, status);
}

export async function handleCodRequest(
  req: Request,
  run: (payload: Payload, user: User, body: Record<string, unknown>) => Promise<object>,
) {
  if (req.method === 'POST' && !sameAccountOrigin(req)) {
    return reject('FORBIDDEN_ORIGIN', 'This origin cannot submit a cash settlement.', 403);
  }
  const payload = await getPayload({ config });
  try {
    const { user } = await payload.auth({ headers: req.headers }).catch(() => ({ user: null }));
    if (!user || user.collection !== 'users') {
      return reject('AUTHENTICATION_REQUIRED', 'Sign in to process COD payments.', 401);
    }
    let body = {};
    if (req.method === 'POST') {
      const parsed: unknown = await req.json().catch(() => null);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return reject('INVALID_JSON', 'Submit a JSON object.', 400);
      }
      body = parsed;
    }
    return respond({ success: true, ...await run(payload, user, body) });
  } catch (error) {
    if (error instanceof CodSettlementError || error instanceof OrderLifecycleError) {
      return reject(error.code, error.message, error.statusCode);
    }
    payload.logger.error({ err: error, msg: 'COD request failed.' });
    return reject('COD_REQUEST_FAILED', 'The cash settlement request could not be processed.', 500);
  }
}
