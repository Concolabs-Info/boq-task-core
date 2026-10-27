"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Badge, Banner, Button, EmptyState, PageHeader, Panel } from "@/components/ui";
import { apiGet, apiSend, errorText } from "@/lib/api";
import { useRefreshProject } from "@/lib/queries";
import type { ReviewRow, ReviewStatus } from "@/lib/types";

const STATUS: Record<ReviewStatus, { label: string; tone: "neutral" | "success" | "warning" }> = {
  open: { label: "Open", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "success" },
  stale: { label: "Changed since confirming", tone: "warning" },
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
    <>
      <PageHeader
        title="Review"
        description="Confirm each element once its observations and issues are checked. Only confirmed elements reach the BOQ."
      />

      {confirm.error && <Banner tone="danger">{errorText(confirm.error)}</Banner>}

      <Panel title="Elements" bodyClassName="">
        {rows.data?.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No elements registered" />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Element</th>
                <th className="w-56">Status</th>
                <th className="num w-32">Observations</th>
                <th className="num w-24">Errors</th>
                <th className="num w-24">Warnings</th>
                <th className="w-56" />
              </tr>
            </thead>
            <tbody>
              {rows.data?.map((row) => {
                const blocked = row.error_count > 0 || row.observation_count === 0;
                return (
                  <tr key={row.element}>
                    <td>
                      <p className="font-medium text-zinc-900">{row.display_name}</p>
                      <p className="mono text-[11px] text-zinc-400">{row.element}</p>
                    </td>
                    <td>
                      <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                    </td>
                    <td className="num">{row.observation_count}</td>
                    <td className={`num ${row.error_count ? "font-semibold text-red-700" : "text-zinc-500"}`}>{row.error_count}</td>
                    <td className={`num ${row.warning_count ? "text-amber-700" : "text-zinc-500"}`}>{row.warning_count}</td>
                    <td>
                      <span className="flex justify-end gap-2">
                        <Link
                          href={`/projects/${id}/takeoff`}
                          className="inline-flex h-8 items-center gap-1 px-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
                        >
                          Open
                          <ArrowUpRight aria-hidden className="h-4 w-4" />
                        </Link>
                        <Button
                          variant="primary"
                          icon={ShieldCheck}
                          loading={confirm.isPending && confirm.variables === row.element}
                          disabled={row.status === "confirmed" || blocked}
                          title={
                            row.observation_count === 0
                              ? "Add observations first"
                              : row.error_count
                                ? "Fix the errors in Takeoff first"
                                : undefined
                          }
                          onClick={() => confirm.mutate(row.element)}
                        >
                          {row.status === "stale" ? "Confirm again" : "Confirm"}
                        </Button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
