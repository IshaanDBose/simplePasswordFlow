import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Passcode — a state machine explorer",
  description:
    "A four-digit authentication code entry experience, built as an explorable state machine.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      {/* Password managers and similar extensions write inline styles onto
          <body> before React hydrates, which reads as a server/client
          mismatch. Suppressing here is one level deep — children are still
          fully checked. */}
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
