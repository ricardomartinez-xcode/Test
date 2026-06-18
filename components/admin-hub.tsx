"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type AdminTab = "general" | "tasks" | "courses" | "sections" | "materials" | "users" | "notifications" | "reports" | "diagnostics";
type CardSize = "compact" | "medium" | "large";

type CourseConfig = { id: string; name: string; shortName: string; color: string; icon: string; cardSize: CardSize; active: boolean };
type SectionConfig = { id: string; name: string; path: string; color: string; icon: string; cardSize: CardSize; previewStyle: string; active: boolean };
type AdminTaskRow = { id: string; title: string; due_date: string; due_time: string | null; status: string; priority: string; visible_to_students: boolean; material_url: string | null; platform_url: string | null; courses: { name: string; color: string | null } | { name: string; color: string | null }[] | null; task_types: { name: string; color: string | null } | { name: string; color: string | null }[] | null };
type AppProfileRow = { id: string; email: string; full_name: string | null; control_number: string | null; role: "student" | "admin" | "owner"; active: boolean; can_edit_tasks: boolean; can_delete_tasks: boolean; can_manage_materials: boolean; can_manage_users: boolean; can_manage_settings: boolean; can_manage_group: boolean; can_manage_notifications: boolean; can_view_reports: boolean; can_manage_r2: boolean };
type UploadDestination = { id: string; sectionId: string | null; name: string; path: string; source: "supabase" | "r2" };
type AdminProfile = { role: "student" | "admin" | "owner"; canEditTasks: boolean; canDeleteTasks: boolean; canManageMaterials: boolean; canManageUsers: boolean; canManageSettings: boolean; canManageGroup: boolean; canManageNotifications: boolean; canViewReports: boolean; canManageR2: boolean } | null;
type HealthPayload = { ok?: boolean; mode?: string; auth?: { configured?: boolean }; integrations?: Record<string, boolean> };
type DestinationsPayload = { ok?: boolean; root?: string; destinations?: UploadDestination[]; error?: string };
type LibraryPayload = { ok?: boolean; summary?: { sections: number; materials: number; providers: Record<string, number> }; error?: string };
type DiagnosticCounts = { profiles: number | null; tasks: number | null; materials: number | null; sections: number | null; groupColumns: number | null };
type DiagnosticsSnapshot = {
  checkedAt: string;
  health: HealthPayload | null;
  healthError: string | null;
  destinations: DestinationsPayload | null;
  destinationsError: string | null;
  library: LibraryPayload | null;
  libraryError: string | null;
  counts: DiagnosticCounts;
  countErrors: string[];
};
type ImportResult = {
  dryRun?: boolean;
  bucket?: string;
  root?: string;
  scannedObjects?: number;
  sectionsToEnsure?: number;
  sampleSections?: string[];
  importedObjects?: number;
  ensuredSections?: number;
  inserted?: number;
  updated?: number;
  error?: string;
};
type AdminNotification = { id: string; profile_id: string | null; kind: string; priority: string; title: string; body: string; read_at: string | null; dismissed_at: string | null; created_at: string };
type ReportPayload = { ok?: boolean; tasks?: ReportRow[]; materials?: ReportRow[]; students?: ReportRow[]; audit?: ReportRow[]; error?: string };
type ReportRow = Record<string, string | number | boolean | null>;

type AdminHubProps = { courses: CourseConfig[]; sections: SectionConfig[]; columns?: unknown[]; profile?: AdminProfile; supabase: SupabaseBrowser | null; reload: () => Promise<void>; onCourses: (courses: CourseConfig[]) => void; onSections: (sections: SectionConfig[]) => void; onError: (error: string | null) => void };

const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: "general", label: "General", icon: "▣" },
  { id: "tasks", label: "Tareas", icon: "✓" },
  { id: "courses", label: "Materias", icon: "◉" },
  { id: "sections", label: "Secciones", icon: "▤" },
  { id: "materials", label: "Materiales", icon: "⬡" },
  { id: "users", label: "Usuarios", icon: "☷" },
  { id: "notifications", label: "Avisos", icon: "◌" },
  { id: "reports", label: "Reportes", icon: "▥" },
  { id: "diagnostics", label: "Diagnóstico", icon: "◎" },
];

export function AdminHub({ courses, sections, profile = null, supabase, reload, onCourses, onSections, onError }: AdminHubProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("general");
  const [profiles, setProfiles] = useState<AppProfileRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [adminTasks, setAdminTasks] = useState<AdminTaskRow[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const visibleTabs = useMemo(() => tabs.filter((tab) => canSeeAdminTab(profile, tab.id)), [profile]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.id === activeTab)) setActiveTab("general");
  }, [activeTab, visibleTabs]);

  // Tab-driven loads intentionally run only when the active admin module changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === "users") void loadProfiles(); }, [activeTab]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTab === "tasks") void loadTaskAdminData(); }, [activeTab]);

  async function loadProfiles() {
    if (!supabase) return;
    setLoadingUsers(true);
    const { data, error } = await supabase.from("app_profiles").select("id,email,full_name,control_number,role,active,can_edit_tasks,can_delete_tasks,can_manage_materials,can_manage_users,can_manage_settings,can_manage_group,can_manage_notifications,can_view_reports,can_manage_r2").order("role").order("full_name");
    if (error) onError(error.message); else setProfiles((data ?? []) as AppProfileRow[]);
    setLoadingUsers(false);
  }

  async function loadTaskAdminData() {
    if (!supabase) return;
    setLoadingTasks(true);
    const { data, error } = await supabase.from("tasks").select("id,title,due_date,due_time,status,priority,visible_to_students,material_url,platform_url,courses(name,color),task_types(name,color)").is("archived_at", null).order("due_date", { ascending: true }).order("due_time", { ascending: true }).limit(80);
    if (error) onError(error.message); else setAdminTasks((data ?? []) as AdminTaskRow[]);
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

  async function updateTask(id: string, patch: Partial<Pick<AdminTaskRow, "status" | "visible_to_students" | "priority">>) {
    setAdminTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch } : task));
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) onError(error.message);
    else await reload();
  }

  const stats = useMemo(() => ({ courses: courses.length, sections: sections.length, activeSections: sections.filter((section) => section.active).length, tasks: adminTasks.length }), [courses, sections, adminTasks]);

  return (
    <div className="adminHub">
      <section className="adminHero"><div><p className="eyebrow">Admin 2.0</p><h2>Centro de configuración</h2><p>Administra tareas, materiales, usuarios y estructura sin tocar código.</p></div><button type="button" onClick={() => void reload()}>Actualizar datos</button></section>
      <nav className="adminTabs" aria-label="Módulos de administración">{visibleTabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><span>{tab.icon}</span>{tab.label}</button>)}</nav>
      {activeTab === "general" ? <GeneralPanel stats={stats} /> : null}
      {activeTab === "tasks" ? <TasksPanel tasks={adminTasks} loading={loadingTasks} onReload={() => void loadTaskAdminData()} onUpdate={(id, patch) => void updateTask(id, patch)} /> : null}
      {activeTab === "courses" ? <CoursesPanel courses={courses} onUpdate={(id, patch) => void updateCourse(id, patch)} /> : null}
      {activeTab === "sections" ? <SectionsPanel sections={sections} onUpdate={(id, patch) => void updateSection(id, patch)} /> : null}
      {activeTab === "materials" ? <MaterialUploadPanel sections={sections} supabase={supabase} reload={reload} onError={onError} /> : null}
      {activeTab === "users" ? <UsersPanel profiles={profiles} loading={loadingUsers} onReload={() => void loadProfiles()} onUpdate={(id, patch) => void updateProfile(id, patch)} /> : null}
      {activeTab === "notifications" ? <NotificationsPanel onError={onError} /> : null}
      {activeTab === "reports" ? <ReportsPanel onError={onError} /> : null}
      {activeTab === "diagnostics" ? <DiagnosticsPanel supabase={supabase} reload={reload} onError={onError} /> : null}
    </div>
  );
}

function GeneralPanel({ stats }: { stats: { courses: number; sections: number; activeSections: number; tasks: number } }) {
  return <section className="adminPanelGrid"><MetricCard label="Tareas" value={stats.tasks} help="Últimas tareas cargadas" /><MetricCard label="Materias" value={stats.courses} help="Catálogo visual" /><MetricCard label="Secciones" value={stats.sections} help={`${stats.activeSections} visibles`} /><MetricCard label="Storage" value="R2" help="Subidas directas" /></section>;
}

function MetricCard({ label, value, help }: { label: string; value: string | number; help: string }) { return <article className="metricCard"><span>{label}</span><strong>{value}</strong><small>{help}</small></article>; }

function NotificationsPanel({ onError }: { onError: (error: string | null) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [priority, setPriority] = useState("normal");
  const [kind, setKind] = useState("system");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<AdminNotification[]>([]);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    void loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRecent() {
    try {
      const response = await fetch("/api/admin/notifications", { credentials: "include" });
      const payload = await response.json() as { notifications?: AdminNotification[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron cargar avisos.");
      setRecent(payload.notifications ?? []);
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudieron cargar avisos.");
    }
  }

  async function sendNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience, priority, kind }),
      });
      const payload = await response.json() as { inserted?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo enviar el aviso.");
      setResult(`${payload.inserted ?? 0} avisos creados`);
      setTitle("");
      setBody("");
      await loadRecent();
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo enviar el aviso.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDueNotifications() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/notifications/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ windowDays: 3 }),
      });
      const payload = await response.json() as { inserted?: number; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudieron generar recordatorios.");
      setResult(`${payload.inserted ?? 0} recordatorios próximos creados`);
      await loadRecent();
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudieron generar recordatorios.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adminCard">
      <div className="adminCardHead">
        <div><h3>Avisos</h3><p>Crea avisos persistentes y genera recordatorios de entregas próximas.</p></div>
        <button type="button" onClick={() => void generateDueNotifications()} disabled={busy}>{busy ? "Procesando..." : "Generar vencimientos"}</button>
      </div>
      <form className="adminNoticeForm" onSubmit={sendNotification}>
        <label className="wide">Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Aviso para el grupo" required /></label>
        <label className="wide">Mensaje<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Detalle opcional" /></label>
        <label>Audiencia<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">Todos</option><option value="students">Alumnos</option><option value="admins">Administradores</option></select></label>
        <label>Tipo<select value={kind} onChange={(event) => setKind(event.target.value)}><option value="system">Sistema</option><option value="reminder">Recordatorio</option><option value="material_added">Material</option><option value="task_updated">Tarea</option></select></label>
        <label>Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Baja</option><option value="normal">Normal</option><option value="high">Alta</option></select></label>
        <button className="primaryAction" type="submit" disabled={busy || !title.trim()}>{busy ? "Enviando..." : "Enviar aviso"}</button>
      </form>
      {result ? <p className="adminResult">{result}</p> : null}
      <div className="adminNoticeList">
        {recent.slice(0, 8).map((notice) => <article key={notice.id}><strong>{notice.title}</strong><span>{notice.kind} · {notice.priority} · {formatDateTime(notice.created_at)}</span></article>)}
        {!recent.length ? <p className="muted">Sin avisos recientes.</p> : null}
      </div>
    </section>
  );
}

function ReportsPanel({ onError }: { onError: (error: string | null) => void }) {
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<ReportPayload | null>(null);

  useEffect(() => {
    void loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/operations", { credentials: "include" });
      const body = await response.json() as ReportPayload;
      if (!response.ok || body.error) throw new Error(body.error ?? "No se pudieron cargar reportes.");
      setPayload(body);
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudieron cargar reportes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="reportsGrid">
      <article className="adminCard">
        <div className="adminCardHead"><div><h3>Reportes</h3><p>Tareas, materiales, seguimiento y auditoría operativa.</p></div><button type="button" onClick={() => void loadReports()}>{loading ? "Cargando..." : "Recargar"}</button></div>
        <ReportTable title="Tareas" rows={payload?.tasks ?? []} />
      </article>
      <article className="adminCard"><ReportTable title="Materiales" rows={payload?.materials ?? []} /></article>
      <article className="adminCard"><ReportTable title="Seguimiento alumnos" rows={payload?.students ?? []} /></article>
      <article className="adminCard"><ReportTable title="Auditoría reciente" rows={payload?.audit ?? []} /></article>
    </section>
  );
}

function ReportTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  const columns = rows[0] ? Object.keys(rows[0]).slice(0, 6) : [];
  return (
    <div className="reportTableBlock">
      <h4>{title}</h4>
      <div className="reportTableWrap">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column.replace(/_/g, " ")}</th>)}</tr></thead>
          <tbody>{rows.slice(0, 12).map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{formatReportValue(row[column])}</td>)}</tr>)}</tbody>
        </table>
      </div>
      {!rows.length ? <p className="muted">Sin datos.</p> : null}
    </div>
  );
}

function DiagnosticsPanel({ supabase, reload, onError }: { supabase: SupabaseBrowser | null; reload: () => Promise<void>; onError: (error: string | null) => void }) {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    void loadDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function loadDiagnostics() {
    setLoading(true);
    const [health, destinations, library, counts] = await Promise.all([
      safeJson<HealthPayload>("/api/health"),
      safeJson<DestinationsPayload>("/api/uploads/destinations"),
      safeJson<LibraryPayload>("/api/materials/library?limit=25"),
      loadDiagnosticCounts(supabase),
    ]);

    setSnapshot({
      checkedAt: new Date().toISOString(),
      health: health.data,
      healthError: health.error,
      destinations: destinations.data,
      destinationsError: destinations.error,
      library: library.data,
      libraryError: library.error,
      counts: counts.counts,
      countErrors: counts.errors,
    });
    setLoading(false);
  }

  async function runImport(dryRun: boolean) {
    setImportBusy(true);
    try {
      const response = await fetch("/api/admin/r2/import-materials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, reset: false, maxItems: 50000 }),
      });
      const body = await response.json().catch(() => ({})) as ImportResult;
      setImportResult(body);
      if (!response.ok || body.error) throw new Error(body.error ?? "No se pudo ejecutar el importador R2.");
      if (!dryRun) await reload();
      await loadDiagnostics();
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo ejecutar el importador R2.");
    } finally {
      setImportBusy(false);
    }
  }

  const destinations = snapshot?.destinations?.destinations ?? [];
  const r2Destinations = destinations.filter((destination) => destination.source === "r2").length;
  const supabaseDestinations = destinations.filter((destination) => destination.source === "supabase").length;
  const providers = snapshot?.library?.summary?.providers ?? {};
  const healthOk = Boolean(snapshot?.health?.ok && snapshot.health.auth?.configured && snapshot.health.integrations?.supabase && snapshot.health.integrations?.r2);

  return (
    <section className="diagnosticsLayout">
      <article className="adminCard diagnosticCard">
        <div className="adminCardHead">
          <div><h3>Estado operativo</h3><p>{snapshot ? `Revisado ${formatDateTime(snapshot.checkedAt)}` : "Sin revisión cargada"}</p></div>
          <button type="button" onClick={() => void loadDiagnostics()}>{loading ? "Revisando..." : "Revisar"}</button>
        </div>
        <div className="diagnosticPills">
          <DiagnosticPill label="App" ok={!snapshot?.healthError && Boolean(snapshot?.health?.ok)} />
          <DiagnosticPill label="Auth" ok={!snapshot?.healthError && Boolean(snapshot?.health?.auth?.configured)} />
          <DiagnosticPill label="Supabase" ok={!snapshot?.healthError && Boolean(snapshot?.health?.integrations?.supabase)} />
          <DiagnosticPill label="R2" ok={!snapshot?.healthError && Boolean(snapshot?.health?.integrations?.r2)} />
        </div>
        <div className="diagnosticRows">
          <DiagnosticRow label="Modo" value={snapshot?.health?.mode ?? "sin dato"} />
          <DiagnosticRow label="Postgres directo" value={snapshot?.health?.integrations?.postgresDirect ? "activo" : "no requerido"} />
          <DiagnosticRow label="Resultado" value={snapshot?.healthError ?? (healthOk ? "listo" : "requiere revisión")} />
        </div>
      </article>

      <article className="adminCard diagnosticCard">
        <div className="adminCardHead"><div><h3>R2 y biblioteca</h3><p>Destinos visibles para subida y materiales indexados.</p></div></div>
        <div className="diagnosticRows">
          <DiagnosticRow label="Raíz R2" value={snapshot?.destinations?.root ?? "psicologia"} />
          <DiagnosticRow label="Destinos totales" value={destinations.length} />
          <DiagnosticRow label="Desde R2" value={r2Destinations} />
          <DiagnosticRow label="Desde Supabase" value={supabaseDestinations} />
          <DiagnosticRow label="Materiales visibles" value={snapshot?.library?.summary?.materials ?? 0} />
          <DiagnosticRow label="Secciones visibles" value={snapshot?.library?.summary?.sections ?? 0} />
        </div>
        {snapshot?.destinationsError ? <p className="diagnosticError">{snapshot.destinationsError}</p> : null}
        {snapshot?.libraryError ? <p className="diagnosticError">{snapshot.libraryError}</p> : null}
        <div className="diagnosticSample">{destinations.slice(0, 7).map((destination) => <span key={destination.id}>{destination.path}</span>)}</div>
      </article>

      <article className="adminCard diagnosticCard">
        <div className="adminCardHead"><div><h3>Supabase</h3><p>Conteos rápidos para detectar tablas vacías o RLS mal aplicado.</p></div></div>
        <div className="diagnosticRows">
          <DiagnosticRow label="Perfiles" value={formatCount(snapshot?.counts.profiles)} />
          <DiagnosticRow label="Tareas activas" value={formatCount(snapshot?.counts.tasks)} />
          <DiagnosticRow label="Materiales" value={formatCount(snapshot?.counts.materials)} />
          <DiagnosticRow label="Secciones activas" value={formatCount(snapshot?.counts.sections)} />
          <DiagnosticRow label="Columnas grupo" value={formatCount(snapshot?.counts.groupColumns)} />
        </div>
        {snapshot?.countErrors.map((error) => <p className="diagnosticError" key={error}>{error}</p>)}
      </article>

      <article className="adminCard diagnosticCard importer">
        <div className="adminCardHead"><div><h3>Importador R2</h3><p>Sincroniza carpetas y archivos del bucket con Supabase.</p></div></div>
        <div className="diagnosticActions">
          <button type="button" onClick={() => void runImport(true)} disabled={importBusy}>{importBusy ? "Ejecutando..." : "Simular"}</button>
          <button className="primaryAction" type="button" onClick={() => void runImport(false)} disabled={importBusy}>Sincronizar R2</button>
        </div>
        {importResult ? (
          <div className="importResult">
            <strong>{importResult.dryRun ? "Simulación" : "Sincronización"}</strong>
            <span>Raíz: {importResult.root ?? "psicologia"}</span>
            <span>Objetos: {importResult.scannedObjects ?? importResult.importedObjects ?? 0}</span>
            <span>Secciones: {importResult.sectionsToEnsure ?? importResult.ensuredSections ?? 0}</span>
            {!importResult.dryRun ? <span>Insertados/actualizados: {importResult.inserted ?? 0}/{importResult.updated ?? 0}</span> : null}
            {importResult.sampleSections?.length ? <small>{importResult.sampleSections.slice(0, 8).join(" · ")}</small> : null}
            {importResult.error ? <p className="diagnosticError">{importResult.error}</p> : null}
          </div>
        ) : null}
        <div className="diagnosticSample">{Object.entries(providers).map(([provider, count]) => <span key={provider}>{provider}: {count}</span>)}</div>
      </article>
    </section>
  );
}

function TasksPanel({ tasks, loading, onReload, onUpdate }: { tasks: AdminTaskRow[]; loading: boolean; onReload: () => void; onUpdate: (id: string, patch: Partial<Pick<AdminTaskRow, "status" | "visible_to_students" | "priority">>) => void }) {
  return <section className="adminCard"><div className="adminCardHead"><div><h3>Tareas próximas</h3><p>Actualiza estado y visibilidad sin abrir la base.</p></div><button type="button" onClick={onReload}>{loading ? "Cargando..." : "Recargar"}</button></div><div className="adminTaskList">{tasks.map((task) => <TaskAdminRow key={task.id} task={task} onUpdate={onUpdate} />)}{!tasks.length && !loading ? <p className="muted">No hay tareas cargadas.</p> : null}</div></section>;
}

function TaskAdminRow({ task, onUpdate }: { task: AdminTaskRow; onUpdate: (id: string, patch: Partial<Pick<AdminTaskRow, "status" | "visible_to_students" | "priority">>) => void }) {
  const course = first(task.courses);
  const type = first(task.task_types);
  return <article className="adminTaskRow" style={{ borderLeftColor: course?.color ?? type?.color ?? "#4285dc" }}><div><strong>{task.title}</strong><small>{course?.name ?? "Sin materia"} · {type?.name ?? "Tarea"} · {task.due_date} {task.due_time?.slice(0, 5) ?? ""}</small></div><select value={task.status} onChange={(event) => onUpdate(task.id, { status: event.target.value })}><option>Pendiente</option><option>Se entrega hoy</option><option>Entregado</option><option>Reprogramado</option><option>Cancelado</option></select><select value={task.priority} onChange={(event) => onUpdate(task.id, { priority: event.target.value })}><option>Alta</option><option>Media</option><option>Baja</option></select><label><input type="checkbox" checked={task.visible_to_students} onChange={(event) => onUpdate(task.id, { visible_to_students: event.target.checked })} />Visible</label></article>;
}

function CoursesPanel({ courses, onUpdate }: { courses: CourseConfig[]; onUpdate: (id: string, patch: Partial<CourseConfig>) => void }) { return <section className="adminCard"><div className="adminCardHead"><div><h3>Materias</h3><p>Define colores, iconos y visibilidad general.</p></div></div><div className="adminRows">{courses.map((course) => <div className="adminEditRow" key={course.id}><span className="swatch" style={{ background: course.color }} /><strong>{course.name}</strong><input aria-label="Color" type="color" value={course.color} onChange={(event) => onUpdate(course.id, { color: event.target.value })} /><input aria-label="Icono" value={course.icon} onChange={(event) => onUpdate(course.id, { icon: event.target.value })} /><label className="adminSwitch"><input type="checkbox" checked={course.active} onChange={(event) => onUpdate(course.id, { active: event.target.checked })} />Activa</label></div>)}</div></section>; }

function SectionsPanel({ sections, onUpdate }: { sections: SectionConfig[]; onUpdate: (id: string, patch: Partial<SectionConfig>) => void }) { return <section className="adminCard"><div className="adminCardHead"><div><h3>Secciones de materiales</h3><p>Personaliza carpetas y subsecciones del asset R2.</p></div></div><div className="adminRows">{sections.map((section) => <div className="adminEditRow section" key={section.id}><span className="swatch" style={{ background: section.color }} /><div className="adminNameBlock"><strong>{section.name}</strong><small>{section.path}</small></div><input aria-label="Color" type="color" value={section.color} onChange={(event) => onUpdate(section.id, { color: event.target.value })} /><input aria-label="Icono" value={section.icon} onChange={(event) => onUpdate(section.id, { icon: event.target.value })} /><select aria-label="Preview" value={section.previewStyle} onChange={(event) => onUpdate(section.id, { previewStyle: event.target.value })}><option value="none">Sin preview</option><option value="icon">Icono</option><option value="thumbnail">Miniatura</option><option value="embedded">Embebido</option></select></div>)}</div></section>; }

function MaterialUploadPanel({ sections, supabase, reload, onError }: { sections: SectionConfig[]; supabase: SupabaseBrowser | null; reload: () => Promise<void>; onError: (error: string | null) => void }) {
  const sectionDestinations = useMemo<UploadDestination[]>(
    () => sections.map((section) => ({ id: `section:${section.id}`, sectionId: section.id, name: section.name, path: section.path, source: "supabase" })),
    [sections],
  );
  const [destinations, setDestinations] = useState<UploadDestination[]>(sectionDestinations);
  const [destinationId, setDestinationId] = useState(sectionDestinations[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDestinations((current) => mergeDestinations(sectionDestinations, current));
  }, [sectionDestinations]);

  useEffect(() => {
    let cancelled = false;
    async function loadDestinations() {
      try {
        const response = await fetch("/api/uploads/destinations", { credentials: "include" });
        const body = await response.json() as { destinations?: UploadDestination[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar destinos R2.");
        if (!cancelled) setDestinations(mergeDestinations(sectionDestinations, body.destinations ?? []));
      } catch (error) {
        if (!cancelled && sectionDestinations.length) setDestinations(sectionDestinations);
        if (!cancelled && error instanceof Error) onError(error.message);
      }
    }
    void loadDestinations();
    return () => { cancelled = true; };
  }, [sectionDestinations, onError]);

  useEffect(() => {
    if (!destinationId && destinations[0]) setDestinationId(destinations[0].id);
    if (destinationId && destinations.length && !destinations.some((destination) => destination.id === destinationId)) {
      setDestinationId(destinations[0].id);
    }
  }, [destinationId, destinations]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const destination = destinations.find((item) => item.id === destinationId);
    if (!file || !destination || !supabase) {
      onError("Selecciona un archivo y un destino válido.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream", sectionPath: destination.path }),
      });
      const body = await response.json() as { key?: string; uploadUrl?: string; publicUrl?: string | null; error?: string };
      if (!response.ok || !body.uploadUrl || !body.key) throw new Error(body.error ?? "No se pudo preparar la subida.");

      const upload = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!upload.ok) throw new Error("R2 rechazó el archivo.");

      const { error } = await supabase.from("materials").insert({
        section_id: destination.sectionId,
        title: title || file.name,
        file_name: file.name,
        material_type: file.type.includes("pdf") ? "PDF" : "Archivo",
        provider: "r2",
        r2_key: body.key,
        source_url: body.publicUrl,
        preview_url: body.publicUrl,
        content_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw new Error(error.message);

      setTitle("");
      setFile(null);
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo subir el material.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="adminCard"><div className="adminCardHead"><div><h3>Subir material</h3><p>Guarda el archivo en R2 y registra la metadata en Supabase.</p></div></div><form className="adminUpload" onSubmit={submit}><label>Destino<select value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.path}{destination.source === "r2" ? " (R2)" : ""}</option>)}</select></label><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Opcional" /></label><label>Archivo<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button className="primaryAction" disabled={busy} type="submit">{busy ? "Subiendo..." : "Subir a R2"}</button></form></section>;
}

function UsersPanel({ profiles, loading, onReload, onUpdate }: { profiles: AppProfileRow[]; loading: boolean; onReload: () => void; onUpdate: (id: string, patch: Partial<AppProfileRow>) => void }) {
  return (
    <section className="adminCard">
      <div className="adminCardHead"><div><h3>Usuarios</h3><p>Consulta perfiles, roles y permisos operativos.</p></div><button type="button" onClick={onReload}>{loading ? "Cargando..." : "Recargar"}</button></div>
      <div className="adminUserList">
        {profiles.map((profile) => (
          <article className="adminUserRow permissions" key={profile.id}>
            <div><strong>{profile.full_name ?? profile.email}</strong><small>{profile.email} · {profile.control_number ?? "sin control"}</small></div>
            <select value={profile.role} onChange={(event) => onUpdate(profile.id, { role: event.target.value as AppProfileRow["role"] })}><option value="student">Alumno</option><option value="admin">Admin</option><option value="owner">Owner</option></select>
            <label><input type="checkbox" checked={profile.active} onChange={(event) => onUpdate(profile.id, { active: event.target.checked })} />Activo</label>
            <div className="adminPermissionGrid">
              <label><input type="checkbox" checked={profile.can_edit_tasks} onChange={(event) => onUpdate(profile.id, { can_edit_tasks: event.target.checked })} />Tareas</label>
              <label><input type="checkbox" checked={profile.can_delete_tasks} onChange={(event) => onUpdate(profile.id, { can_delete_tasks: event.target.checked })} />Eliminar</label>
              <label><input type="checkbox" checked={profile.can_manage_materials} onChange={(event) => onUpdate(profile.id, { can_manage_materials: event.target.checked })} />Materiales</label>
              <label><input type="checkbox" checked={profile.can_manage_users} onChange={(event) => onUpdate(profile.id, { can_manage_users: event.target.checked })} />Usuarios</label>
              <label><input type="checkbox" checked={profile.can_manage_settings} onChange={(event) => onUpdate(profile.id, { can_manage_settings: event.target.checked })} />Ajustes</label>
              <label><input type="checkbox" checked={profile.can_manage_group} onChange={(event) => onUpdate(profile.id, { can_manage_group: event.target.checked })} />Grupo</label>
              <label><input type="checkbox" checked={profile.can_manage_notifications} onChange={(event) => onUpdate(profile.id, { can_manage_notifications: event.target.checked })} />Avisos</label>
              <label><input type="checkbox" checked={profile.can_view_reports} onChange={(event) => onUpdate(profile.id, { can_view_reports: event.target.checked })} />Reportes</label>
              <label><input type="checkbox" checked={profile.can_manage_r2} onChange={(event) => onUpdate(profile.id, { can_manage_r2: event.target.checked })} />R2</label>
            </div>
          </article>
        ))}
        {!profiles.length && !loading ? <p className="muted">No se pudieron cargar usuarios o no hay permisos RLS para leerlos.</p> : null}
      </div>
    </section>
  );
}

async function safeJson<T>(url: string) {
  try {
    const response = await fetch(url, { credentials: "include" });
    const body = await response.json().catch(() => ({})) as T & { error?: string };
    if (!response.ok || body.error) throw new Error(body.error ?? `No se pudo leer ${url}.`);
    return { data: body as T, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : `No se pudo leer ${url}.` };
  }
}

async function loadDiagnosticCounts(supabase: SupabaseBrowser | null): Promise<{ counts: DiagnosticCounts; errors: string[] }> {
  const counts: DiagnosticCounts = { profiles: null, tasks: null, materials: null, sections: null, groupColumns: null };
  if (!supabase) return { counts, errors: ["Supabase no está configurado en el navegador."] };

  const queries = [
    { key: "profiles", label: "Perfiles", query: supabase.from("app_profiles").select("id", { count: "exact", head: true }) },
    { key: "tasks", label: "Tareas", query: supabase.from("tasks").select("id", { count: "exact", head: true }).is("archived_at", null) },
    { key: "materials", label: "Materiales", query: supabase.from("materials").select("id", { count: "exact", head: true }) },
    { key: "sections", label: "Secciones", query: supabase.from("material_sections").select("id", { count: "exact", head: true }).eq("active", true) },
    { key: "groupColumns", label: "Columnas grupo", query: supabase.from("group_columns").select("id", { count: "exact", head: true }).eq("active", true) },
  ] as const;

  const results = await Promise.all(queries.map(async (item) => ({ ...item, result: await item.query })));
  const errors: string[] = [];

  for (const item of results) {
    if (item.result.error) {
      errors.push(`${item.label}: ${item.result.error.message}`);
      continue;
    }
    counts[item.key] = item.result.count ?? 0;
  }

  return { counts, errors };
}

function DiagnosticPill({ label, ok }: { label: string; ok: boolean }) {
  return <span className={ok ? "diagnosticPill ok" : "diagnosticPill"}>{label}</span>;
}

function DiagnosticRow({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function formatCount(value: number | null | undefined) {
  return value == null ? "sin permiso" : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatReportValue(value: string | number | boolean | null | undefined) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  return String(value);
}

function canSeeAdminTab(profile: AdminProfile, tab: AdminTab) {
  if (!profile || profile.role === "owner") return true;
  if (tab === "general") return true;
  if (tab === "tasks") return profile.canEditTasks;
  if (tab === "courses") return profile.canManageSettings;
  if (tab === "sections" || tab === "materials") return profile.canManageMaterials;
  if (tab === "users") return profile.canManageUsers;
  if (tab === "notifications") return profile.canManageNotifications;
  if (tab === "reports") return profile.canViewReports;
  if (tab === "diagnostics") return profile.canManageR2 || profile.canViewReports;
  return false;
}

function mergeDestinations(primary: UploadDestination[], secondary: UploadDestination[]) {
  const map = new Map<string, UploadDestination>();
  for (const destination of [...secondary, ...primary]) {
    map.set(destination.path.trim().replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase(), destination);
  }
  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path, "es"));
}

function first<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function toDbPatch(patch: Partial<CourseConfig> | Partial<SectionConfig>) { const out: Record<string, unknown> = { updated_at: new Date().toISOString() }; if ("color" in patch) out.color = patch.color; if ("icon" in patch) out.icon = patch.icon; if ("cardSize" in patch) out.card_size = patch.cardSize; if ("previewStyle" in patch) out.preview_style = patch.previewStyle; if ("active" in patch) out.active = patch.active; return out; }
