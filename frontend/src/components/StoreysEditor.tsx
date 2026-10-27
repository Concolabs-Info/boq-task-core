"use client";

import { useState } from "react";

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
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Level (m)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>
                <input className="input" value={row.name} onChange={(e) => update(index, { name: e.target.value })} />
              </td>
              <td>
                <input
                  className="input w-24"
                  value={row.level}
                  onChange={(e) => update(index, { level: e.target.value })}
                />
              </td>
              <td>
                <button type="button" className="btn btn-danger" onClick={() => setRows(rows.filter((_, i) => i !== index))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
