import { NextResponse, type NextRequest } from "next/server";

import {
  decodeDataUrl,
  fetchPublishedSiteByHost,
  pickOgImageDataUrl
} from "@/lib/public-site-meta";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const site = await fetchPublishedSiteByHost(host);
  const dataUrl = site ? pickOgImageDataUrl(site.config) : "";
  const decoded = dataUrl ? decodeDataUrl(dataUrl) : null;

  if (!decoded) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(decoded.body), {
    status: 200,
    headers: {
      "Content-Type": decoded.contentType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
    }
  });
}
