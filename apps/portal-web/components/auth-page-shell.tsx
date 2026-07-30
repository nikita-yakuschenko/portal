import Link from "next/link";

type AuthPageShellProps = {
  children: React.ReactNode;
};

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center overflow-x-hidden bg-muted p-4 md:p-8">
      <div className="mb-8 flex w-full max-w-sm flex-col items-center gap-3 md:max-w-4xl">
        <Link href="/" className="inline-flex">
          <img
            src="/logo.svg"
            alt="Авангард Строй"
            className="h-11 w-auto drop-shadow-sm"
            style={{ filter: "brightness(0) saturate(100%)" }}
          />
        </Link>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-avgst-green">
          Партнёрский кабинет
        </p>
      </div>
      <div className="w-full min-w-0 max-w-sm md:max-w-4xl">{children}</div>
    </div>
  );
}
