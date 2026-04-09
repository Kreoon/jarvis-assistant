import { BaseAgent } from '../../core/base-agent.js';
import type { AgentRequest, LLMTool } from '../../shared/types.js';
import {
  createTask,
  listTasks,
  completeTask,
  getTodayTasks,
  updateTask,
  moveTask,
} from '../../modules/tasks/service.js';
import type { CreateTaskInput, TaskFilter, MoveTaskInput } from '../../modules/tasks/types.js';

// ─── Tool definitions ─────────────────────────────────────────────────────────

const tools: LLMTool[] = [
  {
    name: 'create_task',
    description: 'Crea una nueva tarea en un workspace de Alexander.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título de la tarea' },
        workspaceSlug: { type: 'string', description: 'Slug del workspace (ej: kreoon, personal, ugc-colombia)' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'], description: 'Prioridad' },
        dueDate: { type: 'string', description: 'Fecha límite en formato YYYY-MM-DD' },
        description: { type: 'string', description: 'Descripción opcional' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags opcionales' },
      },
      required: ['title', 'workspaceSlug'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Lista las tareas del Command Center, con filtros opcionales.',
    parameters: {
      type: 'object',
      properties: {
        workspaceSlug: { type: 'string', description: 'Filtrar por workspace' },
        status: { type: 'string', enum: ['backlog', 'in_progress', 'review', 'done'] },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        includeCompleted: { type: 'boolean', description: 'Incluir tareas completadas' },
      },
    },
  },
  {
    name: 'complete_task',
    description: 'Marca una tarea como completada por su ID.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID de la tarea' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_today_tasks',
    description: 'Devuelve las tareas de hoy: con due_date de hoy o de prioridad urgent/high.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_task',
    description: 'Actualiza campos de una tarea existente.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID de la tarea' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
  {
    name: 'move_task',
    description: 'Mueve una tarea a otra columna del kanban.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'UUID de la tarea' },
        status: { type: 'string', enum: ['backlog', 'in_progress', 'review', 'done'] },
        position: { type: 'number', description: 'Posición numérica dentro de la columna (opcional)' },
      },
      required: ['id', 'status'],
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

const toolHandlers: Record<string, (args: Record<string, unknown>, _req: AgentRequest) => Promise<unknown>> = {
  async create_task(args) {
    const input: CreateTaskInput = {
      title: args.title as string,
      workspaceSlug: args.workspaceSlug as string,
      priority: args.priority as CreateTaskInput['priority'],
      dueDate: args.dueDate as string | undefined,
      description: args.description as string | undefined,
      tags: args.tags as string[] | undefined,
      source: 'whatsapp',
    };
    return createTask(input);
  },

  async list_tasks(args) {
    const filter: TaskFilter = {
      workspaceSlug: args.workspaceSlug as string | undefined,
      status: args.status as TaskFilter['status'],
      priority: args.priority as TaskFilter['priority'],
      includeCompleted: Boolean(args.includeCompleted),
    };
    return listTasks(filter);
  },

  async complete_task(args) {
    return completeTask(args.id as string);
  },

  async get_today_tasks() {
    return getTodayTasks();
  },

  async update_task(args) {
    const { id, ...patch } = args;
    return updateTask(id as string, patch as Parameters<typeof updateTask>[1]);
  },

  async move_task(args) {
    const input: MoveTaskInput = {
      status: args.status as MoveTaskInput['status'],
      position: args.position as number | undefined,
    };
    return moveTask(args.id as string, input);
  },
};

// ─── Agent ────────────────────────────────────────────────────────────────────

class TaskAgent extends BaseAgent {
  constructor() {
    super({
      name: 'task-agent',
      systemPrompt: `Eres el agente de tareas de Jarvis, el asistente personal de Alexander Cast.

Manejas el Command Center: un kanban personal con workspaces (kreoon, ugc-colombia, personal, infiny-latam, etc.).

## Tu tono
Parcero, directo, colombiano. Sin formalismos. Cuando Alexander dice "necesito hacer X" ya creas la tarea. No preguntas si quiere crearla.

## Reglas
- Cuando el usuario menciona "tarea X en Y" → usa create_task con workspaceSlug=Y
- Cuando dice "qué tengo hoy" o "mis tareas de hoy" → usa get_today_tasks
- Cuando dice "completé X" o "ya terminé X" → usa complete_task con el ID correcto
- Cuando pide ver tareas de un workspace → usa list_tasks
- Cuando quiere mover una tarea de columna → usa move_task
- Siempre confirma la operación con el título de la tarea para evitar confusiones
- Si no tienes el ID exacto para complete_task, usa list_tasks primero para buscarlo

## Workspaces disponibles (slugs)
kreoon, ugc-colombia, personal, infiny-latam, reyes-contenido, prolab

Responde siempre en español, tono parcero/casual.`,
      tools,
      toolHandlers,
    });
  }
}

export const taskAgent = new TaskAgent();
