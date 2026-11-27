import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE inventory_balances (
      id serial PRIMARY KEY,
      target_type text NOT NULL CHECK (target_type IN ('product', 'variant')),
      target_id integer NOT NULL CHECK (target_id > 0),
      available integer NOT NULL CHECK (available >= 0),
      UNIQUE (target_type, target_id)
    );

    CREATE TABLE inventory_movements (
      id serial PRIMARY KEY,
      balance_id integer NOT NULL REFERENCES inventory_balances (id),
      sku varchar(128) NOT NULL CHECK (length(sku) > 0),
      operation_key varchar(384) NOT NULL CHECK (length(operation_key) > 0),
      kind text NOT NULL,
      quantity integer NOT NULL,
      reason varchar(500) NOT NULL CHECK (length(btrim(reason)) > 0),
      actor_id integer CHECK (actor_id > 0),
      order_id integer CHECK (order_id > 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (balance_id, operation_key),
      CHECK (
        (kind = 'opening' AND quantity >= 0 AND order_id IS NULL AND actor_id IS NOT NULL)
        OR (kind = 'adjustment' AND quantity <> 0 AND order_id IS NULL AND actor_id IS NOT NULL)
        OR (kind = 'allocation' AND quantity < 0 AND order_id IS NOT NULL)
        OR (kind IN ('cancellation', 'return') AND quantity > 0 AND order_id IS NOT NULL AND actor_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX inventory_movements_opening_idx ON inventory_movements (balance_id) WHERE kind = 'opening';
    CREATE UNIQUE INDEX inventory_movements_allocation_idx ON inventory_movements (order_id, balance_id) WHERE kind = 'allocation';
    CREATE INDEX inventory_movements_order_idx ON inventory_movements (order_id, id) WHERE order_id IS NOT NULL;
    CREATE INDEX inventory_movements_balance_history_idx ON inventory_movements (balance_id, id DESC);
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE inventory_movements;
    DROP TABLE inventory_balances;
  `);
}
