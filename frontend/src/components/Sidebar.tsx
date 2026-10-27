"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, ClipboardCheck, FileStack, FolderKanban, Ruler, Sheet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { apiGet } from "@/lib/api";
import { useFrame } from "@/lib/queries";
import type { BoqLine, Project, ReviewRow } from "@/lib/types";

import { useAgentStatus } from "./AgentBadge";

type Tone = "done" | "todo" | "warn";
type Step = { slug: string; label: string; icon: LucideIcon; status: string; tone: Tone };

const DOTS: Record<Tone, string> = { done: "bg-emerald-400", todo: "bg-zinc-600", warn: "bg-amber-400" };

function useSteps(projectId: string): Step[] {
  const frame = useFrame(projectId).data;
  const review = useQuery({
    queryKey: ["review", projectId],
    queryFn: () => apiGet<ReviewRow[]>(`/api/projects/${projectId}/review`),
  }).data;
  const boq = useQuery({
    queryKey: ["boq", projectId],
    queryFn: () => apiGet<BoqLine[]>(`/api/projects/${projectId}/boq`),
  }).data;

  const observations = review?.reduce((sum, row) => sum + row.observation_count, 0) ?? 0;
  const confirmed = review?.filter((row) => row.status === "confirmed").length ?? 0;
  const stale = review?.some((row) => row.status === "stale") ?? false;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

  return [
    {
      slug: "pre",
      label: "Pre",
      icon: FileStack,
      status:
        frame?.status === "current"
          ? `Frame v${frame.version}`
          : frame?.status === "stale"
            ? "Changed, freeze again"
            : "Not frozen",
      tone: frame?.status === "current" ? "done" : frame?.status === "stale" ? "warn" : "todo",
    },
    {
      slug: "takeoff",
      label: "Takeoff",
      icon: Ruler,
      status: plural(observations, "observation"),
      tone: observations ? "done" : "todo",
    },
    {
      slug: "review",
      label: "Review",
      icon: ClipboardCheck,
      status: stale ? "Needs re-confirming" : `${confirmed} of ${review?.length ?? 0} confirmed`,
      tone: stale ? "warn" : confirmed > 0 && confirmed === review?.length ? "done" : "todo",
    },
    {
      slug: "boq",
      label: "BOQ",
      icon: Sheet,
      status: plural(boq?.length ?? 0, "line"),
      tone: boq?.length ? "done" : "todo",
    },
  ];
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  status,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  status?: string;
  tone?: Tone;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded px-2.5 py-2 ${
        active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
      }`}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        {status && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOTS[tone ?? "todo"]}`} />
            <span className="truncate">{status}</span>
          </span>
        )}
      </span>
    </Link>
  );
}

function ProjectSteps({ projectId, pathname }: { projectId: string; pathname: string }) {
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiGet<Project>(`/api/projects/${projectId}`),
  });
  const steps = useSteps(projectId);
  return (
    <div className="mt-5">
      <p className="truncate px-2.5 pb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500" title={project.data?.name}>
        {project.data?.name ?? "Project"}
      </p>
      <div className="space-y-0.5">
        {steps.map((step) => {
          const href = `/projects/${projectId}/${step.slug}`;
          return (
            <NavLink
              key={step.slug}
              href={href}
              icon={step.icon}
              label={step.label}
              status={step.status}
              tone={step.tone}
              active={pathname.startsWith(href)}
            />
          );
        })}
      </div>
    </div>
  );
}

const AGENT = {
  ready: { label: "Agent ready", detail: "Logged in with Codex", dot: "bg-emerald-400" },
  login_required: { label: "Agent needs login", detail: "npm run auth", dot: "bg-amber-400" },
  offline: { label: "Agent offline", detail: "npm start in agent-runtime", dot: "bg-zinc-500" },
};

function AgentStatus() {
  const state = AGENT[useAgentStatus()];
  return (
    <div className="flex items-center gap-2.5 rounded border border-zinc-800 px-2.5 py-2">
      <Bot aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
          <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} />
          {state.label}
        </p>
        <p className="mono truncate text-[11px] text-zinc-500">{state.detail}</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const projectId = /^\/projects\/([^/]+)/.exec(pathname)?.[1];
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900 px-3 py-4">
      <Link href="/" className="mb-5 flex items-center gap-2 px-2.5 text-sm font-semibold text-white">
        <span className="grid h-6 w-6 place-items-center rounded bg-blue-600 text-[10px] font-bold tracking-tight">BQ</span>
        BOQ Task Core
      </Link>
      <nav className="flex-1 overflow-y-auto">
        <NavLink href="/" icon={FolderKanban} label="Projects" active={pathname === "/"} />
        {projectId && <ProjectSteps projectId={projectId} pathname={pathname} />}
      </nav>
      <AgentStatus />
    </aside>
  );
}
