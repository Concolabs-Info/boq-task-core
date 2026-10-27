"use client";

import { useState } from "react";

import type { Point } from "./PageViewer";

type ScaleBody =
  | { method: "ratio"; denominator: number }
  | { method: "points"; p1: Point; p2: Point; distance_m: number };

type Props = {
  metresPerPixel: number | null;
  picking: boolean;
  points: [Point, Point] | null;
  onStartPicking: () => void;
  onSave: (body: ScaleBody) => void;
  saving: boolean;
};

/** Set a page scale from a printed ratio or from two points a known distance apart. */
export function ScaleTool({ metresPerPixel, picking, points, onStartPicking, onSave, saving }: Props) {
  const [method, setMethod] = useState<"ratio" | "points">("ratio");
  const [ratio, setRatio] = useState("100");
  const [distance, setDistance] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Current scale:{" "}
        {metresPerPixel ? (
          <strong>{(metresPerPixel * 1000).toFixed(3)} mm per pixel</strong>
        ) : (
          <span className="text-amber-700">not set</span>
        )}
      </p>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" checked={method === "ratio"} onChange={() => setMethod("ratio")} /> Printed ratio
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={method === "points"} onChange={() => setMethod("points")} /> Two points
        </label>
      </div>

      {method === "ratio" ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ method: "ratio", denominator: Number(ratio) });
          }}
        >
          <span className="text-sm">1 :</span>
          <input className="input w-24" value={ratio} onChange={(event) => setRatio(event.target.value)} />
          <button className="btn" disabled={saving || !(Number(ratio) > 0)}>
            Save
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <button type="button" className="btn" onClick={onStartPicking}>
            {picking ? "Picking..." : points ? "Pick again" : "Pick two points on the page"}
          </button>
          {points && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSave({ method: "points", p1: points[0], p2: points[1], distance_m: Number(distance) });
              }}
            >
              <span className="text-sm">Real distance</span>
              <input
                className="input w-24"
                placeholder="metres"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
              <span className="text-sm">m</span>
              <button className="btn" disabled={saving || !(Number(distance) > 0)}>
                Save
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
