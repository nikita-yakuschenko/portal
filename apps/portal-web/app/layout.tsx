import type { Metadata } from "next";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = localFont({
  src: "../../../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  display: "swap",
  variable: "--font-geist-sans",
  weight: "100 900"
});

// Inter остаётся вторым уровнем стека по ADS 1.1 §9.1
const inter = localFont({
  src: [
    { path: "../../../node_modules/@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2", weight: "300 700", style: "normal" },
    { path: "../../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "300 700", style: "normal" }
  ],
  display: "swap",
  variable: "--font-inter"
});

/**
 * Подпись под QR-кодом на экране мокапа. Instagram печатает там имя аккаунта
 * шрифтом Instagram Sans Condensed — он проприетарный и распространению не
 * подлежит, поэтому берём ближайший по рисунку OFL-гротеск.
 */
const robotoCondensed = localFont({
  src: [
    { path: "../../../node_modules/@fontsource-variable/roboto-condensed/files/roboto-condensed-cyrillic-wght-normal.woff2", weight: "700", style: "normal" },
    { path: "../../../node_modules/@fontsource-variable/roboto-condensed/files/roboto-condensed-latin-wght-normal.woff2", weight: "700", style: "normal" }
  ],
  display: "swap",
  variable: "--font-qr-handle"
});

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
    <html lang="ru" className={`${geistSans.variable} ${inter.variable} ${robotoCondensed.variable}`} suppressHydrationWarning>
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
