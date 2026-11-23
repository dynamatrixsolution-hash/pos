import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import ToastContainer from "@/components/toast";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#6B2837",
};

export const metadata: Metadata = {
  title: "RestroInn – Hotel & Restaurant Management System",
  description:
    "RestroInn is a modern, scalable hotel, restaurant, and POS management platform optimized for dining, hospitality, speed, accuracy, and double-entry reporting.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo-icon.jpg",
    apple: "/logo-icon.jpg",
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
      className="font-sans h-full antialiased"
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
