/**
 * Secure Client IP Resolution Helper.
 * Defends against IP spoofing (CF-Connecting-IP and X-Forwarded-For) by strictly
 * validating proxy configurations.
 */

export interface ClientIpOptions {
  trustCloudflare?: boolean;
  trustedProxyDepth?: number;
}

export function resolveClientIp(
  headers: Headers,
  options: ClientIpOptions | number = {}
): string {
  const normalizedOptions: ClientIpOptions =
    typeof options === 'number' ? { trustedProxyDepth: options } : options;

  const trustCloudflare =
    normalizedOptions.trustCloudflare !== undefined
      ? normalizedOptions.trustCloudflare
      : process.env.TRUST_CLOUDFLARE_PROXY === 'true';

  const trustedProxyDepth =
    normalizedOptions.trustedProxyDepth !== undefined
      ? normalizedOptions.trustedProxyDepth
      : Number(process.env.TRUSTED_PROXY_DEPTH || 0);

  // 1. Only trust CF-Connecting-IP if explicitly enabled and confirmed behind Cloudflare
  if (trustCloudflare) {
    const cfConnectingIp = headers.get('cf-connecting-ip');
    if (cfConnectingIp && isValidIp(cfConnectingIp.trim())) {
      return cfConnectingIp.trim();
    }
  }

  // 2. Only trust X-Forwarded-For if a reverse proxy depth > 0 is explicitly configured
  if (trustedProxyDepth > 0) {
    const xForwardedFor = headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const rawIps = xForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
      if (rawIps.length > 0) {
        // In reverse proxy chains, the trusted proxy appends the client IP at the end.
        // Selecting from the right based on depth prevents header injection by the client.
        const targetIndex = Math.max(0, rawIps.length - trustedProxyDepth);
        const resolvedIp = rawIps[targetIndex];
        if (isValidIp(resolvedIp)) {
          return resolvedIp;
        }
      }
    }

    const xRealIp = headers.get('x-real-ip');
    if (xRealIp && isValidIp(xRealIp.trim())) {
      return xRealIp.trim();
    }
  }

  // 3. Fallback when untrusted or in local/direct environment
  return '127.0.0.1';
}

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
