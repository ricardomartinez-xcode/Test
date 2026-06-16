"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  ListTodo,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { AdminHub } from "@/components/admin-hub";
import { MaterialLibrary } from "@/components/material-library";
import type { DeliveryType, GroupMember, Role, Task, TaskStatus } from "@/lib/domain";
import { deliveryTypes, statuses } from "@/lib/domain";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { calculateDaysRemaining, deriveReaderVisibility, deriveStatus, sortTasks } from "@/lib/task-utils";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type Tab = "calendar" | "tasks" | "materials" | "completed" | "group" | "admin" | "prefs";
type CardSize = "compact" | "medium" | "large";

type Props = {
  initialTasks: Task[];
  initialMembers: GroupMember[];
};

type UserPreferences = {
  calendarView: "month" | "week" | "day";
  taskDensity: CardSize;
  materialPreviewSize: "small" | "medium" | "large";
  showCompleted: boolean;
  theme: "system" | "light" | "dark";
};

type Profile = {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "admin" | "owner";
  preferences: UserPreferences;
};

type UiTask = Task & {
  courseColor?: string;
  taskTypeColor?: string;
  courseCardSize?: CardSize;
};

type CourseConfig = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  cardSize: CardSize;
  active: boolean;
};

type SectionConfig = {
  id: string;
  name: string;
  path: string;
  color: string;
  icon: string;
  cardSize: CardSize;
  previewStyle: string;
  active: boolean;
};

const fallbackPrefs: UserPreferences = {
  calendarView: "month",
  taskDensity: "medium",
  materialPreviewSize: "medium",
  showCompleted: false,
  theme: "system",
};

const hasSupabaseConfig = hasSupabaseBrowserConfig();

const demoProfile: Profile = {
  id: "local-demo-admin",
  email: "demo.admin@pscv.local",
  fullName: "Administrador demo",
  role: "owner",
  preferences: fallbackPrefs,
};

const demoCourses: CourseConfig[] = [
  { id: "aprendizaje", name: "Psicología del Aprendizaje", shortName: "Aprendizaje", color: "#2f77d0", icon: "book", cardSize: "medium", active: true },
  { id: "evaluacion", name: "Evaluación Psicológica I", shortName: "Evaluación", color: "#7c3aed", icon: "clipboard", cardSize: "medium", active: true },
  { id: "social", name: "Problemática Social Mexicana", shortName: "Social", color: "#d97706", icon: "users", cardSize: "medium", active: true },
  { id: "grupales", name: "Procesos Grupales", shortName: "Grupales", color: "#0f9f8f", icon: "network", cardSize: "medium", active: true },
  { id: "conducta", name: "Alteraciones de la Conducta", shortName: "Conducta", color: "#dc2626", icon: "brain", cardSize: "medium", active: true },
];

const demoSections: SectionConfig[] = [
  { id: "clase", name: "Materiales de clase", path: "Psicología/Materiales de clase", color: "#2f77d0", icon: "folder", cardSize: "medium", previewStyle: "thumbnail", active: true },
  { id: "apa", name: "APA e investigación", path: "Psicología/Materiales de clase/APA e investigación", color: "#7c3aed", icon: "file", cardSize: "medium", previewStyle: "thumbnail", active: true },
  { id: "clinica", name: "Psicología clínica", path: "Psicología/Materiales de clase/Psicología clínica", color: "#0f9f8f", icon: "file", cardSize: "medium", previewStyle: "thumbnail", active: true },
];

export function AppShellV5({ initialTasks, initialMembers }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [ready, setReady] = useState(!hasSupabaseConfig);
  const [email, setEmail] = useState<string | null>(hasSupabaseConfig ? null : demoProfile.email);
  const [profile, setProfile] = useState<Profile | null>(hasSupabaseConfig ? null : demoProfile);
  const [tab, setTab] = useState<Tab>("calendar");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UiTask[]>(initialTasks);
  const [courses, setCourses] = useState<CourseConfig[]>(hasSupabaseConfig ? [] : demoCourses);
  const [sections, setSections] = useState<SectionConfig[]>(hasSupabaseConfig ? [] : demoSections);
  const [cursor, setCursor] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTasks[0]?.id ?? null);

  const prefs = profile?.preferences ?? fallbackPrefs;
  const role: Role = profile?.role === "admin" || profile?.role === "owner" ? "admin" : "reader";

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setReady(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (supabase && email) void loadData(supabase, email);
  }, [supabase, email]);

  async function loadData(client: SupabaseBrowser, accountEmail: string) {
    setError(null);
    const normalized = accountEmail.toLowerCase();
    const [profileRes, coursesRes, sectionsRes, tasksRes] = await Promise.all([
      client.from("app_profiles").select("*").eq("email", normalized).maybeSingle(),
      client.from("courses").select("*").order("sort_order"),
      client.from("material_sections").select("*").order("sort_order"),
      client
        .from("tasks")
        .select("*, courses(name,color,card_size), task_types(name,color,card_size)")
        .is("archived_at", null)
        .order("due_date")
        .order("due_time"),
    ]);

    const failure = profileRes.error || coursesRes.error || sectionsRes.error || tasksRes.error;
    if (failure) {
      setError(failure.message);
      return;
    }

    if (profileRes.data) setProfile(toProfile(profileRes.data));
    setCourses((coursesRes.data ?? []).map(toCourse));
    setSections((sectionsRes.data ?? []).map(toSection));
    setTasks((tasksRes.data ?? []).map(toTask));
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setEmail(null);
    setProfile(null);
    setDrawerOpen(false);
  }

  function enterLocalDemo() {
    setEmail(demoProfile.email);
    setProfile(demoProfile);
    setCourses(demoCourses);
    setSections(demoSections);
    setTab("calendar");
  }

  async function markDone(id: string) {
    if (!supabase || role !== "admin") return;
    const { error: updateError } = await supabase
      .from("tasks")
      .update({ status: "Entregado", visible_to_students: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) setError(updateError.message);
    else if (email) await loadData(supabase, email);
  }

  if (!ready) {
    return (
      <main className="loginScreen">
        <div className="loader" />
      </main>
    );
  }

  if (!email && !supabase) {
    return (
      <main className="loginScreen authPage">
        <section className="loginCard authCard authCardSimple">
          <img src="/icon.svg" className="authLogoMain" alt="PSCV Room" />
          <h1 className="authTitle">PSCV Room</h1>
          <button className="microsoftButton" onClick={enterLocalDemo} type="button">
            Entrar en demo
          </button>
        </section>
      </main>
    );
  }

  const normalizedTasks = tasks.map((task) => {
    const daysRemaining = calculateDaysRemaining(task.dueDate);
    const status = deriveStatus(task.status, daysRemaining);
    return { ...task, daysRemaining, status, visibleToReaders: deriveReaderVisibility({ status }) };
  });

  const listBase = role === "admin"
    ? normalizedTasks
    : normalizedTasks.filter((task) => task.visibleToReaders || prefs.showCompleted);
  const visibleTasks = sortTasks(listBase);
  const completedTasks = sortTasks(normalizedTasks.filter((task) => task.status === "Entregado"));
  const shownTasks = filterTasks(visibleTasks, query);
  const selectedTask = selectedTaskId
    ? visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? null
    : visibleTasks[0] ?? null;

  function go(next: Tab) {
    if (["completed", "group", "admin"].includes(next) && role !== "admin") return;
    setTab(next);
    setDrawerOpen(false);
  }

  return (
    <main className={`mobileApp density-${prefs.taskDensity} ${role === "admin" ? "adminShell" : ""}`}>
      <header className="topAppBar">
        <button className="iconButton" aria-label="Abrir navegación" title="Navegación" onClick={() => setDrawerOpen(true)} type="button"><Menu size={23} /></button>
        <img src="/icon.svg" className="appLogo" alt="PSCV" />
        <div className="barTitle">
          {searchOpen ? (
            <input className="barSearch" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" />
          ) : (
            titleFor(tab)
          )}
        </div>
        <button className="iconButton" aria-label="Buscar" title="Buscar" onClick={() => setSearchOpen((value) => !value)} type="button"><Search size={22} /></button>
        <button className="iconButton" aria-label="Actualizar" title="Actualizar" onClick={() => email && supabase ? void loadData(supabase, email) : undefined} type="button"><RefreshCw size={21} /></button>
      </header>

      <Drawer
        open={drawerOpen}
        email={email ?? ""}
        role={role}
        active={tab}
        sourceLabel={supabase ? "Supabase conectado" : "Demo local"}
        onClose={() => setDrawerOpen(false)}
        onSelect={go}
        onSignOut={signOut}
      />
      {error ? <div className="systemBanner">{error}</div> : null}

      <section className="screen">
        {tab === "calendar" ? <Calendar tasks={visibleTasks} cursor={cursor} setCursor={setCursor} selectedTask={selectedTask} onSelect={setSelectedTaskId} /> : null}
        {tab === "tasks" ? <TaskList tasks={shownTasks} role={role} onDone={(id) => void markDone(id)} /> : null}
        {tab === "materials" ? <MaterialLibrary previewSize={prefs.materialPreviewSize} globalQuery={query} /> : null}
        {tab === "completed" ? <TaskList tasks={completedTasks} role="reader" onDone={() => undefined} /> : null}
        {tab === "group" ? <Group members={initialMembers} /> : null}
        {tab === "prefs" ? <Preferences profile={profile} supabase={supabase} onProfile={setProfile} onError={setError} /> : null}
        {tab === "admin" ? (
          <AdminHub
            courses={courses}
            sections={sections}
            supabase={supabase}
            reload={() => email && supabase ? loadData(supabase, email) : Promise.resolve()}
            onCourses={setCourses}
            onSections={setSections}
            onError={setError}
          />
        ) : null}
      </section>

      <nav className={`bottomNav ${role === "admin" ? "adminBottomNav" : ""}`}>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => go("calendar")} type="button"><CalendarDays size={22} />Calendario</button>
        <button className={tab === "tasks" ? "active" : ""} onClick={() => go("tasks")} type="button"><ListTodo size={22} />Tareas</button>
        {role === "admin" ? (
          <button className={tab === "admin" ? "active" : ""} onClick={() => go("admin")} type="button"><SlidersHorizontal size={22} />Admin</button>
        ) : null}
        <button className={tab === "materials" ? "active" : ""} onClick={() => go("materials")} type="button"><FolderOpen size={22} />Materiales</button>
      </nav>
    </main>
  );
}

function Drawer({ open, email, role, active, sourceLabel, onClose, onSelect, onSignOut }: { open: boolean; email: string; role: Role; active: Tab; sourceLabel: string; onClose: () => void; onSelect: (tab: Tab) => void; onSignOut: () => void }) {
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawerHead">
          <img src="/icon.svg" alt="PSCV" />
          <div>
            <strong>{role === "admin" ? "PSCV-ADMIN" : "PSCV-ROOM"}</strong>
            <span className="drawerSource">{sourceLabel}</span>
          </div>
        </div>
        <nav className="drawerNav">
          <DrawerItem icon={<CalendarDays size={20} />} label="Calendario" active={active === "calendar"} onClick={() => onSelect("calendar")} />
          <DrawerItem icon={<ListTodo size={20} />} label="Tareas" active={active === "tasks"} onClick={() => onSelect("tasks")} />
          <DrawerItem icon={<FolderOpen size={20} />} label="Materiales" active={active === "materials"} onClick={() => onSelect("materials")} />
          <DrawerItem icon={<Settings size={20} />} label="Preferencias" active={active === "prefs"} onClick={() => onSelect("prefs")} />
          {role === "admin" ? <DrawerItem icon={<CheckCircle2 size={20} />} label="Entregadas" active={active === "completed"} onClick={() => onSelect("completed")} /> : null}
          {role === "admin" ? <DrawerItem icon={<Users size={20} />} label="Lista de grupo" active={active === "group"} onClick={() => onSelect("group")} /> : null}
          {role === "admin" ? <DrawerItem icon={<SlidersHorizontal size={20} />} label="Configuración" active={active === "admin"} onClick={() => onSelect("admin")} /> : null}
        </nav>
        <div className="drawerFooter">
          <div className="offline"><span>Online</span><u>{sourceLabel}</u></div>
          <div className="accountRow">
            <span className="avatar">{email[0]?.toUpperCase()}</span>
            <span>{email}</span>
            <button className="logoutButton" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onSignOut} type="button"><LogOut size={18} /><span>Cerrar sesión</span></button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`drawerItem ${active ? "active" : ""}`} onClick={onClick} type="button"><span>{icon}</span>{label}</button>;
}

function Calendar({ tasks, cursor, setCursor, selectedTask, onSelect }: { tasks: UiTask[]; cursor: Date; setCursor: (date: Date) => void; selectedTask: UiTask | null; onSelect: (id: string) => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="calendarWorkspace">
      <section className="calendarPane">
        <div className="viewTabs"><span>Día</span><span>Semana</span><strong>Mes</strong><button type="button" onClick={() => setCursor(new Date())}>Hoy</button></div>
        <div className="monthHead"><button aria-label="Mes anterior" onClick={() => setCursor(new Date(year, month - 1, 15))} type="button">‹</button><h2>{label}</h2><button aria-label="Mes siguiente" onClick={() => setCursor(new Date(year, month + 1, 15))} type="button">›</button></div>
        <div className="weekdays"><span>do</span><span>lu</span><span>ma</span><span>mi</span><span>ju</span><span>vi</span><span>sá</span></div>
        <div className="monthGrid">
          {cells.map((day, index) => {
            const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
            const dayTasks = tasks.filter((task) => task.dueDate === key);
            return (
              <div className="dayCell" key={`${key}-${index}`}>
                {day ? <span className={`dayNumber ${key === today ? "today" : ""}`}>{String(day).padStart(2, "0")}</span> : null}
                <div className="eventStack">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      className={`calendarEvent ${selectedTask?.id === task.id ? "selected" : ""}`}
                      style={{ borderLeftColor: task.taskTypeColor ?? task.courseColor ?? "#4285dc" } as CSSProperties}
                      key={task.id}
                      title={`${task.dueTime} ${task.title}`}
                      onClick={() => onSelect(task.id)}
                      type="button"
                    >
                      <span>{task.dueTime}</span>
                      <strong>{task.title}</strong>
                    </button>
                  ))}
                  {dayTasks.length > 3 ? (
                    <button className="moreEvents" onClick={() => onSelect(dayTasks[3].id)} type="button">+{dayTasks.length - 3}</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <TaskDetailPanel task={selectedTask} />
    </div>
  );
}

function TaskDetailPanel({ task }: { task: UiTask | null }) {
  if (!task) {
    return (
      <aside className="taskDetailPanel empty">
        <CalendarDays size={24} />
        <strong>Sin actividades</strong>
      </aside>
    );
  }

  return (
    <aside className="taskDetailPanel">
      <div className="detailAccent" style={{ background: task.taskTypeColor ?? task.courseColor ?? "#4285dc" }} />
      <div className="detailHeader">
        <span>{task.deliveryType}</span>
        <strong>{task.status}</strong>
      </div>
      <h3>{task.title}</h3>
      <dl className="detailMeta">
        <div><dt>Materia</dt><dd>{task.course}</dd></div>
        <div><dt>Entrega</dt><dd>{task.dueDate} · {task.dueTime}</dd></div>
        <div><dt>Días</dt><dd>{task.daysRemaining}</dd></div>
      </dl>
      {task.materialNeeded ? <p className="detailText">{task.materialNeeded}</p> : null}
      {task.notes ? <p className="detailNote">{task.notes}</p> : null}
      <div className="detailActions">
        {task.materialUrl ? <a href={task.materialUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Material</a> : null}
        {task.platformUrl ? <a href={task.platformUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Plataforma</a> : null}
      </div>
    </aside>
  );
}

function TaskList({ tasks, role, onDone }: { tasks: UiTask[]; role: Role; onDone: (id: string) => void }) {
  const grouped = groupTasks(tasks);
  return (
    <div className="listScreen">
      {deliveryTypes.map((type) => {
        const rows = grouped.get(type) ?? [];
        if (!rows.length) return null;
        return (
          <section className="typeGroup" key={type}>
            <h2 className="groupTitle" style={{ color: rows[0].taskTypeColor ?? undefined }}><ListTodo size={22} />{type}</h2>
            {rows.map((task) => (
              <article className={`dataRow taskRow card-${task.courseCardSize ?? "medium"}`} style={{ borderLeft: `5px solid ${task.courseColor ?? "#4285dc"}` }} key={task.id}>
                <div className="rowMain"><strong>{task.title}</strong><span>{task.course}</span></div>
                <div className="rowSide">
                  <span className="days">D{task.daysRemaining}</span>
                  {task.materialUrl ? <a className="openIcon" aria-label="Abrir material" title="Abrir material" href={task.materialUrl} target="_blank" rel="noreferrer"><ExternalLink size={20} /></a> : null}
                  {role === "admin" ? <button className="miniAction" aria-label="Marcar entregada" title="Marcar entregada" onClick={() => onDone(task.id)} type="button"><Check size={16} /></button> : null}
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function Group({ members }: { members: GroupMember[] }) {
  return (
    <div className="tableWrap">
      <table className="appTable memberTable">
        <thead><tr><th>No. Control</th><th>Correo electrónico</th><th>Nombre completo</th></tr></thead>
        <tbody>{members.map((member) => <tr key={member.controlNumber}><td>{member.controlNumber}</td><td>{member.email}</td><td>{member.fullName}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Preferences({ profile, supabase, onProfile, onError }: { profile: Profile | null; supabase: SupabaseBrowser | null; onProfile: (profile: Profile | null) => void; onError: (error: string | null) => void }) {
  const prefs = profile?.preferences ?? fallbackPrefs;

  async function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const next = { ...prefs, [key]: value };
    if (profile) onProfile({ ...profile, preferences: next });
    if (supabase) {
      const { error } = await supabase.rpc("update_my_preferences", { preferences_input: next });
      if (error) onError(error.message);
    }
  }

  return (
    <div className="settingsScreen">
      <section className="settingsCard">
        <p className="eyebrow">Alumno</p>
        <h2>Preferencias</h2>
        <div className="settingsGrid">
          <label>Vista<select value={prefs.calendarView} onChange={(event) => void update("calendarView", event.target.value as UserPreferences["calendarView"])}><option value="month">Mes</option><option value="week">Semana</option><option value="day">Día</option></select></label>
          <label>Densidad<select value={prefs.taskDensity} onChange={(event) => void update("taskDensity", event.target.value as CardSize)}><option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option></select></label>
          <label>Previews<select value={prefs.materialPreviewSize} onChange={(event) => void update("materialPreviewSize", event.target.value as UserPreferences["materialPreviewSize"])}><option value="small">Pequeños</option><option value="medium">Medianos</option><option value="large">Grandes</option></select></label>
          <label className="checkSetting"><input type="checkbox" checked={prefs.showCompleted} onChange={(event) => void update("showCompleted", event.target.checked)} /> Mostrar entregadas</label>
        </div>
      </section>
    </div>
  );
}

function titleFor(tab: Tab) {
  return tab === "calendar" ? "Calendario" : tab === "tasks" ? "Tareas" : tab === "materials" ? "Materiales" : tab === "completed" ? "Entregadas" : tab === "group" ? "Lista de grupo" : tab === "prefs" ? "Preferencias" : "Configuración";
}
function monthCells(year: number, month: number) { const first = new Date(year, month, 1).getDay(); const total = new Date(year, month + 1, 0).getDate(); const cells: Array<number | null> = Array(first).fill(null).concat(Array.from({ length: total }, (_, index) => index + 1)); while (cells.length % 7 !== 0) cells.push(null); return cells; }
function groupTasks(tasks: UiTask[]) { const map = new Map<DeliveryType, UiTask[]>(); tasks.forEach((task) => map.set(task.deliveryType, [...(map.get(task.deliveryType) ?? []), task])); return map; }
function filterTasks(tasks: UiTask[], query: string) { const q = query.toLowerCase().trim(); return q ? tasks.filter((task) => [task.title, task.course, task.materialNeeded, task.notes].some((value) => value?.toLowerCase().includes(q))) : tasks; }
function asOne<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function cardSize(value: unknown): CardSize { return value === "compact" || value === "large" ? value : "medium"; }
function delivery(value: unknown): DeliveryType { const text = String(value ?? "Tarea"); return deliveryTypes.includes(text as DeliveryType) ? text as DeliveryType : "Tarea"; }
function status(value: unknown): TaskStatus { const text = String(value ?? "Pendiente"); return statuses.includes(text as TaskStatus) ? text as TaskStatus : "Pendiente"; }
function toProfile(row: Record<string, unknown>): Profile { return { id: String(row.id), email: String(row.email), fullName: String(row.full_name ?? row.email), role: row.role === "owner" ? "owner" : row.role === "admin" ? "admin" : "student", preferences: { ...fallbackPrefs, ...(typeof row.preferences === "object" && row.preferences ? row.preferences : {}) } as UserPreferences }; }
function toCourse(row: Record<string, unknown>): CourseConfig { return { id: String(row.id), name: String(row.name), shortName: String(row.short_name ?? row.name), color: String(row.color ?? "#4285dc"), icon: String(row.icon ?? "book"), cardSize: cardSize(row.card_size), active: Boolean(row.active ?? true) }; }
function toSection(row: Record<string, unknown>): SectionConfig { return { id: String(row.id), name: String(row.name), path: String(row.path), color: String(row.color ?? "#4285dc"), icon: String(row.icon ?? "folder"), cardSize: cardSize(row.card_size), previewStyle: String(row.preview_style ?? "thumbnail"), active: Boolean(row.active ?? true) }; }
function toTask(row: Record<string, unknown>): UiTask { const course = asOne(row.courses as Record<string, unknown> | Record<string, unknown>[] | null); const type = asOne(row.task_types as Record<string, unknown> | Record<string, unknown>[] | null); const dueDate = String(row.due_date); const daysRemaining = calculateDaysRemaining(dueDate); const next = deriveStatus(status(row.status), daysRemaining); return { id: String(row.id), course: String(course?.name ?? "Sin materia"), dueDate, dueTime: String(row.due_time ?? "23:59").slice(0, 5), title: String(row.title ?? "Sin título"), materialNeeded: row.material_needed ? String(row.material_needed) : "", materialUrl: row.material_url ? String(row.material_url) : "", deliveryType: delivery(type?.name), status: next, daysRemaining, notes: row.notes ? String(row.notes) : "", platformUrl: row.platform_url ? String(row.platform_url) : "", visibleToReaders: Boolean(row.visible_to_students), courseColor: course?.color ? String(course.color) : undefined, taskTypeColor: type?.color ? String(type.color) : undefined, courseCardSize: cardSize(course?.card_size) }; }
