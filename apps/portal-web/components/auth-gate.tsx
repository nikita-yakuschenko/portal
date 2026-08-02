import { cookies } from "next/headers";
import { redirect } from "next/navigation";

type SessionUser = {
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member";
};

type SessionPayload = {
  user: SessionUser;
};

type AuthGateProps = {
  allow: Array<SessionUser["role"]>;
  children: React.ReactNode;
};

function apiBaseUrl(): string {
  return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

/** Серверная проверка роли: без клиентского экрана ожидания. */
export async function AuthGate({ allow, children }: AuthGateProps) {
  const cookieStore = await cookies();
  const token = cookieStore.get("b2b_session")?.value;

  if (!token) {
    redirect("/login");
  }

  // redirect() бросает исключение — не вызывать его внутри try/catch
  let session: SessionPayload | null = null;
  try {
    const response = await fetch(`${apiBaseUrl()}/api/auth/session`, {
      headers: {
        Cookie: `b2b_session=${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (response.ok) {
      session = (await response.json()) as SessionPayload;
    }
  } catch {
    session = null;
  }

  if (!session) {
    redirect("/login");
  }

  if (!allow.includes(session.user.role)) {
    const home =
      session.user.role === "company_admin" || session.user.role === "company_manager"
        ? "/company"
        : "/partner";
    redirect(home);
  }

  return children;
}
