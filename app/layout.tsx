import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import "./responsive.css";

export const metadata: Metadata = {
  title: "PSCV Room 2.0",
  description: "Panel moderno de tareas, materiales y calendario para psicología.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4285dc",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
