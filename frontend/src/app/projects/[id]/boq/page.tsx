"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Download, Sheet } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useState } from "react";

import { formatQuantity } from "@/components/ItemsTable";
import { EmptyState, LinkButton, PageHeader, Panel } from "@/components/ui";
import { apiGet, apiUrl } from "@/lib/api";
import type { BoqLine } from "@/lib/types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export default function BoqPage() {
  const { id } = useParams<{ id: string }>();
  const lines = useQuery({ queryKey: ["boq", id], queryFn: () => apiGet<BoqLine[]>(`/api/projects/${id}/boq`) });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpen(next);
  };

  const sections = Array.from(new Set(lines.data?.map((line) => line.section) ?? []));

  return (
    <>
      <PageHeader
        title="Bill of quantities"
        description="Lines from confirmed elements, grouped by section. Expand a line to see how each quantity was worked out."
        actions={
          <LinkButton href={apiUrl(`/api/projects/${id}/boq.csv`)} icon={Download}>
            Download CSV
          </LinkButton>
        }
      />

      <Panel bodyClassName="">
        {lines.data?.length === 0 ? (
          <EmptyState icon={Sheet} title="Nothing confirmed yet">
            Confirm elements in{" "}
            <Link href={`/projects/${id}/review`} className="font-medium text-blue-700 hover:underline">
              Review
            </Link>{" "}
            to see them here.
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-20">Item</th>
                <th>Description</th>
                <th className="w-32">Item code</th>
                <th className="num w-32">Quantity</th>
                <th className="w-20">Unit</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section, sectionIndex) => {
                const letter = LETTERS[sectionIndex] ?? String(sectionIndex + 1);
                const sectionLines = lines.data!.filter((line) => line.section === section);
                return (
                  <Fragment key={section}>
                    <tr className="bg-zinc-50">
                      <td className="font-semibold text-zinc-700">{letter}</td>
                      <td colSpan={4} className="font-semibold uppercase tracking-wide text-zinc-700">
                        {section}
                      </td>
                    </tr>
                    {sectionLines.map((line, lineIndex) => {
                      const key = `${section}:${lineIndex}`;
                      const expanded = open.has(key);
                      const Chevron = expanded ? ChevronDown : ChevronRight;
                      return (
                        <Fragment key={key}>
                          <tr className="cursor-pointer hover:bg-zinc-50" onClick={() => toggle(key)}>
                            <td className="tabular-nums text-zinc-600">
                              {letter}
                              {lineIndex + 1}
                            </td>
                            <td>
                              <span className="flex items-center gap-1.5 font-medium text-zinc-900">
                                <Chevron aria-hidden className="h-4 w-4 text-zinc-400" />
                                {line.description}
                              </span>
                            </td>
                            <td className="mono text-xs text-zinc-500">{line.item_code ?? "-"}</td>
                            <td className="num font-semibold">{formatQuantity(line.quantity)}</td>
                            <td>{line.unit}</td>
                          </tr>
                          {expanded &&
                            line.items.map((item) => (
                              <tr key={item.id} className="bg-zinc-50/60 text-xs text-zinc-600">
                                <td />
                                <td className="pl-9">
                                  <span className="text-zinc-500">{item.storey ?? "No storey"}</span>
                                  <span className="mono ml-3">{item.basis}</span>
                                </td>
                                <td />
                                <td className="num">{formatQuantity(item.quantity)}</td>
                                <td>{item.unit}</td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
