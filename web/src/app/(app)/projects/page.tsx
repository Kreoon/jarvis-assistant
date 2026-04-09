import { Suspense } from "react";
import { ProjectsClient } from "./ProjectsClient";
import { listProjects } from "@/lib/projects/actions";
import { getWorkspaces } from "@/lib/tasks/actions";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [projects, workspaces] = await Promise.all([
    listProjects().catch(() => []),
    getWorkspaces().catch(() => []),
  ]);

  return (
    <Suspense>
      <ProjectsClient projects={projects} workspaces={workspaces} />
    </Suspense>
  );
}
