import { AuthGate } from "../../components/auth-gate";

const SITE_MODE = process.env.APP_ROLE === "site" || process.env.NEXT_PUBLIC_APP_ROLE === "site";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  // Публичный site-runtime: /partner/site/preview без логина (Host → resolve)
  if (SITE_MODE) {
    return children;
  }

  // Общий дилерский вход пускаем в дерево /partner: внутри ему открыт только
  // /partner/general, остальное закрывает AuthGate самого раздела и API
  return (
    <AuthGate allow={["partner_owner", "partner_member", "dealer_guest"]}>{children}</AuthGate>
  );
}
