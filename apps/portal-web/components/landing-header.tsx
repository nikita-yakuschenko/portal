import Link from "next/link";

import type { SessionUser } from "./auth-gate";
import { cabinetHomeForRole } from "./auth-gate";
import { BrandLogo } from "./brand-logo";

const navItems = [
  { href: "#factory", label: "Завод" },
  { href: "#advantages", label: "Преимущества" },
  { href: "#partner", label: "Стать дилером" }
];

type LandingHeaderProps = {
  user?: SessionUser | null;
};

export function LandingHeader({ user = null }: LandingHeaderProps) {
  const cabinetHref = user ? cabinetHomeForRole(user.role) : "/login";

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
        <div className="flex items-center justify-between gap-4 rounded-xl bg-black/25 px-3 py-2.5 shadow-sm backdrop-blur-md md:px-4">
          <BrandLogo variant="wordmark" />

          <nav className="hidden items-center gap-1 text-sm text-white/80 lg:flex">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <Link
                href={cabinetHref}
                className="rounded-lg bg-avgst-green px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-avgst-green-hover"
              >
                {user.fullName || user.email}
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10 hover:text-white"
                >
                  Войти в кабинет
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-avgst-green px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-avgst-green-hover"
                >
                  Стать дилером
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
