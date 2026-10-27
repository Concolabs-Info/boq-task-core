import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import type { Issue } from "@/lib/types";

const STYLES = {
  error: { icon: XCircle, className: "text-red-700" },
  warning: { icon: AlertTriangle, className: "text-amber-700" },
  info: { icon: Info, className: "text-blue-700" },
};

const ORDER = { error: 0, warning: 1, info: 2 };

export function IssuesList({ issues }: { issues: Issue[] }) {
  if (!issues.length) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500">
        <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />
        No issues
      </p>
    );
  }
  const sorted = [...issues].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <ul className="divide-y divide-zinc-100">
      {sorted.map((issue, index) => {
        const { icon: Icon, className } = STYLES[issue.severity];
        return (
          <li key={index} className="flex gap-2.5 px-4 py-2.5 text-sm">
            <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} />
            <div className="min-w-0">
              <p className="text-zinc-800">{issue.message}</p>
              <p className="mono text-[11px] text-zinc-400">{issue.code}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
