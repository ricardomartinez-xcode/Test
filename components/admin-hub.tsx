"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ConfigColumn } from "@/lib/domain";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type AdminTab = "general" | "tasks" | "courses" | "sections" | "materials" | "users" | "legacy";
type CardSize = "compact" | "medium" | "large";

type CourseConfig = { id: string; name: string; shortName: string; color: string; icon: string; cardSize: CardSize; active: boolean };
type SectionConfig = { id: string; name: string; path: string; color: string; icon: string; cardSize: CardSize; previewStyle: string; active: boolean };
type TaskTypeRow = { id: string; name: string; color: string | null; icon: string | null };
type AdminTaskRow = { id: string; title: string; due_date: string; due_time: string | null; status: string; priority: string; visible_to_students: boolean; material_url: string | null; platform_url: string | null; courses: { name: string; color: string | null } | { name: string; color: string | null }[] | null; task_types: { name: string; color: string | null } | { name: string; color: string | null }[] | null };
type AppProfileRow = { id: string; email: string; full_name: string | null; control_number: string | null; role: "student" | "admin" | "owner"; active: boolean; can_edit_tasks: boolean; can_delete_tasks: boolean };
type TaskForm = { title: string; courseId: string; typeId: string; dueDate: string; dueTime: string; status: string; priority: string; visible: boolean; materialUrl: string; platformUrl: string; notes: string; materialNeeded: string };

type AdminHubProps = { courses: CourseConfig[]; sections: SectionConfig[]; columns: ConfigColumn[]; supabase: SupabaseBrowser | null; reload: () => Promise<void>; onCourses: (courses: CourseConfig[]) => void; onSections: (sections: SectionConfig[]) => void; onError: (error: string | null) => void };

const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: "general", label: "General", icon: "▣" },
  { id: "tasks", label: "Tareas", icon: "✓" },
  { id: "courses", label: "Materias", icon: "◉" },
  { id: "sections", label: "Secciones", icon: "▤" },
  { id: "materials", label: "Materiales", icon: "⬡" },
  { id: "users", label: "Usuarios", icon: "☷" },
  { id: "legacy", label: "Legacy", icon: "⌁" },
];

const emptyTaskForm: TaskForm = { title: "", courseId: "", typeId: "", dueDate: new Date().toISOString().slice(0, 10), dueTime: "23:59", status: "Pendiente", priority: "Media", visible: true, materialUrl: "", platformUrl: "", notes: "", materialNeeded: "" };

export function AdminHub({ courses, sections, columns, supabase, reload, onCourses, onSections, onError }: AdminHubProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("general");
  const [profiles, setProfiles] = useState<AppProfileRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [taskTypes, setTaskTypes] = useState<TaskTypeRow[]>([]);
  const [adminTasks, setAdminTasks] = useState<AdminTaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => { if (activeTab === "users") void loadProfiles(); }, [activeTab]);
  useEffect(() => { if (activeTab === "tasks") void loadTaskAdminData(); }, [activeTab]);

  async function loadProfiles() {
    if (!supabase) return;
    setLoadingUsers(true);
    const { data, error } = await supabase.from("app_profiles").select("id,email,full_name,control_number,role,active,can_edit_tasks,can_delete_tasks").order("role").order("full_name");
    if (error) onError(error.message); else setProfiles((data ?? []) as AppProfileRow[]);
    setLoadingUsers(false);
  }

  async function loadTaskAdminData() {
    if (!supabase) return;
    setLoadingTasks(true);
    const [typesResult, tasksResult] = await Promise.all([
      supabase.from("task_types").select("id,name,color,icon").eq("active", true).order("sort_order"),
      supabase.from("tasks").select("id,title,due_date,due_time,status,priority,visible_to_students,material_url,platform_url,courses(name,color),task_types(name,color)").is("archived_at", null).order("due_date", { ascending: true }).order("due_time", { ascending: true }).limit(80),
    ]);
    const failure = typesResult.error || tasksResult.error;
    if (failure) onError(failure.message);
    else {
      setTaskTypes((typesResult.data ?? []) as TaskTypeRow[]);
      setAdminTasks((tasksResult.data ?? []) as AdminTaskRow[]);
    }
    setLoadingTasks(false);
  }

  async function updateCourse(id: string, patch: Partial<CourseConfig>) {
    onCourses(courses.map((course) => course.id === id ? { ...course, ...patch } : course));
    if (!supabase) return;
    const { error } = await supabase.from("courses").update(toDbPatch(patch)).eq("id", id);
    if (error) onError(error.message);
  }

  async function updateSection(id: string, patch: Partial<SectionConfig>) {
    onSections(sections.map((section) => section.id === id ? { ...section, ...patch } : section));
    if (!supabase) return;
    const { error } = await supabase.from("material_sections").update(toDbPatch(patch)).eq("id", id);
    if (error) onError(error.message);
  }

  async function updateProfile(id: string, patch: Partial<AppProfileRow>) {
    setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, ...patch } : profile));
    if (!supabase) return;
    const { error } = await supabase.from("app_profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) onError(error.message);
  }

  async function createTask(form: TaskForm) {
    if (!supabase) return;
    const { error } = await supabase.from("tasks").insert({
      title: form.title.trim(),
      course_id: form.courseId || null,
      task_type_id: form.typeId || null,
      due_date: form.dueDate,
      due_time: form.dueTime || "23:59",
      status: form.status,
      priority: form.priority,
      visible_to_students: form.visible,
      material_url: form.materialUrl.trim() || null,
      platform_url: form.platformUrl.trim() || null,
      notes: form.notes.trim() || null,
      material_needed: form.materialNeeded.trim() || null,
    });
    if (error) onError(error.message);
    else { await loadTaskAdminData(); await reload(); }
  }

  async function updateTask(id: string, patch: Partial<Pick<AdminTaskRow, "status" | "visible_to_students" | "priority">>) {
    setAdminTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch } : task));
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) onError(error.message);
    else await reload();
  }

  const stats = useMemo(() => ({ courses: courses.length, sections: sections.length, activeSections: sections.filter((section) => section.active).length, legacyColumns: columns.length, activeLegacyColumns: columns.filter((column) => column.active).length, tasks: adminTasks.length }), [courses, sections, columns, adminTasks]);

  return (
    <div className="adminHub">
      <section className="adminHero"><div><p className="eyebrow">Admin 2.0</p><h2>Centro de configuración</h2><p>Administra tareas, materiales, usuarios y estructura sin tocar código.</p></div><button type="button" onClick={() => void reload()}>Actualizar datos</button></section>
      <nav className="adminTabs" aria-label="Módulos de administración">{tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><span>{tab.icon}</span>{tab.label}</button>)}</nav>
      {activeTab === "general" ? <GeneralPanel stats={stats} /> : null}
      {activeTab === "tasks" ? <TasksPanel courses={courses} taskTypes={taskTypes} tasks={adminTasks} loading={loadingTasks} onReload={() => void loadTaskAdminData()} onCreate={(form) => void createTask(form)} onUpdate={(id, patch) => void updateTask(id, patch)} /> : null}
      {activeTab === "courses" ? <CoursesPanel courses={courses} onUpdate={(id, patch) => void updateCourse(id, patch)} /> : null}
      {activeTab === "sections" ? <SectionsPanel sections={sections} onUpdate={(id, patch) => void updateSection(id, patch)} /> : null}
      {activeTab === "materials" ? <MaterialUploadPanel sections={sections} supabase={supabase} reload={reload} onError={onError} /> : null}
      {activeTab === "users" ? <UsersPanel profiles={profiles} loading={loadingUsers} onReload={() => void loadProfiles()} onUpdate={(id, patch) => void updateProfile(id, patch)} /> : null}
      {activeTab === "legacy" ? <LegacyPanel columns={columns} /> : null}
    </div>
  );
}

function GeneralPanel({ stats }: { stats: { courses: number; sections: number; activeSections: number; legacyColumns: number; activeLegacyColumns: number; tasks: number } }) {
  return <section className="adminPanelGrid"><MetricCard label="Tareas" value={stats.tasks} help="Últimas tareas cargadas" /><MetricCard label="Materias" value={stats.courses} help="Catálogo visual" /><MetricCard label="Secciones" value={stats.sections} help={`${stats.activeSections} visibles`} /><MetricCard label="Storage" value="R2" help="Subidas directas" /></section>;
}

function MetricCard({ label, value, help }: { label: string; value: string | number; help: string }) { return <article className="metricCard"><span>{label}</span><strong>{value}</strong><small>{help}</small></article>; }

function TasksPanel({ courses, taskTypes, tasks, loading, onReload, onCreate, onUpdate }: { courses: CourseConfig[]; taskTypes: TaskTypeRow[]; tasks: AdminTaskRow[]; loading: boolean; onReload: () => void; onCreate: (form: TaskForm) => void; onUpdate: (id: string, patch: Partial<Pick<AdminTaskRow, "status" | "visible_to_students" | "priority">>) => void }) {
  const [form, setForm] = useState<TaskForm>(emptyTaskForm);
  useEffect(() => {
    setForm((current) => ({ ...current, courseId: current.courseId || courses[0]?.id || "", typeId: current.typeId || taskTypes[0]?.id || "" }));
  }, [courses, taskTypes]);
  function setField<K extends keyof TaskForm>(key: K, value: TaskForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim()) return;
    onCreate(form);
    setForm({ ...emptyTaskForm, courseId: courses[0]?.id || "", typeId: taskTypes[0]?.id || "" });
  }
  return <div className="taskAdminGrid"><section className="adminCard"><div className="adminCardHead"><div><h3>Nueva tarea</h3><p>Crea tareas que aparecerán en calendario y lista según visibilidad.</p></div></div><form className="taskForm" onSubmit={submit}><label className="wide">Título<input value={form.title} onChange={(event) => setField("title", event.target.value)} required /></label><label>Materia<select value={form.courseId} onChange={(event) => setField("courseId", event.target.value)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label>Tipo<select value={form.typeId} onChange={(event) => setField("typeId", event.target.value)}>{taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label>Fecha<input type="date" value={form.dueDate} onChange={(event) => setField("dueDate", event.target.value)} required /></label><label>Hora<input type="time" value={form.dueTime} onChange={(event) => setField("dueTime", event.target.value)} /></label><label>Estado<select value={form.status} onChange={(event) => setField("status", event.target.value)}><option>Pendiente</option><option>Se entrega hoy</option><option>Entregado</option><option>Reprogramado</option><option>Cancelado</option></select></label><label>Prioridad<select value={form.priority} onChange={(event) => setField("priority", event.target.value)}><option>Alta</option><option>Media</option><option>Baja</option></select></label><label className="wide">Material necesario<input value={form.materialNeeded} onChange={(event) => setField("materialNeeded", event.target.value)} /></label><label className="wide">Link material<input value={form.materialUrl} onChange={(event) => setField("materialUrl", event.target.value)} /></label><label className="wide">Link plataforma<input value={form.platformUrl} onChange={(event) => setField("platformUrl", event.target.value)} /></label><label className="wide">Notas<textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label><label className="taskCheck"><input type="checkbox" checked={form.visible} onChange={(event) => setField("visible", event.target.checked)} /> Visible para alumnos</label><button className="primaryAction" type="submit">Crear tarea</button></form></section><section className="adminCard"><div className="adminCardHead"><div><h3>Tareas próximas</h3><p>Actualiza estado y visibilidad sin abrir la base.</p></div><button type="button" onClick={onReload}>{loading ? "Cargando..." : "Recargar"}</button></div><div className="adminTaskList">{tasks.map((task) => <TaskAdminRow key={task.id} task={task} onUpdate={onUpdate} />)}{!tasks.length && !loading ? <p className="muted">No hay tareas cargadas.</p> : null}</div></section></div>;
}

function TaskAdminRow({ task, onUpdate }: { task: AdminTaskRow; onUpdate: (id: string, patch: Partial<Pick<AdminTaskRow, "status" | "visible_to_students" | "priority">>) => void }) {
  const course = first(task.courses);
  const type = first(task.task_types);
  return <article className="adminTaskRow" style={{ borderLeftColor: course?.color ?? type?.color ?? "#4285dc" }}><div><strong>{task.title}</strong><small>{course?.name ?? "Sin materia"} · {type?.name ?? "Tarea"} · {task.due_date} {task.due_time?.slice(0, 5) ?? ""}</small></div><select value={task.status} onChange={(event) => onUpdate(task.id, { status: event.target.value })}><option>Pendiente</option><option>Se entrega hoy</option><option>Entregado</option><option>Reprogramado</option><option>Cancelado</option></select><select value={task.priority} onChange={(event) => onUpdate(task.id, { priority: event.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select><label><input type="checkbox" checked={task.visible_to_students} onChange={(event) => onUpdate(task.id, { visible_to_students: event.target.checked })} />Visible</label></article>;
}

function CoursesPanel({ courses, onUpdate }: { courses: CourseConfig[]; onUpdate: (id: string, patch: Partial<CourseConfig>) => void }) { return <section className="adminCard"><div className="adminCardHead"><div><h3>Materias</h3><p>Define colores, iconos, tamaño y visibilidad.</p></div></div><div className="adminRows">{courses.map((course) => <div className="adminEditRow" key={course.id}><span className="swatch" style={{ background: course.color }} /><strong>{course.name}</strong><input aria-label="Color" type="color" value={course.color} onChange={(event) => onUpdate(course.id, { color: event.target.value })} /><input aria-label="Icono" value={course.icon} onChange={(event) => onUpdate(course.id, { icon: event.target.value })} /><select aria-label="Tamaño" value={course.cardSize} onChange={(event) => onUpdate(course.id, { cardSize: event.target.value as CardSize })}><option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option></select><label className="adminSwitch"><input type="checkbox" checked={course.active} onChange={(event) => onUpdate(course.id, { active: event.target.checked })} />Activa</label></div>)}</div></section>; }

function SectionsPanel({ sections, onUpdate }: { sections: SectionConfig[]; onUpdate: (id: string, patch: Partial<SectionConfig>) => void }) { return <section className="adminCard"><div className="adminCardHead"><div><h3>Secciones de materiales</h3><p>Personaliza carpetas y subsecciones del asset R2.</p></div></div><div className="adminRows">{sections.map((section) => <div className="adminEditRow section" key={section.id}><span className="swatch" style={{ background: section.color }} /><div className="adminNameBlock"><strong>{section.name}</strong><small>{section.path}</small></div><input aria-label="Color" type="color" value={section.color} onChange={(event) => onUpdate(section.id, { color: event.target.value })} /><input aria-label="Icono" value={section.icon} onChange={(event) => onUpdate(section.id, { icon: event.target.value })} /><select aria-label="Tamaño" value={section.cardSize} onChange={(event) => onUpdate(section.id, { cardSize: event.target.value as CardSize })}><option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option></select><select aria-label="Preview" value={section.previewStyle} onChange={(event) => onUpdate(section.id, { previewStyle: event.target.value })}><option value="none">Sin preview</option><option value="icon">Icono</option><option value="thumbnail">Miniatura</option><option value="embedded">Embebido</option></select></div>)}</div></section>; }

function MaterialUploadPanel({ sections, supabase, reload, onError }: { sections: SectionConfig[]; supabase: SupabaseBrowser | null; reload: () => Promise<void>; onError: (error: string | null) => void }) {
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? ""); const [title, setTitle] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!sectionId && sections[0]) setSectionId(sections[0].id); }, [sections, sectionId]);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const section = sections.find((item) => item.id === sectionId); if (!file || !section || !supabase) { onError("Selecciona un archivo y una sección válida."); return; } setBusy(true); try { const response = await fetch("/api/uploads/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream", sectionPath: section.path }) }); const body = await response.json() as { key?: string; uploadUrl?: string; publicUrl?: string | null; error?: string }; if (!response.ok || !body.uploadUrl || !body.key) throw new Error(body.error ?? "No se pudo preparar la subida."); const upload = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file }); if (!upload.ok) throw new Error("R2 rechazó el archivo."); const { error } = await supabase.from("materials").insert({ section_id: sectionId, title: title || file.name, file_name: file.name, material_type: file.type.includes("pdf") ? "PDF" : "Archivo", provider: "r2", r2_key: body.key, source_url: body.publicUrl, preview_url: body.publicUrl, content_type: file.type || null, size_bytes: file.size }); if (error) throw new Error(error.message); setTitle(""); setFile(null); await reload(); } catch (error) { onError(error instanceof Error ? error.message : "No se pudo subir el material."); } finally { setBusy(false); } }
  return <section className="adminCard"><div className="adminCardHead"><div><h3>Subir material</h3><p>Guarda el archivo en R2 y registra la metadata en Supabase.</p></div></div><form className="adminUpload" onSubmit={submit}><label>Sección<select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>{sections.map((section) => <option key={section.id} value={section.id}>{section.path}</option>)}</select></label><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Opcional" /></label><label>Archivo<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button className="primaryAction" disabled={busy} type="submit">{busy ? "Subiendo..." : "Subir a R2"}</button></form></section>;
}

function UsersPanel({ profiles, loading, onReload, onUpdate }: { profiles: AppProfileRow[]; loading: boolean; onReload: () => void; onUpdate: (id: string, patch: Partial<AppProfileRow>) => void }) { return <section className="adminCard"><div className="adminCardHead"><div><h3>Usuarios</h3><p>Consulta perfiles, roles y permisos operativos.</p></div><button type="button" onClick={onReload}>{loading ? "Cargando..." : "Recargar"}</button></div><div className="adminUserList">{profiles.map((profile) => <article className="adminUserRow" key={profile.id}><div><strong>{profile.full_name ?? profile.email}</strong><small>{profile.email} · {profile.control_number ?? "sin control"}</small></div><select value={profile.role} onChange={(event) => onUpdate(profile.id, { role: event.target.value as AppProfileRow["role"] })}><option value="student">Alumno</option><option value="admin">Admin</option><option value="owner">Owner</option></select><label><input type="checkbox" checked={profile.active} onChange={(event) => onUpdate(profile.id, { active: event.target.checked })} />Activo</label><label><input type="checkbox" checked={profile.can_edit_tasks} onChange={(event) => onUpdate(profile.id, { can_edit_tasks: event.target.checked })} />Edita</label></article>)}{!profiles.length && !loading ? <p className="muted">No se pudieron cargar usuarios o no hay permisos RLS para leerlos.</p> : null}</div></section>; }

function LegacyPanel({ columns }: { columns: ConfigColumn[] }) { return <section className="adminCard"><div className="adminCardHead"><div><h3>Columnas legacy</h3><p>Referencia de configuración migrada desde AppSheet/Sheets.</p></div></div><div className="legacyGrid">{columns.map((column) => <span className="configPill" key={column.key}>{column.name}: {column.active ? "SI" : "NO"}</span>)}</div></section>; }

function first<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function toDbPatch(patch: Partial<CourseConfig> | Partial<SectionConfig>) { const out: Record<string, unknown> = { updated_at: new Date().toISOString() }; if ("color" in patch) out.color = patch.color; if ("icon" in patch) out.icon = patch.icon; if ("cardSize" in patch) out.card_size = patch.cardSize; if ("previewStyle" in patch) out.preview_style = patch.previewStyle; if ("active" in patch) out.active = patch.active; return out; }
