import { AuthPageShell } from "@/components/auth-page-shell";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <AuthPageShell>
      <SignupForm />
    </AuthPageShell>
  );
}
