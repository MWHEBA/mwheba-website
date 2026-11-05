import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trailing slash false per MWHEBA URL standard
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/ar',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Safe HSTS: 30 days without 'includeSubDomains' or 'preload' to avoid breaking unverified agency subdomains (mail, cpanel, etc.)
          { key: 'Strict-Transport-Security', value: 'max-age=2592000' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            // Baseline transitional CSP: retains unsafe-inline & unsafe-eval to accommodate Next.js App Router and Payload Admin scripts
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self';",
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
