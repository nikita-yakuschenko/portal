import { NextResponse, type NextRequest } from "next/server";

const SITE_MODE = process.env.APP_ROLE === "site" || process.env.NEXT_PUBLIC_APP_ROLE === "site";

/** Повторный заход после внутреннего rewrite не должен снова менять адрес. */
const INTERNAL = "x-portal-internal";

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

function roleFromSession(request: NextRequest): string | null {
  const token = request.cookies.get("b2b_session")?.value;
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}

function isCompany(role: string | null): boolean {
  return role === "company_admin" || role === "company_manager";
}

function isDealer(role: string | null): boolean {
  return role === "dealer_guest";
}

/** Старый адрес кабинета → /portal/..., без роли в пути. Превью витрины не трогаем. */
function legacyToPortal(pathname: string): string | null {
  if (pathname.startsWith("/partner/site/preview")) return null;
  if (pathname === "/catalog" || pathname.startsWith("/catalog/")) return `/portal${pathname}`;
  if (pathname === "/company" || pathname === "/partner") return "/portal";
  if (pathname.startsWith("/company/")) return `/portal${pathname.slice("/company".length)}`;
  if (pathname.startsWith("/partner/")) return `/portal${pathname.slice("/partner".length)}`;
  return null;
}

/** /portal/... → существующая страница. Роль выбирает экран, адрес остаётся общим. */
function portalToLegacy(pathname: string, role: string | null): string | null {
  if (pathname !== "/portal" && !pathname.startsWith("/portal/")) return null;
  const rest = pathname.slice("/portal".length);
  const company = isCompany(role);
  if (rest === "") {
    if (company) return "/company";
    if (isDealer(role)) return "/partner/general";
    return "/partner";
  }
  if (rest === "/catalog") {
    if (company) return "/company/catalog";
    if (isDealer(role)) return "/partner/general/houses";
    return "/partner/catalog";
  }
  if (rest.startsWith("/catalog/")) return `/catalog${rest.slice("/catalog".length)}`;
  if (rest === "/general") return company ? "/company/general" : "/partner/general";
  if (
    rest === "/messenger" ||
    rest.startsWith("/messenger/") ||
    rest === "/notifications" ||
    rest.startsWith("/notifications/") ||
    rest === "/team" ||
    rest.startsWith("/team/")
  ) {
    return `${company ? "/company" : "/partner"}${rest}`;
  }
  if (rest === "/partners" || rest.startsWith("/partners/") || rest === "/sites" || rest.startsWith("/sites/")) {
    return `/company${rest}`;
  }
  return `/partner${rest}`;
}

function portalCabinet(request: NextRequest) {
  if (request.headers.get(INTERNAL) === "1" || request.headers.get("x-middleware-rewrite")) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const portalPath = legacyToPortal(pathname);
  if (portalPath) {
    const url = request.nextUrl.clone();
    url.pathname = portalPath;
    return NextResponse.redirect(url, 308);
  }

  const legacy = portalToLegacy(pathname, roleFromSession(request));
  if (!legacy) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = legacy;
  const headers = new Headers(request.headers);
  headers.set(INTERNAL, "1");
  return NextResponse.rewrite(url, { request: { headers } });
}

export function middleware(request: NextRequest) {
  if (!SITE_MODE) return portalCabinet(request);

  const host = request.headers.get("host") ?? "";
  // www.example.ru → example.ru (иначе Host не резолвится в БД)
  if (host.toLowerCase().startsWith("www.")) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
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
  if (pathname.startsWith("/portal")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (pathname.startsWith("/partner") && !pathname.startsWith("/partner/site/preview")) {
    return NextResponse.rewrite(new URL("/partner/site/preview", request.url));
  }
  // /delete — инструкция завода по удалению данных, на домене дилера её быть не должно
  if (
    pathname.startsWith("/company") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname === "/delete"
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
