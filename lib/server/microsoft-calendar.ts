export type CalendarTask = {
  id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  notes: string | null;
  material_url: string | null;
  platform_url: string | null;
  courses: { name: string } | { name: string }[] | null;
};

export type MicrosoftCalendarEvent = {
  subject: string;
  body: { contentType: "HTML"; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isReminderOn: boolean;
  reminderMinutesBeforeStart: number;
  showAs: "free";
  transactionId: string;
};

export type MicrosoftCalendarUpdate = Omit<MicrosoftCalendarEvent, "transactionId">;

const MICROSOFT_TIME_ZONE = "Central Standard Time (Mexico)";

function normalizeTime(value: string | null) {
  const match = value?.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  return match ? `${match[1]}:${match[2]}:${match[3] ?? "00"}` : "23:59:00";
}

function addMinutes(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second] = time.split(":").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute + minutes, second));
  return value.toISOString().slice(0, 19);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] ?? character);
}

function courseName(task: CalendarTask) {
  const course = Array.isArray(task.courses) ? task.courses[0] : task.courses;
  return course?.name ?? "Sin materia";
}

function eventBody(task: CalendarTask) {
  const rows = [
    `<p><strong>Materia:</strong> ${escapeHtml(courseName(task))}</p>`,
    task.notes ? `<p>${escapeHtml(task.notes)}</p>` : "",
    task.material_url ? `<p><a href="${escapeHtml(task.material_url)}">Abrir material</a></p>` : "",
    task.platform_url ? `<p><a href="${escapeHtml(task.platform_url)}">Abrir plataforma</a></p>` : "",
    "<p>Evento sincronizado por PSCV Room.</p>",
  ];
  return rows.filter(Boolean).join("");
}

export function buildMicrosoftCalendarEvent(task: CalendarTask): MicrosoftCalendarEvent {
  const time = normalizeTime(task.due_time);
  const startDateTime = `${task.due_date}T${time}`;

  return {
    subject: `[PSCV] ${task.title}`,
    body: {
      contentType: "HTML",
      content: eventBody(task),
    },
    start: {
      dateTime: startDateTime,
      timeZone: MICROSOFT_TIME_ZONE,
    },
    end: {
      dateTime: addMinutes(task.due_date, time, 30),
      timeZone: MICROSOFT_TIME_ZONE,
    },
    isReminderOn: true,
    reminderMinutesBeforeStart: 60,
    showAs: "free",
    transactionId: task.id,
  };
}

export function buildMicrosoftCalendarUpdate(task: CalendarTask): MicrosoftCalendarUpdate {
  const event = buildMicrosoftCalendarEvent(task);
  return {
    subject: event.subject,
    body: event.body,
    start: event.start,
    end: event.end,
    isReminderOn: event.isReminderOn,
    reminderMinutesBeforeStart: event.reminderMinutesBeforeStart,
    showAs: event.showAs,
  };
}
