import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "900"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const workSans = Work_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Gazete",
  description:
    "Seçtiğin kategorilerden, yapay zekâ ile özetlenmiş günlük Türkçe haber bülteni.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`${fraunces.variable} ${workSans.variable}`}>
        {children}
      </body>
    </html>
  );
}
