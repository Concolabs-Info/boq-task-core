import type { Issue } from "@/lib/types";

const STYLES = {
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export function IssuesList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return <p className="text-sm text-slate-500">No issues.</p>;
  return (
    <ul className="space-y-1">
      {issues.map((issue, index) => (
        <li key={index} className={`rounded border px-2 py-1 text-sm ${STYLES[issue.severity]}`}>
          <span className="font-medium capitalize">{issue.severity}:</span> {issue.message}
        </li>
      ))}
    </ul>
  );
}
