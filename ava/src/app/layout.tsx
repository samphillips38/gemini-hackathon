import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FaultLine / ExitZero — 3D Seismic & Evacuation Verifier",
  description:
    "Gemini 4 Argon + Deterministic 3D Physics & A* Egress Verifier for Google DeepMind Hackathon at Imperial",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
