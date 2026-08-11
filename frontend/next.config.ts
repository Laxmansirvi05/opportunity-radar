import type { NextConfig } from "next";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://fonts.googleapis.com https://fonts.gstatic.com wss://*.supabase.co wss://*.livekit.cloud https://*.livekit.cloud;
  media-src 'self' blob: data:;
  frame-ancestors 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`;

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pdf-parse'],
  experimental: {
    swcPlugins: [
      ['@lingui/swc-plugin', {}],
    ],
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Google user avatars (recruiter avatars from Supabase profiles)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      // Google favicon service (company logos)
      { protocol: 'https', hostname: 'www.google.com', pathname: '/s2/favicons/**' },
      // Supabase Storage (resume uploads, user-uploaded logos)
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, ''),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // microphone=(self) is required for the AI voice interview:
            // getUserMedia is refused outright while it is disallowed here,
            // and no client-side code can work around that.
            value: 'camera=(), microphone=(self), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
