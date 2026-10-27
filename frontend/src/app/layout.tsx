import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/Sidebar";

import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "BOQ Task Core",
  description: "Pre, Takeoff, Review and BOQ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="min-w-0 flex-1 px-6 py-5">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
