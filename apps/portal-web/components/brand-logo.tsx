import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string;
  /** wordmark = logo_l.svg; mark = logo.svg */
  variant?: "wordmark" | "mark";
  className?: string;
};

export function BrandLogo({
  href = "/",
  variant = "wordmark",
  className
}: BrandLogoProps) {
  const content = (
    <img
      src={variant === "mark" ? "/logo.svg" : "/logo_l.svg"}
      alt="Авангард Строй"
      className={cn(
        "w-auto",
        variant === "mark" ? "h-9" : "h-9 md:h-10",
        className
      )}
    />
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="inline-flex shrink-0">
      {content}
    </Link>
  );
}
