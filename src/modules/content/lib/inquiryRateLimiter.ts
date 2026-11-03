import type { Payload } from 'payload';
import { sql } from '@payloadcms/db-postgres';
import { logger } from '../../../shared/lib/logger';

/**
 * Persistent, Atomic Rate Limiter for Inquiries backed by PostgreSQL.
 * Fully eliminates TOCTOU race conditions under high concurrency and
 * persists across application restarts and multiple worker processes.
 * Default: 5 submissions per 10 minutes per IP address.
 */

export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_INQUIRIES_PER_WINDOW = 5;

// In-memory map for unit test helpers
const localFallbackMap = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
  currentCount: number;
  error?: 'RATE_LIMIT_STORE_UNAVAILABLE' | string;
}

/**
 * Atomically checks and records an attempt in PostgreSQL.
 * Serializes concurrent requests per IP hash using PostgreSQL transaction-level
 * advisory locks. If the database store fails, it fails closed (allowed: false)
 * with an explicit error status, preventing silent multi-process rate limit bypasses.
 */
export async function checkRateLimitPersistent(
  payload: Payload,
  ip: string
): Promise<RateLimitCheckResult> {
  try {
    const drizzle = (payload.db as any)?.drizzle;
    if (!drizzle) {
      logger.error('Persistent rate limit check failed: missing database instance', { ip });
      return {
        allowed: false,
        remaining: 0,
        currentCount: MAX_INQUIRIES_PER_WINDOW,
        retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        error: 'RATE_LIMIT_STORE_UNAVAILABLE',
      };
    }

    const result = await drizzle.transaction(async (tx: any) => {
      // Advisory transaction-level lock per IP hash serializes concurrent requests
      // for the same IP while allowing different IPs to execute in parallel
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ip}))`);

      const countRes = await tx.execute(sql`
        SELECT count(*)::int AS count
        FROM "rate_limit_events"
        WHERE "key" = ${ip} AND "created_at" > now() - interval '10 minutes';
      `);

      const rawCount = countRes.rows?.[0]?.count ?? countRes[0]?.count ?? 0;
      const currentCount = Number(rawCount);

      if (currentCount >= MAX_INQUIRIES_PER_WINDOW) {
        return {
          allowed: false,
          remaining: 0,
          currentCount: currentCount + 1,
          retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
        };
      }

      await tx.execute(sql`
        INSERT INTO "rate_limit_events" ("key", "created_at", "updated_at")
        VALUES (${ip}, now(), now());
      `);

      return {
        allowed: true,
        remaining: Math.max(0, MAX_INQUIRIES_PER_WINDOW - (currentCount + 1)),
        currentCount: currentCount + 1,
      };
    });

    return result;
  } catch (err) {
    logger.error('Persistent rate limit check failed: database store error', {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      allowed: false,
      remaining: 0,
      currentCount: MAX_INQUIRIES_PER_WINDOW,
      retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      error: 'RATE_LIMIT_STORE_UNAVAILABLE',
    };
  }
}

/**
 * In-memory rate limiter helper (used as fallback or for synchronous unit checks)
 */
export function checkRateLimitInMemory(ip: string): RateLimitCheckResult {
  const now = Date.now();
  const record = localFallbackMap.get(ip);

  if (!record || now > record.resetAt) {
    localFallbackMap.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, remaining: MAX_INQUIRIES_PER_WINDOW - 1, currentCount: 1 };
  }

  if (record.count >= MAX_INQUIRIES_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds, currentCount: record.count };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: MAX_INQUIRIES_PER_WINDOW - record.count,
    currentCount: record.count,
  };
}

export function resetLocalRateLimitsForTesting(): void {
  localFallbackMap.clear();
}
