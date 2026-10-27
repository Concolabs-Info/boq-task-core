"use client";

import { CheckCircle2, Loader2, MessageSquare, Wrench, XCircle, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { apiUrl } from "@/lib/api";

type Line = { kind: "text" | "tool" | "result" | "error"; text: string };

const LINE_STYLES: Record<Line["kind"], { icon: LucideIcon; className: string }> = {
  text: { icon: MessageSquare, className: "text-zinc-700" },
  tool: { icon: Wrench, className: "text-zinc-500" },
  result: { icon: CheckCircle2, className: "text-emerald-700" },
  error: { icon: XCircle, className: "text-red-700" },
};

/**
 * Shows what the agent does in one run until it finishes. The run is started by the caller
 * (on a click), so re-rendering or re-mounting this panel never starts a second run.
 * Render it with key={runId} so each run starts with a fresh log.
 */
export function AgentRunPanel({ runId, onFinished }: { runId: string; onFinished: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const add = (line: Line) => setLines((current) => [...current, line]);
    const source = new EventSource(apiUrl(`/api/agent-runs/${runId}/events`));
    source.addEventListener("text", (event) => add({ kind: "text", text: JSON.parse(event.data).text }));
    source.addEventListener("tool", (event) => {
      const data = JSON.parse(event.data);
      add({ kind: "tool", text: `${data.name}${data.isError ? " returned a problem" : ""}` });
    });
    source.addEventListener("result", (event) => {
      const data = JSON.parse(event.data);
      source.close();
      add(
        data.status === "accepted"
          ? { kind: "result", text: `Saved ${data.ids.length} observation(s). Check them before confirming.` }
          : { kind: "error", text: data.reason },
      );
      setDone(true);
      onFinished();
    });
    source.onerror = () => {
      source.close();
      add({ kind: "error", text: "Lost connection to the agent runtime." });
      setDone(true);
    };
    return () => source.close();
    // One stream per run id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <ol className="space-y-1.5 text-sm">
      {lines.map((line, index) => {
        const { icon: Icon, className } = LINE_STYLES[line.kind];
        return (
          <li key={index} className={`flex gap-2 ${className}`}>
            <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span className={`min-w-0 whitespace-pre-wrap break-words ${line.kind === "tool" ? "mono text-xs leading-5" : ""}`}>
              {line.text}
            </span>
          </li>
        );
      })}
      {!done && (
        <li className="flex items-center gap-2 text-zinc-400">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Reading the drawing
        </li>
      )}
    </ol>
  );
}
