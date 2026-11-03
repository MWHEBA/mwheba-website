/**
 * Utility for generating and maintaining deterministic operation keys for client-to-server cart mutations.
 *
 * CRITICAL IDEMPOTENCY INVARIANT:
 * An operation key MUST be generated on the client/caller BEFORE dispatching the network request.
 * If the network drops, times out, or fails with a retryable network error,
 * the client MUST reuse the exact same operationKey on retry.
 * The server records applied keys in `carts.applied_operations` to guarantee exactly-once mutation semantics.
 */

export function generateOperationKey(prefix: 'add' | 'update' | 'remove' | 'clear' | 'cart_op' = 'cart_op'): string {
  const timestamp = Date.now();
  const randomEntropy = Math.random().toString(36).slice(2, 10);
  return `op_${prefix}_${timestamp}_${randomEntropy}`;
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  retryOn?: (error: any) => boolean;
}

/**
 * Executes a client mutation with automated retry upon network interruptions,
 * strictly reusing the same operation key across attempts so the server never duplicates the operation.
 * Can be passed an existing operation key or a prefix to generate a new key.
 */
export async function executeWithOperationRetry<T>(
  action: (operationKey: string) => Promise<T>,
  keyOrPrefix: 'add' | 'update' | 'remove' | 'clear' | 'cart_op' | string = 'cart_op',
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 50;
  const operationKey =
    typeof keyOrPrefix === 'string' && keyOrPrefix.startsWith('op_')
      ? keyOrPrefix
      : generateOperationKey(keyOrPrefix as any);

  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action(operationKey);
    } catch (err: any) {
      lastError = err;
      const isRetryable =
        options.retryOn ? options.retryOn(err) :
        err.message?.includes('fetch failed') ||
        err.message?.includes('ECONNRESET') ||
        err.message?.includes('ETIMEDOUT') ||
        err.message?.includes('NetworkError') ||
        err.name === 'TypeError'; // fetch failure in browser

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, initialDelayMs * Math.pow(2, attempt - 1)));
    }
  }

  throw lastError;
}
