"use client";

import { Fragment, useState } from "react";

import type { Storey } from "@/lib/types";

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

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_5rem_auto] items-center gap-2">
        <span className="label mb-0">Name</span>
        <span className="label mb-0">Level (m)</span>
        <span />
        {rows.map((row, index) => (
          <Fragment key={index}>
            <input className="input" value={row.name} onChange={(e) => update(index, { name: e.target.value })} />
            <input className="input" value={row.level} onChange={(e) => update(index, { level: e.target.value })} />
            <button
              type="button"
              className="btn btn-danger px-2"
              title="Remove storey"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              x
            </button>
          </Fragment>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => setRows([...rows, { name: "", level: "" }])}>
          Add storey
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid || saving}
          onClick={() => onSave(rows.map((row) => ({ name: row.name.trim(), level_m: Number(row.level) })))}
        >
          Save storeys
        </button>
      </div>
    </div>
  );
}
