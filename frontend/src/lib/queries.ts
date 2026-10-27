"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet } from "./api";
import type { ElementInfo, ElementResult, FrameInfo, Page, Storey } from "./types";

export function usePages(projectId: string) {
  return useQuery({ queryKey: ["pages", projectId], queryFn: () => apiGet<Page[]>(`/api/projects/${projectId}/pages`) });
}

export function useStoreys(projectId: string) {
  return useQuery({
    queryKey: ["storeys", projectId],
    queryFn: () => apiGet<Storey[]>(`/api/projects/${projectId}/storeys`),
  });
}

export function useFrame(projectId: string) {
  return useQuery({ queryKey: ["frame", projectId], queryFn: () => apiGet<FrameInfo>(`/api/projects/${projectId}/frame`) });
}

export function useElements() {
  return useQuery({ queryKey: ["elements"], queryFn: () => apiGet<ElementInfo[]>("/api/elements") });
}

export function useElementResult(projectId: string, element: string | undefined) {
  return useQuery({
    queryKey: ["element", projectId, element],
    queryFn: () => apiGet<ElementResult>(`/api/projects/${projectId}/elements/${element}`),
    enabled: Boolean(element),
  });
}

/** Everything that depends on Pre or observations is refetched after a change. */
export function useRefreshProject(projectId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["pages", "storeys", "frame", "element", "review", "boq"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key, projectId] }),
      ),
    );
}
