import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type SessionUser = {
  role:
    | "company_admin"
    | "company_manager"
    | "partner_owner"
    | "partner_member"
    | "dealer_guest";
  fullName: string;
  email: string;
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

export function cabinetHomeForRole(
  role: SessionUser["role"]
): "/company" | "/partner" | "/partner/general" {
  if (role === "company_admin" || role === "company_manager") {
    return "/company";
  }
  // У общего дилерского входа кабинета нет — его дом это общий раздел
  return role === "dealer_guest" ? "/partner/general" : "/partner";
}

/** Текущий пользователь из cookie-сессии или null (для публичных страниц). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("b2b_session")?.value;
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/api/auth/session`, {
      headers: {
        Cookie: `b2b_session=${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const session = (await response.json()) as SessionPayload;
    return session.user ?? null;
  } catch {
    return null;
  }
}

/** Серверная проверка роли: без клиентского экрана ожидания. */
export async function AuthGate({ allow, children }: AuthGateProps) {
  // redirect() бросает исключение — не вызывать его внутри try/catch
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (!allow.includes(user.role)) {
    redirect(cabinetHomeForRole(user.role));
  }

  return children;
}
