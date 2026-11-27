import { APIError, type Endpoint, type PayloadRequest } from 'payload';
import { sameAccountOrigin } from '@/modules/identity/services/customerMail';
import { adjustInventoryStock, getInventoryStock, previewInventoryOpening } from '../services/inventoryService';

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function inventoryResponse(error: unknown) {
  if (error instanceof APIError) {
    return respond({ success: false, code: error.message.split(':', 1)[0], error: error.message }, error.status);
  }
  return respond({ success: false, code: 'INVENTORY_REQUEST_FAILED', error: 'Inventory request failed.' }, 500);
}

async function readInventory(req: PayloadRequest) {
  try {
    const url = new URL(req.url ?? '', 'http://localhost');
    const before = url.searchParams.get('before');
    const stock = await getInventoryStock(req.payload, {
      actor: req.user,
      sku: url.searchParams.get('sku'),
      before: before == null ? undefined : Number(before),
    });
    return respond({ success: true, ...stock });
  } catch (error) {
    return inventoryResponse(error);
  }
}

async function readInventoryOperation(req: PayloadRequest) {
  if (!req.url || !sameAccountOrigin(new Request(req.url, { headers: req.headers }))) {
    throw new APIError('FORBIDDEN_ORIGIN: Use a same-origin inventory request.', 403);
  }
  const body: unknown = req.json ? await req.json().catch(() => null) : null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new APIError('INVALID_INVENTORY_INPUT: Provide a JSON stock operation.', 422);
  }
  return body as Record<string, unknown>;
}

async function changeInventory(req: PayloadRequest) {
  try {
    const { sku, kind, quantity, operationKey, reason } = await readInventoryOperation(req);
    const stock = await adjustInventoryStock(req.payload, { actor: req.user, sku, kind, quantity, operationKey, reason });
    return respond({ success: true, ...stock }, stock.isIdempotentReplay ? 200 : 201);
  } catch (error) {
    return inventoryResponse(error);
  }
}

async function previewOpening(req: PayloadRequest) {
  try {
    const { rows } = await readInventoryOperation(req);
    const results = await previewInventoryOpening(req.payload, { actor: req.user, rows });
    return respond({ success: true, results });
  } catch (error) {
    return inventoryResponse(error);
  }
}

export const inventoryEndpoints: Endpoint[] = [
  { path: '/inventory', method: 'get', handler: readInventory },
  { path: '/inventory', method: 'post', handler: changeInventory },
  { path: '/inventory/preview-opening', method: 'post', handler: previewOpening },
];
