import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "O'Boyle Acquisition Operating System",
  description: "Private operations headquarters for O'Boyle Acquisitions — run by Big Stein.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "O'Boyle Acquisition OS",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/icon-apple-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#080A09",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark", sans.variable, serif.variable, mono.variable)}>
      <body className="min-h-screen bg-bg text-text font-sans">
        {children}
      </body>
    </html>
  );
}
