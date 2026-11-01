import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import Script from "next/script";
import "./globals.css";

const sansFont = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RestroInn – Hotel & Restaurant Management System",
  description: "RestroInn is a modern, scalable hotel, restaurant, and POS management platform optimized for dining, hospitality, speed, accuracy, and double-entry reporting.",
  icons: {
    icon: "/logo-icon.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sansFont.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="/nepali.datepicker.v5.0.6.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SessionProvider>
        <Script
          src="/nepali.datepicker.v5.0.6.min.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
