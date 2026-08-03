import { redirect } from "next/navigation";

/** Сайты перенесены в карточку партнёра — старые ссылки ведём на список */
export default function CompanySitesRedirectPage() {
  redirect("/company/partners");
}
