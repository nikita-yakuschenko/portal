import { NextResponse, type NextRequest } from "next/server";

import { primaryImage } from "@/lib/partner-site-preview";
import { fetchPublishedSiteByHost } from "@/lib/public-site-meta";
import { fetchPublicStorefrontProject } from "@/lib/public-project-meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(raw: string): string {
  return decodeURIComponent(raw)
    .trim()
    .replace(/\.(jpe?g|png|webp)$/i, "");
}

/** /site-branding/project-og/barnhouse-113.jpg — без query, иначе Telegram часто не тянет картинку */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await context.params;
  const slug = cleanSlug(rawSlug ?? "");
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
      headers: {
        Accept: "image/jpeg,image/png,image/webp,image/*,*/*",
        "User-Agent": "AVGST-OG-Proxy/1.0"
      },
      cache: "force-cache"
    });
    if (!upstream.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = Buffer.from(await upstream.arrayBuffer());

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("image/") ? contentType : "image/jpeg",
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Disposition": `inline; filename="${slug}.jpg"`
      }
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
