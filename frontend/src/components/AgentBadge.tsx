"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { AgentStatus } from "@/lib/types";

const LABELS: Record<AgentStatus, { text: string; className: string; hint: string }> = {
  ready: { text: "Agent ready", className: "bg-emerald-100 text-emerald-800", hint: "Logged in with Codex" },
  login_required: {
    text: "Agent needs login",
    className: "bg-amber-100 text-amber-800",
    hint: "Run npm run auth in agent-runtime",
  },
  offline: { text: "Agent offline", className: "bg-slate-200 text-slate-700", hint: "Run npm start in agent-runtime" },
};

export function useAgentStatus(): AgentStatus {
  const { data } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => apiGet<{ status: AgentStatus }>("/api/agent/status"),
    refetchInterval: 15_000,
  });
  return data?.status ?? "offline";
}

export function AgentBadge() {
  const label = LABELS[useAgentStatus()];
  return (
    <span title={label.hint} className={`rounded-full px-2.5 py-1 text-xs font-medium ${label.className}`}>
      {label.text}
    </span>
  );
}
