"use client";

import { Check, Crosshair, Hash } from "lucide-react";
import { useState } from "react";

import type { Point } from "./PageViewer";
import { Button, Segmented } from "./ui";

type ScaleBody =
  | { method: "ratio"; denominator: number }
  | { method: "points"; p1: Point; p2: Point; distance_m: number };

type Props = {
  picking: boolean;
  points: [Point, Point] | null;
  onStartPicking: () => void;
  onSave: (body: ScaleBody) => void;
  saving: boolean;
};

/** Set a page scale from a printed ratio or from two points a known distance apart. */
export function ScaleTool({ picking, points, onStartPicking, onSave, saving }: Props) {
  const [method, setMethod] = useState<"ratio" | "points">("ratio");
  const [ratio, setRatio] = useState("100");
  const [distance, setDistance] = useState("");
  const pixels = points ? Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]) : 0;

  return (
    <div className="space-y-3">
      <Segmented
        options={[
          { value: "ratio", label: "Printed ratio", icon: Hash },
          { value: "points", label: "Two points", icon: Crosshair },
        ]}
        value={method}
        onChange={setMethod}
      />

      {method === "ratio" ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ method: "ratio", denominator: Number(ratio) });
          }}
        >
          <span className="text-sm text-zinc-600">1 :</span>
          <input className="input w-24 tabular-nums" value={ratio} onChange={(event) => setRatio(event.target.value)} />
          <Button type="submit" variant="primary" icon={Check} loading={saving} disabled={!(Number(ratio) > 0)}>
            Apply
          </Button>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Pick two points on a printed dimension or the scale bar, then enter the real distance.</p>
          <Button icon={Crosshair} onClick={onStartPicking} disabled={picking}>
            {picking ? "Click two points on the drawing" : points ? "Pick again" : "Pick two points"}
          </Button>
          {points && (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                onSave({ method: "points", p1: points[0], p2: points[1], distance_m: Number(distance) });
              }}
            >
              <span className="whitespace-nowrap text-xs tabular-nums text-zinc-500">{pixels.toFixed(0)} px =</span>
              <input
                className="input w-24 tabular-nums"
                placeholder="0.000"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
              <span className="text-sm text-zinc-600">m</span>
              <Button type="submit" variant="primary" icon={Check} loading={saving} disabled={!(Number(distance) > 0)}>
                Apply
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
