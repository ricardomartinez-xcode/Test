import assert from "node:assert/strict";
import test from "node:test";
import { groupAdminNotifications } from "../lib/server/notification-groups.ts";

test("groups recipient rows from the same notification delivery", () => {
  const createdAt = "2026-06-22T18:48:15.000Z";
  const groups = groupAdminNotifications([
    {
      id: "1",
      profile_id: "student-1",
      kind: "task_updated",
      priority: "normal",
      title: "Tarea actualizada: TRABAJO FINAL",
      body: "Psicología · 24/06/2026 18:00",
      entity: "tasks",
      entity_id: "task-1",
      read_at: null,
      dismissed_at: null,
      created_at: createdAt,
    },
    {
      id: "2",
      profile_id: "student-2",
      kind: "task_updated",
      priority: "normal",
      title: "Tarea actualizada: TRABAJO FINAL",
      body: "Psicología · 24/06/2026 18:00",
      entity: "tasks",
      entity_id: "task-1",
      read_at: createdAt,
      dismissed_at: null,
      created_at: createdAt,
    },
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.recipient_count, 2);
  assert.equal(groups[0]?.read_count, 1);
  assert.equal(groups[0]?.dismissed_count, 0);
});

test("keeps separate notification deliveries created at different times", () => {
  const base = {
    profile_id: "student-1",
    kind: "task_updated",
    priority: "normal",
    title: "Tarea actualizada: TRABAJO FINAL",
    body: "",
    entity: "tasks",
    entity_id: "task-1",
    read_at: null,
    dismissed_at: null,
  };

  const groups = groupAdminNotifications([
    { ...base, id: "1", created_at: "2026-06-22T18:48:15.000Z" },
    { ...base, id: "2", created_at: "2026-06-22T18:49:15.000Z" },
  ]);

  assert.equal(groups.length, 2);
});

