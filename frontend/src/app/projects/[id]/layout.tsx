import type { ReactNode } from "react";

/** Project pages share the sidebar steps from the root layout; each page renders its own header. */
export default function ProjectLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1600px] space-y-4">{children}</div>;
}
