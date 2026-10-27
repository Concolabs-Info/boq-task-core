"use client";

import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import type { AgentStatus } from "@/lib/types";

/** Agent runtime status, polled every 15 seconds through the backend. */
export function useAgentStatus(): AgentStatus {
  const { data } = useQuery({
    queryKey: ["agent-status"],
    queryFn: () => apiGet<{ status: AgentStatus }>("/api/agent/status"),
    refetchInterval: 15_000,
  });
  return data?.status ?? "offline";
}
