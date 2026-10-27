"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { ProjectNav } from "@/components/ProjectNav";
import { apiGet } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => apiGet<Project>(`/api/projects/${id}`) });

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:underline">
          Projects
        </Link>
        <span>/</span>
        <h1 className="text-xl font-semibold text-slate-900">{project.data?.name ?? "..."}</h1>
      </div>
      <ProjectNav projectId={id} />
      {children}
    </div>
  );
}
