import { redirect } from "next/navigation";

/** Цены настраиваются в карточке проекта каталога */
export default function PartnerPricingRedirectPage() {
  redirect("/portal/catalog");
}
