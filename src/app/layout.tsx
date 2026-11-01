import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";

import { AppSessionProvider } from "@/components/AppSessionProvider";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  applicationName: "Expense Manager",
  title: "Expense Manager",
  description: "A modern expense tracker dashboard designed for daily budgeting and spending insights.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Expense Manager",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1016",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#020d14] text-slate-50">
        <PwaRegister />
        <AppSessionProvider>{children}</AppSessionProvider>
      </body>
    </html>
  );
}
