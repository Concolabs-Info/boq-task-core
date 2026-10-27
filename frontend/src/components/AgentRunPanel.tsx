"use client";

import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";

type Line = { kind: "text" | "tool" | "result" | "error"; text: string };

/**
 * Shows what the agent does in one run until it finishes. The run is started by the caller
 * (on a click), so re-rendering or re-mounting this panel never starts a second run.
 * Render it with key={runId} so each run starts with a fresh log.
 */
export function AgentRunPanel({ runId, onFinished }: { runId: string; onFinished: () => void }) {
  const [lines, setLines] = useState<Line[]>([{ kind: "text", text: "The agent is reading the drawing..." }]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const add = (line: Line) => setLines((current) => [...current, line]);

    const source = new EventSource(apiUrl(`/api/agent-runs/${runId}/events`));
    source.addEventListener("text", (event) => add({ kind: "text", text: JSON.parse(event.data).text }));
    source.addEventListener("tool", (event) => {
      const data = JSON.parse(event.data);
      add({ kind: "tool", text: `Used ${data.name}${data.isError ? " (problem)" : ""}` });
    });
    source.addEventListener("result", (event) => {
      const data = JSON.parse(event.data);
      source.close();
      add(
        data.status === "accepted"
          ? { kind: "result", text: `Saved ${data.ids.length} observation(s). Check them before confirming.` }
          : { kind: "error", text: `The agent could not finish: ${data.reason}` },
      );
      setDone(true);
      onFinished();
    });
    source.onerror = () => {
      source.close();
      add({ kind: "error", text: "Lost connection to the agent." });
      setDone(true);
    };
    return () => source.close();
    // One stream per run id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

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
