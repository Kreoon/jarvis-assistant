import { Router } from 'express';
import { logger } from '../shared/logger.js';
import {
  createTask,
  updateTask,
  listTasks,
  getTodayTasks,
  logWebhook,
} from '../modules/tasks/service.js';
import type { CreateTaskInput, TaskFilter } from '../modules/tasks/types.js';

const router = Router();
const log = logger.child({ module: 'route-n8n-tasks' });

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.use((req, res, next) => {
  const apiKey = process.env.N8N_TASKS_API_KEY;
  if (!apiKey) {
    log.warn('N8N_TASKS_API_KEY not set — endpoint is open');
    return next();
  }
  if (req.headers['x-api-key'] !== apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});

// ─── POST / — body: { action, payload } ──────────────────────────────────────

router.post('/', async (req, res) => {
  const { action, payload } = req.body as { action?: string; payload?: Record<string, unknown> };

  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }

  log.info({ action, keys: payload ? Object.keys(payload) : [] }, 'n8n task action');

  let result: unknown = null;

  try {
    switch (action) {
      case 'create_task': {
        if (!payload) throw new Error('payload required for create_task');
        result = await createTask(payload as unknown as CreateTaskInput);
        break;
      }

      case 'update_status': {
        if (!payload?.id || !payload?.status) {
          throw new Error('payload.id and payload.status required');
        }
        result = await updateTask(payload.id as string, { status: payload.status as string } as Parameters<typeof updateTask>[1]);
        break;
      }

      case 'get_workspace_tasks': {
        const filter: TaskFilter = {
          workspaceSlug: payload?.workspaceSlug as string | undefined,
          status: payload?.status as TaskFilter['status'],
          priority: payload?.priority as TaskFilter['priority'],
          includeCompleted: Boolean(payload?.includeCompleted),
        };
        result = await listTasks(filter);
        break;
      }

      case 'get_today': {
        result = await getTodayTasks();
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    await logWebhook('n8n', action, { payload: payload ?? {} }, { result }, 'success');
    res.json({ success: true, action, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, action }, 'n8n task action failed');
    await logWebhook('n8n', action, { payload: payload ?? {} }, null, 'error', msg).catch(() => {});
    res.status(500).json({ error: msg });
  }
});

export { router as n8nTasksRouter };
