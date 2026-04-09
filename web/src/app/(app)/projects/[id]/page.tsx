import { notFound } from "next/navigation";
import { getProjectWithTasks } from "@/lib/projects/actions";
import { getWorkspaces } from "@/lib/tasks/actions";
import { ProjectDetailClient } from "./ProjectDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;

  const [result, workspaces] = await Promise.all([
    getProjectWithTasks(id).catch(() => null),
    getWorkspaces().catch(() => []),
  ]);

  if (!result) notFound();

  return (
    <ProjectDetailClient
      project={result.project}
      tasks={result.tasks}
      stats={result.stats}
      workspaces={workspaces}
    />
  );
}
