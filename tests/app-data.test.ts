import assert from "node:assert/strict";
import test from "node:test";
import { normalizePreferences, toProfile, toTask } from "../lib/app-data.ts";

test("normalizes D1 profile rows with JSON preferences and integer permission flags", () => {
  const profile = toProfile({
    id: "profile-1",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin",
    active: 1,
    can_edit_tasks: 1,
    can_delete_tasks: 0,
    can_manage_materials: 1,
    can_manage_users: 0,
    can_manage_settings: 1,
    can_manage_group: 0,
    can_manage_notifications: 1,
    can_view_reports: 0,
    can_manage_r2: 1,
    preferences: '{"calendarView":"week","taskDensity":"compact","materialPreviewSize":"large","showCompleted":true,"theme":"dark"}',
  });

  assert.deepEqual(profile.preferences, {
    calendarView: "week",
    taskDensity: "compact",
    materialPreviewSize: "large",
    showCompleted: true,
    theme: "dark",
  });
  assert.equal(profile.canEditTasks, true);
  assert.equal(profile.canDeleteTasks, false);
  assert.equal(profile.canManageR2, true);
});

test("falls back safely when preference JSON is malformed", () => {
  assert.deepEqual(normalizePreferences("{bad json"), {
    calendarView: "month",
    taskDensity: "medium",
    materialPreviewSize: "medium",
    showCompleted: false,
    theme: "system",
  });
});

test("maps D1 task rows with joined course and task type fields", () => {
  const task = toTask({
    id: "task-1",
    course_id: "course-1",
    course_name: "Procesos Grupales",
    course_color: "#0f9f8f",
    course_card_size: "large",
    task_type_id: "type-1",
    task_type_name: "Proyecto",
    task_type_color: "#d97706",
    title: "Entrega final",
    due_date: "2026-07-01",
    due_time: "15:30:00",
    status: "Pendiente",
    priority: "Alta",
    visible_to_students: 1,
    material_needed: "Rúbrica",
    material_url: "",
    platform_url: "",
  });

  assert.equal(task.course, "Procesos Grupales");
  assert.equal(task.deliveryType, "Proyecto");
  assert.equal(task.visibleToReaders, true);
  assert.equal(task.courseCardSize, "large");
});
