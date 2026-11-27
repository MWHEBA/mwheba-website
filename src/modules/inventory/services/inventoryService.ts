import { sql, type PostgresAdapter } from '@payloadcms/db-postgres';
import { APIError, type Payload, type PayloadRequest } from 'payload';
import { hasRole } from '@/modules/identity/access/roles';

export const inventoryQuantityLimit = 2_147_483_647;

type InventoryDb = PostgresAdapter['drizzle'];
type InventoryTargetType = 'product' | 'variant';
type InventoryMovementKind = 'opening' | 'adjustment' | 'allocation' | 'cancellation' | 'return';

interface InventoryLine {
  productId: number;
  variantId?: number;
  productTitle: string;
  variantTitle?: string;
  sku?: string;
  quantity: number;
  itemType: 'physical' | 'service';
  productType: 'physical' | 'fixed_service';
  availabilityError?: string;
}

export interface InventoryIssue {
  code: 'INVENTORY_UNINITIALIZED' | 'INSUFFICIENT_STOCK' | 'INVALID_QUANTITY';
  requested: number;
  available: number | null;
}

export function inventoryIssueMessage(issue: InventoryIssue, label: string) {
  if (issue.code === 'INVALID_QUANTITY') return `${issue.code}: Enter a valid whole quantity for ${label}.`;
  if (!issue.available || issue.code === 'INVENTORY_UNINITIALIZED') {
    return `${issue.code}: ${label} is currently unavailable. Remove it from the cart or select another option.`;
  }
  return `${issue.code}: Only ${issue.available} units of ${label} are available. Reduce the cart quantity.`;
}

export async function getInventoryTransaction(payload: Payload, req: Partial<PayloadRequest>) {
  const transactionID = await req.transactionID;
  const db = payload.db as Pick<PostgresAdapter, 'sessions'>;
  const transaction = transactionID == null ? undefined : db.sessions?.[transactionID]?.db;
  if (!transaction || typeof transaction.execute !== 'function') {
    throw new APIError('INVENTORY_TRANSACTION_REQUIRED: An active PostgreSQL transaction is required.', 500);
  }
  // The pinned adapter types sessions for PostgreSQL and SQLite. This app uses PostgreSQL.
  return transaction as unknown as InventoryDb;
}

function inventoryDb(payload: Payload) {
  const db = payload.db.primaryDrizzle ?? payload.db.drizzle;
  if (!db || typeof db.execute !== 'function') {
    throw new APIError('INVENTORY_DATABASE_UNAVAILABLE: PostgreSQL inventory is unavailable.', 500);
  }
  return db as InventoryDb;
}

function stockTarget(line: InventoryLine) {
  const targetType: InventoryTargetType = line.variantId === undefined ? 'product' : 'variant';
  const targetId = line.variantId ?? line.productId;
  return { targetType, targetId, key: `${targetType}:${targetId}` };
}

function stockLabel(line: InventoryLine) {
  return line.variantTitle ? `${line.productTitle} (${line.variantTitle})` : line.productTitle;
}

function stockDemand(lines: readonly InventoryLine[]) {
  const requests = new Map<string, ReturnType<typeof stockTarget> & { quantity: number; sku: string | undefined; label: string }>();
  for (const line of lines) {
    if (line.availabilityError || line.itemType === 'service' || line.productType === 'fixed_service') continue;
    const target = stockTarget(line);
    const existing = requests.get(target.key);
    if (existing) {
      existing.quantity = Number.isInteger(line.quantity) && line.quantity > 0
        ? existing.quantity + line.quantity : NaN;
    } else {
      requests.set(target.key, {
        ...target, quantity: line.quantity > 0 ? line.quantity : NaN,
        sku: line.sku, label: stockLabel(line),
      });
    }
  }
  return [...requests.values()].sort((left, right) =>
    (left.targetType === right.targetType ? left.targetId - right.targetId : left.targetType === 'product' ? -1 : 1),
  );
}

function stockIssue(quantity: number, available: number | null): InventoryIssue | undefined {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > inventoryQuantityLimit) {
    return { code: 'INVALID_QUANTITY', requested: 0, available };
  }
  if (available == null) return { code: 'INVENTORY_UNINITIALIZED', requested: quantity, available };
  if (available < quantity) return { code: 'INSUFFICIENT_STOCK', requested: quantity, available };
}

export async function checkInventoryAvailability<T extends InventoryLine>(
  payload: Payload,
  lines: readonly T[],
  req?: Partial<PayloadRequest>,
): Promise<(T & { stockIssue?: InventoryIssue })[]> {
  const demand = stockDemand(lines);
  if (demand.length === 0) return [...lines];

  const skuTargets = demand.filter((entry) => entry.sku);
  const balances = new Map<string, number>();
  if (skuTargets.length > 0) {
    const db = req ? await getInventoryTransaction(payload, req) : inventoryDb(payload);
    const values = sql.join(skuTargets.map(({ targetType, targetId, sku }) =>
      sql`(${targetType}::text, ${targetId}::integer, ${sku}::text)`), sql`, `);
    const { rows } = await db.execute<{ target_type: InventoryTargetType; target_id: number; available: number }>(sql`
      SELECT balance.target_type, balance.target_id, balance.available
      FROM (VALUES ${values}) AS wanted(target_type, target_id, sku)
      JOIN inventory_balances AS balance ON (balance.target_type, balance.target_id) = (wanted.target_type, wanted.target_id)
      JOIN catalog_sku_claims AS claim ON claim.sku = lower(wanted.sku)
        AND claim.record_id = wanted.target_id
        AND claim.collection = CASE WHEN wanted.target_type = 'product' THEN 'products' ELSE 'variants' END
    `);
    for (const row of rows) balances.set(`${row.target_type}:${row.target_id}`, row.available);
  }

  const issues = new Map(demand.map(({ key, quantity }) => [key, stockIssue(quantity, balances.get(key) ?? null)]));
  return lines.map((line) => {
    if (line.availabilityError || line.itemType === 'service' || line.productType === 'fixed_service') return line;
    const issue = issues.get(stockTarget(line).key);
    return issue ? { ...line, stockIssue: issue } : line;
  });
}

interface InventoryMovementInput {
  balanceId: number;
  sku: string;
  operationKey: string;
  kind: InventoryMovementKind;
  quantity: number;
  reason: string;
  actorId?: number | null;
  orderId?: number | null;
}

/** Requires the caller to enforce operation eligibility and idempotency in the same transaction. */
export async function applyInventoryMovement(tx: InventoryDb, input: InventoryMovementInput) {
  const { rows: [movement] } = await tx.execute<{ id: number; available: number; created_at: Date }>(sql`
    WITH changed AS (
      UPDATE inventory_balances
      SET available = (available::bigint + ${input.quantity}::bigint)::integer
      WHERE id = ${input.balanceId}
        AND available::bigint + ${input.quantity}::bigint BETWEEN 0 AND ${inventoryQuantityLimit}
      RETURNING available
    ), recorded AS (
      INSERT INTO inventory_movements (balance_id, sku, operation_key, kind, quantity, reason, actor_id, order_id)
      SELECT ${input.balanceId}, ${input.sku}, ${input.operationKey}, ${input.kind}, ${input.quantity},
        ${input.reason}, ${input.actorId ?? null}, ${input.orderId ?? null}
      FROM changed
      RETURNING id, created_at
    )
    SELECT recorded.id, changed.available, recorded.created_at FROM changed CROSS JOIN recorded
  `);
  return movement ?? null;
}

export function inventoryOrderError(issue: InventoryIssue, label: string) {
  return new APIError(inventoryIssueMessage(issue, label), issue.code === 'INVALID_QUANTITY' ? 422 : 409, issue, true);
}

export async function allocateOrderInventory(
  payload: Payload,
  req: Partial<PayloadRequest>,
  orderId: number,
  lines: readonly InventoryLine[],
) {
  const demand = stockDemand(lines);
  if (demand.length === 0) return;
  const tx = await getInventoryTransaction(payload, req);
  for (const { targetType, targetId, sku, quantity, label } of demand) {
    const { rows: [balance] } = await tx.execute<{ id: number; available: number }>(sql`
      SELECT balance.id, balance.available
      FROM inventory_balances AS balance
      JOIN catalog_sku_claims AS claim ON claim.sku = lower(${sku ?? null}) AND claim.record_id = balance.target_id
        AND claim.collection = CASE WHEN balance.target_type = 'product' THEN 'products' ELSE 'variants' END
      WHERE balance.target_type = ${targetType} AND balance.target_id = ${targetId}
      FOR UPDATE OF balance FOR SHARE OF claim
    `);
    const issue = stockIssue(quantity, balance?.available ?? null);
    if (issue) throw inventoryOrderError(issue, label);
    if (!balance || !sku) throw new APIError('INVENTORY_ALLOCATION_FAILED: The SKU or balance changed.', 500);
    const applied = await applyInventoryMovement(tx, {
      balanceId: balance.id, sku, operationKey: `order:${orderId}:allocation`, kind: 'allocation',
      orderId, quantity: -quantity, reason: 'Checkout stock allocation',
    });
    if (!applied) throw new APIError('INVENTORY_ALLOCATION_FAILED: The guarded allocation failed.', 500);
  }
}

type InventoryActor = { id: number; roles?: unknown } | null | undefined;

type InventoryTarget = {
  targetType: InventoryTargetType;
  targetId: number;
  sku: string;
};

const validInventoryId = (id: number) => Number.isInteger(id) && id > 0 && id <= inventoryQuantityLimit;

function requireInventoryActor(actor: InventoryActor, canWrite: boolean) {
  if (!actor || !validInventoryId(actor.id)) throw new APIError('UNAUTHENTICATED: Sign in to manage inventory.', 401);
  if (!hasRole(actor, canWrite ? ['super_admin', 'operations'] : ['super_admin', 'operations', 'catalog_manager'])) {
    throw new APIError('FORBIDDEN_INVENTORY_ACCESS: This account lacks inventory access.', 403);
  }
  return actor;
}

function trimmedInventoryText(value: unknown, limit: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= limit && !text.includes('\0') ? text : null;
}

function inventoryText(value: unknown, limit: number, field: string) {
  const text = trimmedInventoryText(value, limit);
  if (!text) throw new APIError(`INVALID_INVENTORY_INPUT: Supply ${field} within ${limit} characters.`, 422);
  return text;
}

const inventoryTargets = sql`
  SELECT claim.sku AS sku_key, CASE WHEN claim.collection = 'products' THEN 'product' ELSE 'variant' END AS "targetType",
    claim.record_id AS "targetId", COALESCE(variant.sku, product.sku) AS sku
  FROM catalog_sku_claims AS claim
  LEFT JOIN variants AS variant ON claim.collection = 'variants' AND variant.id = claim.record_id
  JOIN products AS product ON product.id = CASE WHEN claim.collection = 'products' THEN claim.record_id ELSE variant.product_id END
  WHERE product.deleted_at IS NULL
    AND product.product_type IS DISTINCT FROM 'fixed_service' AND product.item_type IS DISTINCT FROM 'service'
    AND ((claim.collection = 'products' AND product.enable_variants IS NOT TRUE)
      OR (claim.collection = 'variants' AND variant.deleted_at IS NULL AND product.enable_variants IS TRUE))
`;

async function findInventoryTarget(db: InventoryDb, sku: string, lockClaim = false) {
  const { rows: [target] } = await db.execute<InventoryTarget & { sku_key: string }>(sql`
    ${inventoryTargets} AND claim.sku = lower(${sku})
    ${lockClaim ? sql`FOR SHARE OF claim` : sql.empty()}
  `);
  if (!target) throw new APIError('INVENTORY_SKU_NOT_FOUND: Use a physical simple-product or variant SKU.', 404);
  return { sku: target.sku, targetType: target.targetType, targetId: target.targetId };
}

/** Classifies a proposed opening sheet using the same live SKU ownership rules as a stock adjustment. */
export async function previewInventoryOpening(payload: Payload, input: { actor: InventoryActor; rows: unknown }) {
  requireInventoryActor(input.actor, true);
  if (!Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > 500) {
    throw new APIError('INVALID_INVENTORY_INPUT: Supply 1 to 500 opening rows.', 422);
  }
  const candidates = input.rows.map((row: unknown, index) => {
    const record = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    const sku = trimmedInventoryText(record.sku, 128);
    const quantity = record.quantity;
    return { index, sku, quantity: typeof quantity === 'number' && Number.isInteger(quantity)
      && quantity >= 0 && quantity <= inventoryQuantityLimit ? quantity : null };
  });
  const keys = candidates.filter((row) => row.sku);
  const matches = new Map<number, { sku: string | null; available: number | null; duplicate: boolean }>();
  if (keys.length > 0) {
    const values = sql.join(keys.map(({ index, sku }) => sql`(${index}::integer, lower(${sku}))`), sql`, `);
    const { rows } = await inventoryDb(payload).execute<{ index: number; sku: string | null; available: number | null; duplicate: boolean }>(sql`
      WITH wanted AS (
        SELECT source.row_index, source.sku_key, count(*) OVER (PARTITION BY source.sku_key) > 1 AS duplicate
        FROM (VALUES ${values}) AS source(row_index, sku_key)
      )
      SELECT wanted.row_index AS index, wanted.duplicate, target.sku, balance.available
      FROM wanted
      LEFT JOIN (${inventoryTargets}) AS target ON target.sku_key = wanted.sku_key
      LEFT JOIN inventory_balances AS balance ON (balance.target_type, balance.target_id) = (target."targetType", target."targetId")
    `);
    for (const row of rows) matches.set(row.index, row);
  }
  return candidates.map(({ index, sku, quantity }) => {
    const match = matches.get(index);
    if (!sku || quantity == null) return { index, sku, quantity, status: 'invalid' } as const;
    if (match?.duplicate) return { index, sku, quantity, status: 'duplicate' } as const;
    if (!match?.sku) return { index, sku, quantity, status: 'unresolved' } as const;
    if (match.available != null) return { index, sku: match.sku, quantity, available: match.available, status: 'initialized' } as const;
    return { index, sku: match.sku, quantity, status: 'matched' } as const;
  });
}

interface InventoryMovementRow extends Record<string, unknown> {
  id: number;
  sku: string;
  kind: InventoryMovementKind;
  quantity: number;
  reason: string;
  actor_id: number | null;
  order_id: number | null;
  created_at: Date;
  operation_key: string;
}

export async function getInventoryStock(payload: Payload, input: { actor: InventoryActor; sku: unknown; before?: number }) {
  requireInventoryActor(input.actor, false);
  const db = inventoryDb(payload);
  const target = await findInventoryTarget(db, inventoryText(input.sku, 128, 'a SKU'));
  if (input.before !== undefined && !validInventoryId(input.before)) {
    throw new APIError('INVALID_INVENTORY_INPUT: Supply a valid movement cursor.', 422);
  }
  const { rows: [balance] } = await db.execute<{ id: number; available: number }>(sql`
    SELECT id, available FROM inventory_balances WHERE (target_type, target_id) = (${target.targetType}, ${target.targetId})
  `);
  if (!balance) return { ...target, available: null, movements: [], nextBefore: null };

  const limit = 30;
  const { rows } = await db.execute<InventoryMovementRow>(sql`
    SELECT id, sku, kind, quantity, reason, actor_id, order_id, created_at, operation_key
    FROM inventory_movements WHERE balance_id = ${balance.id}
    ${input.before === undefined ? sql.empty() : sql`AND id < ${input.before}`}
    ORDER BY id DESC LIMIT ${limit + 1}
  `);
  const movements = rows.slice(0, limit);
  return { ...target, available: balance.available, movements, nextBefore: rows.length > limit ? movements.at(-1)?.id ?? null : null };
}

interface AdjustInventoryInput {
  actor: InventoryActor;
  sku: unknown;
  kind: unknown;
  operationKey: unknown;
  quantity: unknown;
  reason: unknown;
}

export async function adjustInventoryStock(payload: Payload, input: AdjustInventoryInput) {
  const actor = requireInventoryActor(input.actor, true);
  const sku = inventoryText(input.sku, 128, 'a SKU');
  const reason = inventoryText(input.reason, 500, 'a reason');
  const operationKey = `staff:${inventoryText(input.operationKey, 128, 'an operation key')}`;
  const { kind, quantity } = input;
  if ((kind !== 'opening' && kind !== 'adjustment') || typeof quantity !== 'number'
    || !Number.isInteger(quantity) || Math.abs(quantity) > inventoryQuantityLimit
    || (kind === 'opening' ? quantity < 0 : quantity === 0)) {
    throw new APIError('INVALID_INVENTORY_INPUT: Use a nonnegative whole opening quantity or a nonzero whole adjustment.', 422);
  }

  const transactionID = await payload.db.beginTransaction();
  if (!transactionID) throw new APIError('INVENTORY_TRANSACTION_REQUIRED: An active PostgreSQL transaction is required.', 500);
  try {
    const tx = await getInventoryTransaction(payload, { transactionID });
    const target = await findInventoryTarget(tx, sku, true);
    const targetValues = sql`(${target.targetType}, ${target.targetId})`;
    if (kind === 'opening') {
      await tx.execute(sql`
        INSERT INTO inventory_balances (target_type, target_id, available)
        VALUES (${target.targetType}, ${target.targetId}, 0)
        ON CONFLICT (target_type, target_id) DO NOTHING
      `);
    }
    const { rows: [balance] } = await tx.execute<{ id: number; available: number }>(sql`
      SELECT id, available FROM inventory_balances WHERE (target_type, target_id) = ${targetValues} FOR UPDATE
    `);
    if (!balance) throw new APIError('INVENTORY_UNINITIALIZED: Record the opening quantity first.', 409);

    const { rows: [prior] } = await tx.execute<InventoryMovementRow>(sql`
      SELECT id, kind, quantity, reason, actor_id, created_at FROM inventory_movements
      WHERE balance_id = ${balance.id} AND operation_key = ${operationKey}
    `);
    let applied: Awaited<ReturnType<typeof applyInventoryMovement>>;
    if (prior) {
      if (prior.kind !== kind || prior.quantity !== quantity || prior.reason !== reason || prior.actor_id !== actor.id) {
        throw new APIError('INVENTORY_OPERATION_CONFLICT: This operation key belongs to a different adjustment.', 409);
      }
      applied = { id: prior.id, available: balance.available, created_at: prior.created_at };
    } else {
      if (kind === 'opening') {
        const { rows } = await tx.execute(sql`SELECT 1 FROM inventory_movements WHERE balance_id = ${balance.id} AND kind = 'opening'`);
        if (rows.length > 0) throw new APIError('INVENTORY_ALREADY_OPEN: A stock balance exists. Record an adjustment.', 409);
      }
      applied = await applyInventoryMovement(tx, {
        balanceId: balance.id, sku: target.sku, operationKey, kind, quantity, reason, actorId: actor.id,
      });
      if (!applied) throw new APIError('INVENTORY_QUANTITY_OUT_OF_RANGE: The resulting available quantity is invalid.', 409);
    }

    await payload.db.commitTransaction(transactionID).catch(() => undefined);
    const { rows: [saved] } = await inventoryDb(payload).execute<{ id: number; available: number }>(sql`
      SELECT movement.id, balance.available FROM inventory_movements AS movement
      JOIN inventory_balances AS balance ON balance.id = movement.balance_id
      WHERE movement.id = ${applied.id} AND movement.balance_id = ${balance.id}
    `);
    if (!saved) throw new APIError('INVENTORY_COMMIT_UNCONFIRMED: Retry this adjustment with the same operation key.', 503);
    return { ...target, available: saved.available, movementId: saved.id, isIdempotentReplay: Boolean(prior) };
  } catch (error) {
    await payload.db.rollbackTransaction(transactionID).catch(() => undefined);
    throw error;
  }
}
