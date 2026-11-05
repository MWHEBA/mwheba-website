import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { edgeRedirectEngine } from './modules/redirects/edgeRedirectEngine';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Safe HSTS: 30 days without includeSubDomains or preload to prevent breaking unverified agency subdomains
  'Strict-Transport-Security': 'max-age=2592000',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Baseline transitional CSP accommodating Next.js App Router and Payload Admin
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self';",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(key)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const evaluation = edgeRedirectEngine.evaluate(pathname, search);

  if (evaluation.action === 'GONE_410') {
    const response = new NextResponse('410 Gone: This legacy resource has been permanently decommissioned.', {
      status: 410,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, max-age=86400',
      },
    });
    return applySecurityHeaders(response);
  }

  if (evaluation.action === 'REDIRECT_301' && evaluation.destination) {
    const redirectUrl = new URL(evaluation.destination, request.url);
    const response = NextResponse.redirect(redirectUrl, 301);
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return applySecurityHeaders(response);
  }

  if (evaluation.action === 'REQUIRES_REVIEW' && evaluation.destination) {
    const redirectUrl = new URL(evaluation.destination, request.url);
    const response = NextResponse.redirect(redirectUrl, 302);
    // Strict SEO rule: never permanently cache unreviewed/provisional redirects
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('X-Redirect-Status', 'pending_owner_review');
    return applySecurityHeaders(response);
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
