import { Router } from 'express';
import { logger } from '../shared/logger.js';
import {
  listWorkspaces,
  listTasks,
  getTask,
  createTask,
  updateTask,
  moveTask,
  completeTask,
  softDelete,
  incrementPomodoro,
  getTodayTasks,
} from '../modules/tasks/service.js';
import type { TaskFilter, TaskStatus, TaskPriority, MoveTaskInput } from '../modules/tasks/types.js';

const router = Router();
const log = logger.child({ module: 'route-tasks' });

// GET /api/tasks/workspaces
router.get('/workspaces', async (_req, res) => {
  try {
    const workspaces = await listWorkspaces();
    res.json({ workspaces });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg }, 'listWorkspaces failed');
    res.status(500).json({ error: msg });
  }
});

// GET /api/tasks/today
router.get('/today', async (_req, res) => {
  try {
    const tasks = await getTodayTasks();
    res.json({ tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg }, 'getTodayTasks failed');
    res.status(500).json({ error: msg });
  }
});

// GET /api/tasks?workspaceSlug=&status=&priority=&dueBefore=&includeCompleted=
router.get('/', async (req, res) => {
  try {
    const filter: TaskFilter = {
      workspaceSlug: req.query.workspaceSlug as string | undefined,
      status: req.query.status as TaskStatus | undefined,
      priority: req.query.priority as TaskPriority | undefined,
      dueBefore: req.query.dueBefore as string | undefined,
      includeCompleted: req.query.includeCompleted === 'true',
    };
    const tasks = await listTasks(filter);
    res.json({ tasks });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg }, 'listTasks failed');
    res.status(500).json({ error: msg });
  }
});

// POST /api/tasks
router.post('/', async (req, res) => {
  const { title, workspaceSlug, priority, dueDate, description, tags } = req.body as Record<string, unknown>;

  if (!title || !workspaceSlug) {
    return res.status(400).json({ error: 'title and workspaceSlug are required' });
  }

  try {
    const task = await createTask({
      title: title as string,
      workspaceSlug: workspaceSlug as string,
      priority: priority as TaskPriority | undefined,
      dueDate: dueDate as string | undefined,
      description: description as string | undefined,
      tags: tags as string[] | undefined,
      source: 'web',
    });
    res.status(201).json({ task });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg }, 'createTask failed');
    res.status(500).json({ error: msg });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req, res) => {
  try {
    const task = await updateTask(req.params.id, req.body);
    res.json({ task });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, id: req.params.id }, 'updateTask failed');
    res.status(500).json({ error: msg });
  }
});

// POST /api/tasks/:id/complete
router.post('/:id/complete', async (req, res) => {
  try {
    const task = await completeTask(req.params.id);
    res.json({ task });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, id: req.params.id }, 'completeTask failed');
    res.status(500).json({ error: msg });
  }
});

// POST /api/tasks/:id/move — body: { status, position? }
router.post('/:id/move', async (req, res) => {
  const { status, position } = req.body as MoveTaskInput;
  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  try {
    const task = await moveTask(req.params.id, { status, position });
    res.json({ task });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, id: req.params.id }, 'moveTask failed');
    res.status(500).json({ error: msg });
  }
});

// POST /api/tasks/:id/pomodoro — body: { date? }
router.post('/:id/pomodoro', async (req, res) => {
  const date = (req.body.date as string | undefined) ?? new Date().toISOString().split('T')[0];

  try {
    await incrementPomodoro(req.params.id, date);
    const task = await getTask(req.params.id);
    res.json({ task });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, id: req.params.id }, 'incrementPomodoro failed');
    res.status(500).json({ error: msg });
  }
});

// DELETE /api/tasks/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    await softDelete(req.params.id);
    res.json({ deleted: true, id: req.params.id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error({ error: msg, id: req.params.id }, 'softDelete failed');
    res.status(500).json({ error: msg });
  }
});

export { router as tasksRouter };
