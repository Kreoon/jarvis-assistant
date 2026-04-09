"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { createProject } from "@/lib/projects/actions";
import type { Workspace } from "@/lib/tasks/types";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  workspaces: Workspace[];
}

export function NewProjectDialog({
  open,
  onClose,
  workspaces,
}: NewProjectDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const workspaceOptions = workspaces.map((ws) => ({
    value: ws.id,
    label: `${ws.icon} ${ws.name}`,
  }));

  const handleClose = () => {
    setName("");
    setDescription("");
    setWorkspaceId(workspaces[0]?.id ?? "");
    setError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!workspaceId) {
      setError("Selecciona un workspace");
      return;
    }

    startTransition(async () => {
      try {
        const project = await createProject({
          workspaceId,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        handleClose();
        router.push(`/projects/${project.id}`);
      } catch {
        setError("Error al crear el proyecto. Intenta de nuevo.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Nuevo proyecto"
      description="Crea un proyecto para agrupar tus tareas."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Mi proyecto"
          autoFocus
          disabled={isPending}
        />

        <Select
          label="Workspace"
          options={workspaceOptions}
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          disabled={isPending}
        />

        <Textarea
          label="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="¿De qué trata este proyecto?"
          disabled={isPending}
        />

        {error ? (
          <p className="text-xs text-[color:var(--danger)]">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" loading={isPending}>
            Crear proyecto
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
