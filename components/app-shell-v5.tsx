"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Bell,
  CalendarDays,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  ListTodo,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { AdminHub } from "@/components/admin-hub";
import { MaterialLibrary } from "@/components/material-library";
import type { DeliveryType, GroupMember, Role, Task, TaskStatus } from "@/lib/domain";
import { deliveryTypes, statuses } from "@/lib/domain";
import { createSupabaseBrowserClient, hasSupabaseBrowserConfig } from "@/lib/supabase/client";
import { calculateDaysRemaining, deriveReaderVisibility, deriveStatus, sortTasks } from "@/lib/task-utils";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type Tab = "calendar" | "tasks" | "materials" | "completed" | "group" | "admin" | "prefs" | "taskDetail";
type CardSize = "compact" | "medium" | "large";
type DetailOrigin = Exclude<Tab, "taskDetail">;

type Props = {
  initialTasks: Task[];
  initialMembers: GroupMember[];
};

type UiGroupMember = GroupMember & {
  profileId?: string;
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
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canManageMaterials: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageGroup: boolean;
  canManageNotifications: boolean;
  canViewReports: boolean;
  canManageR2: boolean;
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

type TaskTypeConfig = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
};

type TaskForm = {
  title: string;
  courseId: string;
  typeId: string;
  dueDate: string;
  dueTime: string;
  status: TaskStatus;
  priority: string;
  visible: boolean;
  materialUrl: string;
  platformUrl: string;
  notes: string;
  materialNeeded: string;
};

type TaskFormChange = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => void;

type BooleanGroupColumn = {
  id: string;
  label: string;
  source?: "attended" | "licenseIssue" | "authIssue";
  fixed?: boolean;
  sortOrder?: number;
};

type GroupValueStore = Record<string, Record<string, boolean>>;

type GroupColumnRow = {
  id: string;
  source_key: "attended" | "licenseIssue" | "authIssue" | null;
  label: string;
  fixed: boolean;
  sort_order: number;
};

type GroupValueRow = {
  profile_id: string;
  column_id: string;
  value: boolean;
};

type AppNotification = {
  id: string;
  kind: string;
  priority: "low" | "normal" | "high";
  title: string;
  body: string;
  entity: string | null;
  entity_id: string | null;
  action_url: string | null;
  scheduled_for: string;
  read_at: string | null;
  created_at: string;
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
  canEditTasks: true,
  canDeleteTasks: true,
  canManageMaterials: true,
  canManageUsers: true,
  canManageSettings: true,
  canManageGroup: true,
  canManageNotifications: true,
  canViewReports: true,
  canManageR2: true,
};

const demoCourses: CourseConfig[] = [
  { id: "aprendizaje", name: "Psicología del Aprendizaje", shortName: "Aprendizaje", color: "#2f77d0", icon: "book", cardSize: "medium", active: true },
  { id: "evaluacion", name: "Evaluación Psicológica I", shortName: "Evaluación", color: "#7c3aed", icon: "clipboard", cardSize: "medium", active: true },
  { id: "social", name: "Problemática Social Mexicana", shortName: "Social", color: "#d97706", icon: "users", cardSize: "medium", active: true },
  { id: "grupales", name: "Procesos Grupales", shortName: "Grupales", color: "#0f9f8f", icon: "network", cardSize: "medium", active: true },
  { id: "conducta", name: "Alteraciones de la Conducta", shortName: "Conducta", color: "#dc2626", icon: "brain", cardSize: "medium", active: true },
];

const demoSections: SectionConfig[] = [
  { id: "conducta", name: "Alteraciones de la conducta", path: "Alteraciones de la conducta", color: "#dc2626", icon: "folder", cardSize: "medium", previewStyle: "thumbnail", active: true },
  { id: "compendio", name: "Compendio de Psicologia", path: "Compendio de Psicologia", color: "#2f77d0", icon: "folder", cardSize: "medium", previewStyle: "thumbnail", active: true },
  { id: "evaluacion", name: "Evaluacion Psicológica I", path: "Evaluacion Psicológica I", color: "#7c3aed", icon: "folder", cardSize: "medium", previewStyle: "thumbnail", active: true },
  { id: "grupales", name: "Procesos Grupales", path: "Procesos Grupales", color: "#0f9f8f", icon: "folder", cardSize: "medium", previewStyle: "thumbnail", active: true },
  { id: "aprendizaje", name: "Teorias del Aprendizaje", path: "Teorias del Aprendizaje", color: "#d97706", icon: "folder", cardSize: "medium", previewStyle: "thumbnail", active: true },
];

const demoTaskTypes: TaskTypeConfig[] = deliveryTypes.map((name) => ({
  id: name.toLowerCase(),
  name,
  color: null,
  icon: null,
}));

const fixedBooleanColumns: BooleanGroupColumn[] = [
  { id: "attended", label: "Asistencia", source: "attended", fixed: true },
  { id: "licenseIssue", label: "Licencia", source: "licenseIssue", fixed: true },
  { id: "authIssue", label: "Acceso", source: "authIssue", fixed: true },
];

function newTaskForm(defaults: Partial<TaskForm> = {}): TaskForm {
  return {
    title: "",
    courseId: "",
    typeId: "",
    dueDate: new Date().toISOString().slice(0, 10),
    dueTime: "23:59",
    status: "Pendiente",
    priority: "Media",
    visible: true,
    materialUrl: "",
    platformUrl: "",
    notes: "",
    materialNeeded: "",
    ...defaults,
  };
}

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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [tasks, setTasks] = useState<UiTask[]>(initialTasks);
  const [courses, setCourses] = useState<CourseConfig[]>(hasSupabaseConfig ? [] : demoCourses);
  const [sections, setSections] = useState<SectionConfig[]>(hasSupabaseConfig ? [] : demoSections);
  const [taskTypes, setTaskTypes] = useState<TaskTypeConfig[]>(hasSupabaseConfig ? [] : demoTaskTypes);
  const [members, setMembers] = useState<UiGroupMember[]>(initialMembers);
  const [cursor, setCursor] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTasks[0]?.id ?? null);
  const [detailOrigin, setDetailOrigin] = useState<DetailOrigin>("calendar");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(() => newTaskForm());
  const [taskFormSource, setTaskFormSource] = useState<"calendar" | "tasks">("tasks");
  const [creatingTask, setCreatingTask] = useState(false);

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

  useEffect(() => {
    if (supabase && profile) void loadNotifications();
    if (!supabase) setNotifications([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, profile?.id]);

  useEffect(() => {
    if (!supabase || !profile) return;
    const refreshNotifications = () => {
      void loadNotifications();
    };
    window.addEventListener("pscv:notifications-changed", refreshNotifications);
    const intervalId = window.setInterval(refreshNotifications, 45000);

    return () => {
      window.removeEventListener("pscv:notifications-changed", refreshNotifications);
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, profile?.id]);

  async function loadData(client: SupabaseBrowser, accountEmail: string) {
    setError(null);
    const normalized = accountEmail.toLowerCase();
    const [profileRes, coursesRes, sectionsRes, tasksRes, membersRes] = await Promise.all([
      client.from("app_profiles").select("*").eq("email", normalized).maybeSingle(),
      client.from("courses").select("*").order("sort_order"),
      client.from("material_sections").select("*").order("sort_order"),
      client
        .from("tasks")
        .select("*, courses(name,color,card_size), task_types(name,color,card_size)")
        .is("archived_at", null)
        .order("due_date")
        .order("due_time"),
      client
        .from("app_profiles")
        .select("id,control_number,email,full_name")
        .eq("role", "student")
        .eq("active", true)
        .order("full_name"),
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
    const taskTypeRes = await client.from("task_types").select("id,name,color,icon").eq("active", true).order("sort_order");
    if (!taskTypeRes.error) setTaskTypes((taskTypeRes.data ?? []) as TaskTypeConfig[]);
    if (!membersRes.error && membersRes.data?.length) {
      setMembers(membersRes.data.map(toGroupMember));
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setEmail(null);
    setProfile(null);
    setNotifications([]);
    setNotificationOpen(false);
    setDrawerOpen(false);
  }

  async function loadNotifications() {
    try {
      const response = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
      const body = await response.json() as { notifications?: AppNotification[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar avisos.");
      setNotifications(body.notifications ?? []);
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "No se pudieron cargar avisos.");
    }
  }

  async function updateNotifications(ids: string[], action: "read" | "dismiss") {
    if (!ids.length) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo actualizar el aviso.");
      if (action === "dismiss") setNotifications((current) => current.filter((item) => !ids.includes(item.id)));
      else setNotifications((current) => current.map((item) => ids.includes(item.id) ? { ...item, read_at: new Date().toISOString() } : item));
    } catch (notificationError) {
      setError(notificationError instanceof Error ? notificationError.message : "No se pudo actualizar el aviso.");
    }
  }

  function enterLocalDemo() {
    setEmail(demoProfile.email);
    setProfile(demoProfile);
    setCourses(demoCourses);
    setSections(demoSections);
    setTaskTypes(demoTaskTypes);
    setMembers(initialMembers);
    setTab("calendar");
  }

  function openTaskForm(source: "calendar" | "tasks", dueDate?: string) {
    setTaskFormSource(source);
    setTaskForm(newTaskForm({
      dueDate: dueDate || new Date().toISOString().slice(0, 10),
      courseId: courses[0]?.id || "",
      typeId: taskTypes[0]?.id || "",
    }));
    setTaskFormOpen(true);
  }

  function setTaskFormField<K extends keyof TaskForm>(key: K, value: TaskForm[K]) {
    setTaskForm((current) => ({ ...current, [key]: value }));
  }

  async function createTask(form: TaskForm) {
    const title = form.title.trim();
    if (!title) return;

    setCreatingTask(true);
    setError(null);

    if (!supabase) {
      const course = courses.find((item) => item.id === form.courseId);
      const type = taskTypes.find((item) => item.id === form.typeId);
      const id = `local-${Date.now()}`;
      const dueDate = form.dueDate || new Date().toISOString().slice(0, 10);
      const dueTime = form.dueTime || "23:59";
      const nextTask: UiTask = {
        id,
        course: course?.name ?? "Sin materia",
        dueDate,
        dueTime,
        title,
        materialNeeded: form.materialNeeded.trim(),
        materialUrl: form.materialUrl.trim(),
        deliveryType: delivery(type?.name),
        status: form.status,
        daysRemaining: calculateDaysRemaining(dueDate),
        notes: form.notes.trim(),
        platformUrl: form.platformUrl.trim(),
        visibleToReaders: form.visible,
        courseColor: course?.color,
        taskTypeColor: type?.color ?? undefined,
        courseCardSize: course?.cardSize,
      };
      setTasks((current) => [...current, nextTask]);
      setSelectedTaskId(id);
      setTaskFormOpen(false);
      setCreatingTask(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title,
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
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
    } else {
      if (email) await loadData(supabase, email);
      setSelectedTaskId(String(data.id));
      setTaskFormOpen(false);
    }

    setCreatingTask(false);
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

  const activeTasks = normalizedTasks.filter((task) => task.status !== "Entregado" && task.status !== "Cancelado");
  const listBase = role === "admin"
    ? activeTasks
    : activeTasks.filter((task) => task.visibleToReaders);
  const visibleTasks = sortTasks(listBase);
  const completedTasks = sortTasks(normalizedTasks.filter((task) => task.status === "Entregado"));
  const shownTasks = filterTasks(visibleTasks, query);
  const selectedTask = selectedTaskId
    ? normalizedTasks.find((task) => task.id === selectedTaskId) ?? shownTasks[0] ?? null
    : shownTasks[0] ?? null;
  const calendarSelectedTask = selectedTaskId
    ? visibleTasks.find((task) => task.id === selectedTaskId) ?? null
    : null;
  const listSelectedTask = selectedTaskId
    ? shownTasks.find((task) => task.id === selectedTaskId) ?? null
    : null;
  const activeNavTab = tab === "taskDetail" ? detailOrigin : tab;
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length;

  function go(next: Tab) {
    if (["completed", "group", "admin"].includes(next) && role !== "admin") return;
    setTab(next);
    setDrawerOpen(false);
  }

  function openTaskDetail(id: string, origin: DetailOrigin) {
    setSelectedTaskId(id);
    setDetailOrigin(origin);
    setTab("taskDetail");
    setDrawerOpen(false);
  }

  function openNotification(notification: AppNotification) {
    void updateNotifications([notification.id], "read");
    setNotificationOpen(false);
    if (notification.entity === "tasks" && notification.entity_id) {
      openTaskDetail(notification.entity_id, "tasks");
    }
  }

  function refreshCurrentData() {
    if (!email || !supabase) return;
    void Promise.all([loadData(supabase, email), loadNotifications()]);
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
        <button
          className={`iconButton notificationButton ${notifications.length && !unreadNotifications ? "hasNotifications" : ""}`}
          aria-label={unreadNotifications ? `${unreadNotifications} avisos sin leer` : "Avisos"}
          title={unreadNotifications ? `${unreadNotifications} avisos sin leer` : "Avisos"}
          onClick={() => setNotificationOpen((value) => !value)}
          type="button"
        >
          <Bell size={21} />
          {unreadNotifications ? <span className="notificationBadge">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span> : null}
        </button>
        <button className="iconButton" aria-label="Actualizar" title="Actualizar" onClick={refreshCurrentData} type="button"><RefreshCw size={21} /></button>
      </header>

      <Drawer
        open={drawerOpen}
        email={email ?? ""}
        role={role}
        active={activeNavTab}
        sourceLabel={supabase ? "Supabase conectado" : "Demo local"}
        onClose={() => setDrawerOpen(false)}
        onSelect={go}
        onSignOut={signOut}
      />
      {error ? <div className="systemBanner">{error}</div> : null}
      <NotificationTray
        open={notificationOpen}
        notifications={notifications}
        onClose={() => setNotificationOpen(false)}
        onOpen={openNotification}
        onRefresh={() => void loadNotifications()}
        onRead={(ids) => void updateNotifications(ids, "read")}
        onDismiss={(ids) => void updateNotifications(ids, "dismiss")}
      />

      <section className="screen">
        {tab === "calendar" ? (
          <>
            <WorkspaceOverview tasks={visibleTasks} completedCount={completedTasks.length} membersCount={members.length} role={role} onGo={go} />
            <Calendar tasks={visibleTasks} cursor={cursor} setCursor={setCursor} selectedTask={calendarSelectedTask} onSelect={(id) => openTaskDetail(id, "calendar")} onCreateDate={role === "admin" ? (date) => openTaskForm("calendar", date) : undefined} />
          </>
        ) : null}
        {tab === "tasks" ? (
          <>
            <WorkspaceOverview tasks={visibleTasks} completedCount={completedTasks.length} membersCount={members.length} role={role} onGo={go} compact />
            <TaskList tasks={shownTasks} role={role} selectedTask={listSelectedTask} density={prefs.taskDensity} onSelect={(id) => openTaskDetail(id, "tasks")} onDone={(id) => void markDone(id)} onCreate={role === "admin" ? () => openTaskForm("tasks") : undefined} />
          </>
        ) : null}
        {tab === "materials" ? <MaterialLibrary previewSize={prefs.materialPreviewSize} globalQuery={query} /> : null}
        {tab === "completed" ? <TaskList tasks={completedTasks} role="reader" selectedTask={null} density={prefs.taskDensity} onSelect={(id) => openTaskDetail(id, "completed")} onDone={() => undefined} completedOnly /> : null}
        {tab === "group" ? <Group members={members} supabase={supabase} role={role} profile={profile} onError={setError} /> : null}
        {tab === "prefs" ? <Preferences profile={profile} supabase={supabase} onProfile={setProfile} onError={setError} /> : null}
        {tab === "taskDetail" ? <TaskDetailScreen task={selectedTask} role={role} onBack={() => go(detailOrigin)} onDone={(id) => void markDone(id)} /> : null}
        {tab === "admin" ? (
          <AdminHub
            courses={courses}
            sections={sections}
            profile={profile}
            supabase={supabase}
            reload={() => email && supabase ? loadData(supabase, email) : Promise.resolve()}
            onCourses={setCourses}
            onSections={setSections}
            onError={setError}
          />
        ) : null}
      </section>

      <TaskCreateModal
        open={taskFormOpen}
        source={taskFormSource}
        form={taskForm}
        courses={courses}
        taskTypes={taskTypes}
        busy={creatingTask}
        onClose={() => setTaskFormOpen(false)}
        onChange={setTaskFormField}
        onSubmit={(form) => void createTask(form)}
      />

      <nav className={`bottomNav ${role === "admin" ? "adminBottomNav" : ""}`}>
        <button className={activeNavTab === "calendar" ? "active" : ""} onClick={() => go("calendar")} type="button"><CalendarDays size={22} />Calendario</button>
        <button className={activeNavTab === "tasks" ? "active" : ""} onClick={() => go("tasks")} type="button"><ListTodo size={22} />Tareas</button>
        {role === "admin" ? (
          <button className={activeNavTab === "admin" ? "active" : ""} onClick={() => go("admin")} type="button"><SlidersHorizontal size={22} />Admin</button>
        ) : null}
        <button className={activeNavTab === "materials" ? "active" : ""} onClick={() => go("materials")} type="button"><FolderOpen size={22} />Materiales</button>
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

function NotificationTray({
  open,
  notifications,
  onClose,
  onOpen,
  onRefresh,
  onRead,
  onDismiss,
}: {
  open: boolean;
  notifications: AppNotification[];
  onClose: () => void;
  onOpen: (notification: AppNotification) => void;
  onRefresh: () => void;
  onRead: (ids: string[]) => void;
  onDismiss: (ids: string[]) => void;
}) {
  if (!open) return null;

  const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
  const unreadLabel = unreadIds.length ? `${unreadIds.length} sin leer` : "todo leído";

  return (
    <section className="notificationTray" aria-label="Avisos">
      <div className="notificationTrayHead">
        <div><strong>Avisos</strong><span>{notifications.length} activos · {unreadLabel}</span></div>
        <button aria-label="Cerrar avisos" onClick={onClose} type="button"><X size={16} /></button>
      </div>
      <div className="notificationTrayActions">
        <button type="button" onClick={onRefresh}>Actualizar</button>
        <button type="button" onClick={() => onRead(unreadIds)} disabled={!unreadIds.length}>Marcar leídos</button>
        <button type="button" onClick={() => onDismiss(notifications.map((notification) => notification.id))} disabled={!notifications.length}>Limpiar</button>
      </div>
      <div className="notificationList">
        {notifications.map((notification) => (
          <article className={`notificationItem ${notification.read_at ? "" : "unread"} priority-${notification.priority}`} key={notification.id}>
            <button type="button" onClick={() => onOpen(notification)}>
              <strong>{notification.title}</strong>
              {notification.body ? <span>{notification.body}</span> : null}
              <small>{formatOptionalSync(notification.scheduled_for)}</small>
            </button>
            <button aria-label="Ocultar aviso" title="Ocultar" onClick={() => onDismiss([notification.id])} type="button"><X size={14} /></button>
          </article>
        ))}
        {!notifications.length ? <p className="notificationEmpty">No hay avisos pendientes.</p> : null}
      </div>
    </section>
  );
}

function DrawerItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button className={`drawerItem ${active ? "active" : ""}`} onClick={onClick} type="button"><span>{icon}</span>{label}</button>;
}

function WorkspaceOverview({ tasks, completedCount, membersCount, role, onGo, compact = false }: { tasks: UiTask[]; completedCount: number; membersCount: number; role: Role; onGo: (tab: Tab) => void; compact?: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = tasks.filter((task) => task.dueDate === today).length;
  const overdue = tasks.filter((task) => task.daysRemaining < 0).length;
  const nextTask = tasks.find((task) => task.daysRemaining >= 0) ?? tasks[0] ?? null;

  return (
    <section className={`workbenchOverview ${compact ? "compact" : ""}`}>
      <button className="overviewMetric" onClick={() => onGo("tasks")} type="button">
        <ListTodo size={18} />
        <span>Activas</span>
        <strong>{tasks.length}</strong>
      </button>
      <button className="overviewMetric" onClick={() => onGo("calendar")} type="button">
        <CalendarClock size={18} />
        <span>Hoy</span>
        <strong>{dueToday}</strong>
      </button>
      {role === "admin" ? (
        <button className="overviewMetric" onClick={() => onGo("completed")} type="button">
          <CheckCircle2 size={18} />
          <span>Entregadas</span>
          <strong>{completedCount}</strong>
        </button>
      ) : null}
      {role === "admin" ? (
        <button className="overviewMetric" onClick={() => onGo("group")} type="button">
          <Users size={18} />
          <span>Alumnos</span>
          <strong>{membersCount}</strong>
        </button>
      ) : null}
      <div className="overviewNext">
        <span>{overdue > 0 ? `${overdue} vencidas` : "Siguiente actividad"}</span>
        <strong>{nextTask ? nextTask.title : "Sin actividades activas"}</strong>
        {nextTask ? <small>{formatTaskDateTime(nextTask.dueDate, nextTask.dueTime)}</small> : null}
      </div>
    </section>
  );
}

function Calendar({ tasks, cursor, setCursor, selectedTask, onSelect, onCreateDate }: { tasks: UiTask[]; cursor: Date; setCursor: (date: Date) => void; selectedTask: UiTask | null; onSelect: (id: string) => void; onCreateDate?: (date: string) => void }) {
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
              <div
                className={`dayCell ${day && onCreateDate ? "canCreateTask" : ""}`}
                key={`${key}-${index}`}
                title={day && onCreateDate ? "Crear tarea en esta fecha" : undefined}
              >
                {day && onCreateDate ? (
                  <button
                    className={`dayNumber ${key === today ? "today" : ""}`}
                    aria-label={`Crear tarea el ${key}`}
                    onClick={() => onCreateDate(key)}
                    type="button"
                  >
                    {String(day).padStart(2, "0")}
                    <Plus className="dayCreateIcon" size={12} />
                  </button>
                ) : day ? (
                  <span className={`dayNumber ${key === today ? "today" : ""}`}>{String(day).padStart(2, "0")}</span>
                ) : null}
                <div className="eventStack">
                  {dayTasks.slice(0, 3).map((task) => (
                    <button
                      className={`calendarEvent ${selectedTask?.id === task.id ? "selected" : ""}`}
                      style={{ borderLeftColor: task.taskTypeColor ?? task.courseColor ?? "#4285dc" } as CSSProperties}
                      key={task.id}
                      title={`${task.dueTime} ${task.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(task.id);
                      }}
                      type="button"
                    >
                      <span>{task.dueTime}</span>
                      <strong>{task.title}</strong>
                    </button>
                  ))}
                  {dayTasks.length > 3 ? (
                    <button
                      className="moreEvents"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(dayTasks[3].id);
                      }}
                      type="button"
                    >
                      +{dayTasks.length - 3}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function TaskDetailScreen({ task, role, onBack, onDone }: { task: UiTask | null; role: Role; onBack: () => void; onDone: (id: string) => void }) {
  if (!task) {
    return (
      <div className="taskDetailScreen empty">
        <CalendarDays size={24} />
        <strong>Sin actividades</strong>
        <button className="detailNavButton" onClick={onBack} type="button"><ArrowLeft size={17} />Volver</button>
      </div>
    );
  }

  const accent = task.taskTypeColor ?? task.courseColor ?? "#4285dc";
  const dateTime = formatTaskDateTime(task.dueDate, task.dueTime);

  return (
    <div className="taskDetailScreen">
      <div className="detailToolbar">
        <button className="detailNavButton" onClick={onBack} type="button"><ArrowLeft size={17} />Volver</button>
        <div className="detailToolbarTitle">
          <span>Detalle de actividad</span>
          <strong>{task.title}</strong>
        </div>
        <div className="detailToolbarActions">
          {task.materialUrl ? <a href={task.materialUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Material</a> : null}
          {task.platformUrl ? <a href={task.platformUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Plataforma</a> : null}
          {role === "admin" && task.status !== "Entregado" ? <button onClick={() => onDone(task.id)} type="button"><Check size={16} />Entregada</button> : null}
        </div>
      </div>
      <section className="detailSheet" style={{ borderTopColor: accent } as CSSProperties}>
        <div className="detailHero">
          <span style={{ background: accent }}>{task.deliveryType}</span>
          <h2>{task.title}</h2>
        </div>
        <dl className="detailGrid">
          <DetailField label="Actividad / tarea" value={task.title} />
          <DetailField label="Materia" value={task.course} />
          <DetailField label="Fecha de entrega" value={dateTime} icon={<CalendarClock size={17} />} />
          <DetailField label="Hora" value={formatTaskTime(task.dueTime)} icon={<Clock size={17} />} />
          <DetailField label="Material necesario" value={task.materialNeeded || "Sin material indicado"} wide />
          <DetailField label="Tipo de entrega" wide>
            <span className="deliveryTypeLarge" style={{ color: accent }}><FileCheck2 size={28} />{task.deliveryType}</span>
          </DetailField>
          <DetailField label="Estado" value={task.status} icon={<ClipboardCheck size={17} />} />
          <DetailField label="Días restantes" value={String(task.daysRemaining)} />
          {task.notes ? <DetailField label="Notas" value={task.notes} wide /> : null}
          {task.calendarEventId ? <DetailField label="Evento calendario" value={task.calendarEventId} /> : null}
          {task.lastSync ? <DetailField label="Última sincronización" value={formatOptionalSync(task.lastSync)} /> : null}
        </dl>
      </section>
    </div>
  );
}

function DetailField({ label, value, icon, wide = false, children }: { label: string; value?: string; icon?: React.ReactNode; wide?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`detailField ${wide ? "wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{icon ? <span className="detailFieldIcon">{icon}</span> : null}{children ?? value}</dd>
    </div>
  );
}

function TaskList({
  tasks,
  role,
  selectedTask,
  density,
  completedOnly = false,
  onSelect,
  onDone,
  onCreate,
}: {
  tasks: UiTask[];
  role: Role;
  selectedTask: UiTask | null;
  density: CardSize;
  completedOnly?: boolean;
  onSelect: (id: string) => void;
  onDone: (id: string) => void;
  onCreate?: () => void;
}) {
  const grouped = groupTasks(tasks);
  return (
    <div className={`taskListWorkspace ${completedOnly ? "completedOnly" : ""}`}>
      <div className="listScreen">
        {deliveryTypes.map((type) => {
          const rows = grouped.get(type) ?? [];
          if (!rows.length) return null;
          return (
            <section className="typeGroup" key={type}>
              <h2 className="groupTitle" style={{ color: rows[0].taskTypeColor ?? undefined }}><ListTodo size={22} />{type}</h2>
              {rows.map((task) => (
                <article className={`dataRow taskRow card-${density} ${selectedTask?.id === task.id ? "selected" : ""}`} style={{ borderLeft: `5px solid ${task.courseColor ?? "#4285dc"}` }} key={task.id}>
                  <button className="taskRowButton" onClick={() => onSelect(task.id)} type="button" aria-label={`Ver detalles de ${task.title}`}>
                    <span className="rowMain"><strong>{task.title}</strong><span>{task.course}</span></span>
                    <span className="rowDue">{formatTaskDateTime(task.dueDate, task.dueTime)}</span>
                  </button>
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
        {!tasks.length ? <section className="emptyLibrary"><strong>{completedOnly ? "Sin tareas entregadas" : "Sin tareas activas"}</strong><p>{completedOnly ? "Cuando marques una tarea como entregada aparecerá aquí." : "Las tareas entregadas se muestran solamente en Entregadas."}</p></section> : null}
      </div>
      {onCreate ? (
        <button className="taskCreateDock" onClick={onCreate} type="button">
          <Plus size={18} />
          <span>Nueva tarea</span>
        </button>
      ) : null}
    </div>
  );
}

function TaskCreateModal({
  open,
  source,
  form,
  courses,
  taskTypes,
  busy,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  source: "calendar" | "tasks";
  form: TaskForm;
  courses: CourseConfig[];
  taskTypes: TaskTypeConfig[];
  busy: boolean;
  onClose: () => void;
  onChange: TaskFormChange;
  onSubmit: (form: TaskForm) => void;
}) {
  if (!open) return null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) onSubmit(form);
  }

  return (
    <>
      <div className="taskModalBackdrop" onClick={onClose} />
      <section className="taskCreateModal" role="dialog" aria-modal="true" aria-labelledby="task-create-title">
        <div className="taskCreateHead">
          <div>
            <p className="eyebrow">{source === "calendar" ? "Calendario" : "Tareas"}</p>
            <h2 id="task-create-title">Nueva tarea</h2>
          </div>
          <button className="iconButton modalCloseButton" aria-label="Cerrar formulario" title="Cerrar" onClick={onClose} type="button"><X size={20} /></button>
        </div>
        <form className="taskForm taskCreateForm" onSubmit={submit}>
          <label className="wide">Título<input value={form.title} onChange={(event) => onChange("title", event.target.value)} required /></label>
          <label>Materia<select value={form.courseId} onChange={(event) => onChange("courseId", event.target.value)}>{courses.length ? courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>) : <option value="">Sin materias</option>}</select></label>
          <label>Tipo<select value={form.typeId} onChange={(event) => onChange("typeId", event.target.value)}>{taskTypes.length ? taskTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>) : <option value="">Tarea</option>}</select></label>
          <label>Fecha<input type="date" value={form.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} required /></label>
          <label>Hora<input type="time" value={form.dueTime} onChange={(event) => onChange("dueTime", event.target.value)} /></label>
          <label>Estado<select value={form.status} onChange={(event) => onChange("status", event.target.value as TaskStatus)}><option>Pendiente</option><option>Se entrega hoy</option><option>Entregado</option><option>Reprogramado</option><option>Cancelado</option></select></label>
          <label>Prioridad<select value={form.priority} onChange={(event) => onChange("priority", event.target.value)}><option>Alta</option><option>Media</option><option>Baja</option></select></label>
          <label className="wide">Material necesario<input value={form.materialNeeded} onChange={(event) => onChange("materialNeeded", event.target.value)} /></label>
          <label className="wide">Link material<input value={form.materialUrl} onChange={(event) => onChange("materialUrl", event.target.value)} /></label>
          <label className="wide">Link plataforma<input value={form.platformUrl} onChange={(event) => onChange("platformUrl", event.target.value)} /></label>
          <label className="wide">Notas<textarea value={form.notes} onChange={(event) => onChange("notes", event.target.value)} /></label>
          <label className="taskCheck"><input type="checkbox" checked={form.visible} onChange={(event) => onChange("visible", event.target.checked)} /> Visible para alumnos</label>
          <button className="primaryAction" disabled={busy || !form.title.trim()} type="submit">{busy ? "Creando..." : "Crear tarea"}</button>
        </form>
      </section>
    </>
  );
}

function Group({ members, supabase, role, profile, onError }: { members: UiGroupMember[]; supabase: SupabaseBrowser | null; role: Role; profile: Profile | null; onError: (error: string | null) => void }) {
  const [columns, setColumns] = useState<BooleanGroupColumn[]>(fixedBooleanColumns);
  const [values, setValues] = useState<GroupValueStore>({});
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [usingRemote, setUsingRemote] = useState(false);

  const loadGroupConfig = useCallback(async () => {
    if (supabase && role === "admin") {
      const [columnRes, valueRes] = await Promise.all([
        supabase
          .from("group_columns")
          .select("id,source_key,label,fixed,sort_order")
          .eq("active", true)
          .order("sort_order"),
        supabase
          .from("group_column_values")
          .select("profile_id,column_id,value"),
      ]);

      if (!columnRes.error && !valueRes.error) {
        const remoteColumns = (columnRes.data ?? []).map((row) => toGroupColumn(row as GroupColumnRow));
        setColumns(remoteColumns.length ? remoteColumns : fixedBooleanColumns);
        setValues(toGroupValueStore((valueRes.data ?? []) as GroupValueRow[]));
        setUsingRemote(true);
        setStorageReady(true);
        return;
      }

      onError(columnRes.error?.message ?? valueRes.error?.message ?? null);
    }

    try {
      const raw = window.localStorage.getItem("pscv-group-columns-v2");
      if (raw) {
        const parsed = JSON.parse(raw) as { columns?: BooleanGroupColumn[]; values?: GroupValueStore };
        const storedColumns = Array.isArray(parsed.columns) ? parsed.columns.filter((column) => column.id && column.label && !column.fixed) : [];
        setColumns([...fixedBooleanColumns, ...storedColumns]);
        setValues(parsed.values && typeof parsed.values === "object" ? parsed.values : {});
      } else {
        setColumns(fixedBooleanColumns);
        setValues({});
      }
    } catch {
      setColumns(fixedBooleanColumns);
      setValues({});
    } finally {
      setUsingRemote(false);
      setStorageReady(true);
    }
  }, [onError, role, supabase]);

  useEffect(() => {
    void loadGroupConfig();
  }, [loadGroupConfig]);

  useEffect(() => {
    if (!storageReady || usingRemote) return;
    window.localStorage.setItem("pscv-group-columns-v2", JSON.stringify({ columns: columns.filter((column) => !column.fixed), values }));
  }, [columns, values, storageReady, usingRemote]);

  async function addColumn() {
    const label = newColumnLabel.trim();
    if (!label) return;
    const sortOrder = Math.max(0, ...columns.map((column) => column.sortOrder ?? 0)) + 10;

    if (usingRemote && supabase) {
      const { data, error } = await supabase
        .from("group_columns")
        .insert({ label, sort_order: sortOrder, created_by: profile?.id ?? null })
        .select("id,source_key,label,fixed,sort_order")
        .single();
      if (error) {
        onError(error.message);
        return;
      }
      if (data) setColumns((current) => [...current, toGroupColumn(data as GroupColumnRow)]);
    } else {
      setColumns((current) => [...current, { id: `custom-${Date.now()}`, label, sortOrder }]);
    }

    setNewColumnLabel("");
  }

  function startEditing(column: BooleanGroupColumn) {
    setEditingColumnId(column.id);
    setEditingLabel(column.label);
  }

  async function saveColumnLabel(id: string) {
    const label = editingLabel.trim();
    if (label) {
      if (usingRemote && supabase) {
        const { error } = await supabase
          .from("group_columns")
          .update({ label, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) {
          onError(error.message);
        } else {
          setColumns((current) => current.map((column) => column.id === id ? { ...column, label } : column));
        }
      } else {
        setColumns((current) => current.map((column) => column.id === id ? { ...column, label } : column));
      }
    }
    setEditingColumnId(null);
    setEditingLabel("");
  }

  async function removeColumn(id: string) {
    const column = columns.find((item) => item.id === id);
    if (column?.fixed) return;

    if (usingRemote && supabase) {
      const { error } = await supabase
        .from("group_columns")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        onError(error.message);
        return;
      }
    }

    setColumns((current) => current.filter((item) => item.id !== id));
    setValues((current) => {
      const next: GroupValueStore = {};
      for (const [memberId, row] of Object.entries(current)) {
        const nextRow = { ...row };
        delete nextRow[id];
        next[memberId] = nextRow;
      }
      return next;
    });
  }

  function memberKey(member: UiGroupMember) {
    return usingRemote && member.profileId ? member.profileId : member.controlNumber;
  }

  function cellValue(member: UiGroupMember, column: BooleanGroupColumn) {
    const override = values[memberKey(member)]?.[column.id];
    if (override !== undefined) return override;
    return !usingRemote && column.source ? Boolean(member[column.source]) : false;
  }

  async function toggleCell(member: UiGroupMember, column: BooleanGroupColumn) {
    const key = memberKey(member);
    const nextValue = !cellValue(member, column);
    setValues((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {}),
        [column.id]: nextValue,
      },
    }));

    if (usingRemote && supabase && member.profileId) {
      const { error } = await supabase
        .from("group_column_values")
        .upsert({
          profile_id: member.profileId,
          column_id: column.id,
          value: nextValue,
          updated_by: profile?.id ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "profile_id,column_id" });
      if (error) {
        onError(error.message);
        setValues((current) => ({
          ...current,
          [key]: {
            ...(current[key] ?? {}),
            [column.id]: !nextValue,
          },
        }));
      }
    }
  }

  return (
    <div className="groupScreen">
      <section className="groupToolbar">
        <div>
          <strong>Lista de grupo</strong>
          <span>{members.length} alumnos · {usingRemote ? "Sincronizada en Supabase" : "Demo local"}</span>
        </div>
        <label>
          <input value={newColumnLabel} onChange={(event) => setNewColumnLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void addColumn(); }} placeholder="Nuevo encabezado" />
          <button onClick={() => void addColumn()} type="button"><Plus size={16} />Columna</button>
        </label>
      </section>
      <div className="tableWrap groupTableWrap">
        <table className="appTable memberTable">
          <thead>
            <tr>
              <th>No. Control</th>
              <th>Correo electrónico</th>
              <th>Nombre completo</th>
              {columns.map((column) => (
                <th className="booleanHeader" key={column.id}>
                  <div className="groupColumnHeader">
                    {editingColumnId === column.id ? (
                      <input
                        value={editingLabel}
                        onChange={(event) => setEditingLabel(event.target.value)}
                        onBlur={() => void saveColumnLabel(column.id)}
                        onKeyDown={(event) => { if (event.key === "Enter") void saveColumnLabel(column.id); }}
                        autoFocus
                      />
                    ) : (
                      <span>{column.label}</span>
                    )}
                    <button aria-label={`Editar ${column.label}`} title="Editar encabezado" onClick={() => startEditing(column)} type="button"><Edit3 size={14} /></button>
                    {column.fixed ? <span className="headerSpacer" /> : <button aria-label={`Eliminar ${column.label}`} title="Eliminar columna" onClick={() => void removeColumn(column.id)} type="button"><Trash2 size={14} /></button>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.controlNumber}>
                <td>{member.controlNumber}</td>
                <td>{member.email}</td>
                <td>{member.fullName}</td>
                {columns.map((column) => {
                  const checked = cellValue(member, column);
                  return (
                    <td className="booleanCell" key={column.id}>
                      <button className={`boolToggle ${checked ? "on" : ""}`} aria-pressed={checked} onClick={() => void toggleCell(member, column)} type="button">
                        {checked ? <Check size={14} /> : <X size={14} />}
                        <span>{checked ? "Sí" : "No"}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Preferences({ profile, supabase, onProfile, onError }: { profile: Profile | null; supabase: SupabaseBrowser | null; onProfile: (profile: Profile | null) => void; onError: (error: string | null) => void }) {
  const prefs = profile?.preferences ?? fallbackPrefs;

  async function update<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    const next = { ...prefs, [key]: value };
    if (profile) onProfile({ ...profile, preferences: next });
    if (supabase && profile) {
      const { error } = await supabase
        .from("app_profiles")
        .update({ preferences: next, updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      if (error) {
        const fallback = await supabase.rpc("update_my_preferences", { preferences_input: next });
        if (fallback.error) onError(fallback.error.message);
      }
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
          <label className="checkSetting"><input type="checkbox" checked={prefs.showCompleted} onChange={(event) => void update("showCompleted", event.target.checked)} /> Guardar entregadas en mi perfil</label>
        </div>
      </section>
    </div>
  );
}

function titleFor(tab: Tab) {
  return tab === "calendar" ? "Calendario" : tab === "tasks" ? "Tareas" : tab === "materials" ? "Materiales" : tab === "completed" ? "Entregadas" : tab === "group" ? "Lista de grupo" : tab === "prefs" ? "Preferencias" : tab === "taskDetail" ? "Detalle de tarea" : "Configuración";
}
function monthCells(year: number, month: number) { const first = new Date(year, month, 1).getDay(); const total = new Date(year, month + 1, 0).getDate(); const cells: Array<number | null> = Array(first).fill(null).concat(Array.from({ length: total }, (_, index) => index + 1)); while (cells.length % 7 !== 0) cells.push(null); return cells; }
function groupTasks(tasks: UiTask[]) { const map = new Map<DeliveryType, UiTask[]>(); tasks.forEach((task) => map.set(task.deliveryType, [...(map.get(task.deliveryType) ?? []), task])); return map; }
function filterTasks(tasks: UiTask[], query: string) { const q = query.toLowerCase().trim(); return q ? tasks.filter((task) => [task.title, task.course, task.materialNeeded, task.notes].some((value) => value?.toLowerCase().includes(q))) : tasks; }
function formatTaskTime(value: string) { return value.slice(0, 5); }
function formatTaskDateTime(date: string, time: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return `${date} ${formatTaskTime(time)}`.trim();
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year} ${formatTaskTime(time)}`;
}
function formatOptionalSync(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace(",", "");
}
function asOne<T>(value: T | T[] | null | undefined): T | null { return Array.isArray(value) ? value[0] ?? null : value ?? null; }
function cardSize(value: unknown): CardSize { return value === "compact" || value === "large" ? value : "medium"; }
function delivery(value: unknown): DeliveryType { const text = String(value ?? "Tarea"); return deliveryTypes.includes(text as DeliveryType) ? text as DeliveryType : "Tarea"; }
function status(value: unknown): TaskStatus { const text = String(value ?? "Pendiente"); return statuses.includes(text as TaskStatus) ? text as TaskStatus : "Pendiente"; }
function toProfile(row: Record<string, unknown>): Profile {
  const role = row.role === "owner" ? "owner" : row.role === "admin" ? "admin" : "student";
  const owner = role === "owner";
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name ?? row.email),
    role,
    preferences: normalizePreferences(row.preferences),
    canEditTasks: owner || Boolean(row.can_edit_tasks),
    canDeleteTasks: owner || Boolean(row.can_delete_tasks),
    canManageMaterials: owner || Boolean(row.can_manage_materials),
    canManageUsers: owner || Boolean(row.can_manage_users),
    canManageSettings: owner || Boolean(row.can_manage_settings),
    canManageGroup: owner || Boolean(row.can_manage_group),
    canManageNotifications: owner || Boolean(row.can_manage_notifications),
    canViewReports: owner || Boolean(row.can_view_reports),
    canManageR2: owner || Boolean(row.can_manage_r2),
  };
}
function toCourse(row: Record<string, unknown>): CourseConfig { return { id: String(row.id), name: String(row.name), shortName: String(row.short_name ?? row.name), color: String(row.color ?? "#4285dc"), icon: String(row.icon ?? "book"), cardSize: cardSize(row.card_size), active: Boolean(row.active ?? true) }; }
function toSection(row: Record<string, unknown>): SectionConfig { return { id: String(row.id), name: String(row.name), path: String(row.path), color: String(row.color ?? "#4285dc"), icon: String(row.icon ?? "folder"), cardSize: cardSize(row.card_size), previewStyle: String(row.preview_style ?? "thumbnail"), active: Boolean(row.active ?? true) }; }
function toTask(row: Record<string, unknown>): UiTask { const course = asOne(row.courses as Record<string, unknown> | Record<string, unknown>[] | null); const type = asOne(row.task_types as Record<string, unknown> | Record<string, unknown>[] | null); const dueDate = String(row.due_date); const daysRemaining = calculateDaysRemaining(dueDate); const next = deriveStatus(status(row.status), daysRemaining); return { id: String(row.id), course: String(course?.name ?? "Sin materia"), dueDate, dueTime: String(row.due_time ?? "23:59").slice(0, 5), title: String(row.title ?? "Sin título"), materialNeeded: row.material_needed ? String(row.material_needed) : "", materialUrl: row.material_url ? String(row.material_url) : "", deliveryType: delivery(type?.name), status: next, daysRemaining, notes: row.notes ? String(row.notes) : "", platformUrl: row.platform_url ? String(row.platform_url) : "", visibleToReaders: Boolean(row.visible_to_students), courseColor: course?.color ? String(course.color) : undefined, taskTypeColor: type?.color ? String(type.color) : undefined, courseCardSize: cardSize(course?.card_size) }; }
function toGroupMember(row: Record<string, unknown>): UiGroupMember {
  const email = String(row.email ?? "");
  const fallbackControl = email.includes("@") ? email.split("@")[0] : String(row.id ?? "");
  return {
    profileId: String(row.id),
    controlNumber: String(row.control_number ?? fallbackControl),
    email,
    fullName: String(row.full_name ?? email ?? "Sin nombre"),
    attended: false,
    licenseIssue: false,
    authIssue: false,
  };
}
function toGroupColumn(row: GroupColumnRow): BooleanGroupColumn {
  const source = row.source_key === "attended" || row.source_key === "licenseIssue" || row.source_key === "authIssue" ? row.source_key : undefined;
  return {
    id: String(row.id),
    label: String(row.label),
    source,
    fixed: Boolean(row.fixed),
    sortOrder: Number(row.sort_order ?? 0),
  };
}
function toGroupValueStore(rows: GroupValueRow[]): GroupValueStore {
  return rows.reduce<GroupValueStore>((store, row) => {
    const memberId = String(row.profile_id);
    store[memberId] = { ...(store[memberId] ?? {}), [String(row.column_id)]: Boolean(row.value) };
    return store;
  }, {});
}
function normalizePreferences(value: unknown): UserPreferences {
  const input = typeof value === "object" && value ? value as Partial<UserPreferences> : {};
  return {
    calendarView: input.calendarView === "week" || input.calendarView === "day" ? input.calendarView : "month",
    taskDensity: cardSize(input.taskDensity),
    materialPreviewSize: input.materialPreviewSize === "small" || input.materialPreviewSize === "large" ? input.materialPreviewSize : "medium",
    showCompleted: Boolean(input.showCompleted),
    theme: input.theme === "light" || input.theme === "dark" ? input.theme : "system",
  };
}
