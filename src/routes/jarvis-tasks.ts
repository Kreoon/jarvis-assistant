import { Router } from 'express';
import { logger } from '../shared/logger.js';
import {
  createTask,
  getTodayTasks,
  findTaskFuzzy,
  completeTask,
  listTasks,
  logWebhook,
} from '../modules/tasks/service.js';
import type { TaskPriority } from '../modules/tasks/types.js';

const router = Router();
const log = logger.child({ module: 'route-jarvis-tasks' });

// ─── Autenticación por header ─────────────────────────────────────────────────

router.use((req, res, next) => {
  const secret = process.env.JARVIS_TASKS_SECRET;
  if (!secret) {
    log.warn('JARVIS_TASKS_SECRET not set — webhook is open');
    return next();
  }
  if (req.headers['x-jarvis-secret'] !== secret) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  next();
});

// ─── Parser de comandos ───────────────────────────────────────────────────────

type ParsedCommand =
  | { type: 'create'; title: string; workspace: string; priority: TaskPriority }
  | { type: 'today' }
  | { type: 'complete'; query: string }
  | { type: 'status'; workspace: string }
  | { type: 'unknown' };

function parseCommand(text: string): ParsedCommand {
  const t = text.trim();

  // "urgente X" o "tarea urgente X en Y"
  const urgentEnMatch = t.match(/(?:tarea\s+)?urgente\s+(.+?)\s+en\s+(.+)/i);
  if (urgentEnMatch) {
    return { type: 'create', title: urgentEnMatch[1].trim(), workspace: urgentEnMatch[2].trim(), priority: 'urgent' };
  }
  const urgentMatch = t.match(/(?:tarea\s+)?urgente\s+(.+)/i);
  if (urgentMatch) {
    return { type: 'create', title: urgentMatch[1].trim(), workspace: 'personal', priority: 'urgent' };
  }

  // "nueva tarea X en Y" o "tarea X en Y"
  const tareaEnMatch = t.match(/(?:nueva\s+)?tarea\s+(.+?)\s+en\s+(.+)/i);
  if (tareaEnMatch) {
    return { type: 'create', title: tareaEnMatch[1].trim(), workspace: tareaEnMatch[2].trim(), priority: 'medium' };
  }

  // "qué tengo hoy" / "que tengo hoy"
  if (/qu[eé]\s+tengo\s+hoy/i.test(t)) {
    return { type: 'today' };
  }

  // "completé X" / "complete X"
  const completeMatch = t.match(/complet[eé]\s+(.+)/i);
  if (completeMatch) {
    return { type: 'complete', query: completeMatch[1].trim() };
  }

  // "estado de Y"
  const estadoMatch = t.match(/estado\s+de\s+(.+)/i);
  if (estadoMatch) {
    return { type: 'status', workspace: estadoMatch[1].trim() };
  }

  return { type: 'unknown' };
}

// ─── POST / ───────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { text, from } = req.body as { text?: string; from?: string };

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const command = parseCommand(text);
  log.info({ command: command.type, from, text: text.slice(0, 100) }, 'Jarvis task command');

  let reply = '';
  let data: unknown = null;

  try {
    switch (command.type) {
      case 'create': {
        const task = await createTask({
          title: command.title,
          workspaceSlug: command.workspace,
          priority: command.priority,
          source: 'whatsapp',
        });
        reply = `Tarea creada: "${task.title}" en ${command.workspace} (${command.priority})`;
        data = task;
        break;
      }

      case 'today': {
        const tasks = await getTodayTasks();
        if (!tasks.length) {
          reply = 'No tienes tareas urgentes o para hoy. Día libre parce.';
        } else {
          const lines = tasks.map((t, i) => `${i + 1}. [${t.priority}] ${t.title}${t.due_date ? ` — ${t.due_date}` : ''}`);
          reply = `Tienes ${tasks.length} tarea(s) hoy:\n\n${lines.join('\n')}`;
        }
        data = tasks;
        break;
      }

      case 'complete': {
        const found = await findTaskFuzzy(command.query);
        if (!found) {
          reply = `No encontré ninguna tarea que coincida con "${command.query}"`;
        } else {
          await completeTask(found.id);
          reply = `Completada: "${found.title}"`;
          data = found;
        }
        break;
      }

      case 'status': {
        const tasks = await listTasks({ workspaceSlug: command.workspace, includeCompleted: false });
        const byStatus = tasks.reduce<Record<string, number>>((acc, t) => {
          acc[t.status] = (acc[t.status] ?? 0) + 1;
          return acc;
        }, {});
        const lines = Object.entries(byStatus).map(([s, n]) => `${s}: ${n}`);
        reply = lines.length
          ? `Estado de ${command.workspace}:\n${lines.join('\n')}`
          : `No hay tareas activas en ${command.workspace}`;
        data = byStatus;
        break;
      }

      default:
        reply = 'No entendí el comando. Intenta: "tarea X en Y", "qué tengo hoy", "completé X", "estado de Y"';
    }

    await logWebhook('whatsapp', command.type, { text, from }, { reply }, 'success');
    res.json({ reply, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, command: command.type }, 'Jarvis task command failed');
    await logWebhook('whatsapp', command.type, { text, from }, null, 'error', msg).catch(() => {});
    res.status(500).json({ error: msg });
  }
});

export { router as jarvisTasksRouter };
