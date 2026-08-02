"use client";

import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Светлая", icon: IconSun },
  { value: "dark", label: "Тёмная", icon: IconMoon },
  { value: "system", label: "Системная", icon: IconDeviceDesktop }
] as const;

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant={active ? "default" : "outline"}
            className={cn("justify-start", !active && "bg-background")}
            onClick={() => setTheme(option.value)}
            aria-pressed={active}
          >
            <Icon />
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
