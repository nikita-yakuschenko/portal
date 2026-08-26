/** @type {import('next').NextConfig} */
const apiOrigin = process.env.API_BASE_URL ?? "http://localhost:4000";

const nextConfig = {
  transpilePackages: ["@b2b/domain", "@b2b/site-schema"],
  eslint: {
    // ESLint в root workspace; в Docker-образе portal его нет — типы проверяет tsc в build
    ignoreDuringBuilds: true
  },
  // Браузер ходит на тот же origin — без CORS и без cookie на :4000
  async redirects() {
    return [
      {
        source: "/partner/site/preview/projects",
        destination: "/partner/site/preview/catalog",
        permanent: true
      },
      {
        source: "/partner/site/preview/projects/:slug",
        destination: "/partner/site/preview/catalog/:slug",
        permanent: true
      }
    ];
  },
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${apiOrigin}/api/auth/:path*` },
      { source: "/api/partner/:path*", destination: `${apiOrigin}/api/partner/:path*` },
      { source: "/api/company/:path*", destination: `${apiOrigin}/api/company/:path*` },
      { source: "/api/public/:path*", destination: `${apiOrigin}/api/public/:path*` },
      { source: "/api/uploads", destination: `${apiOrigin}/api/uploads` },
      { source: "/api/messenger", destination: `${apiOrigin}/api/messenger` },
      { source: "/api/messenger/:path*", destination: `${apiOrigin}/api/messenger/:path*` },
      // in-app уведомления (колокольчик + страница)
      { source: "/api/notifications", destination: `${apiOrigin}/api/notifications` },
      {
        source: "/api/notifications/:path*",
        destination: `${apiOrigin}/api/notifications/:path*`
      }
    ];
  }
};

export default nextConfig;
