"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";

import { apiUrl } from "@/lib/api";
import type { BBox, Page } from "@/lib/types";

import { Segmented } from "./ui";

export type Point = [number, number];

export type ViewerBox = { bbox: BBox; label?: string; tone?: "default" | "selected" | "draft" };

type Props = {
  page: Page;
  mode?: "view" | "points" | "box";
  onPoints?: (p1: Point, p2: Point) => void;
  onBox?: (bbox: BBox) => void;
  boxes?: ViewerBox[];
  points?: Point[];
  /** Extra controls shown on the left of the viewer toolbar. */
  toolbar?: ReactNode;
};

const ZOOMS = [1, 1.5, 2, 3].map((value) => ({ value, label: `${value * 100}%` }));
const TONES = {
  default: "border-blue-600 bg-blue-500/10",
  selected: "border-amber-500 bg-amber-400/20",
  draft: "border-blue-700 border-dashed bg-blue-500/10",
};

/**
 * Shows a rendered page. All coordinates going in and out are render pixels (150 DPI),
 * whatever the zoom, so they match what the backend stores.
 */
export function PageViewer({ page, mode = "view", onPoints, onBox, boxes = [], points = [], toolbar }: Props) {
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
    <div className="overflow-hidden rounded-md border border-zinc-200 bg-white">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-1.5">
        <div className="flex items-center gap-3 text-sm">
          {toolbar}
          {mode === "points" && <span className="text-xs text-blue-700">Click two points a known distance apart</span>}
          {mode === "box" && <span className="text-xs text-zinc-500">Drag on the drawing to mark an element</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="tabular-nums">
            {page.width_px} x {page.height_px} px
          </span>
          <Segmented options={ZOOMS} value={zoom} onChange={setZoom} />
        </div>
      </div>
      <div className="max-h-[calc(100vh-13rem)] min-h-[24rem] overflow-auto bg-zinc-200 p-3">
        <div
          className={`relative mx-auto select-none bg-white shadow-sm ring-1 ring-zinc-300 ${mode === "view" ? "" : "cursor-crosshair"}`}
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
                <span className="absolute -top-4 left-0 whitespace-nowrap rounded-sm bg-zinc-900 px-1 text-[10px] leading-4 text-white">
                  {box.label}
                </span>
              )}
            </div>
          ))}
          {shownPoints.map((point, index) => (
            <div
              key={index}
              className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 ring-1 ring-blue-700"
              style={{ left: pct(point[0], page.width_px), top: pct(point[1], page.height_px) }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
