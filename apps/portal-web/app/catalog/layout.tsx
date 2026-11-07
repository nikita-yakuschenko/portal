import { AuthGate } from "@/components/auth-gate";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate
      allow={[
        "company_admin",
        "company_manager",
        "partner_owner",
        "partner_member",
        "dealer_guest"
      ]}
    >
      {children}
    </AuthGate>
  );
}
