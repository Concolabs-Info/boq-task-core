"use client";

import { useRef, useState, type MouseEvent } from "react";

import { apiUrl } from "@/lib/api";
import type { BBox, Page } from "@/lib/types";

export type Point = [number, number];

export type ViewerBox = { bbox: BBox; label?: string; tone?: "default" | "selected" | "draft" };

type Props = {
  page: Page;
  mode?: "view" | "points" | "box";
  onPoints?: (p1: Point, p2: Point) => void;
  onBox?: (bbox: BBox) => void;
  boxes?: ViewerBox[];
  points?: Point[];
};

const ZOOMS = [1, 1.5, 2, 3];
const TONES = {
  default: "border-sky-500 bg-sky-400/10",
  selected: "border-orange-500 bg-orange-400/20",
  draft: "border-fuchsia-600 border-dashed bg-fuchsia-400/10",
};

/**
 * Shows a rendered page. All coordinates going in and out are render pixels (150 DPI),
 * whatever the zoom, so they match what the backend stores.
 */
export function PageViewer({ page, mode = "view", onPoints, onBox, boxes = [], points = [] }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pending, setPending] = useState<Point | null>(null);
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);

  function toPixels(event: MouseEvent): Point {
    const rect = imageRef.current!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * page.width_px;
    const y = ((event.clientY - rect.top) / rect.height) * page.height_px;
    return [Math.round(Math.min(Math.max(x, 0), page.width_px)), Math.round(Math.min(Math.max(y, 0), page.height_px))];
  }

  function handleClick(event: MouseEvent) {
    if (mode !== "points") return;
    const point = toPixels(event);
    if (!pending) return setPending(point);
    setPending(null);
    onPoints?.(pending, point);
  }

  function handleMouseDown(event: MouseEvent) {
    if (mode !== "box") return;
    event.preventDefault();
    const point = toPixels(event);
    setDrag({ start: point, end: point });
  }

  function handleMouseMove(event: MouseEvent) {
    if (drag) setDrag({ ...drag, end: toPixels(event) });
  }

  function handleMouseUp() {
    if (!drag) return;
    const [x0, x1] = [drag.start[0], drag.end[0]].sort((a, b) => a - b);
    const [y0, y1] = [drag.start[1], drag.end[1]].sort((a, b) => a - b);
    setDrag(null);
    if (x1 - x0 >= 4 && y1 - y0 >= 4) onBox?.([x0, y0, x1, y1]);
  }

  const shownPoints = pending ? [...points, pending] : points;
  const draft: ViewerBox[] = drag
    ? [
        {
          bbox: [
            Math.min(drag.start[0], drag.end[0]),
            Math.min(drag.start[1], drag.end[1]),
            Math.max(drag.start[0], drag.end[0]),
            Math.max(drag.start[1], drag.end[1]),
          ],
          tone: "draft",
        },
      ]
    : [];

  const pct = (value: number, total: number) => `${(value / total) * 100}%`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Zoom</span>
        {ZOOMS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setZoom(value)}
            className={`rounded px-2 py-0.5 ${zoom === value ? "bg-slate-900 text-white" : "bg-slate-200"}`}
          >
            {value * 100}%
          </button>
        ))}
        {mode === "points" && <span className="ml-2 text-amber-700">Click two points a known distance apart</span>}
        {mode === "box" && <span className="ml-2 text-amber-700">Drag to draw a box</span>}
      </div>
      <div className="max-h-[70vh] overflow-auto rounded border border-slate-300 bg-white">
        <div
          className={`relative select-none ${mode === "view" ? "" : "cursor-crosshair"}`}
          style={{ width: `${zoom * 100}%` }}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img ref={imageRef} src={apiUrl(page.image_url)} alt={`Page ${page.page_index + 1}`} className="block w-full" draggable={false} />
          {[...boxes, ...draft].map((box, index) => (
            <div
              key={index}
              className={`pointer-events-none absolute border-2 ${TONES[box.tone ?? "default"]}`}
              style={{
                left: pct(box.bbox[0], page.width_px),
                top: pct(box.bbox[1], page.height_px),
                width: pct(box.bbox[2] - box.bbox[0], page.width_px),
                height: pct(box.bbox[3] - box.bbox[1], page.height_px),
              }}
            >
              {box.label && (
                <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-slate-900 px-1 text-[10px] text-white">
                  {box.label}
                </span>
              )}
            </div>
          ))}
          {shownPoints.map((point, index) => (
            <div
              key={index}
              className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-600"
              style={{ left: pct(point[0], page.width_px), top: pct(point[1], page.height_px) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
