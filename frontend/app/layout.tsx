import type { Metadata } from "next";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@reactive-resume/ui/components/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: "Opportunity Radar",
  description: "The mission-control for students seeking world-class internships, fellowships, and early-career opportunities.",
  openGraph: {
    title: "Opportunity Radar",
    description: "The mission-control for students seeking world-class internships, fellowships, and early-career opportunities.",
    url: "https://opportunity-radar.com",
    siteName: "Opportunity Radar",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Opportunity Radar",
    description: "The mission-control for students seeking world-class internships, fellowships, and early-career opportunities.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* Material Symbols — required by approved design system */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="antialiased">
        {children}
        {/* Mounted once, globally — every page calls `toast(...)` from
            "sonner" directly, but the only <Toaster/> in the app used to
            live inside the Resume Builder's own page-client.tsx, so every
            toast call anywhere else (ATS Checker, Optimiser, AI Search,
            Tracker, notifications, resume upload/import) silently rendered
            nothing. Found live 16 Aug 2026: submitted a real ATS check and
            watched the loading/success/error toasts never appear anywhere
            on screen despite firing correctly in code. */}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
