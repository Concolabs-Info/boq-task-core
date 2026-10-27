"use client";

import { useMutation } from "@tanstack/react-query";
import { FileStack, FileText, Lock, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { PageViewer, type Point } from "@/components/PageViewer";
import { ScaleTool } from "@/components/ScaleTool";
import { StoreysEditor } from "@/components/StoreysEditor";
import { Badge, Banner, Button, EmptyState, ErrorText, PageHeader, Panel } from "@/components/ui";
import { apiSend, apiUpload, errorText } from "@/lib/api";
import { useFrame, usePages, useRefreshProject, useStoreys } from "@/lib/queries";
import type { Document, FrameInfo, Page, Storey } from "@/lib/types";

function scaleLabel(page: Page): string | null {
  if (!page.metres_per_pixel) return null;
  const scale = page.scale as { method?: string; denominator?: number } | null;
  if (scale?.method === "ratio") return `1:${scale.denominator}`;
  return `${(page.metres_per_pixel * 1000).toFixed(2)} mm/px`;
}

export default function PrePage() {
  const { id } = useParams<{ id: string }>();
  const pages = usePages(id);
  const storeys = useStoreys(id);
  const frame = useFrame(id);
  const refresh = useRefreshProject(id);
  const fileInput = useRef<HTMLInputElement>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [points, setPoints] = useState<[Point, Point] | null>(null);
  const selected = pages.data?.find((page) => page.id === selectedId) ?? pages.data?.[0];
  const selectedIndex = pages.data?.findIndex((page) => page.id === selected?.id) ?? -1;
  const unscaled = pages.data?.filter((page) => !page.metres_per_pixel).length ?? 0;

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

  const status = frame.data?.status;

  return (
    <>
      <PageHeader
        title="Pre"
        description="Upload drawings, set each page's scale and list the storeys. Then freeze the frame for Takeoff."
        actions={
          <>
            {status === "current" && <Badge tone="success">Frame v{frame.data?.version} frozen</Badge>}
            {status === "stale" && <Badge tone="warning">Changed since v{frame.data?.version}</Badge>}
            {status === "none" && <Badge>Not frozen</Badge>}
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) upload.mutate(files);
                event.target.value = "";
              }}
            />
            <Button icon={Upload} loading={upload.isPending} onClick={() => fileInput.current?.click()}>
              Upload PDF
            </Button>
            <Button
              variant="primary"
              icon={Lock}
              loading={freeze.isPending}
              disabled={status === "current" || !pages.data?.length}
              onClick={() => freeze.mutate()}
            >
              {status === "stale" ? "Freeze new version" : "Freeze frame"}
            </Button>
          </>
        }
      />

      {upload.error && <Banner tone="danger">{errorText(upload.error)}</Banner>}
      {freeze.error && <Banner tone="danger">{errorText(freeze.error)}</Banner>}
      {status === "stale" && (
        <Banner tone="warning">
          Pages, scales or storeys changed after the last freeze. Takeoff is read-only until you freeze a new version.
          Observations carry over and boxes are measured again with the new scale.
        </Banner>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel
            title="Pages"
            bodyClassName=""
            actions={
              pages.data?.length ? (
                <span className="text-xs text-zinc-500">
                  {unscaled ? `${unscaled} without scale` : "All scaled"}
                </span>
              ) : undefined
            }
          >
            {pages.data?.length ? (
              <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto">
                {pages.data.map((page, index) => {
                  const active = page.id === selected?.id;
                  const label = scaleLabel(page);
                  return (
                    <li key={page.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(page.id);
                          setPoints(null);
                          setPicking(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm ${
                          active ? "bg-blue-50 shadow-[inset_2px_0_0_0_theme(colors.blue.600)]" : "hover:bg-zinc-50"
                        }`}
                      >
                        <FileText aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="flex-1 font-medium text-zinc-800">Page {index + 1}</span>
                        {label ? <Badge>{label}</Badge> : <Badge tone="warning">No scale</Badge>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={FileStack} title="No drawings yet">
                Upload one or more PDF drawings.
              </EmptyState>
            )}
          </Panel>

          <Panel title={selected ? `Scale, page ${selectedIndex + 1}` : "Scale"}>
            {selected ? (
              <>
                <ScaleTool
                  key={selected.id}
                  picking={picking}
                  points={points}
                  onStartPicking={() => {
                    setPoints(null);
                    setPicking(true);
                  }}
                  onSave={(body) => saveScale.mutate(body)}
                  saving={saveScale.isPending}
                />
                {saveScale.error && <ErrorText>{errorText(saveScale.error)}</ErrorText>}
              </>
            ) : (
              <p className="text-sm text-zinc-500">Upload a drawing first.</p>
            )}
          </Panel>

          <Panel title="Storeys">
            {storeys.data && (
              <StoreysEditor
                key={JSON.stringify(storeys.data)}
                storeys={storeys.data}
                onSave={(body) => saveStoreys.mutate(body)}
                saving={saveStoreys.isPending}
              />
            )}
            {saveStoreys.error && <ErrorText>{errorText(saveStoreys.error)}</ErrorText>}
          </Panel>
        </div>

        {selected ? (
          <PageViewer
            page={selected}
            mode={picking ? "points" : "view"}
            points={points ?? []}
            onPoints={(p1, p2) => {
              setPoints([p1, p2]);
              setPicking(false);
            }}
            toolbar={
              <span className="font-medium text-zinc-800">
                Page {selectedIndex + 1} of {pages.data?.length}
              </span>
            }
          />
        ) : (
          <Panel>
            <EmptyState icon={FileStack} title="No drawing to show">
              Uploaded pages appear here.
            </EmptyState>
          </Panel>
        )}
      </div>
    </>
  );
}
