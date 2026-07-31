"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api";

type SessionUser = {
  role: "company_admin" | "company_manager" | "partner_owner" | "partner_member";
  fullName?: string;
  email?: string;
};

type SessionPayload = {
  user: SessionUser;
};

type AuthGateProps = {
  allow: Array<SessionUser["role"]>;
  children: React.ReactNode;
};

export function AuthGate({ allow, children }: AuthGateProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const allowKey = allow.join(",");

  useEffect(() => {
    let cancelled = false;
    const allowedRoles = allowKey.split(",") as Array<SessionUser["role"]>;

    void (async () => {
      try {
        const session = await apiFetch<SessionPayload>("/api/auth/session");
        if (cancelled) return;

        if (!allowedRoles.includes(session.user.role)) {
          const home =
            session.user.role === "company_admin" || session.user.role === "company_manager"
              ? "/company"
              : "/partner";
          router.replace(home);
          return;
        }

        setReady(true);
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowKey, router]);

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 text-sm text-slate-500">
        Проверяем доступ...
      </div>
    );
  }

  return children;
}
