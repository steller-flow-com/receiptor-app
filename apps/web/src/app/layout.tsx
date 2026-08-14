import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Receiptor",
  description: "Verifiable receipts and accounting for x402 payments on Stellar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
