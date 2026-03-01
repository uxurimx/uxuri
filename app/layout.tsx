import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { SkinProvider } from "@/components/providers/skin-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uxuri — Administración Personal y Empresarial",
  description:
    "Sistema completo de gestión de clientes, proyectos y tareas para profesionales y empresas.",
  manifest: "/manifest.json",
  themeColor: "#1e3a5f",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Uxuri",
    startupImage: "/apple-touch-icon.png",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="es" suppressHydrationWarning>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <SkinProvider>
              {children}
            </SkinProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
