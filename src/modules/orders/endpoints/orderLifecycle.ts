import type { PayloadRequest } from 'payload';
import { sameAccountOrigin } from '@/modules/identity/services/customerMail';
import {
  cancelOrderBeforeDispatch,
  getOrderLifecycle,
  OrderLifecycleError,
  receiveOrderReturn,
  recordCodOrderRefusal,
} from '../services/orderLifecycle';

const respond = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function respondError(req: PayloadRequest, error: unknown) {
  if (error instanceof OrderLifecycleError) {
    return respond({ success: false, code: error.code, error: error.message }, error.statusCode);
  }
  req.payload.logger.error({ err: error, msg: 'Unable to process order lifecycle request.' });
  return respond({ success: false, code: 'ORDER_LIFECYCLE_FAILED', error: 'Unable to process the order change.' }, 500);
}

export async function getOrderLifecycleEndpoint(req: PayloadRequest) {
  try {
    return respond({ success: true, ...await getOrderLifecycle(req.payload, req.routeParams?.id, req.user) });
  } catch (error) {
    return respondError(req, error);
  }
}

export async function postOrderLifecycle(req: PayloadRequest) {
  if (!req.url || !sameAccountOrigin(new Request(req.url, { headers: req.headers }))) {
    return respond({ success: false, code: 'FORBIDDEN_ORIGIN' }, 403);
  }
  let body: unknown;
  try {
    body = await req.json?.();
  } catch {
    return respond({ success: false, code: 'INVALID_JSON' }, 400);
  }
  if (!body || typeof body !== 'object' || !('action' in body) || !('reason' in body)) {
    return respond({ success: false, code: 'INVALID_ORDER_ACTION' }, 400);
  }
  const common = { orderId: req.routeParams?.id, actor: req.user };
  try {
    switch (body.action) {
      case 'cancel':
        return respond({ success: true, ...await cancelOrderBeforeDispatch(req.payload, { ...common, reason: body.reason }) });
      case 'refuse':
        return respond({ success: true, ...await recordCodOrderRefusal(req.payload, { ...common, refusalReason: body.reason }) });
      case 'receive_return':
        if (!('receiptReference' in body) || !('lines' in body)) break;
        return respond({
          success: true,
          ...await receiveOrderReturn(req.payload, {
            ...common, reason: body.reason, receiptReference: body.receiptReference, lines: body.lines,
          }),
        });
    }
    return respond({ success: false, code: 'INVALID_ORDER_ACTION' }, 400);
  } catch (error) {
    return respondError(req, error);
  }
}
