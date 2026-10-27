"use client";

import { useEffect, useState } from "react";

import { apiSend, apiUrl, errorText } from "@/lib/api";
import type { Geometry } from "@/lib/types";

type Line = { kind: "text" | "tool" | "result" | "error"; text: string };

/** Starts one agent run for a box and shows what the agent does until it finishes. */
export function AgentRunPanel({
  projectId,
  element,
  geometry,
  onFinished,
}: {
  projectId: string;
  element: string;
  geometry: Geometry;
  onFinished: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([{ kind: "text", text: "Starting the agent..." }]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;
    const add = (line: Line) => setLines((current) => [...current, line]);

    apiSend<{ run_id: string }>("POST", `/api/projects/${projectId}/elements/${element}/agent-runs`, geometry)
      .then(({ run_id }) => {
        if (cancelled) return;
        source = new EventSource(apiUrl(`/api/agent-runs/${run_id}/events`));
        source.addEventListener("text", (event) => add({ kind: "text", text: JSON.parse(event.data).text }));
        source.addEventListener("tool", (event) => {
          const data = JSON.parse(event.data);
          add({ kind: "tool", text: `Used ${data.name}${data.isError ? " (problem)" : ""}` });
        });
        source.addEventListener("result", (event) => {
          const data = JSON.parse(event.data);
          source?.close();
          add(
            data.status === "accepted"
              ? { kind: "result", text: `Saved ${data.ids.length} observation(s). Check them before confirming.` }
              : { kind: "error", text: `The agent could not finish: ${data.reason}` },
          );
          setDone(true);
          onFinished();
        });
        source.onerror = () => {
          source?.close();
          add({ kind: "error", text: "Lost connection to the agent." });
          setDone(true);
        };
      })
      .catch((error) => {
        add({ kind: "error", text: errorText(error) });
        setDone(true);
      });

    return () => {
      cancelled = true;
      source?.close();
    };
    // One run per mounted panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const colours = { text: "text-slate-700", tool: "text-slate-500", result: "text-emerald-700", error: "text-red-700" };
  return (
    <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      {lines.map((line, index) => (
        <p key={index} className={`whitespace-pre-wrap ${colours[line.kind]}`}>
          {line.text}
        </p>
      ))}
      {!done && <p className="animate-pulse text-slate-400">Working...</p>}
    </div>
  );
}
