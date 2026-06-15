"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import type { ConfigColumn, DeliveryType, GroupMember, Material, NewTaskInput, Role, Task, TaskStatus } from "@/lib/domain";
import { courses, deliveryTypes, statuses } from "@/lib/domain";
import { calculateDaysRemaining, calendarTone, createId, deliveryTone, deriveReaderVisibility, deriveStatus, formatDate, shortText, sortTasks } from "@/lib/task-utils";

type Tab = "calendar" | "tasks" | "materials" | "completed" | "group" | "config";

type Props = {
  initialTasks: Task[];
  initialMaterials: Material[];
  initialMembers: GroupMember[];
  initialConfigColumns: ConfigColumn[];
};

const storageKey = "pscv-room-2.tasks";
const adminEmails = [
  "martinez_28699@univdep.edu.mx",
  "ricardomartinez19b@gmail.com",
  "ricardomartinez19b@icloud.com",
  "montsedv2611@gmail.com",
  "ortega_28607@univdep.edu.mx",
];

const blankTask: NewTaskInput = {
  course: courses[0],
  dueDate: "2026-06-15",
  dueTime: "23:59",
  title: "",
  deliveryType: "Tarea",
  status: "Pendiente",
  materialNeeded: "",
  materialUrl: "",
  notes: "",
  platformUrl: "",
};

export function AppShell({ initialTasks, initialMaterials, initialMembers, initialConfigColumns }: Props) {
  const { data: session, status: authStatus } = useSession();
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const email = session?.user?.email ?? demoEmail;
  const role: Role = email && adminEmails.includes(email.toLowerCase()) ? "admin" : "reader";

  const [tab, setTab] = useState<Tab>("calendar");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draft, setDraft] = useState<NewTaskInput>(blankTask);
  const [monthCursor, setMonthCursor] = useState(new Date(2026, 5, 15));

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setTasks(JSON.parse(stored) as Task[]);
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(tasks));
  }, [tasks]);

  if (authStatus === "loading") return <LoadingScreen />;
  if (!email) return <LoginScreen onDemo={setDemoEmail} />;

  const normalizedTasks = tasks.map((task) => {
    const daysRemaining = calculateDaysRemaining(task.dueDate);
    const nextStatus = deriveStatus(task.status, daysRemaining);
    return {
      ...task,
      daysRemaining,
      status: nextStatus,
      visibleToReaders: deriveReaderVisibility({ status: nextStatus }),
    };
  });

  const activeTasks = sortTasks(normalizedTasks.filter((task) => task.visibleToReaders));
  const completedTasks = sortTasks(normalizedTasks.filter((task) => task.status === "Entregado"));
  const searchedActive = filterByQuery(activeTasks, query);
  const searchedMaterials = filterMaterials(initialMaterials, query);
  const title = getTitle(tab, role);

  function selectTab(nextTab: Tab) {
    if (nextTab === "completed" || nextTab === "group" || nextTab === "config") {
      if (role !== "admin") return;
    }
    setTab(nextTab);
    setDrawerOpen(false);
  }

  function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const daysRemaining = calculateDaysRemaining(draft.dueDate);
    const nextStatus = deriveStatus(draft.status, daysRemaining);
    const task: Task = {
      id: createId("tar"),
      course: draft.course,
      dueDate: draft.dueDate,
      dueTime: draft.dueTime,
      title: draft.title.trim(),
      materialNeeded: draft.materialNeeded?.trim(),
      materialUrl: draft.materialUrl?.trim(),
      deliveryType: draft.deliveryType,
      status: nextStatus,
      daysRemaining,
      notes: draft.notes?.trim(),
      platformUrl: draft.platformUrl?.trim(),
      visibleToReaders: deriveReaderVisibility({ status: nextStatus }),
    };
    if (!task.title) return;
    setTasks((current) => [task, ...current]);
    setDraft(blankTask);
    setTab("tasks");
  }

  function updateStatus(taskId: string, nextStatus: TaskStatus) {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        const daysRemaining = calculateDaysRemaining(task.dueDate);
        return {
          ...task,
          status: nextStatus,
          daysRemaining,
          visibleToReaders: deriveReaderVisibility({ status: nextStatus }),
        };
      }),
    );
  }

  function resetDemo() {
    setTasks(initialTasks);
    window.localStorage.removeItem(storageKey);
  }

  return (
    <main className="mobileApp">
      <TopBar
        title={title}
        searchOpen={searchOpen}
        query={query}
        onQueryChange={setQuery}
        onMenu={() => setDrawerOpen(true)}
        onSearch={() => setSearchOpen((value) => !value)}
        onRefresh={resetDemo}
        adminTools={role === "admin" && tab === "config"}
      />

      <Drawer
        open={drawerOpen}
        email={email}
        role={role}
        active={tab}
        onClose={() => setDrawerOpen(false)}
        onSelect={selectTab}
        onSignOut={() => {
          setDemoEmail(null);
          void signOut({ callbackUrl: "/" });
        }}
      />

      <section className="screen">
        {tab === "calendar" ? (
          <CalendarScreen
            tasks={activeTasks}
            cursor={monthCursor}
            onPrev={() => setMonthCursor((date) => new Date(date.getFullYear(), date.getMonth() - 1, 15))}
            onNext={() => setMonthCursor((date) => new Date(date.getFullYear(), date.getMonth() + 1, 15))}
            onToday={() => setMonthCursor(new Date(2026, 5, 15))}
          />
        ) : null}

        {tab === "tasks" ? <TaskListScreen tasks={searchedActive} role={role} onStatusChange={updateStatus} /> : null}
        {tab === "materials" ? <MaterialsScreen materials={searchedMaterials} /> : null}
        {tab === "completed" ? <CompletedScreen tasks={completedTasks} /> : null}
        {tab === "group" ? <GroupScreen members={initialMembers} /> : null}
        {tab === "config" ? <ConfigScreen columns={initialConfigColumns} /> : null}
      </section>

      {role === "admin" && (tab === "calendar" || tab === "tasks" || tab === "completed" || tab === "group" || tab === "config") ? (
        <button className="fab" type="button" onClick={() => selectTab("tasks")} aria-label="Agregar">
          +
        </button>
      ) : null}

      {role === "admin" && tab === "tasks" ? <QuickAddTask draft={draft} setDraft={setDraft} onSubmit={addTask} /> : null}

      <BottomNav active={tab} role={role} onSelect={selectTab} />
    </main>
  );
}

function LoginScreen({ onDemo }: { onDemo: (email: string) => void }) {
  return (
    <main className="loginScreen">
      <div className="loginCard">
        <img src="/icon.svg" alt="PSCV" className="loginLogo" />
        <p className="eyebrow">PSCV Room 2.0</p>
        <h1>Accede con Google para asignar tu rol automáticamente.</h1>
        <p className="muted">La UI usa el correo OAuth para resolver permisos: alumno o admin. Mientras configuramos Google OAuth puedes entrar en modo demo.</p>
        <button className="primaryAction" type="button" onClick={() => void signIn("google")}>Continuar con Google</button>
        <div className="demoGrid">
          <button type="button" onClick={() => onDemo("alumno@univdep.edu.mx")}>Demo alumno</button>
          <button type="button" onClick={() => onDemo("martinez_28699@univdep.edu.mx")}>Demo admin</button>
        </div>
      </div>
    </main>
  );
}

function LoadingScreen() {
  return <main className="loginScreen"><div className="loader" /></main>;
}

function TopBar({ title, searchOpen, query, onQueryChange, onMenu, onSearch, onRefresh, adminTools }: {
  title: string;
  searchOpen: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onMenu: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  adminTools: boolean;
}) {
  return (
    <header className="topAppBar">
      <button className="iconButton" type="button" onClick={onMenu} aria-label="Menú">☰</button>
      <img src="/icon.svg" alt="PSCV" className="appLogo" />
      <div className="barTitle">{searchOpen ? <input autoFocus className="barSearch" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar" /> : title}</div>
      <button className="iconButton" type="button" onClick={onSearch} aria-label="Buscar">⌕</button>
      {adminTools ? <button className="iconButton hideSmall" type="button" aria-label="Editar">▣</button> : null}
      {adminTools ? <button className="iconButton hideSmall" type="button" aria-label="Guardar">☑</button> : null}
      <button className="iconButton" type="button" onClick={onRefresh} aria-label="Actualizar">↻</button>
    </header>
  );
}

function Drawer({ open, email, role, active, onClose, onSelect, onSignOut }: {
  open: boolean;
  email: string;
  role: Role;
  active: Tab;
  onClose: () => void;
  onSelect: (tab: Tab) => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`}>
        <div className="drawerHead">
          <img src="/icon.svg" alt="PSCV" />
          <strong>{role === "admin" ? "PSCV-ADMIN" : "PSCV-ROOM"}</strong>
        </div>
        <nav className="drawerNav">
          {role === "admin" ? <DrawerItem icon="✓" label="Entregadas" active={active === "completed"} onClick={() => onSelect("completed")} /> : null}
          {role === "admin" ? <DrawerItem icon="☷" label="Lista de grupo" active={active === "group"} onClick={() => onSelect("group")} /> : null}
          {role === "admin" ? <DrawerItem icon="🛠" label="Configuración" active={active === "config"} onClick={() => onSelect("config")} /> : null}
          <DrawerItem icon="ⓘ" label="About" active={false} onClick={onClose} />
          <DrawerItem icon="⌘" label="Share" active={false} onClick={onClose} />
          <div className="drawerLine" />
          <DrawerItem icon="▦" label="App Gallery" active={false} onClick={onClose} />
          <DrawerItem icon="♟" label="Add Shortcut" active={false} onClick={onClose} />
        </nav>
        <div className="drawerFooter">
          <div className="offline">◉ Offline ready <u>more</u></div>
          <div className="accountRow">
            <span className="avatar">{email[0]?.toUpperCase()}</span>
            <span>{email}</span>
            <button type="button" onClick={onSignOut}>⌄</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return <button className={`drawerItem ${active ? "active" : ""}`} type="button" onClick={onClick}><span>{icon}</span>{label}</button>;
}

function CalendarScreen({ tasks, cursor, onPrev, onNext, onToday }: { tasks: Task[]; cursor: Date; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const weeks = buildMonthGrid(year, month);
  const monthName = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(cursor);
  const todayKey = "2026-06-15";

  return (
    <div className="calendarScreen">
      <div className="viewTabs"><span>Day</span><span>Week</span><strong>Month</strong><button type="button" onClick={onToday}>TODAY</button></div>
      <div className="monthHead"><button onClick={onPrev} type="button">‹</button><h2>{monthName}</h2><button onClick={onNext} type="button">›</button></div>
      <div className="weekdays"><span>do</span><span>lu</span><span>ma</span><span>mi</span><span>ju</span><span>vi</span><span>sá</span></div>
      <div className="monthGrid">
        {weeks.flat().map((day, index) => {
          const dateKey = day ? toDateKey(year, month, day) : "";
          const dayTasks = tasks.filter((task) => task.dueDate === dateKey);
          return (
            <div className="dayCell" key={`${dateKey}-${index}`}>
              {day ? <span className={`dayNumber ${dateKey === todayKey ? "today" : ""}`}>{String(day).padStart(2, "0")}</span> : null}
              <div className="eventStack">
                {dayTasks.slice(0, 3).map((task) => <span className={`calendarEvent ${calendarTone(task)}`} key={task.id}>{shortText(task.title, 13)}</span>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskListScreen({ tasks, role, onStatusChange }: { tasks: Task[]; role: Role; onStatusChange: (id: string, status: TaskStatus) => void }) {
  const groups = groupTasks(tasks);
  return (
    <div className="listScreen">
      {deliveryTypes.map((type) => {
        const group = groups.get(type) ?? [];
        if (!group.length) return null;
        return (
          <section className="typeGroup" key={type}>
            <h2 className={`groupTitle ${deliveryTone(type)}`}><span>{typeIcon(type)}</span>{type}</h2>
            {group.map((task) => <TaskRow key={task.id} task={task} role={role} onStatusChange={onStatusChange} />)}
          </section>
        );
      })}
    </div>
  );
}

function TaskRow({ task, role, onStatusChange }: { task: Task; role: Role; onStatusChange: (id: string, status: TaskStatus) => void }) {
  return (
    <article className="dataRow taskRow">
      <div className="rowMain">
        <strong>{task.title}</strong>
        <span>{task.course}</span>
      </div>
      <div className="rowSide">
        <span className="days">◷ <u>{task.daysRemaining}</u></span>
        {task.materialUrl || task.platformUrl ? <a href={task.materialUrl || task.platformUrl} target="_blank" rel="noreferrer" className="openIcon">↗</a> : null}
        {role === "admin" ? <button type="button" className="miniAction" onClick={() => onStatusChange(task.id, "Entregado")}>✓</button> : null}
      </div>
    </article>
  );
}

function MaterialsScreen({ materials }: { materials: Material[] }) {
  const groups = new Map<string, Material[]>();
  materials.forEach((material) => groups.set(material.scope, [...(groups.get(material.scope) ?? []), material]));
  return (
    <div className="listScreen">
      {[...groups.entries()].map(([scope, rows]) => (
        <section key={scope} className="materialGroup">
          <h2 className="plainGroupTitle">{scope}</h2>
          {rows.map((material) => (
            <article className="dataRow" key={material.id}>
              <div className="rowMain"><strong>{material.name}</strong><span>{material.folder ?? material.scope}</span></div>
              <a href={material.url} target="_blank" rel="noreferrer" className="openIcon">↗</a>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

function CompletedScreen({ tasks }: { tasks: Task[] }) {
  const groups = groupTasks(tasks);
  return (
    <div className="listScreen">
      {deliveryTypes.map((type) => {
        const group = groups.get(type) ?? [];
        if (!group.length) return null;
        return (
          <section className="typeGroup" key={type}>
            <h2 className="groupTitle blue"><span>{typeIcon(type)}</span>{type}</h2>
            {group.map((task) => (
              <article className="dataRow completedRow" key={task.id}>
                <div className="rowMain"><strong>✓ {task.title}</strong><span>{task.course}</span></div>
                <div className="rowSide"><span className="doneDate">✓ {formatDate(task.dueDate)}</span>{task.materialUrl ? <a className="openIcon" href={task.materialUrl}>↗</a> : null}</div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function ConfigScreen({ columns }: { columns: ConfigColumn[] }) {
  return (
    <div className="tableWrap">
      <table className="appTable">
        <thead><tr><th>Nombre de columna</th><th>Key</th><th>Activa</th><th>Casillas</th><th>Fija</th></tr></thead>
        <tbody>{columns.map((column) => <tr key={column.key}><td>{column.name}</td><td>{column.key}</td><td>{column.active ? "SI" : "NO"}</td><td>{column.checkboxes ? "SI" : "NO"}</td><td>{column.fixed ? "SI" : "NO"}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function GroupScreen({ members }: { members: GroupMember[] }) {
  return (
    <div className="tableWrap">
      <table className="appTable memberTable">
        <thead><tr><th>No. Control</th><th>Correo electronico</th><th></th><th>Nombre completo</th><th>Asistió</th><th>Problema licencia</th><th>Problema Auth</th></tr></thead>
        <tbody>{members.map((member) => <tr key={member.controlNumber}><td>{member.controlNumber}</td><td>{member.email}</td><td>✉</td><td>{member.fullName}</td><td>{yesNo(member.attended)}</td><td>{yesNo(member.licenseIssue)}</td><td>{yesNo(member.authIssue)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function QuickAddTask({ draft, setDraft, onSubmit }: { draft: NewTaskInput; setDraft: (draft: NewTaskInput) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`quickAdd ${open ? "open" : ""}`}>
      <button className="quickAddHandle" type="button" onClick={() => setOpen((value) => !value)}>{open ? "Cerrar" : "Nueva tarea"}</button>
      {open ? (
        <form onSubmit={onSubmit} className="quickForm">
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Actividad / tarea" required />
          <select value={draft.course} onChange={(event) => setDraft({ ...draft, course: event.target.value })}>{courses.map((item) => <option key={item}>{item}</option>)}</select>
          <div className="twoCols"><input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /><input type="time" value={draft.dueTime} onChange={(event) => setDraft({ ...draft, dueTime: event.target.value })} /></div>
          <select value={draft.deliveryType} onChange={(event) => setDraft({ ...draft, deliveryType: event.target.value as DeliveryType })}>{deliveryTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={draft.materialUrl} onChange={(event) => setDraft({ ...draft, materialUrl: event.target.value })} placeholder="Link al material" />
          <button className="primaryAction" type="submit">Guardar</button>
        </form>
      ) : null}
    </div>
  );
}

function BottomNav({ active, role, onSelect }: { active: Tab; role: Role; onSelect: (tab: Tab) => void }) {
  const middleTab: Tab = role === "admin" ? "completed" : "tasks";
  return (
    <nav className="bottomNav">
      <button className={active === "calendar" ? "active" : ""} onClick={() => onSelect("calendar")} type="button"><span>▦</span>Calendario</button>
      <button className={active === middleTab || active === "group" || active === "config" ? "active" : ""} onClick={() => onSelect(middleTab)} type="button"><span>{role === "admin" ? "▣" : "▤"}</span>{role === "admin" ? "Admin" : "Tareas"}</button>
      <button className={active === "materials" ? "active" : ""} onClick={() => onSelect("materials")} type="button"><span>⬡</span>Materiales adicionales</button>
    </nav>
  );
}

function getTitle(tab: Tab, role: Role) {
  if (tab === "calendar") return "Calendario";
  if (tab === "tasks") return "Tareas";
  if (tab === "materials") return "Materiales adicionales";
  if (tab === "completed") return "Entregadas";
  if (tab === "group") return "Lista de grupo";
  if (tab === "config") return "Configuración";
  return role === "admin" ? "Admin" : "Tareas";
}

function groupTasks(tasks: Task[]) {
  const groups = new Map<DeliveryType, Task[]>();
  tasks.forEach((task) => groups.set(task.deliveryType, [...(groups.get(task.deliveryType) ?? []), task]));
  return groups;
}

function filterByQuery(tasks: Task[], query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return tasks;
  return tasks.filter((task) => [task.title, task.course, task.materialNeeded, task.notes].some((value) => value?.toLowerCase().includes(text)));
}

function filterMaterials(materials: Material[], query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return materials;
  return materials.filter((material) => [material.name, material.scope, material.folder, material.type].some((value) => value?.toLowerCase().includes(text)));
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, index) => index + 1));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function typeIcon(type: DeliveryType) {
  if (type === "Proyecto") return "▥";
  if (type === "Examen") return "▧";
  if (type === "Exposición") return "◩";
  return "▤";
}

function yesNo(value: boolean) {
  return value ? "SI" : "NO";
}
