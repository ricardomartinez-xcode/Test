import type { DeliveryType, Task, TaskStatus } from "./domain";

export function dateToLocalMidnight(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function calculateDaysRemaining(dueDate: string, today = new Date()) {
  const due = dateToLocalMidnight(dueDate);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((due.getTime() - current.getTime()) / 86_400_000);
}

export function deriveReaderVisibility(task: Pick<Task, "status">) {
  return task.status !== "Entregado" && task.status !== "Cancelado";
}

export function deriveStatus(status: TaskStatus, daysRemaining: number): TaskStatus {
  if (status === "Pendiente" && daysRemaining === 0) return "Se entrega hoy";
  return status;
}

export function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const aDate = `${a.dueDate}T${a.dueTime || "23:59"}`;
    const bDate = `${b.dueDate}T${b.dueTime || "23:59"}`;
    return aDate.localeCompare(bDate);
  });
}

export function createId(prefix = "task") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

export function deliveryTone(type: DeliveryType) {
  const map: Record<DeliveryType, string> = {
    Tarea: "blue",
    Lectura: "blue",
    Examen: "red",
    Exposición: "teal",
    Proyecto: "purple",
    Material: "gray",
    Recordatorio: "gray",
    Práctica: "teal",
  };
  return map[type];
}

export function calendarTone(task: Pick<Task, "deliveryType" | "status">) {
  if (task.status === "Entregado") return "green";
  if (task.deliveryType === "Examen") return "gold";
  if (task.deliveryType === "Proyecto") return "teal";
  if (task.deliveryType === "Exposición") return "teal";
  return "red";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "numeric", year: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );
}

export function shortText(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
