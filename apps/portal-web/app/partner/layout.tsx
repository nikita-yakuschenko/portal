import { AuthGate } from "../../components/auth-gate";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate allow={["partner_owner", "partner_member"]}>{children}</AuthGate>
  );
}
