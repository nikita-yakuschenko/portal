import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const SITE_MODE = process.env.APP_ROLE === "site" || process.env.NEXT_PUBLIC_APP_ROLE === "site";

// site-runtime: title/description/favicon отдаёт generateMetadata превью по Host
export const metadata: Metadata = SITE_MODE
  ? {
      title: { default: "Сайт", template: "%s" },
      robots: { index: true, follow: true }
    }
  : {
      title: "Партнёрский кабинет Авангард Строй",
      description:
        "Авангард Строй — завод модульных и каркасных домокомплектов. Станьте дилером: маржа до 15%, каталог проектов, производство 8000 м² и поддержка завода.",
      icons: {
        icon: [{ url: "/logo_social_l.svg", type: "image/svg+xml" }],
        apple: [{ url: "/logo_social_l.svg", type: "image/svg+xml" }]
      }
    };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={GeistSans.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
