import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuakeRoom & ExitZero | Gemini 4 Argon 3D Seismic & Evacuation Verifier",
  description:
    "Google DeepMind Hackathon at Imperial — Plan B (QuakeRoom 3D Seismic Collapse & Remediation) & Plan C (ExitZero 3D Building Dynamic Evacuation Verifier)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-emerald-500 selection:text-slate-950">
        {children}
      </body>
    </html>
  );
}
