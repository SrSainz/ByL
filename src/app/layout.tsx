import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Gestión de incidencias",
  description: "Aplicación PWA para registrar y gestionar incidencias.",
  manifest: "/manifest.webmanifest",
  applicationName: "ByL Mantenimiento",
  icons: {
    icon: "/logo-byl.png",
    apple: "/icons/icon-192.png"
  },
  formatDetection: {
    telephone: false
  },
  appleWebApp: {
    capable: true,
    title: "ByL Mantenimiento",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#f1eee6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
