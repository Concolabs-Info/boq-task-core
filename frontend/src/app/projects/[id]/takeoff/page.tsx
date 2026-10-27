"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useAgentStatus } from "@/components/AgentBadge";
import { AgentRunPanel } from "@/components/AgentRunPanel";
import { IssuesList } from "@/components/IssuesList";
import { ItemsTable } from "@/components/ItemsTable";
import { PageViewer } from "@/components/PageViewer";
import { SchemaForm, toForm, toValues, type FormValues } from "@/components/SchemaForm";
import { apiSend, errorText } from "@/lib/api";
import { useElementResult, useElements, useFrame, usePages, useRefreshProject, useStoreys } from "@/lib/queries";
import type { BBox, ObservationIn, ObservationRecord } from "@/lib/types";

type Editor = { observationId: string | null; bbox: BBox | null; storey: string; form: FormValues };

function summary(values: Record<string, unknown>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${typeof value === "number" ? Number(value.toFixed(3)) : value}`)
    .join(", ");
}

export default function TakeoffPage() {
  const { id } = useParams<{ id: string }>();
  const elements = useElements();
  const pages = usePages(id);
  const storeys = useStoreys(id);
  const frame = useFrame(id);
  const refresh = useRefreshProject(id);
  const agentStatus = useAgentStatus();

  const [elementKey, setElementKey] = useState<string>();
  const [pageId, setPageId] = useState<string>();
  const [draftBox, setDraftBox] = useState<BBox | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [selectedObs, setSelectedObs] = useState<string | null>(null);

  const spec = elements.data?.find((e) => e.key === elementKey) ?? elements.data?.[0];
  const page = pages.data?.find((p) => p.id === pageId) ?? pages.data?.[0];
  const result = useElementResult(id, spec?.key);
  const canEdit = frame.data?.status === "current";

  const base = `/api/projects/${id}/elements/${spec?.key}/observations`;
  const save = useMutation({
    mutationFn: ({ observationId, body }: { observationId: string | null; body: ObservationIn }) =>
      observationId ? apiSend("PUT", `${base}/${observationId}`, body) : apiSend("POST", base, body),
    onSuccess: () => {
      setEditor(null);
      setDraftBox(null);
      return refresh();
    },
  });
  const startAgent = useMutation({
    mutationFn: (bbox: BBox) =>
      apiSend<{ run_id: string }>("POST", `/api/projects/${id}/elements/${spec!.key}/agent-runs`, {
        page_id: page!.id,
        bbox,
      }),
    onSuccess: (data) => setAgentRunId(data.run_id),
  });
  const remove = useMutation({
    mutationFn: (observationId: string) => apiSend("DELETE", `${base}/${observationId}`),
    onSuccess: refresh,
  });

  function openEditor(observation?: ObservationRecord, bbox: BBox | null = null) {
    save.reset();
    setAgentRunId(null);
    setEditor({
      observationId: observation?.id ?? null,
      bbox: observation?.geometry?.bbox ?? bbox,
      storey: observation?.storey ?? storeys.data?.[0]?.name ?? "",
      form: toForm(observation?.values ?? {}),
    });
  }

  /** A draft box or open form belongs to one page and element, so changing either clears them. */
  function resetDraft() {
    setDraftBox(null);
    setEditor(null);
    setAgentRunId(null);
    startAgent.reset();
  }

  if (!spec || !pages.data) return <p className="text-sm text-slate-500">Loading...</p>;

  const observations = result.data?.observations ?? [];
  const boxes = observations
    .filter((o) => o.geometry && o.geometry.page_id === page?.id)
    .map((o) => ({
      bbox: o.geometry!.bbox,
      label: String(o.values.mark ?? o.source),
      tone: o.id === selectedObs ? ("selected" as const) : ("default" as const),
    }));
  if (draftBox) boxes.push({ bbox: draftBox, label: "new", tone: "selected" });

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {frame.data?.status === "stale" ? "Pre changed since the last freeze." : "The frame is not frozen yet."}{" "}
          <Link href={`/projects/${id}/pre`} className="underline">
            Go to Pre and freeze the frame
          </Link>{" "}
          to add observations.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label>
          <span className="label">Element</span>
          <select className="input" value={spec.key} onChange={(e) => {
              setElementKey(e.target.value);
              resetDraft();
            }}>
            {elements.data?.map((e) => (
              <option key={e.key} value={e.key}>
                {e.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Page</span>
          <select className="input" value={page?.id ?? ""} onChange={(e) => {
              setPageId(e.target.value);
              resetDraft();
            }}>
            {pages.data.map((p, index) => (
              <option key={p.id} value={p.id}>
                Page {index + 1}
                {p.metres_per_pixel ? "" : " (no scale)"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" disabled={!canEdit} onClick={() => openEditor()}>
          Add without a box
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_26rem]">
        <section>
          {page ? (
            <PageViewer
              page={page}
              mode={canEdit ? "box" : "view"}
              boxes={boxes}
              onBox={(bbox) => {
                setDraftBox(bbox);
                setEditor(null);
                setAgentRunId(null);
                startAgent.reset();
              }}
            />
          ) : (
            <div className="card text-sm text-slate-500">Upload drawings in Pre first.</div>
          )}
        </section>

        <aside className="space-y-4">
          {draftBox && !editor && !agentRunId && (
            <section className="card space-y-2">
              <h2 className="label">New box</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => openEditor(undefined, draftBox)}>
                  Add by hand
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={agentStatus !== "ready" || !spec.has_prompt || startAgent.isPending}
                  title={agentStatus !== "ready" ? "The agent runtime is not ready" : undefined}
                  onClick={() => startAgent.mutate(draftBox)}
                >
                  Ask agent
                </button>
                <button type="button" className="btn" onClick={() => setDraftBox(null)}>
                  Cancel
                </button>
              </div>
              {startAgent.error && <p className="text-sm text-red-700">{errorText(startAgent.error)}</p>}
            </section>
          )}

          {agentRunId && (
            <section className="card space-y-2">
              <h2 className="label">Agent</h2>
              <AgentRunPanel
                key={agentRunId}
                runId={agentRunId}
                onFinished={() => {
                  setDraftBox(null);
                  refresh();
                }}
              />
              <button type="button" className="btn" onClick={() => setAgentRunId(null)}>
                Close
              </button>
            </section>
          )}

          {editor && (
            <section className="card space-y-3">
              <h2 className="label">{editor.observationId ? "Edit observation" : "New observation"}</h2>
              {editor.bbox && (
                <p className="text-xs text-slate-500">
                  Values this element measures from the box are filled in from the drawing when you save.
                </p>
              )}
              <label className="block">
                <span className="label">Storey</span>
                <select
                  className="input"
                  value={editor.storey}
                  onChange={(e) => setEditor({ ...editor, storey: e.target.value })}
                >
                  <option value="">No storey</option>
                  {storeys.data?.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <SchemaForm schema={spec.schema} value={editor.form} onChange={(form) => setEditor({ ...editor, form })} />
              {save.error && <p className="text-sm text-red-700">{errorText(save.error)}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={save.isPending}
                  onClick={() => {
                    const geometryPage = observations.find((o) => o.id === editor.observationId)?.geometry?.page_id;
                    save.mutate({
                      observationId: editor.observationId,
                      body: {
                        storey: editor.storey || null,
                        geometry: editor.bbox ? { page_id: geometryPage ?? page!.id, bbox: editor.bbox } : null,
                        values: toValues(spec.schema, editor.form),
                      },
                    });
                  }}
                >
                  Save
                </button>
                <button type="button" className="btn" onClick={() => setEditor(null)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          <section className="card space-y-2">
            <h2 className="label">Issues</h2>
            <IssuesList issues={result.data?.issues ?? []} />
          </section>
        </aside>
      </div>

      <section className="card space-y-2">
        <h2 className="label">Observations ({observations.length})</h2>
        {remove.error && <p className="text-sm text-red-700">{errorText(remove.error)}</p>}
        {observations.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Storey</th>
                <th>Source</th>
                <th>Values</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {observations.map((o) => (
                <tr
                  key={o.id}
                  className={o.id === selectedObs ? "bg-orange-50" : "cursor-pointer hover:bg-slate-50"}
                  onClick={() => {
                    setSelectedObs(o.id);
                    if (o.geometry && o.geometry.page_id !== page?.id) {
                      setPageId(o.geometry.page_id);
                      resetDraft();
                    }
                  }}
                >
                  <td>{o.storey ?? "-"}</td>
                  <td>{o.source}</td>
                  <td className="text-xs">{summary(o.values)}</td>
                  <td className="whitespace-nowrap text-right">
                    <button
                      type="button"
                      className="btn"
                      disabled={!canEdit}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(o);
                      }}
                    >
                      Edit
                    </button>{" "}
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={!canEdit || remove.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(o.id);
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Draw a box on a page, or add an observation without a box.</p>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="label">Items</h2>
        <ItemsTable items={result.data?.items ?? []} />
      </section>
    </div>
  );
}
