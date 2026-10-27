"use client";

import { useQuery } from "@tanstack/react-query";
import { FileSearch, Layers } from "lucide-react";

import { apiGet } from "@/lib/api";
import type { BBox, PageVectors } from "@/lib/types";

import { Spinner } from "./ui";

/** What the PDF itself holds inside a box: exact text and the layers of its vector paths. No AI. */
export function BoxContents({ pageId, bbox }: { pageId: string; bbox: BBox }) {
  const query = new URLSearchParams({ x0: String(bbox[0]), y0: String(bbox[1]), x1: String(bbox[2]), y1: String(bbox[3]) });
  const vectors = useQuery({
    queryKey: ["vectors", pageId, ...bbox],
    queryFn: () => apiGet<PageVectors>(`/api/pages/${pageId}/vectors?${query}`),
  });

  if (vectors.isPending) return <Spinner label="Reading the PDF" />;
  if (vectors.error || !vectors.data) return null;

  const { text, paths } = vectors.data;
  const pathLayers = Array.from(new Set(paths.map((path) => path.layer ?? "no layer")));
  if (!text.length && !paths.length) {
    return <p className="text-xs text-zinc-500">No text or vector lines in this box. The page may be a scan.</p>;
  }
  return (
    <div className="space-y-2 rounded border border-zinc-200 bg-zinc-50 p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-zinc-700">
        <FileSearch aria-hidden className="h-3.5 w-3.5" />
        In the PDF inside this box
      </p>
      {text.length > 0 && (
        <ul className="mono max-h-28 space-y-0.5 overflow-y-auto text-zinc-800">
          {text.map((line, index) => (
            <li key={index} className="truncate">
              {line.text}
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-start gap-1.5 text-zinc-500">
        <Layers aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        {paths.length} vector path{paths.length === 1 ? "" : "s"}
        {pathLayers.length ? ` on ${pathLayers.join(", ")}` : ""}
      </p>
    </div>
  );
}
