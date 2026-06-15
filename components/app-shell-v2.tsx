"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ConfigColumn, DeliveryType, GroupMember, Material, Role, Task, TaskStatus } from "@/lib/domain";
import { deliveryTypes, statuses } from "@/lib/domain";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { calculateDaysRemaining, deriveReaderVisibility, deriveStatus, formatDate, shortText, sortTasks } from "@/lib/task-utils";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type Tab = "calendar" | "tasks" | "materials" | "completed" | "group" | "admin" | "prefs";
type DataSource = "demo" | "supabase";
type CardSize = "compact" | "medium" | "large";
type PreviewStyle = "none" | "icon" | "thumbnail" | "embedded";

type Props = { initialTasks: Task[]; initialMaterials: Material[]; initialMembers: GroupMember[]; initialConfigColumns: ConfigColumn[] };
type Profile = { id: string; email: string; fullName: string; role: "student" | "admin" | "owner"; preferences: UserPreferences };
type UserPreferences = { calendarView: "month" | "week" | "day"; taskDensity: CardSize; materialPreviewSize: "small" | "medium" | "large"; showCompleted: boolean; theme: "system" | "light" | "dark" };
type CourseConfig = { id: string; name: string; shortName: string; color: string; icon: string; cardSize: CardSize; active: boolean };
type TaskTypeConfig = { id: string; name: string; color: string; icon: string; cardSize: CardSize; active: boolean };
type SectionConfig = { id: string; name: string; path: string; color: string; icon: string; cardSize: CardSize; previewStyle: PreviewStyle; active: boolean };
type AppSetting = { key: string; label: string; value: unknown };
type UiTask = Task & { courseColor?: string; taskTypeColor?: string; courseCardSize?: CardSize };
type UiMaterial = Material & { sectionId?: string; sectionPath?: string; sectionColor?: string; sectionCardSize?: CardSize; previewStyle?: PreviewStyle; provider?: string; r2Key?: string; thumbnailUrl?: string };

const fallbackPrefs: UserPreferences = { calendarView: "month", taskDensity: "medium", materialPreviewSize: "medium", showCompleted: false, theme: "system" };
const adminFallback = new Set(["martinez_28699@univdep.edu.mx", "ricardomartinez19b@gmail.com", "ricardomartinez19b@icloud.com", "montsedv2611@gmail.com", "ortega_28607@univdep.edu.mx"]);

export function AppShellV2({ initialTasks, initialMaterials, initialMembers, initialConfigColumns }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [authReady, setAuthReady] = useState(!hasSupabaseBrowserConfig());
  const [email, setEmail] = useState<string | null>(null);
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("calendar");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<DataSource>("demo");
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UiTask[]>(initialTasks);
  const [materials, setMaterials] = useState<UiMaterial[]>(initialMaterials);
  const [courses, setCourses] = useState<CourseConfig[]>([]);
  const [types, setTypes] = useState<TaskTypeConfig[]>([]);
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [cursor, setCursor] = useState(new Date(2026, 5, 15));

  const accountEmail = email ?? demoEmail;
  const role: Role = profile?.role === "admin" || profile?.role === "owner" || (accountEmail ? adminFallback.has(accountEmail.toLowerCase()) : false) ? "admin" : "reader";
  const prefs = profile?.preferences ?? fallbackPrefs;

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setAuthReady(true);
    });
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, [supabase]);

  useEffect(() => { if (supabase && email) void loadData(supabase, email); }, [supabase, email]);

  async function loadData(client: SupabaseBrowser, userEmail: string) {
    setError(null);
    const normalizedEmail = userEmail.toLowerCase();
    const [profileRes, coursesRes, typesRes, tasksRes, sectionsRes, materialsRes, settingsRes] = await Promise.all([
      client.from("app_profiles").select("*").eq("email", normalizedEmail).maybeSingle(),
      client.from("courses").select("*").order("sort_order"),
      client.from("task_types").select("*").order("sort_order"),
      client.from("tasks").select("*, courses(name,color,card_size), task_types(name,color,card_size)").order("due_date").order("due_time"),
      client.from("material_sections").select("*").order("sort_order"),
      client.from("materials").select("*, material_sections(id,name,path,color,card_size,preview_style)").order("title"),
      client.from("app_settings").select("*").order("key"),
    ]);
    const failure = profileRes.error || coursesRes.error || typesRes.error || tasksRes.error || sectionsRes.error || materialsRes.error || settingsRes.error;
    if (failure) { setError(failure.message); return; }
    if (profileRes.data) setProfile(toProfile(profileRes.data));
    setCourses((coursesRes.data ?? []).map(toCourse));
    setTypes((typesRes.data ?? []).map(toType));
    setSections((sectionsRes.data ?? []).map(toSection));
    setTasks((tasksRes.data ?? []).map(toTask));
    setMaterials((materialsRes.data ?? []).map(toMaterial));
    setSettings((settingsRes.data ?? []).map((row: Record<string, unknown>) => ({ key: String(row.key), label: String(row.label ?? row.key), value: row.value })));
    setSource("supabase");
  }

  async function signInMicrosoft() {
    if (!supabase) { setError("Faltan variables de Supabase en Vercel."); return; }
    const { error: signInError } = await supabase.auth.signInWithOAuth({ provider: "azure", options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: "openid email profile" } });
    if (signInError) setError(signInError.message);
  }

  async function signOut() {
    setDemoEmail(null); setEmail(null); setProfile(null); setSource("demo"); setTasks(initialTasks); setMaterials(initialMaterials);
    if (supabase) await supabase.auth.signOut();
  }

  if (!authReady) return <main className="loginScreen"><div className="loader" /></main>;
  if (!accountEmail) return <Login onMicrosoft={signInMicrosoft} onDemo={setDemoEmail} error={error} authEnabled={Boolean(supabase)} />;

  const normalizedTasks = tasks.map((task) => {
    const daysRemaining = calculateDaysRemaining(task.dueDate);
    const status = deriveStatus(task.status, daysRemaining);
    return { ...task, daysRemaining, status, visibleToReaders: deriveReaderVisibility({ status }) };
  });
  const visibleTasks = sortTasks(normalizedTasks.filter((task) => task.visibleToReaders || prefs.showCompleted));
  const completedTasks = sortTasks(normalizedTasks.filter((task) => task.status === "Entregado"));
  const shownTasks = filterTasks(visibleTasks, query);
  const shownMaterials = filterMaterials(materials, query);

  function go(next: Tab) {
    if (["completed", "group", "admin"].includes(next) && role !== "admin") return;
    setTab(next); setDrawerOpen(false);
  }

  async function markDone(id: string) {
    if (source === "supabase" && supabase && role === "admin") {
      const { error: updateError } = await supabase.from("tasks").update({ status: "Entregado", visible_to_students: false, updated_at: new Date().toISOString() }).eq("id", id);
      if (updateError) setError(updateError.message); else if (email) await loadData(supabase, email);
      return;
    }
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: "Entregado", visibleToReaders: false } : task));
  }

  return (
    <main className={`mobileApp density-${prefs.taskDensity}`}>
      <header className="topAppBar">
        <button className="iconButton" onClick={() => setDrawerOpen(true)} type="button">☰</button><img src="/icon.svg" className="appLogo" alt="PSCV" />
        <div className="barTitle">{searchOpen ? <input className="barSearch" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" /> : titleFor(tab)}</div>
        <button className="iconButton" onClick={() => setSearchOpen((v) => !v)} type="button">⌕</button><button className="iconButton" onClick={() => email && supabase ? void loadData(supabase, email) : undefined} type="button">↻</button>
      </header>
      <Drawer open={drawerOpen} email={accountEmail} role={role} source={source} active={tab} onClose={() => setDrawerOpen(false)} onSelect={go} onSignOut={signOut} />
      {error ? <div className="systemBanner">{error}</div> : null}
      <section className="screen">
        {tab === "calendar" ? <Calendar tasks={visibleTasks} cursor={cursor} setCursor={setCursor} /> : null}
        {tab === "tasks" ? <TaskList tasks={shownTasks} role={role} onDone={(id) => void markDone(id)} /> : null}
        {tab === "materials" ? <MaterialList materials={shownMaterials} previewSize={prefs.materialPreviewSize} /> : null}
        {tab === "completed" ? <Completed tasks={completedTasks} /> : null}
        {tab === "group" ? <Group members={initialMembers} /> : null}
        {tab === "prefs" ? <Preferences profile={profile} email={accountEmail} supabase={supabase} source={source} onProfile={setProfile} onError={setError} /> : null}
        {tab === "admin" ? <AdminPanel courses={courses} sections={sections} types={types} settings={settings} columns={initialConfigColumns} supabase={supabase} source={source} reload={() => email && supabase ? loadData(supabase, email) : Promise.resolve()} onCourses={setCourses} onSections={setSections} onError={setError} /> : null}
      </section>
      <nav className="bottomNav"><button className={tab === "calendar" ? "active" : ""} onClick={() => go("calendar")} type="button"><span>▦</span>Calendario</button><button className={["tasks", "completed", "group", "admin", "prefs"].includes(tab) ? "active" : ""} onClick={() => go(role === "admin" ? "admin" : "tasks")} type="button"><span>{role === "admin" ? "▣" : "▤"}</span>{role === "admin" ? "Admin" : "Tareas"}</button><button className={tab === "materials" ? "active" : ""} onClick={() => go("materials")} type="button"><span>⬡</span>Materiales</button></nav>
    </main>
  );
}

function Login({ onMicrosoft, onDemo, error, authEnabled }: { onMicrosoft: () => void; onDemo: (email: string) => void; error: string | null; authEnabled: boolean }) { return <main className="loginScreen"><div className="loginCard"><img src="/icon.svg" className="loginLogo" alt="PSCV" /><p className="eyebrow">PSCV Room 2.0</p><h1>Accede con Microsoft.</h1><p className="muted">Tu correo define tus permisos en Supabase.</p><button className="primaryAction" onClick={onMicrosoft} type="button">{authEnabled ? "Continuar con Microsoft" : "OAuth pendiente"}</button>{error ? <p className="authError">{error}</p> : null}<div className="demoGrid"><button onClick={() => onDemo("alumno@univdep.edu.mx")} type="button">Demo alumno</button><button onClick={() => onDemo("martinez_28699@univdep.edu.mx")} type="button">Demo admin</button></div></div></main>; }
function Drawer({ open, email, role, source, active, onClose, onSelect, onSignOut }: { open: boolean; email: string; role: Role; source: DataSource; active: Tab; onClose: () => void; onSelect: (tab: Tab) => void; onSignOut: () => void }) { return <><div className={`scrim ${open ? "show" : ""}`} onClick={onClose} /><aside className={`drawer ${open ? "open" : ""}`}><div className="drawerHead"><img src="/icon.svg" alt="PSCV" /><div><strong>{role === "admin" ? "PSCV-ADMIN" : "PSCV-ROOM"}</strong><span className="drawerSource">{source === "supabase" ? "Supabase conectado" : "Modo demo"}</span></div></div><nav className="drawerNav"><DrawerItem icon="⚙" label="Preferencias" active={active === "prefs"} onClick={() => onSelect("prefs")} />{role === "admin" ? <DrawerItem icon="✓" label="Entregadas" active={active === "completed"} onClick={() => onSelect("completed")} /> : null}{role === "admin" ? <DrawerItem icon="☷" label="Lista de grupo" active={active === "group"} onClick={() => onSelect("group")} /> : null}{role === "admin" ? <DrawerItem icon="🛠" label="Configuración" active={active === "admin"} onClick={() => onSelect("admin")} /> : null}<DrawerItem icon="ⓘ" label="About" active={false} onClick={onClose} /></nav><div className="drawerFooter"><div className="offline">◉ Offline ready <u>more</u></div><div className="accountRow"><span className="avatar">{email[0]?.toUpperCase()}</span><span>{email}</span><button onClick={onSignOut} type="button">⌄</button></div></div></aside></>; }
function DrawerItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) { return <button className={`drawerItem ${active ? "active" : ""}`} onClick={onClick} type="button"><span>{icon}</span>{label}</button>; }
function Calendar({ tasks, cursor, setCursor }: { tasks: UiTask[]; cursor: Date; setCursor: (date: Date) => void }) { const y = cursor.getFullYear(); const m = cursor.getMonth(); const cells = monthCells(y, m); const name = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor); return <div><div className="viewTabs"><span>Day</span><span>Week</span><strong>Month</strong><button type="button" onClick={() => setCursor(new Date(2026, 5, 15))}>TODAY</button></div><div className="monthHead"><button onClick={() => setCursor(new Date(y, m - 1, 15))} type="button">‹</button><h2>{name}</h2><button onClick={() => setCursor(new Date(y, m + 1, 15))} type="button">›</button></div><div className="weekdays"><span>do</span><span>lu</span><span>ma</span><span>mi</span><span>ju</span><span>vi</span><span>sá</span></div><div className="monthGrid">{cells.map((day, index) => { const key = day ? `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : ""; const dayTasks = tasks.filter((task) => task.dueDate === key); return <div className="dayCell" key={`${key}-${index}`}>{day ? <span className={`dayNumber ${key === "2026-06-15" ? "today" : ""}`}>{String(day).padStart(2, "0")}</span> : null}<div className="eventStack">{dayTasks.slice(0, 3).map((task) => <span className="calendarEvent" style={{ backgroundColor: task.taskTypeColor ?? task.courseColor ?? "#4285dc" } as CSSProperties} key={task.id}>{shortText(task.title, 13)}</span>)}</div></div>; })}</div></div>; }
function TaskList({ tasks, role, onDone }: { tasks: UiTask[]; role: Role; onDone: (id: string) => void }) { const grouped = groupTasks(tasks); return <div className="listScreen">{deliveryTypes.map((type) => { const rows = grouped.get(type) ?? []; if (!rows.length) return null; return <section className="typeGroup" key={type}><h2 className="groupTitle" style={{ color: rows[0].taskTypeColor ?? undefined }}><span>▤</span>{type}</h2>{rows.map((task) => <article className={`dataRow taskRow card-${task.courseCardSize ?? "medium"}`} style={{ borderLeft: `5px solid ${task.courseColor ?? "#4285dc"}` }} key={task.id}><div className="rowMain"><strong>{task.title}</strong><span>{task.course}</span></div><div className="rowSide"><span className="days">◷ <u>{task.daysRemaining}</u></span>{task.materialUrl ? <a className="openIcon" href={task.materialUrl} target="_blank" rel="noreferrer">↗</a> : null}{role === "admin" ? <button className="miniAction" onClick={() => onDone(task.id)} type="button">✓</button> : null}</div></article>)}</section>; })}</div>; }
function MaterialList({ materials, previewSize }: { materials: UiMaterial[]; previewSize: UserPreferences["materialPreviewSize"] }) { const grouped = new Map<string, UiMaterial[]>(); materials.forEach((m) => grouped.set(m.scope, [...(grouped.get(m.scope) ?? []), m])); return <div className={`listScreen materialPreview-${previewSize}`}>{[...grouped.entries()].map(([scope, rows]) => <section className="materialGroup" key={scope}><h2 className="plainGroupTitle" style={{ color: rows[0]?.sectionColor }}>{scope}</h2>{rows.map((material) => <article className={`dataRow materialRow card-${material.sectionCardSize ?? "medium"}`} key={material.id}><div className="materialPreviewBox" style={{ borderColor: material.sectionColor }}>{material.type}</div><div className="rowMain"><strong>{material.name}</strong><span>{material.sectionPath ?? material.folder ?? material.scope}</span></div><a href={material.url} target="_blank" rel="noreferrer" className="openIcon">↗</a></article>)}</section>)}</div>; }
function Completed({ tasks }: { tasks: UiTask[] }) { return <TaskList tasks={tasks} role="reader" onDone={() => undefined} />; }
function Group({ members }: { members: GroupMember[] }) { return <div className="tableWrap"><table className="appTable memberTable"><thead><tr><th>No. Control</th><th>Correo electronico</th><th>Nombre completo</th></tr></thead><tbody>{members.map((m) => <tr key={m.controlNumber}><td>{m.controlNumber}</td><td>{m.email}</td><td>{m.fullName}</td></tr>)}</tbody></table></div>; }
function Preferences({ profile, email, supabase, source, onProfile, onError }: { profile: Profile | null; email: string; supabase: SupabaseBrowser | null; source: DataSource; onProfile: (p: Profile | null) => void; onError: (e: string | null) => void }) { const prefs = profile?.preferences ?? fallbackPrefs; async function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) { const next = { ...prefs, [key]: value }; if (profile) onProfile({ ...profile, preferences: next }); if (source === "supabase" && supabase) { const { error } = await supabase.from("app_profiles").update({ preferences: next }).eq("email", email.toLowerCase()); if (error) onError(error.message); } } return <div className="settingsScreen"><section className="settingsCard"><p className="eyebrow">Alumno</p><h2>Preferencias</h2><div className="settingsGrid"><label>Vista<select value={prefs.calendarView} onChange={(e) => void update("calendarView", e.target.value as UserPreferences["calendarView"])}><option value="month">Mes</option><option value="week">Semana</option><option value="day">Día</option></select></label><label>Densidad<select value={prefs.taskDensity} onChange={(e) => void update("taskDensity", e.target.value as CardSize)}><option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option></select></label><label>Previews<select value={prefs.materialPreviewSize} onChange={(e) => void update("materialPreviewSize", e.target.value as UserPreferences["materialPreviewSize"])}><option value="small">Pequeños</option><option value="medium">Medianos</option><option value="large">Grandes</option></select></label><label className="checkSetting"><input type="checkbox" checked={prefs.showCompleted} onChange={(e) => void update("showCompleted", e.target.checked)} /> Mostrar entregadas</label></div></section></div>; }
function AdminPanel({ courses, sections, types, settings, columns, supabase, source, reload, onCourses, onSections, onError }: { courses: CourseConfig[]; sections: SectionConfig[]; types: TaskTypeConfig[]; settings: AppSetting[]; columns: ConfigColumn[]; supabase: SupabaseBrowser | null; source: DataSource; reload: () => Promise<void>; onCourses: (c: CourseConfig[]) => void; onSections: (s: SectionConfig[]) => void; onError: (e: string | null) => void }) { async function updateCourse(id: string, patch: Partial<CourseConfig>) { onCourses(courses.map((c) => c.id === id ? { ...c, ...patch } : c)); if (source === "supabase" && supabase) { const { error } = await supabase.from("courses").update(toDbPatch(patch)).eq("id", id); if (error) onError(error.message); } } async function updateSection(id: string, patch: Partial<SectionConfig>) { onSections(sections.map((s) => s.id === id ? { ...s, ...patch } : s)); if (source === "supabase" && supabase) { const { error } = await supabase.from("material_sections").update(toDbPatch(patch)).eq("id", id); if (error) onError(error.message); } } return <div className="settingsScreen"><section className="settingsCard"><p className="eyebrow">Admin</p><h2>Configuración editable</h2><p className="muted">Cambios guardados en Supabase; no necesitas tocar código.</p></section><section className="settingsCard"><h3>Materias</h3><div className="configList">{courses.map((c) => <div className="configRow" key={c.id}><span className="swatch" style={{ background: c.color }} /><strong>{c.name}</strong><input type="color" value={c.color} onChange={(e) => void updateCourse(c.id, { color: e.target.value })} /><input value={c.icon} onChange={(e) => void updateCourse(c.id, { icon: e.target.value })} /><select value={c.cardSize} onChange={(e) => void updateCourse(c.id, { cardSize: e.target.value as CardSize })}><option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option></select></div>)}</div></section><section className="settingsCard"><h3>Secciones de materiales</h3><div className="configList">{sections.map((s) => <div className="configRow sectionConfigRow" key={s.id}><span className="swatch" style={{ background: s.color }} /><strong>{s.name}</strong><small>{s.path}</small><input type="color" value={s.color} onChange={(e) => void updateSection(s.id, { color: e.target.value })} /><input value={s.icon} onChange={(e) => void updateSection(s.id, { icon: e.target.value })} /><select value={s.cardSize} onChange={(e) => void updateSection(s.id, { cardSize: e.target.value as CardSize })}><option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option></select><select value={s.previewStyle} onChange={(e) => void updateSection(s.id, { previewStyle: e.target.value as PreviewStyle })}><option value="none">Sin preview</option><option value="icon">Icono</option><option value="thumbnail">Miniatura</option><option value="embedded">Embebido</option></select></div>)}</div></section><Uploader sections={sections} supabase={supabase} source={source} reload={reload} onError={onError} /><section className="settingsCard"><h3>Tipos</h3><div className="pillGrid">{types.map((t) => <span className="configPill" style={{ color: t.color, borderColor: t.color }} key={t.id}>{t.icon} {t.name}</span>)}</div></section><section className="settingsCard"><h3>Settings</h3>{settings.map((s) => <details className="settingDetail" key={s.key}><summary>{s.label}</summary><pre>{JSON.stringify(s.value, null, 2)}</pre></details>)}</section><section className="settingsCard"><h3>Columnas legacy</h3><div className="pillGrid">{columns.map((c) => <span className="configPill" key={c.key}>{c.name}: {c.active ? "SI" : "NO"}</span>)}</div></section></div>; }
function Uploader({ sections, supabase, source, reload, onError }: { sections: SectionConfig[]; supabase: SupabaseBrowser | null; source: DataSource; reload: () => Promise<void>; onError: (e: string | null) => void }) { const [sectionId, setSectionId] = useState(""); const [title, setTitle] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); useEffect(() => { if (!sectionId && sections[0]) setSectionId(sections[0].id); }, [sections, sectionId]); async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); if (!file || !sectionId || !supabase || source !== "supabase") { onError("Selecciona archivo/sección y configura Supabase/R2."); return; } setBusy(true); try { const res = await fetch("/api/uploads/presign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }) }); const body = await res.json() as { key?: string; uploadUrl?: string; publicUrl?: string | null; error?: string }; if (!res.ok || !body.uploadUrl || !body.key) throw new Error(body.error ?? "No se pudo firmar la subida."); const put = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file }); if (!put.ok) throw new Error("R2 rechazó el archivo."); const { error } = await supabase.from("materials").insert({ section_id: sectionId, title: title || file.name, file_name: file.name, material_type: file.type.includes("pdf") ? "PDF" : "Archivo", provider: "r2", r2_key: body.key, source_url: body.publicUrl, preview_url: body.publicUrl, content_type: file.type || null, size_bytes: file.size }); if (error) throw new Error(error.message); setTitle(""); setFile(null); await reload(); } catch (err) { onError(err instanceof Error ? err.message : "Error subiendo material."); } finally { setBusy(false); } } return <section className="settingsCard"><h3>Subir material a R2</h3><form className="uploadForm" onSubmit={submit}><select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>{sections.map((s) => <option key={s.id} value={s.id}>{s.path}</option>)}</select><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título opcional" /><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /><button className="primaryAction" disabled={busy} type="submit">{busy ? "Subiendo..." : "Subir"}</button></form></section>; }

function titleFor(tab: Tab) { return tab === "calendar" ? "Calendario" : tab === "tasks" ? "Tareas" : tab === "materials" ? "Materiales adicionales" : tab === "completed" ? "Entregadas" : tab === "group" ? "Lista de grupo" : tab === "prefs" ? "Preferencias" : "Configuración"; }
function monthCells(year: number, month: number) { const first = new Date(year, month, 1).getDay(); const total = new Date(year, month + 1, 0).getDate(); const cells: Array<number | null> = Array(first).fill(null).concat(Array.from({ length: total }, (_, i) => i + 1)); while (cells.length % 7 !== 0) cells.push(null); return cells; }
function groupTasks(tasks: UiTask[]) { const map = new Map<DeliveryType, UiTask[]>(); tasks.forEach((t) => map.set(t.deliveryType, [...(map.get(t.deliveryType) ?? []), t])); return map; }
function filterTasks(tasks: UiTask[], query: string) { const q = query.toLowerCase().trim(); return q ? tasks.filter((t) => [t.title, t.course, t.materialNeeded, t.notes].some((v) => v?.toLowerCase().includes(q))) : tasks; }
function filterMaterials(materials: UiMaterial[], query: string) { const q = query.toLowerCase().trim(); return q ? materials.filter((m) => [m.name, m.scope, m.folder, m.sectionPath].some((v) => v?.toLowerCase().includes(q))) : materials; }
function asOne<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function cardSize(value: unknown): CardSize { return value === "compact" || value === "large" ? value : "medium"; }
function preview(value: unknown): PreviewStyle { return value === "none" || value === "icon" || value === "embedded" ? value : "thumbnail"; }
function delivery(value: unknown): DeliveryType { const text = String(value ?? "Tarea"); return deliveryTypes.includes(text as DeliveryType) ? text as DeliveryType : "Tarea"; }
function status(value: unknown): TaskStatus { const text = String(value ?? "Pendiente"); return statuses.includes(text as TaskStatus) ? text as TaskStatus : "Pendiente"; }
function toProfile(r: Record<string, unknown>): Profile { return { id: String(r.id), email: String(r.email), fullName: String(r.full_name ?? r.email), role: r.role === "owner" ? "owner" : r.role === "admin" ? "admin" : "student", preferences: { ...fallbackPrefs, ...(typeof r.preferences === "object" && r.preferences ? r.preferences : {}) } as UserPreferences }; }
function toCourse(r: Record<string, unknown>): CourseConfig { return { id: String(r.id), name: String(r.name), shortName: String(r.short_name ?? r.name), color: String(r.color ?? "#4285dc"), icon: String(r.icon ?? "book"), cardSize: cardSize(r.card_size), active: Boolean(r.active ?? true) }; }
function toType(r: Record<string, unknown>): TaskTypeConfig { return { id: String(r.id), name: String(r.name), color: String(r.color ?? "#4285dc"), icon: String(r.icon ?? "task"), cardSize: cardSize(r.card_size), active: Boolean(r.active ?? true) }; }
function toSection(r: Record<string, unknown>): SectionConfig { return { id: String(r.id), name: String(r.name), path: String(r.path), color: String(r.color ?? "#4285dc"), icon: String(r.icon ?? "folder"), cardSize: cardSize(r.card_size), previewStyle: preview(r.preview_style), active: Boolean(r.active ?? true) }; }
function toTask(r: Record<string, unknown>): UiTask { const c = asOne(r.courses as Record<string, unknown> | Record<string, unknown>[] | null); const tt = asOne(r.task_types as Record<string, unknown> | Record<string, unknown>[] | null); const dueDate = String(r.due_date); const daysRemaining = calculateDaysRemaining(dueDate); const next = deriveStatus(status(r.status), daysRemaining); return { id: String(r.id), course: String(c?.name ?? "Sin materia"), dueDate, dueTime: String(r.due_time ?? "23:59").slice(0, 5), title: String(r.title ?? "Sin título"), materialNeeded: r.material_needed ? String(r.material_needed) : "", materialUrl: r.material_url ? String(r.material_url) : "", deliveryType: delivery(tt?.name), status: next, daysRemaining, notes: r.notes ? String(r.notes) : "", platformUrl: r.platform_url ? String(r.platform_url) : "", visibleToReaders: Boolean(r.visible_to_students), courseColor: c?.color ? String(c.color) : undefined, taskTypeColor: tt?.color ? String(tt.color) : undefined, courseCardSize: cardSize(c?.card_size) }; }
function toMaterial(r: Record<string, unknown>): UiMaterial { const s = asOne(r.material_sections as Record<string, unknown> | Record<string, unknown>[] | null); const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_BASE_URL || ""; const key = r.r2_key ? String(r.r2_key) : ""; const r2Url = base && key ? `${base.replace(/\/$/, "")}/${encodeURI(key)}` : ""; const source = r.source_url ? String(r.source_url) : ""; const prev = r.preview_url ? String(r.preview_url) : ""; return { id: String(r.id), type: String(r.material_type ?? "PDF"), scope: String(s?.name ?? "Materiales"), name: String(r.title ?? r.file_name ?? "Material"), url: r2Url || source || prev || "#", previewUrl: prev || r2Url || source, thumbnailUrl: r.thumbnail_url ? String(r.thumbnail_url) : undefined, folder: s?.name ? String(s.name) : undefined, sectionId: s?.id ? String(s.id) : undefined, sectionPath: s?.path ? String(s.path) : undefined, sectionColor: s?.color ? String(s.color) : undefined, sectionCardSize: cardSize(s?.card_size), previewStyle: preview(s?.preview_style), provider: String(r.provider ?? "r2"), r2Key: key }; }
function toDbPatch(patch: Partial<CourseConfig> | Partial<SectionConfig>) { const out: Record<string, unknown> = { updated_at: new Date().toISOString() }; if ("color" in patch) out.color = patch.color; if ("icon" in patch) out.icon = patch.icon; if ("cardSize" in patch) out.card_size = patch.cardSize; if ("previewStyle" in patch) out.preview_style = patch.previewStyle; return out; }
