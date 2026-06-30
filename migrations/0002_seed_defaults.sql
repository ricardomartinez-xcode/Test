-- Minimal Cloudflare D1 defaults for a usable empty deployment.

INSERT OR IGNORE INTO courses (id, name, short_name, color, icon, card_size, sort_order, active)
VALUES
  ('course-aprendizaje', 'Psicología del Aprendizaje', 'Aprendizaje', '#2f77d0', 'book', 'medium', 10, 1),
  ('course-evaluacion', 'Evaluación Psicológica I', 'Evaluación', '#7c3aed', 'clipboard', 'medium', 20, 1),
  ('course-social', 'Problemática Social Mexicana', 'Social', '#d97706', 'users', 'medium', 30, 1),
  ('course-grupales', 'Procesos Grupales', 'Grupales', '#0f9f8f', 'network', 'medium', 40, 1),
  ('course-conducta', 'Alteraciones de la Conducta', 'Conducta', '#dc2626', 'brain', 'medium', 50, 1);

INSERT OR IGNORE INTO task_types (id, name, color, icon, card_size, sort_order, active)
VALUES
  ('task-type-tarea', 'Tarea', '#2f77d0', 'task', 'medium', 10, 1),
  ('task-type-lectura', 'Lectura', '#0f9f8f', 'book-open', 'medium', 20, 1),
  ('task-type-examen', 'Examen', '#dc2626', 'clipboard-check', 'medium', 30, 1),
  ('task-type-exposicion', 'Exposición', '#7c3aed', 'presentation', 'medium', 40, 1),
  ('task-type-proyecto', 'Proyecto', '#d97706', 'folder-check', 'medium', 50, 1),
  ('task-type-material', 'Material', '#64748b', 'file-text', 'medium', 60, 1),
  ('task-type-recordatorio', 'Recordatorio', '#f59e0b', 'bell', 'medium', 70, 1),
  ('task-type-practica', 'Práctica', '#16a34a', 'check-circle', 'medium', 80, 1);

INSERT OR IGNORE INTO material_sections (id, parent_id, name, slug, path, color, icon, card_size, preview_style, sort_order, active)
VALUES
  ('section-conducta', NULL, 'Alteraciones de la conducta', 'alteraciones-de-la-conducta', 'Alteraciones de la conducta', '#dc2626', 'folder', 'medium', 'thumbnail', 10, 1),
  ('section-compendio', NULL, 'Compendio de Psicología', 'compendio-de-psicologia', 'Compendio de Psicología', '#2f77d0', 'folder', 'medium', 'thumbnail', 20, 1),
  ('section-evaluacion', NULL, 'Evaluación Psicológica I', 'evaluacion-psicologica-i', 'Evaluación Psicológica I', '#7c3aed', 'folder', 'medium', 'thumbnail', 30, 1),
  ('section-grupales', NULL, 'Procesos Grupales', 'procesos-grupales', 'Procesos Grupales', '#0f9f8f', 'folder', 'medium', 'thumbnail', 40, 1),
  ('section-aprendizaje', NULL, 'Teorías del Aprendizaje', 'teorias-del-aprendizaje', 'Teorías del Aprendizaje', '#d97706', 'folder', 'medium', 'thumbnail', 50, 1);

INSERT OR IGNORE INTO group_columns (id, source_key, label, value_type, fixed, active, sort_order)
VALUES
  ('group-attended', 'attended', 'Asistencia', 'boolean', 1, 1, 10),
  ('group-license', 'licenseIssue', 'Licencia', 'boolean', 1, 1, 20),
  ('group-auth', 'authIssue', 'Acceso', 'boolean', 1, 1, 30);
