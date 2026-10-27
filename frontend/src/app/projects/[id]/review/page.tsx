"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";

import { apiGet, apiSend, errorText } from "@/lib/api";
import { useRefreshProject } from "@/lib/queries";
import type { ReviewRow, ReviewStatus } from "@/lib/types";

const PILLS: Record<ReviewStatus, { text: string; className: string }> = {
  open: { text: "Open", className: "bg-slate-200 text-slate-700" },
  confirmed: { text: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  stale: { text: "Changed since confirming", className: "bg-amber-100 text-amber-800" },
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const refresh = useRefreshProject(id);
  const rows = useQuery({ queryKey: ["review", id], queryFn: () => apiGet<ReviewRow[]>(`/api/projects/${id}/review`) });
  const confirm = useMutation({
    mutationFn: (element: string) => apiSend("POST", `/api/projects/${id}/elements/${element}/confirm`),
    onSuccess: refresh,
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Check each element in Takeoff, then confirm it here. Only confirmed elements go into the BOQ. Any later change
        to the observations or to Pre needs a new confirmation.
      </p>
      {confirm.error && <p className="text-sm text-red-700">{errorText(confirm.error)}</p>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Element</th>
              <th>Status</th>
              <th className="text-right">Observations</th>
              <th className="text-right">Errors</th>
              <th className="text-right">Warnings</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.data?.map((row) => (
              <tr key={row.element}>
                <td>
                  <Link href={`/projects/${id}/takeoff`} className="font-medium hover:underline">
                    {row.display_name}
                  </Link>
                </td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PILLS[row.status].className}`}>
                    {PILLS[row.status].text}
                  </span>
                </td>
                <td className="text-right tabular-nums">{row.observation_count}</td>
                <td className={`text-right tabular-nums ${row.error_count ? "text-red-700" : ""}`}>{row.error_count}</td>
                <td className="text-right tabular-nums">{row.warning_count}</td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={row.status === "confirmed" || confirm.isPending}
                    onClick={() => confirm.mutate(row.element)}
                  >
                    Confirm
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
