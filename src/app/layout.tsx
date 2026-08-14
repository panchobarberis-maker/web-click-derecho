import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import "./globals.css";

// Auto-hospedadas: se descargan en el build y se sirven desde nuestro dominio.
// Con <link> a fonts.googleapis.com la hoja bloquea el render, y el formulario
// se embebe en sitios ajenos donde ese salto de red se paga dos veces.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Right Lead",
  description: "Formularios de consulta y analytics para estudios jurídicos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
