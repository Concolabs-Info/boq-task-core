import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AgentBadge } from "@/components/AgentBadge";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BOQ Task Core",
  description: "Pre, Takeoff, Review and BOQ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <Link href="/" className="font-semibold">
                BOQ Task Core
              </Link>
              <AgentBadge />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
