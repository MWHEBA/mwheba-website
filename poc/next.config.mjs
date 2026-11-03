import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Trailing slash false per MWHEBA URL standard
  trailingSlash: false,
};

export default withPayload(nextConfig);
