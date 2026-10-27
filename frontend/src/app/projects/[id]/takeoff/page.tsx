"use client";

import { useMutation } from "@tanstack/react-query";
import { Bot, Check, ListPlus, MousePointerSquareDashed, Pencil, Plus, Trash2, User, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { useAgentStatus } from "@/components/AgentBadge";
import { AgentRunPanel } from "@/components/AgentRunPanel";
import { IssuesList } from "@/components/IssuesList";
import { ItemsTable } from "@/components/ItemsTable";
import { PageViewer } from "@/components/PageViewer";
import { SchemaForm, toForm, toValues, type FormValues } from "@/components/SchemaForm";
import { Badge, Banner, Button, EmptyState, ErrorText, Field, PageHeader, Panel, Spinner } from "@/components/ui";
import { apiSend, errorText } from "@/lib/api";
import { useElementResult, useElements, useFrame, usePages, useRefreshProject, useStoreys } from "@/lib/queries";
import type { BBox, ObservationIn, ObservationRecord, Page } from "@/lib/types";

type Editor = { observationId: string | null; bbox: BBox | null; storey: string; form: FormValues };

function formatValue(value: unknown): string {
  return typeof value === "number" ? String(Number(value.toFixed(3))) : String(value);
}

function boxSize(page: Page | undefined, bbox: BBox): string {
  const w = bbox[2] - bbox[0];
  const h = bbox[3] - bbox[1];
  if (!page?.metres_per_pixel) return `${w} x ${h} px (page has no scale)`;
  const m = (px: number) => (px * page.metres_per_pixel!).toFixed(3);
  return `${m(w)} x ${m(h)} m`;
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
  const pageIndex = pages.data?.findIndex((p) => p.id === page?.id) ?? -1;
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
  const remove = useMutation({
    mutationFn: (observationId: string) => apiSend("DELETE", `${base}/${observationId}`),
    onSuccess: refresh,
  });
  const startAgent = useMutation({
    mutationFn: (bbox: BBox) =>
      apiSend<{ run_id: string }>("POST", `/api/projects/${id}/elements/${spec!.key}/agent-runs`, {
        page_id: page!.id,
        bbox,
      }),
    onSuccess: (data) => setAgentRunId(data.run_id),
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

  if (!spec || !pages.data) {
    return (
      <div className="py-10 text-center">
        <Spinner label="Loading" />
      </div>
    );
  }

  const observations = result.data?.observations ?? [];
  const issues = result.data?.issues ?? [];
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const boxes = observations
    .filter((o) => o.geometry && o.geometry.page_id === page?.id)
    .map((o) => ({
      bbox: o.geometry!.bbox,
      label: String(o.values.mark ?? o.source),
      tone: o.id === selectedObs ? ("selected" as const) : ("default" as const),
    }));
  if (draftBox) boxes.push({ bbox: draftBox, label: "new", tone: "selected" });

  const agentDisabledReason =
    agentStatus === "offline"
      ? "The agent runtime is not running"
      : agentStatus === "login_required"
        ? "The agent runtime needs npm run auth"
        : !spec.has_prompt
          ? "This element has no agent prompt"
          : undefined;

  let inspector;
  if (agentRunId) {
    inspector = (
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Bot aria-hidden className="h-4 w-4 text-zinc-500" />
            Agent run
          </span>
        }
        actions={<Button size="sm" variant="ghost" icon={X} aria-label="Close" onClick={() => setAgentRunId(null)} />}
      >
        <AgentRunPanel
          key={agentRunId}
          runId={agentRunId}
          onFinished={() => {
            setDraftBox(null);
            refresh();
          }}
        />
      </Panel>
    );
  } else if (editor) {
    inspector = (
      <Panel title={editor.observationId ? "Edit observation" : "New observation"}>
        <div className="space-y-3">
          {editor.bbox && (
            <p className="rounded bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600">
              Box {boxSize(page, editor.bbox)}. Values this element measures from the box are filled in from the drawing
              when you save.
            </p>
          )}
          <Field label="Storey">
            <select className="input" value={editor.storey} onChange={(e) => setEditor({ ...editor, storey: e.target.value })}>
              <option value="">No storey</option>
              {storeys.data?.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <SchemaForm schema={spec.schema} value={editor.form} onChange={(form) => setEditor({ ...editor, form })} />
          {save.error && <ErrorText>{errorText(save.error)}</ErrorText>}
          <div className="flex justify-end gap-2 border-t border-zinc-100 pt-3">
            <Button icon={X} onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon={Check}
              loading={save.isPending}
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
            </Button>
          </div>
        </div>
      </Panel>
    );
  } else if (draftBox) {
    inspector = (
      <Panel title="New box" actions={<Badge tone="info">{boxSize(page, draftBox)}</Badge>}>
        <div className="space-y-2">
          <Button className="w-full justify-start" icon={Pencil} onClick={() => openEditor(undefined, draftBox)}>
            Enter values by hand
          </Button>
          <Button
            className="w-full justify-start"
            icon={Bot}
            loading={startAgent.isPending}
            disabled={Boolean(agentDisabledReason)}
            title={agentDisabledReason}
            onClick={() => startAgent.mutate(draftBox)}
          >
            Ask the agent to read it
          </Button>
          {agentDisabledReason && <p className="text-xs text-zinc-500">{agentDisabledReason}.</p>}
          {startAgent.error && <ErrorText>{errorText(startAgent.error)}</ErrorText>}
          <Button className="w-full justify-start" variant="ghost" icon={X} onClick={() => setDraftBox(null)}>
            Discard box
          </Button>
        </div>
      </Panel>
    );
  } else {
    inspector = (
      <Panel title="Add an observation">
        <div className="space-y-3 text-sm text-zinc-600">
          <p className="flex gap-2">
            <MousePointerSquareDashed aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            Drag a box around one element on the drawing. Then enter its values or let the agent read them.
          </p>
          <p className="flex gap-2">
            <ListPlus aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            Values that are not on a plan, such as a depth from a schedule, can be added without a box.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Takeoff"
        description="Read elements off the drawings. Quantities are worked out by the element's code, never by the agent."
        actions={
          <>
            <select
              aria-label="Element"
              className="input w-64"
              value={spec.key}
              onChange={(e) => {
                setElementKey(e.target.value);
                resetDraft();
              }}
            >
              {elements.data?.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.display_name}
                </option>
              ))}
            </select>
            <Button icon={Plus} disabled={!canEdit} onClick={() => openEditor()}>
              Add without a box
            </Button>
          </>
        }
      />

      {!canEdit && (
        <Banner
          tone="warning"
          action={
            <Link href={`/projects/${id}/pre`} className="whitespace-nowrap text-sm font-medium underline">
              Go to Pre
            </Link>
          }
        >
          {frame.data?.status === "stale"
            ? "Pre changed since the last freeze. Freeze a new version to keep working."
            : "The frame is not frozen yet. Freeze it in Pre to start the takeoff."}
        </Banner>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
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
            toolbar={
              <select
                aria-label="Page"
                className="input h-7 w-40 text-xs"
                value={page.id}
                onChange={(e) => {
                  setPageId(e.target.value);
                  resetDraft();
                }}
              >
                {pages.data.map((p, index) => (
                  <option key={p.id} value={p.id}>
                    Page {index + 1}
                    {p.metres_per_pixel ? "" : " (no scale)"}
                  </option>
                ))}
              </select>
            }
          />
        ) : (
          <Panel>
            <EmptyState title="No drawings">Upload drawings in Pre first.</EmptyState>
          </Panel>
        )}

        <div className="space-y-4 xl:sticky xl:top-5">
          {inspector}
          <Panel
            title="Issues"
            bodyClassName=""
            actions={issues.length ? <Badge tone={errors ? "danger" : "warning"}>{issues.length}</Badge> : undefined}
          >
            <IssuesList issues={issues} />
          </Panel>
        </div>
      </div>

      <Panel title={`Observations (${observations.length})`} bodyClassName="">
        {remove.error && (
          <div className="px-4">
            <ErrorText>{errorText(remove.error)}</ErrorText>
          </div>
        )}
        {observations.length ? (
          <table className="table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th className="w-32">Storey</th>
                <th className="w-24">Source</th>
                <th>Values</th>
                <th className="w-24">Box</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {observations.map((o, index) => {
                const boxPage = o.geometry ? pages.data.findIndex((p) => p.id === o.geometry!.page_id) + 1 : null;
                return (
                  <tr
                    key={o.id}
                    className={`cursor-pointer ${o.id === selectedObs ? "bg-amber-50" : "hover:bg-zinc-50"}`}
                    onClick={() => {
                      setSelectedObs(o.id);
                      if (o.geometry && o.geometry.page_id !== page?.id) {
                        setPageId(o.geometry.page_id);
                        resetDraft();
                      }
                    }}
                  >
                    <td className="tabular-nums text-zinc-500">{index + 1}</td>
                    <td>{o.storey ?? <span className="text-red-700">None</span>}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 text-zinc-600">
                        {o.source === "agent" ? <Bot aria-hidden className="h-3.5 w-3.5" /> : <User aria-hidden className="h-3.5 w-3.5" />}
                        {o.source === "agent" ? "Agent" : "Manual"}
                      </span>
                    </td>
                    <td>
                      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {Object.entries(o.values).map(([key, value]) => (
                          <span key={key}>
                            <span className="text-zinc-500">{key}</span> <span className="mono text-zinc-800">{formatValue(value)}</span>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="text-xs text-zinc-500">{boxPage ? `Page ${boxPage}` : "-"}</td>
                    <td>
                      <span className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Pencil}
                          aria-label="Edit observation"
                          title="Edit"
                          disabled={!canEdit}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditor(o);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          aria-label="Delete observation"
                          title="Delete"
                          className="hover:text-red-700"
                          disabled={!canEdit || remove.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            remove.mutate(o.id);
                          }}
                        />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={MousePointerSquareDashed} title="No observations yet">
            Draw a box on page {pageIndex + 1} or add an observation without a box.
          </EmptyState>
        )}
      </Panel>

      <Panel title="Items" bodyClassName="">
        <ItemsTable items={result.data?.items ?? []} />
      </Panel>
    </>
  );
}
