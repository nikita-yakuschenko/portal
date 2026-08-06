import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Каркас плашки проекта — один на оба кабинета.
 * Слоты нужны, чтобы HQ мог подставить инлайн-правку, не меняя саму разметку.
 */
export function ProjectSummaryCard({
  title,
  badge,
  visibility,
  specs,
  prices,
  className
}: {
  title: ReactNode;
  badge: ReactNode;
  visibility?: ReactNode;
  specs: ReactNode;
  prices: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-wrap items-stretch justify-between gap-4">
        <div className="flex min-h-full min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {title}
            {badge}
            {visibility}
          </div>
          {specs}
        </div>
        <div className="shrink-0 self-start text-right">{prices}</div>
      </CardContent>
    </Card>
  );
}
