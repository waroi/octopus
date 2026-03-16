import type { Metadata } from "next";
import { Geist, Geist_Mono, Public_Sans } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VersionChecker } from "@/components/version-checker";
import { GlobalErrorHandler } from "@/components/global-error-handler";
import { TopLoader } from "@/components/top-loader";
import "./globals.css";

const publicSans = Public_Sans({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Octopus",
  description: "Code review automation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="Octopus" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-BNFCHLD0BY"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-BNFCHLD0BY');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TopLoader />
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <VersionChecker />
          <GlobalErrorHandler />
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
