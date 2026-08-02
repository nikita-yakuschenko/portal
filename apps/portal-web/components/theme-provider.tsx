"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// Публичные зоны всегда светлые: лендинг, вход/регистрация и витрина покупателя
const LIGHT_ONLY_PATHS = ["/", "/login", "/signup", "/apply"];

function isLightOnly(pathname: string): boolean {
  return LIGHT_ONLY_PATHS.includes(pathname) || pathname.startsWith("/partner/site/preview");
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();

  return (
    <NextThemesProvider {...props} {...(isLightOnly(pathname) ? { forcedTheme: "light" } : {})}>
      {children}
    </NextThemesProvider>
  );
}
