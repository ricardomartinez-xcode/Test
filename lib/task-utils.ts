import type { Task, TaskStatus } from "./domain";

export function dateToLocalMidnight(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function calculateDaysRemaining(dueDate: string, today = new Date()) {
  const due = dateToLocalMidnight(dueDate);
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((due.getTime() - current.getTime()) / 86_400_000);
}

export function deriveReaderVisibility(task: Pick<Task, "status" | "daysRemaining">) {
  if (task.status === "Entregado" || task.status === "Cancelado") return false;
  return task.daysRemaining >= 0;
}

export function deriveStatus(status: TaskStatus, daysRemaining: number): TaskStatus {
  if (status === "Pendiente" && daysRemaining === 0) return "Se entrega hoy";
  return status;
}

export function statusTone(status: TaskStatus, daysRemaining: number) {
  if (status === "Entregado") return "ok";
  if (status === "Cancelado") return "danger";
  if (daysRemaining < 0) return "danger";
  if (status === "Se entrega hoy" || daysRemaining === 0) return "warn";
  if (status === "En proceso" || status === "Reprogramado") return "blue";
  return "";
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
