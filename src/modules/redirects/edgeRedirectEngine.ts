import rawRules from '../../config/redirects.json';

export type RedirectAction = 'PRESERVE' | 'REDIRECT_301' | 'GONE_410' | 'REQUIRES_REVIEW';

export interface RedirectRule {
  legacyUrl: string;
  sourcePath: string;
  targetUrl: string;
  targetPath: string;
  action: RedirectAction;
  statusCode: number;
  routeType: string;
  notes: string;
}

export interface MatchResult {
  action: RedirectAction | 'PASS';
  statusCode?: number;
  destination?: string;
  rule?: RedirectRule;
}

/**
 * Normalizes a URL path for lookup:
 * - Decodes percent-encoding
 * - Ensures leading slash
 * - Lowercases ASCII paths (while preserving Arabic UTF-8 text casing)
 */
export function normalizePath(path: string): string {
  if (!path) return '/';
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  // Trim spaces and ensure leading slash
  decoded = decoded.trim();
  if (!decoded.startsWith('/')) {
    decoded = '/' + decoded;
  }
  return decoded;
}

/**
 * Pre-indexes redirect rules into an O(1) hash map covering:
 * 1. Normalized decoded path (e.g. "/ar/خدماتنا/تطوير-المواقع/")
 * 2. Raw encoded path (e.g. "/ar/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA%D9%86%D8%A7/...")
 * 3. Both with and without trailing slash where applicable
 */
class RedirectEngine {
  private map: Map<string, RedirectRule> = new Map();
  private allRules: RedirectRule[] = [];

  constructor(rules: RedirectRule[] = rawRules as RedirectRule[]) {
    this.allRules = rules;
    this.initMap(rules);
    this.assertNoChains();
  }

  private initMap(rules: RedirectRule[]) {
    for (const rule of rules) {
      const decodedSource = normalizePath(rule.sourcePath);
      const encodedSource = rule.sourcePath;

      // Index decoded version
      this.map.set(decodedSource, rule);
      // Index raw encoded version
      this.map.set(encodedSource, rule);

      // If source ends with slash, index stripped version too if not root AND not the target destination
      if (decodedSource.length > 1 && decodedSource.endsWith('/')) {
        const strippedDecoded = decodedSource.slice(0, -1);
        const targetClean = rule.targetPath.split('?')[0];
        if (strippedDecoded !== targetClean && !this.map.has(strippedDecoded)) {
          this.map.set(strippedDecoded, rule);
        }
      }

      // Also index by full legacy URL string
      try {
        const fullUrl = new URL(rule.legacyUrl);
        const fullPath = fullUrl.pathname;
        this.map.set(fullPath, rule);
        this.map.set(decodeURIComponent(fullPath), rule);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Verifies that no targetPath redirects again to another rule (Zero Redirect Chains).
   */
  private assertNoChains(): void {
    for (const rule of this.allRules) {
      if (rule.action === 'REDIRECT_301' || rule.action === 'REQUIRES_REVIEW') {
        const targetClean = normalizePath(rule.targetPath.split('?')[0]);
        if (targetClean !== '/' && this.map.has(targetClean)) {
          const secondHop = this.map.get(targetClean);
          if (secondHop && secondHop.action === 'REDIRECT_301' && secondHop.targetPath !== rule.targetPath) {
            console.warn(
              `[RedirectEngine] Warning: Potential redirect chain detected: ${rule.sourcePath} -> ${rule.targetPath} -> ${secondHop.targetPath}`,
            );
          }
        }
      }
    }
  }

  /**
   * Evaluates an incoming pathname and query string, returning the appropriate HTTP routing action.
   */
  public evaluate(pathname: string, searchParams?: string | URLSearchParams): MatchResult {
    // Exclude static assets and internal Next.js system paths
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/admin') ||
      pathname.startsWith('/brand') ||
      pathname === '/favicon.ico'
    ) {
      return { action: 'PASS' };
    }

    const normalized = normalizePath(pathname);

    // Direct rule lookup in hash map
    const rule = this.map.get(normalized) || this.map.get(pathname);

    if (rule) {
      if (rule.action === 'PRESERVE') {
        return {
          action: 'PRESERVE',
          statusCode: 200,
          rule,
        };
      }

      if (rule.action === 'GONE_410') {
        return {
          action: 'GONE_410',
          statusCode: 410,
          rule,
        };
      }

      if (rule.action === 'REDIRECT_301' || rule.action === 'REQUIRES_REVIEW') {
        let destination = rule.targetPath;

        // Preserve and merge incoming query params
        if (searchParams) {
          const incomingSearch =
            typeof searchParams === 'string'
              ? searchParams.replace(/^\?/, '')
              : searchParams.toString();

          if (incomingSearch) {
            const separator = destination.includes('?') ? '&' : '?';
            destination = `${destination}${separator}${incomingSearch}`;
          }
        }

        return {
          action: rule.action,
          statusCode: 301,
          destination,
          rule,
        };
      }
    }

    // Trailing slash normalization: If path is not root and ends with "/", redirect 301 to clean non-trailing-slash URL
    if (pathname.length > 1 && pathname.endsWith('/')) {
      const cleanPath = pathname.slice(0, -1);
      let destination = cleanPath;

      if (searchParams) {
        const incomingSearch =
          typeof searchParams === 'string'
            ? searchParams.replace(/^\?/, '')
            : searchParams.toString();
        if (incomingSearch) {
          destination = `${destination}?${incomingSearch}`;
        }
      }

      return {
        action: 'REDIRECT_301',
        statusCode: 301,
        destination,
      };
    }

    // No matching redirect rule -> PASS to Next.js page handlers
    return { action: 'PASS' };
  }

  public getAllRules(): RedirectRule[] {
    return this.allRules;
  }
}

export const edgeRedirectEngine = new RedirectEngine();
