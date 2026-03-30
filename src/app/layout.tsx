import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "PabloRM - Entrenador de Natación",
  description: "Entrenamientos personalizados de natación para oposiciones (Bomberos, Policía, GC, Militares), triatletas, nadadores y clases para gimnasios CrossFit.",
  keywords: ["entrenador de natación", "oposiciones bomberos", "oposiciones policía", "triatlón", "natación", "crossfit piscina", "entrenamiento swimming"],
  openGraph: {
    title: "PabloRM - Entrenador de Natación",
    description: "Entrenamientos personalizados de natación. Oposiciones, triatlón y más.",
    type: "website",
  },
  icons: {
    icon: "/dibujo.PNG",
    apple: "/dibujo.PNG",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/dibujo.PNG" type="image/png" />
      </head>
      <body className="antialiased font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
