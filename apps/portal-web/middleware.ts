import { NextResponse, type NextRequest } from "next/server";

const SITE_MODE = process.env.APP_ROLE === "site" || process.env.NEXT_PUBLIC_APP_ROLE === "site";

/** Публичные URL → страницы превью в portal-web */
function rewritePublicToPreview(pathname: string): string | null {
  if (pathname === "/" || pathname === "") return "/partner/site/preview";
  if (pathname === "/catalog") return "/partner/site/preview/catalog";
  if (pathname.startsWith("/catalog/")) {
    return `/partner/site/preview${pathname}`;
  }
  if (pathname === "/policy") return "/partner/site/preview/policy";
  if (pathname === "/about" || pathname === "/contacts") return "/partner/site/preview";
  return null;
}

export function middleware(request: NextRequest) {
  if (!SITE_MODE) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Favicon по Host партнёра (не общая иконка кабинета)
  if (pathname === "/favicon.ico" || pathname === "/icon.svg") {
    const url = request.nextUrl.clone();
    url.pathname = "/site-branding/icon";
    return NextResponse.rewrite(url);
  }

  // Статика и API пропускаем
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/landing") ||
    pathname.startsWith("/site-branding") ||
    pathname === "/logo.svg" ||
    /\.\w+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Кабинет в site-runtime недоступен
  if (
    pathname.startsWith("/partner") &&
    !pathname.startsWith("/partner/site/preview")
  ) {
    return NextResponse.rewrite(new URL("/partner/site/preview", request.url));
  }
  if (
    pathname.startsWith("/company") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/reset-password")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const target = rewritePublicToPreview(pathname);
  if (target) {
    const url = request.nextUrl.clone();
    url.pathname = target;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
