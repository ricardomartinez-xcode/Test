-- PSCV Room D1 baseline. UUIDs are generated in application code with crypto.randomUUID().
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_profiles (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT,
  control_number TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','owner')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  can_edit_tasks INTEGER NOT NULL DEFAULT 0 CHECK (can_edit_tasks IN (0,1)),
  can_delete_tasks INTEGER NOT NULL DEFAULT 0 CHECK (can_delete_tasks IN (0,1)),
  can_manage_materials INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_materials IN (0,1)),
  can_manage_users INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_users IN (0,1)),
  can_manage_settings INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_settings IN (0,1)),
  can_manage_group INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_group IN (0,1)),
  can_manage_notifications INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_notifications IN (0,1)),
  can_view_reports INTEGER NOT NULL DEFAULT 0 CHECK (can_view_reports IN (0,1)),
  can_manage_r2 INTEGER NOT NULL DEFAULT 0 CHECK (can_manage_r2 IN (0,1)),
  preferences TEXT NOT NULL DEFAULT '{"theme":"system","taskDensity":"comfortable","calendarView":"month","showCompleted":false,"materialPreviewSize":"medium"}',
  legacy_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  editable_by_admin INTEGER NOT NULL DEFAULT 1 CHECK (editable_by_admin IN (0,1)),
  updated_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  legacy_name TEXT,
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  color TEXT NOT NULL DEFAULT '#4285dc',
  icon TEXT NOT NULL DEFAULT 'book',
  card_size TEXT NOT NULL DEFAULT 'medium',
  calendar_lane INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#4285dc',
  icon TEXT NOT NULL DEFAULT 'task',
  card_size TEXT NOT NULL DEFAULT 'medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  config TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS material_sections (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES material_sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#4285dc',
  icon TEXT NOT NULL DEFAULT 'folder',
  card_size TEXT NOT NULL DEFAULT 'medium',
  preview_style TEXT NOT NULL DEFAULT 'thumbnail',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  legacy_id TEXT,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  task_type_id TEXT REFERENCES task_types(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  material_needed TEXT,
  material_url TEXT,
  platform_url TEXT,
  notes TEXT,
  due_date TEXT NOT NULL,
  due_time TEXT NOT NULL DEFAULT '23:59:00',
  status TEXT NOT NULL DEFAULT 'Pendiente',
  priority TEXT NOT NULL DEFAULT 'Media',
  visible_to_students INTEGER NOT NULL DEFAULT 1 CHECK (visible_to_students IN (0,1)),
  calendar_event_id TEXT,
  last_sync_at TEXT,
  created_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  legacy_id TEXT,
  section_id TEXT REFERENCES material_sections(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'PDF',
  visibility TEXT NOT NULL DEFAULT 'visible' CHECK (visibility IN ('visible','hidden')),
  provider TEXT NOT NULL DEFAULT 'r2' CHECK (provider IN ('r2','drive','external')),
  source_url TEXT,
  preview_url TEXT,
  thumbnail_url TEXT,
  r2_bucket TEXT,
  r2_key TEXT UNIQUE,
  file_id TEXT,
  file_name TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  observations TEXT,
  uploaded_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_materials (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  material_id TEXT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, material_id)
);

CREATE TABLE IF NOT EXISTS user_course_preferences (
  profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
  custom_color TEXT,
  sort_order INTEGER,
  PRIMARY KEY (profile_id, course_id)
);

CREATE TABLE IF NOT EXISTS group_columns (
  id TEXT PRIMARY KEY,
  source_key TEXT UNIQUE,
  label TEXT NOT NULL,
  value_type TEXT NOT NULL DEFAULT 'boolean',
  fixed INTEGER NOT NULL DEFAULT 0 CHECK (fixed IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_column_values (
  profile_id TEXT NOT NULL REFERENCES app_profiles(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES group_columns(id) ON DELETE CASCADE,
  value INTEGER NOT NULL DEFAULT 0 CHECK (value IN (0,1)),
  updated_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id, column_id)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  profile_id TEXT PRIMARY KEY REFERENCES app_profiles(id) ON DELETE CASCADE,
  in_app_enabled INTEGER NOT NULL DEFAULT 1 CHECK (in_app_enabled IN (0,1)),
  email_enabled INTEGER NOT NULL DEFAULT 0 CHECK (email_enabled IN (0,1)),
  due_soon_hours INTEGER NOT NULL DEFAULT 48 CHECK (due_soon_hours BETWEEN 1 AND 336),
  categories TEXT NOT NULL DEFAULT '{"system":true,"task_due":true,"task_created":true,"task_updated":true,"material_added":true}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES app_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'system',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  entity TEXT,
  entity_id TEXT,
  action_url TEXT,
  scheduled_for TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  dismissed_at TEXT,
  created_by TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES app_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_data TEXT,
  after_data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date, due_time);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_course ON tasks(course_id);
CREATE INDEX IF NOT EXISTS idx_materials_section ON materials(section_id);
CREATE INDEX IF NOT EXISTS idx_notifications_profile_status ON notifications(profile_id, dismissed_at, read_at, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON notifications(dismissed_at, scheduled_for DESC) WHERE profile_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id, created_at DESC);

CREATE VIEW IF NOT EXISTS report_task_summary AS
SELECT
  COALESCE(c.name, 'Sin materia') AS course,
  COALESCE(tt.name, 'Tarea') AS task_type,
  t.status,
  COUNT(*) AS total,
  SUM(CASE WHEN t.due_date < date('now') AND t.status NOT IN ('Entregado','Cancelado') THEN 1 ELSE 0 END) AS overdue,
  MIN(t.due_date) AS next_due_date
FROM tasks t
LEFT JOIN courses c ON c.id = t.course_id
LEFT JOIN task_types tt ON tt.id = t.task_type_id
WHERE t.archived_at IS NULL
GROUP BY COALESCE(c.name, 'Sin materia'), COALESCE(tt.name, 'Tarea'), t.status;

CREATE VIEW IF NOT EXISTS report_material_summary AS
SELECT
  COALESCE(ms.path, 'Sin sección') AS section_path,
  COALESCE(m.provider, 'r2') AS provider,
  COUNT(*) AS total,
  COALESCE(SUM(m.size_bytes), 0) AS total_bytes,
  MAX(m.updated_at) AS last_updated_at
FROM materials m
LEFT JOIN material_sections ms ON ms.id = m.section_id
WHERE m.visibility = 'visible'
GROUP BY COALESCE(ms.path, 'Sin sección'), COALESCE(m.provider, 'r2');
