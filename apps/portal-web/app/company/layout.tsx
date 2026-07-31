import { AuthGate } from "../../components/auth-gate";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate allow={["company_admin", "company_manager"]}>{children}</AuthGate>
  );
}
