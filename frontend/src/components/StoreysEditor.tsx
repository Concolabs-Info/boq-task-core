"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import type { Storey } from "@/lib/types";

import { Button } from "./ui";

type Row = { name: string; level: string };

export function StoreysEditor({
  storeys,
  onSave,
  saving,
}: {
  storeys: Storey[];
  onSave: (storeys: Storey[]) => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    storeys.length ? storeys.map((s) => ({ name: s.name, level: String(s.level_m) })) : [{ name: "Ground", level: "0" }],
  );

  const update = (index: number, patch: Partial<Row>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const valid = rows.every((row) => row.name.trim() && row.level.trim() !== "" && !Number.isNaN(Number(row.level)));
  const dirty =
    JSON.stringify(rows.map((row) => ({ name: row.name.trim(), level_m: Number(row.level) }))) !== JSON.stringify(storeys);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_5.5rem_2rem] items-center gap-x-2 gap-y-1.5">
        <span className="text-xs font-medium text-zinc-600">Name</span>
        <span className="text-xs font-medium text-zinc-600">Level (m)</span>
        <span />
        {rows.map((row, index) => (
          <Fragment key={index}>
            <input className="input" value={row.name} onChange={(e) => update(index, { name: e.target.value })} />
            <input
              className="input text-right tabular-nums"
              value={row.level}
              onChange={(e) => update(index, { level: e.target.value })}
            />
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              title="Remove storey"
              aria-label={`Remove ${row.name || "storey"}`}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            />
          </Fragment>
        ))}
      </div>
      <div className="flex justify-between gap-2">
        <Button size="sm" icon={Plus} onClick={() => setRows([...rows, { name: "", level: "" }])}>
          Add storey
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={Save}
          loading={saving}
          disabled={!valid || !dirty}
          onClick={() => onSave(rows.map((row) => ({ name: row.name.trim(), level_m: Number(row.level) })))}
        >
          Save storeys
        </Button>
      </div>
    </div>
  );
}
