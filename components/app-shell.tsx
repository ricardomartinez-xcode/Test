"use client";

import { useEffect, useMemo, useState } from "react";
import type { DeliveryType, Material, NewTaskInput, Role, Task, TaskStatus } from "@/lib/domain";
import { courses, deliveryTypes, statuses } from "@/lib/domain";
import { calculateDaysRemaining, createId, deriveReaderVisibility, deriveStatus, sortTasks, statusTone } from "@/lib/task-utils";

type Props = {
  initialTasks: Task[];
  initialMaterials: Material[];
};

const storageKey = "pscv-room-2.tasks";

const blankTask: NewTaskInput = {
  course: courses[0],
  dueDate: new Date().toISOString().slice(0, 10),
  dueTime: "23:59",
  title: "",
  deliveryType: "Tarea",
  status: "Pendiente",
  materialNeeded: "",
  materialUrl: "",
  notes: "",
  platformUrl: "",
};

export function AppShell({ initialTasks, initialMaterials }: Props) {
  const [role, setRole] = useState<Role>("reader");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "Todas">("Todas");
  const [type, setType] = useState<DeliveryType | "Todos">("Todos");
  const [draft, setDraft] = useState<NewTaskInput>(blankTask);

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

  const normalizedTasks = useMemo(
    () =>
      tasks.map((task) => {
        const daysRemaining = calculateDaysRemaining(task.dueDate);
        const nextStatus = deriveStatus(task.status, daysRemaining);
        return {
          ...task,
          daysRemaining,
          status: nextStatus,
          visibleToReaders: deriveReaderVisibility({ status: nextStatus, daysRemaining }),
        };
      }),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const text = query.trim().toLowerCase();
    return sortTasks(normalizedTasks)
      .filter((task) => (role === "reader" ? task.visibleToReaders : true))
      .filter((task) => (status === "Todas" ? true : task.status === status))
      .filter((task) => (type === "Todos" ? true : task.deliveryType === type))
      .filter((task) => {
        if (!text) return true;
        return [task.title, task.course, task.materialNeeded, task.notes].some((value) => value?.toLowerCase().includes(text));
      });
  }, [normalizedTasks, query, role, status, type]);

  const metrics = useMemo(() => {
    const readerVisible = normalizedTasks.filter((task) => task.visibleToReaders);
    return {
      pending: normalizedTasks.filter((task) => task.status !== "Entregado" && task.status !== "Cancelado").length,
      today: normalizedTasks.filter((task) => task.daysRemaining === 0 && task.status !== "Entregado").length,
      visible: readerVisible.length,
      materials: initialMaterials.length,
    };
  }, [normalizedTasks, initialMaterials.length]);

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
      visibleToReaders: deriveReaderVisibility({ status: nextStatus, daysRemaining }),
    };
    if (!task.title) return;
    setTasks((current) => [task, ...current]);
    setDraft(blankTask);
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
          visibleToReaders: deriveReaderVisibility({ status: nextStatus, daysRemaining }),
        };
      }),
    );
  }

  function removeTask(taskId: string) {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  function resetDemo() {
    setTasks(initialTasks);
    window.localStorage.removeItem(storageKey);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(normalizedTasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pscv-room-tareas.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">PR</div>
          <div>
            <p className="eyebrow">AppSheet 2.0 · PSCV</p>
            <strong>Room operativo</strong>
          </div>
        </div>
        <div className="actions">
          <div className="segmented" aria-label="Modo de uso">
            <button className={role === "reader" ? "active" : ""} onClick={() => setRole("reader")} type="button">
              Lectura
            </button>
            <button className={role === "admin" ? "active" : ""} onClick={() => setRole("admin")} type="button">
              Admin
            </button>
          </div>
          <button className="ghost" onClick={exportJson} type="button">Exportar JSON</button>
          <button className="ghost" onClick={resetDemo} type="button">Reset demo</button>
        </div>
      </header>

      <section className="hero">
        <div className="panel heroText">
          <p className="eyebrow">Fuente recomendada: Postgres + R2</p>
          <h1>Un reemplazo propio para AppSheet, con control real de datos y archivos.</h1>
          <p className="muted">
            Este MVP conserva lo útil del flujo anterior —tareas, materiales, calendario y vista de alumnos— pero separa lectura/admin,
            elimina columnas internas de la UI y deja listo el salto a base SQL y bucket de archivos.
          </p>
          <div className="actions">
            <a className="button" href="#tareas">Ver tareas</a>
            <a className="ghost" href="#arquitectura">Arquitectura</a>
          </div>
        </div>
        <div className="panel">
          <h2>Estado del sistema</h2>
          <div className="architecture">
            <div className="archItem"><strong>UI</strong><span className="small muted">Next.js</span></div>
            <div className="archItem"><strong>Datos</strong><span className="small muted">Postgres-ready</span></div>
            <div className="archItem"><strong>Archivos</strong><span className="small muted">R2-ready</span></div>
          </div>
        </div>
      </section>

      <section className="grid metrics" aria-label="Métricas">
        <Metric value={metrics.pending} label="Activas admin" />
        <Metric value={metrics.today} label="Se entregan hoy" />
        <Metric value={metrics.visible} label="Visibles lectura" />
        <Metric value={metrics.materials} label="Materiales seed" />
      </section>

      <section className="workspace" id="tareas">
        <aside className="sidebar">
          <div className="card">
            <h2>Filtros</h2>
            <div className="stack">
              <div className="field">
                <label>Buscar</label>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Materia, tarea, material..." />
              </div>
              <div className="field">
                <label>Estado</label>
                <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "Todas")}>
                  <option>Todas</option>
                  {statuses.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={type} onChange={(event) => setType(event.target.value as DeliveryType | "Todos")}>
                  <option>Todos</option>
                  {deliveryTypes.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>

          {role === "admin" ? (
            <div className="card">
              <h2>Nueva tarea</h2>
              <form className="stack" onSubmit={addTask}>
                <div className="field">
                  <label>Título</label>
                  <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Nombre de la actividad" required />
                </div>
                <div className="field">
                  <label>Materia</label>
                  <select value={draft.course} onChange={(event) => setDraft({ ...draft, course: event.target.value })}>
                    {courses.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Fecha</label>
                  <input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} required />
                </div>
                <div className="field">
                  <label>Hora</label>
                  <input type="time" value={draft.dueTime} onChange={(event) => setDraft({ ...draft, dueTime: event.target.value })} />
                </div>
                <div className="field">
                  <label>Tipo</label>
                  <select value={draft.deliveryType} onChange={(event) => setDraft({ ...draft, deliveryType: event.target.value as DeliveryType })}>
                    {deliveryTypes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Material / notas</label>
                  <textarea value={draft.materialNeeded} onChange={(event) => setDraft({ ...draft, materialNeeded: event.target.value })} placeholder="Material necesario" />
                </div>
                <div className="field">
                  <label>Link</label>
                  <input value={draft.materialUrl} onChange={(event) => setDraft({ ...draft, materialUrl: event.target.value })} placeholder="https://..." />
                </div>
                <button className="button" type="submit">Agregar tarea</button>
              </form>
            </div>
          ) : (
            <div className="card soft">
              <h2>Modo lectura</h2>
              <p className="muted small">Solo se muestran tareas activas y visibles. Entregadas, canceladas o vencidas se ocultan automáticamente.</p>
            </div>
          )}
        </aside>

        <div className="panel">
          <div className="topbar">
            <div>
              <p className="eyebrow">{role === "admin" ? "Panel administrativo" : "Vista para alumnos"}</p>
              <h2>Tareas</h2>
            </div>
            <span className="badge">{visibleTasks.length} registros</span>
          </div>

          <div className="taskList">
            {visibleTasks.length === 0 ? <div className="empty">No hay tareas con estos filtros.</div> : null}
            {visibleTasks.map((task) => (
              <article className="task" key={task.id}>
                <div>
                  <div className="taskMeta">
                    <span className={`badge ${statusTone(task.status, task.daysRemaining)}`}>{task.status}</span>
                    <span className="badge">{task.deliveryType}</span>
                    <span className="badge">{task.daysRemaining === 0 ? "Hoy" : `${task.daysRemaining} días`}</span>
                  </div>
                  <h3>{task.title}</h3>
                  <p className="muted small">{task.course} · {formatDate(task.dueDate)} · {task.dueTime}</p>
                  {task.materialNeeded ? <p className="taskBody">{task.materialNeeded}</p> : null}
                  {task.notes ? <p className="taskBody">{task.notes}</p> : null}
                  <div className="actions">
                    {task.materialUrl ? <a className="linkButton" href={task.materialUrl} target="_blank" rel="noreferrer">Abrir material</a> : null}
                    {task.platformUrl ? <a className="linkButton" href={task.platformUrl} target="_blank" rel="noreferrer">Plataforma</a> : null}
                  </div>
                </div>
                {role === "admin" ? (
                  <div className="stack">
                    <button className="ghost" type="button" onClick={() => updateStatus(task.id, "Entregado")}>Entregado</button>
                    <button className="ghost" type="button" onClick={() => updateStatus(task.id, "Reprogramado")}>Reprogramar</button>
                    <button className="danger" type="button" onClick={() => removeTask(task.id)}>Eliminar</button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="panel" id="arquitectura" style={{ marginTop: 20 }}>
        <p className="eyebrow">Diseño 2.0</p>
        <h2>Qué mejora sobre AppSheet</h2>
        <div className="architecture">
          <div className="archItem"><strong>Permisos reales</strong><span className="small muted">Admin y lectura separados por backend, no por link compartido.</span></div>
          <div className="archItem"><strong>Datos consistentes</strong><span className="small muted">Postgres evita fórmulas rotas, IDs duplicados y estados manuales.</span></div>
          <div className="archItem"><strong>Archivos escalables</strong><span className="small muted">R2 guarda PDFs, presentaciones y previews fuera de Sheets.</span></div>
        </div>
      </section>

      <section className="panel" style={{ marginTop: 20 }}>
        <p className="eyebrow">Biblioteca</p>
        <h2>Materiales</h2>
        <div className="materials">
          {initialMaterials.map((material) => (
            <article className="material" key={material.id}>
              <strong>{material.name}</strong>
              <span className="small muted">{material.type} · {material.scope}</span>
              <div className="actions">
                <a className="linkButton" href={material.url} target="_blank" rel="noreferrer">Abrir</a>
                {material.previewUrl ? <a className="linkButton" href={material.previewUrl} target="_blank" rel="noreferrer">Preview</a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
