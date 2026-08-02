import { NextResponse, type NextRequest } from "next/server";

import { primaryImage } from "@/lib/partner-site-preview";
import { fetchPublishedSiteByHost } from "@/lib/public-site-meta";
import { fetchPublicStorefrontProject } from "@/lib/public-project-meta";

export const runtime = "nodejs";

/** Прокси обложки проекта — Telegram часто не тянет картинки с чужих CDN. */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? "";
  if (!slug) {
    return new NextResponse(null, { status: 400 });
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const site = await fetchPublishedSiteByHost(host);
  if (!site) {
    return new NextResponse(null, { status: 404 });
  }

  const project = await fetchPublicStorefrontProject(site.partnerId, slug);
  const imageUrl = project ? primaryImage(project) : null;
  if (!imageUrl) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const upstream = await fetch(imageUrl, {
      headers: { Accept: "image/*,*/*" },
      next: { revalidate: 3600 }
    });
    if (!upstream.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
      }
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
