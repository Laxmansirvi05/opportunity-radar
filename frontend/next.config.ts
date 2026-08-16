import type { NextConfig } from "next";

// SEC-02: 'unsafe-eval' was set unconditionally, in both dev and production.
// Per Next.js's own CSP guide (node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md): "unsafe-eval is not required for production.
// Neither React nor Next.js use eval in production by default" — it's only
// needed in dev, for React's server-error-stack reconstruction. Dropped for
// production; kept for dev so local debugging is unaffected. 'wasm-unsafe-
// eval' is added instead, since the Resume Builder's layout engine
// (yoga-layout) instantiates WebAssembly, which needs its own, narrower
// grant — not the general eval() one being removed. A full nonce-based
// rewrite (removing 'unsafe-inline' too) would force every route into
// dynamic rendering — a real architectural change with its own caching
// tradeoffs — and is deliberately not attempted in this pass.
// https://www.gstatic.com on connect-src, and worker-src below: the Spline
// runtime (floating robot) fetches Google's DRACO mesh-decoder (.js +
// .wasm) from there at scene-load time regardless of where the
// .splinecode file itself is served from, then runs it inside a Web
// Worker created from a blob: URL. Confirmed live, in order: first
// connect-src blocked the decoder fetch outright ("Failed to fetch");
// fixing that surfaced a second, independent block — with no worker-src
// directive, CSP falls back to script-src for worker creation, which has
// no blob: source, so "Creating a worker from 'blob:...' violates...
// script-src" fired next. Both layers caught by RobotErrorBoundary, so
// the page degraded to the plain fallback icon rather than breaking —
// but the real 3D asset never rendered until both were fixed.
const isDev = process.env.NODE_ENV === "development";
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://fonts.googleapis.com https://fonts.gstatic.com https://www.gstatic.com wss://*.supabase.co wss://*.livekit.cloud https://*.livekit.cloud;
  worker-src 'self' blob:;
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
