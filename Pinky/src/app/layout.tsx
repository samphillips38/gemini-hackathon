import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuakeRoom & ExitZero — Spatial Safety Verifier",
  description:
    "Gemini 4 Argon + Deterministic 3D Physics & A* Evacuation Verifier",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
