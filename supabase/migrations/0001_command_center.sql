-- Migration: Jarvis Command Center — schema inicial
-- Date: 2026-04-09
-- Author: Alexander Cast
-- Proyecto: jarvis-assistant (Kreoon Tech)
--
-- Tablas: workspaces, projects, tasks, daily_focus, webhook_logs
-- RLS: service_role full access; anon/authenticated solo lectura en las 3 principales
-- Realtime: tasks, daily_focus agregadas a supabase_realtime
-- Seed: 7 workspaces del ecosistema Infiny

-- ============================================================
-- Extension
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- Table: workspaces
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  slug        TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  icon        TEXT,                          -- nombre de icono lucide (ej. 'briefcase')
  color       TEXT,                          -- hex (ej. '#00e5ff')
  sort_order  INT         DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE workspaces IS 'Espacios de trabajo del ecosistema Infiny (un workspace por negocio/pilar)';
COMMENT ON COLUMN workspaces.icon  IS 'Nombre del icono en lucide-react';
COMMENT ON COLUMN workspaces.color IS 'Color hex del workspace para el UI';

-- ============================================================
-- Table: projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'paused', 'done', 'archived')),
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at   TIMESTAMPTZ                           -- soft delete
);

COMMENT ON TABLE projects IS 'Proyectos agrupados dentro de un workspace';
COMMENT ON COLUMN projects.deleted_at IS 'Soft delete — no eliminar filas, poner timestamp aquí';

-- ============================================================
-- Table: tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id        UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id          UUID        REFERENCES projects(id) ON DELETE SET NULL,
  title               TEXT        NOT NULL,
  description         TEXT,
  status              TEXT        NOT NULL DEFAULT 'backlog'
                                  CHECK (status IN ('backlog', 'in_progress', 'review', 'done')),
  priority            TEXT        NOT NULL DEFAULT 'medium'
                                  CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  position            INT         NOT NULL DEFAULT 0,
  due_date            TIMESTAMPTZ,
  tags                TEXT[]      DEFAULT '{}',
  pomodoros_completed INT         DEFAULT 0,
  google_event_id     TEXT,                          -- previene duplicados en sync Calendar
  source              TEXT        NOT NULL DEFAULT 'web'
                                  CHECK (source IN ('web', 'whatsapp', 'n8n', 'calendar', 'api')),
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at        TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ                    -- soft delete
);

COMMENT ON TABLE tasks IS 'Tareas del kanban. Soporte multi-origen: web, WhatsApp, n8n, Google Calendar';
COMMENT ON COLUMN tasks.google_event_id     IS 'ID del evento en Google Calendar para evitar duplicados en sync';
COMMENT ON COLUMN tasks.source              IS 'Origen de la tarea: web | whatsapp | n8n | calendar | api';
COMMENT ON COLUMN tasks.pomodoros_completed IS 'Contador de sesiones pomodoro completadas para esta tarea';
COMMENT ON COLUMN tasks.deleted_at          IS 'Soft delete — filtrar con WHERE deleted_at IS NULL';

-- ============================================================
-- Table: daily_focus
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_focus (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date                DATE        UNIQUE NOT NULL,
  selected_task_id    UUID        REFERENCES tasks(id) ON DELETE SET NULL,
  pomodoros_completed INT         DEFAULT 0,
  minutes_focused     INT         DEFAULT 0,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE daily_focus IS 'Registro diario del modo foco TDA: tarea principal + métricas de pomodoros';
COMMENT ON COLUMN daily_focus.date IS 'Una fila por día (UNIQUE). Usar ON CONFLICT (date) DO UPDATE para upsert';

-- ============================================================
-- Table: webhook_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source     TEXT        NOT NULL,   -- 'jarvis-whatsapp' | 'n8n' | 'google-calendar'
  action     TEXT,
  payload    JSONB,
  response   JSONB,
  status     INT,
  error      TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE webhook_logs IS 'Log de todos los webhooks entrantes: WhatsApp, n8n, Google Calendar';
COMMENT ON COLUMN webhook_logs.source IS 'Origen: jarvis-whatsapp | n8n | google-calendar';

-- ============================================================
-- Indexes — tasks
-- ============================================================
-- Consulta principal del kanban: tareas activas de un workspace ordenadas por posición
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status_position
  ON tasks (workspace_id, status, position)
  WHERE deleted_at IS NULL;

-- Tareas con fecha límite (agenda, calendario)
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON tasks (due_date)
  WHERE deleted_at IS NULL;

-- Filtro por prioridad (urgente/alta primero)
CREATE INDEX IF NOT EXISTS idx_tasks_priority
  ON tasks (priority);

-- Filtro por status con soft delete (útil para reportes)
CREATE INDEX IF NOT EXISTS idx_tasks_status_active
  ON tasks (status)
  WHERE deleted_at IS NULL;

-- FK para JOINs con projects
CREATE INDEX IF NOT EXISTS idx_tasks_project_id
  ON tasks (project_id);

-- Deduplicación Google Calendar
CREATE INDEX IF NOT EXISTS idx_tasks_google_event_id
  ON tasks (google_event_id)
  WHERE google_event_id IS NOT NULL;

-- ============================================================
-- Indexes — projects
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_workspace_active
  ON projects (workspace_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- Indexes — webhook_logs
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at
  ON webhook_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_source_created_at
  ON webhook_logs (source, created_at DESC);

-- ============================================================
-- Trigger function: set_updated_at
-- CREATE OR REPLACE para que sea idempotente
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger en tasks
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Trigger en projects
DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS — habilitar en las 5 tablas
-- ============================================================
ALTER TABLE workspaces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_focus  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas: service_role — acceso total (server-side)
-- ============================================================

-- workspaces
DROP POLICY IF EXISTS "service_role full access on workspaces" ON workspaces;
CREATE POLICY "service_role full access on workspaces"
  ON workspaces FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- projects
DROP POLICY IF EXISTS "service_role full access on projects" ON projects;
CREATE POLICY "service_role full access on projects"
  ON projects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- tasks
DROP POLICY IF EXISTS "service_role full access on tasks" ON tasks;
CREATE POLICY "service_role full access on tasks"
  ON tasks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- daily_focus
DROP POLICY IF EXISTS "service_role full access on daily_focus" ON daily_focus;
CREATE POLICY "service_role full access on daily_focus"
  ON daily_focus FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- webhook_logs
DROP POLICY IF EXISTS "service_role full access on webhook_logs" ON webhook_logs;
CREATE POLICY "service_role full access on webhook_logs"
  ON webhook_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Políticas: anon / authenticated — solo lectura en workspaces, projects, tasks
-- (necesario para Realtime del cliente browser)
-- daily_focus y webhook_logs: sin acceso desde el browser
-- ============================================================

-- workspaces — lectura pública (necesario para cargar el sidebar)
DROP POLICY IF EXISTS "public read on workspaces" ON workspaces;
CREATE POLICY "public read on workspaces"
  ON workspaces FOR SELECT
  TO anon, authenticated
  USING (true);

-- projects — lectura pública
DROP POLICY IF EXISTS "public read on projects" ON projects;
CREATE POLICY "public read on projects"
  ON projects FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

-- tasks — lectura pública (kanban + Realtime)
DROP POLICY IF EXISTS "public read on tasks" ON tasks;
CREATE POLICY "public read on tasks"
  ON tasks FOR SELECT
  TO anon, authenticated
  USING (deleted_at IS NULL);

-- ============================================================
-- Realtime — agregar tasks y daily_focus a la publicación
-- Usar DO block para manejar el caso en que ya estén registradas
-- ============================================================
DO $$
BEGIN
  -- tasks
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- ya estaba en la publicación, ignorar
  END;

  -- daily_focus
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_focus;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;

-- ============================================================
-- Seed: 7 workspaces del ecosistema Infiny / Alexander Cast
-- ON CONFLICT (slug) DO NOTHING garantiza idempotencia
-- ============================================================
INSERT INTO workspaces (slug, name, description, icon, color, sort_order) VALUES
  ('infiny-latam',      'Infiny Latam 360°',          'Holding digital y marketing para todo el ecosistema',  'globe',  '#00e5ff', 1),
  ('kreoon',            'Kreoon',                      'Plataforma tech principal del ecosistema',             'rocket', '#7c3aed', 2),
  ('ugc-colombia',      'UGC Colombia',                'Agencia de contenido UGC (@agenciaugccolombia)',       'video',  '#ec4899', 3),
  ('sanavi',            'Sanavi Natural',              'Marca de productos naturales',                        'leaf',   '#10b981', 4),
  ('reyes-contenido',   'Los Reyes del Contenido',     'Comunidad de creadores de contenido',                 'crown',  '#f59e0b', 5),
  ('cafetiando',        'Cafetiando',                  'Proyecto café',                                       'coffee', '#92400e', 6),
  ('personal',          'Personal',                    'Tareas y proyectos personales de Alexander',          'user',   '#6b7280', 7)
ON CONFLICT (slug) DO NOTHING;
