"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { apiGet, apiSend, errorText } from "@/lib/api";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => apiGet<Project[]>("/api/projects") });
  const create = useMutation({
    mutationFn: (projectName: string) => apiSend<Project>("POST", "/api/projects", { name: projectName }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>

      <form
        className="card flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) create.mutate(name.trim());
        }}
      >
        <input
          className="input"
          placeholder="New project name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="btn btn-primary" disabled={!name.trim() || create.isPending}>
          Create
        </button>
      </form>
      {create.error && <p className="text-sm text-red-700">{errorText(create.error)}</p>}

      {projects.error && (
        <p className="text-sm text-red-700">
          Could not reach the backend: {errorText(projects.error)}. Is it running on port 8000?
        </p>
      )}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {projects.data?.map((project) => (
          <li key={project.id}>
            <Link href={`/projects/${project.id}/pre`} className="flex justify-between px-4 py-3 hover:bg-slate-50">
              <span className="font-medium">{project.name}</span>
              <span className="text-sm text-slate-500">{project.created_at.slice(0, 10)}</span>
            </Link>
          </li>
        ))}
        {projects.data?.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No projects yet.</li>}
      </ul>
    </div>
  );
}
