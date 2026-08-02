import { redirect } from "next/navigation";

import { previewPaths } from "@/lib/partner-site-preview";

/** Старый URL /contacts — контакты теперь блок на главной */
export default function PartnerSiteContactsRedirectPage() {
  redirect(previewPaths.home);
}
