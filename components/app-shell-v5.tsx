"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AdminHub } from "@/components/admin-hub";
import { MaterialLibrary } from "@/components/material-library";
import type { ConfigColumn, DeliveryType, GroupMember, Role, Task, TaskStatus } from "@/lib/domain";
import { deliveryTypes, statuses } from "@/lib/domain";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { calculateDaysRemaining, deriveReaderVisibility, deriveStatus, shortText, sortTasks } from "@/lib/task-utils";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type Tab = "calendar" | "tasks" | "materials" | "completed" | "group" | "admin" | "prefs";
type CardSize = "compact" | "medium" | "large";

type Props = {
  initialTasks: Task[];
  initialMembers: GroupMember[];
  initialConfigColumns: ConfigColumn[];
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

export function AppShellV5({ initialTasks, initialMembers, initialConfigColumns }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>("calendar");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UiTask[]>(initialTasks);
  const [courses, setCourses] = useState<CourseConfig[]>([]);
  const [sections, setSections] = useState<SectionConfig[]>([]);
  const [cursor, setCursor] = useState(new Date());

  const prefs = profile?.preferences ?? fallbackPrefs;
  const role: Role = profile?.role === "admin" || profile?.role === "owner" ? "admin" : "reader";

  useEffect(() => {
    if (!supabase) return;
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

  function go(next: Tab) {
    if (["completed", "group", "admin"].includes(next) && role !== "admin") return;
    setTab(next);
    setDrawerOpen(false);
  }

  return (
    <main className={`mobileApp density-${prefs.taskDensity} ${role === "admin" ? "adminShell" : ""}`}>
      <header className="topAppBar">
        <button className="iconButton" onClick={() => setDrawerOpen(true)} type="button">☰</button>
        <img src="/icon.svg" className="appLogo" alt="PSCV" />
        <div className="barTitle">
          {searchOpen ? (
            <input className="barSearch" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" />
          ) : (
            titleFor(tab)
          )}
        </div>
        <button className="iconButton" onClick={() => setSearchOpen((value) => !value)} type="button">⌕</button>
        <button className="iconButton" onClick={() => email && supabase ? void loadData(supabase, email) : undefined} type="button">↻</button>
      </header>

      <Drawer open={drawerOpen} email={email ?? ""} role={role} active={tab} onClose={() => setDrawerOpen(false)} onSelect={go} onSignOut={signOut} />
      {error ? <div className="systemBanner">{error}</div> : null}

      <section className="screen">
        {tab === "calendar" ? <Calendar tasks={visibleTasks} cursor={cursor} setCursor={setCursor} /> : null}
        {tab === "tasks" ? <TaskList tasks={shownTasks} role={role} onDone={(id) => void markDone(id)} /> : null}
        {tab === "materials" ? <MaterialLibrary previewSize={prefs.materialPreviewSize} globalQuery={query} /> : null}
        {tab === "completed" ? <TaskList tasks={completedTasks} role="reader" onDone={() => undefined} /> : null}
        {tab === "group" ? <Group members={initialMembers} /> : null}
        {tab === "prefs" ? <Preferences profile={profile} supabase={supabase} onProfile={setProfile} onError={setError} /> : null}
        {tab === "admin" ? (
          <AdminHub
            courses={courses}
            sections={sections}
            columns={initialConfigColumns}
            supabase={supabase}
            reload={() => email && supabase ? loadData(supabase, email) : Promise.resolve()}
            onCourses={setCourses}
            onSections={setSections}
            onError={setError}
          />
        ) : null}
      </section>

      <nav className={`bottomNav ${role === "admin" ? "adminBottomNav" : ""}`}>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => go("calendar")} type="button"><span>▦</span>Calendario</button>
        <button className={tab === "tasks" ? "active" : ""} onClick={() => go("tasks")} type="button"><span>▤</span>Tareas</button>
        {role === "admin" ? (
          <button className={tab === "admin" ? "active" : ""} onClick={() => go("admin")} type="button"><span>▣</span>Admin</button>
        ) : null}
        <button className={tab === "materials" ? "active" : ""} onClick={() => go("materials")} type="button"><span>⬡</span>Materiales</button>
      </nav>
    </main>
  );
}

function Drawer({ open, email, role, active, onClose, onSelect, onSignOut }: { open: boolean; email: string; role: Role; active: Tab; onClose: () => void; onSelect: (tab: Tab) => void; onSignOut: () => void }) {
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawerHead">
          <img src="/icon.svg" alt="PSCV" />
          <div>
            <strong>{role === "admin" ? "PSCV-ADMIN" : "PSCV-ROOM"}</strong>
            <span className="drawerSource">Supabase conectado</span>
          </div>
        </div>
        <nav className="drawerNav">
          <DrawerItem icon="▦" label="Calendario" active={active === "calendar"} onClick={() => onSelect("calendar")} />
          <DrawerItem icon="▤" label="Tareas" active={active === "tasks"} onClick={() => onSelect("tasks")} />
          <DrawerItem icon="⬡" label="Materiales" active={active === "materials"} onClick={() => onSelect("materials")} />
          <DrawerItem icon="⚙" label="Preferencias" active={active === "prefs"} onClick={() => onSelect("prefs")} />
          {role === "admin" ? <DrawerItem icon="✓" label="Entregadas" active={active === "completed"} onClick={() => onSelect("completed")} /> : null}
          {role === "admin" ? <DrawerItem icon="☷" label="Lista de grupo" active={active === "group"} onClick={() => onSelect("group")} /> : null}
          {role === "admin" ? <DrawerItem icon="🛠" label="Configuración" active={active === "admin"} onClick={() => onSelect("admin")} /> : null}
        </nav>
        <div className="drawerFooter">
          <div className="offline">◉ Online <u>Supabase</u></div>
          <div className="accountRow">
            <span className="avatar">{email[0]?.toUpperCase()}</span>
            <span>{email}</span>
            <button onClick={onSignOut} type="button">⌄</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return <button className={`drawerItem ${active ? "active" : ""}`} onClick={onClick} type="button"><span>{icon}</span>{label}</button>;
}

function Calendar({ tasks, cursor, setCursor }: { tasks: UiTask[]; cursor: Date; setCursor: (date: Date) => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = monthCells(year, month);
  const label = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor);

  return (
    <div>
      <div className="viewTabs"><span>Day</span><span>Week</span><strong>Month</strong><button type="button" onClick={() => setCursor(new Date())}>TODAY</button></div>
      <div className="monthHead"><button onClick={() => setCursor(new Date(year, month - 1, 15))} type="button">‹</button><h2>{label}</h2><button onClick={() => setCursor(new Date(year, month + 1, 15))} type="button">›</button></div>
      <div className="weekdays"><span>do</span><span>lu</span><span>ma</span><span>mi</span><span>ju</span><span>vi</span><span>sá</span></div>
      <div className="monthGrid">
        {cells.map((day, index) => {
          const key = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
          const dayTasks = tasks.filter((task) => task.dueDate === key);
          const today = new Date().toISOString().slice(0, 10);
          return (
            <div className="dayCell" key={`${key}-${index}`}>
              {day ? <span className={`dayNumber ${key === today ? "today" : ""}`}>{String(day).padStart(2, "0")}</span> : null}
              <div className="eventStack">
                {dayTasks.slice(0, 3).map((task) => (
                  <span className="calendarEvent" style={{ backgroundColor: task.taskTypeColor ?? task.courseColor ?? "#4285dc" } as CSSProperties} key={task.id}>{shortText(task.title, 13)}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
            <h2 className="groupTitle" style={{ color: rows[0].taskTypeColor ?? undefined }}><span>▤</span>{type}</h2>
            {rows.map((task) => (
              <article className={`dataRow taskRow card-${task.courseCardSize ?? "medium"}`} style={{ borderLeft: `5px solid ${task.courseColor ?? "#4285dc"}` }} key={task.id}>
                <div className="rowMain"><strong>{task.title}</strong><span>{task.course}</span></div>
                <div className="rowSide">
                  <span className="days">◷ <u>{task.daysRemaining}</u></span>
                  {task.materialUrl ? <a className="openIcon" href={task.materialUrl} target="_blank" rel="noreferrer">↗</a> : null}
                  {role === "admin" ? <button className="miniAction" onClick={() => onDone(task.id)} type="button">✓</button> : null}
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
