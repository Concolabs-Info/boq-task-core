"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";

import { formatQuantity } from "@/components/ItemsTable";
import { apiGet, apiUrl } from "@/lib/api";
import type { BoqLine } from "@/lib/types";

export default function BoqPage() {
  const { id } = useParams<{ id: string }>();
  const lines = useQuery({ queryKey: ["boq", id], queryFn: () => apiGet<BoqLine[]>(`/api/projects/${id}/boq`) });
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (index: number) => {
    const next = new Set(open);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setOpen(next);
  };

  const sections = Array.from(new Set(lines.data?.map((line) => line.section) ?? []));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">Confirmed elements only. Click a line to see how it was worked out.</p>
        <a className="btn" href={apiUrl(`/api/projects/${id}/boq.csv`)}>
          Download CSV
        </a>
      </div>
      {lines.data?.length === 0 && (
        <div className="card text-sm text-slate-500">Nothing confirmed yet. Confirm elements in Review.</div>
      )}
      {sections.map((section) => (
        <section key={section} className="card">
          <h2 className="mb-2 font-semibold">{section}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Item code</th>
                <th>Description</th>
                <th className="text-right">Quantity</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              {lines.data?.map((line, index) =>
                line.section !== section ? null : (
                  <Fragment key={index}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => toggle(index)}>
                      <td>{line.item_code ?? "-"}</td>
                      <td>
                        {open.has(index) ? "▾" : "▸"} {line.description}
                      </td>
                      <td className="text-right font-medium tabular-nums">{formatQuantity(line.quantity)}</td>
                      <td>{line.unit}</td>
                    </tr>
                    {open.has(index) &&
                      line.items.map((item) => (
                        <tr key={item.id} className="text-xs text-slate-600">
                          <td />
                          <td className="pl-6 font-mono">
                            {item.storey ?? "-"}: {item.basis}
                          </td>
                          <td className="text-right tabular-nums">{formatQuantity(item.quantity)}</td>
                          <td>{item.unit}</td>
                        </tr>
                      ))}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
