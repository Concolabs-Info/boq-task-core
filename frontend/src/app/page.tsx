"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Banner, Button, EmptyState, ErrorText, PageHeader, Panel } from "@/components/ui";
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
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Projects" description="Each project holds its drawings, takeoff and BOQ." />

      {projects.error && (
        <Banner tone="danger">
          Cannot reach the backend at port 8000 ({errorText(projects.error)}). Start it with{" "}
          <code className="mono">uvicorn app.main:app --reload</code> in <code className="mono">backend</code>.
        </Banner>
      )}

      <Panel
        title="All projects"
        bodyClassName=""
        actions={
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) create.mutate(name.trim());
            }}
          >
            <input
              className="input w-64"
              placeholder="New project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <Button type="submit" variant="primary" icon={Plus} loading={create.isPending} disabled={!name.trim()}>
              Create project
            </Button>
          </form>
        }
      >
        {create.error && (
          <div className="px-4 pt-3">
            <ErrorText>{errorText(create.error)}</ErrorText>
          </div>
        )}
        {projects.data?.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet">
            Create a project, then upload its drawings in Pre.
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="w-40">Created</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {projects.data?.map((project) => (
                <tr key={project.id} className="hover:bg-zinc-50">
                  <td>
                    <Link href={`/projects/${project.id}/pre`} className="font-medium text-zinc-900 hover:text-blue-700">
                      {project.name}
                    </Link>
                  </td>
                  <td className="tabular-nums text-zinc-500">{project.created_at.slice(0, 10)}</td>
                  <td className="text-right">
                    <Link
                      href={`/projects/${project.id}/pre`}
                      className="inline-flex items-center gap-0.5 text-sm font-medium text-blue-700 hover:underline"
                    >
                      Open
                      <ChevronRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
