// Øyvinds nyhetsbrev kjører på app-serveren hos Hetzner bak Caddy, på
// https://newsletter.zoney.no. Bygges som «standalone» (én node-prosess, se
// husken/workshop/apper/). Samme sikkerhetsheadere som de andre appene der.

const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "connect-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: CSP },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
      ],
    },
  ],
};
