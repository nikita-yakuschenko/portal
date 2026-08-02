import { redirect } from "next/navigation";

import { previewPaths } from "@/lib/partner-site-preview";

/** Старый URL /about — отдельной страницы «О нас» больше нет */
export default function PartnerSiteAboutRedirectPage() {
  redirect(previewPaths.home);
}
