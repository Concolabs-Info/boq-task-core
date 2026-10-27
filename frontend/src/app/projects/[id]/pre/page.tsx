"use client";

import { useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import { PageViewer, type Point } from "@/components/PageViewer";
import { ScaleTool } from "@/components/ScaleTool";
import { StoreysEditor } from "@/components/StoreysEditor";
import { apiSend, apiUpload, apiUrl, errorText } from "@/lib/api";
import { useFrame, usePages, useRefreshProject, useStoreys } from "@/lib/queries";
import type { Document, FrameInfo, Page, Storey } from "@/lib/types";

const FRAME_TEXT = {
  none: "Not frozen yet. Freeze the frame to start Takeoff.",
  current: "Frozen and up to date. Takeoff can run.",
  stale: "Pre changed since the last freeze. Freeze again before Takeoff.",
};

export default function PrePage() {
  const { id } = useParams<{ id: string }>();
  const pages = usePages(id);
  const storeys = useStoreys(id);
  const frame = useFrame(id);
  const refresh = useRefreshProject(id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [points, setPoints] = useState<[Point, Point] | null>(null);
  const selected = pages.data?.find((page) => page.id === selectedId) ?? pages.data?.[0];

  const upload = useMutation({
    mutationFn: (files: File[]) => apiUpload<Document[]>(`/api/projects/${id}/documents`, files),
    onSuccess: refresh,
  });
  const saveScale = useMutation({
    mutationFn: (body: object) => apiSend<Page>("PUT", `/api/pages/${selected!.id}/scale`, body),
    onSuccess: () => {
      setPoints(null);
      return refresh();
    },
  });
  const saveStoreys = useMutation({
    mutationFn: (body: Storey[]) => apiSend<Storey[]>("PUT", `/api/projects/${id}/storeys`, body),
    onSuccess: refresh,
  });
  const freeze = useMutation({
    mutationFn: () => apiSend<FrameInfo>("POST", `/api/projects/${id}/frame/freeze`),
    onSuccess: refresh,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-4">
        <section className="card space-y-2">
          <h2 className="label">1. Drawings</h2>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="block w-full text-sm"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) upload.mutate(files);
              event.target.value = "";
            }}
          />
          {upload.isPending && <p className="text-sm text-slate-500">Uploading and rendering...</p>}
          {upload.error && <p className="text-sm text-red-700">{errorText(upload.error)}</p>}
          <ul className="grid grid-cols-3 gap-2">
            {pages.data?.map((page, index) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(page.id);
                    setPoints(null);
                    setPicking(false);
                  }}
                  className={`w-full rounded border p-1 text-left ${selected?.id === page.id ? "border-slate-900" : "border-slate-200"}`}
                >
                  <img src={apiUrl(page.image_url)} alt="" className="aspect-[4/3] w-full object-contain" />
                  <span className="block text-[11px]">
                    Page {index + 1} {page.metres_per_pixel ? "" : <span className="text-amber-700">(no scale)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {selected && (
          <section className="card space-y-2">
            <h2 className="label">2. Scale for the selected page</h2>
            <ScaleTool
              key={selected.id}
              metresPerPixel={selected.metres_per_pixel}
              picking={picking}
              points={points}
              onStartPicking={() => {
                setPoints(null);
                setPicking(true);
              }}
              onSave={(body) => saveScale.mutate(body)}
              saving={saveScale.isPending}
            />
            {saveScale.error && <p className="text-sm text-red-700">{errorText(saveScale.error)}</p>}
          </section>
        )}

        <section className="card space-y-2">
          <h2 className="label">3. Storeys</h2>
          {storeys.data && (
            <StoreysEditor
              key={JSON.stringify(storeys.data)}
              storeys={storeys.data}
              onSave={(body) => saveStoreys.mutate(body)}
              saving={saveStoreys.isPending}
            />
          )}
          {saveStoreys.error && <p className="text-sm text-red-700">{errorText(saveStoreys.error)}</p>}
        </section>

        <section className="card space-y-2">
          <h2 className="label">4. Frame</h2>
          {frame.data && (
            <p className={`text-sm ${frame.data.status === "current" ? "text-emerald-700" : "text-amber-700"}`}>
              {frame.data.version ? `Version ${frame.data.version}. ` : ""}
              {FRAME_TEXT[frame.data.status]}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={freeze.isPending || frame.data?.status === "current"}
            onClick={() => freeze.mutate()}
          >
            Freeze frame
          </button>
          {freeze.error && <p className="text-sm text-red-700">{errorText(freeze.error)}</p>}
        </section>
      </aside>

      <section>
        {selected ? (
          <PageViewer
            page={selected}
            mode={picking ? "points" : "view"}
            points={points ?? []}
            onPoints={(p1, p2) => {
              setPoints([p1, p2]);
              setPicking(false);
            }}
          />
        ) : (
          <div className="card text-sm text-slate-500">Upload a PDF to see its pages here.</div>
        )}
      </section>
    </div>
  );
}
