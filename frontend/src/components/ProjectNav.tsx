"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { slug: "pre", label: "Pre" },
  { slug: "takeoff", label: "Takeoff" },
  { slug: "review", label: "Review" },
  { slug: "boq", label: "BOQ" },
];

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {STEPS.map((step) => {
        const href = `/projects/${projectId}/${step.slug}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={step.slug}
            href={href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
