import type { Metadata } from "next";
import { Geist, Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-geist-sans"
});

// Inter остаётся вторым уровнем стека по ADS 1.1 §9.1
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "AVGST — стать дилером завода Авангард Строй",
  description:
    "Авангард Строй — завод модульных и каркасных домокомплектов. Станьте дилером: маржа до 15%, каталог проектов, производство 8000 м² и поддержка завода.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${inter.variable}`} suppressHydrationWarning>
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
