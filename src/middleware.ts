import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { edgeRedirectEngine } from './modules/redirects/edgeRedirectEngine';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const evaluation = edgeRedirectEngine.evaluate(pathname, search);

  if (evaluation.action === 'GONE_410') {
    return new NextResponse('410 Gone: This legacy resource has been permanently decommissioned.', {
      status: 410,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  if (
    (evaluation.action === 'REDIRECT_301' || evaluation.action === 'REQUIRES_REVIEW') &&
    evaluation.destination
  ) {
    const redirectUrl = new URL(evaluation.destination, request.url);
    const response = NextResponse.redirect(redirectUrl, 301);
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return response;
  }

  return NextResponse.next();
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
