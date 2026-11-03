import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import ToastContainer from "@/components/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RestroInn – Hotel & Restaurant Management System",
  description:
    "RestroInn is a modern, scalable hotel, restaurant, and POS management platform optimized for dining, hospitality, speed, accuracy, and double-entry reporting.",
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
      className={`${geistSans.variable} ${geistMono.variable} font-sans h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href="/nepali.datepicker.v5.0.6.min.css" />
        <script src="/nepali.datepicker.v5.0.6.min.js" async />
      </head>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider>
            {children}
            <ToastContainer />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
