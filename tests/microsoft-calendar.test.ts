import assert from "node:assert/strict";
import test from "node:test";
import { buildMicrosoftCalendarEvent, buildMicrosoftCalendarUpdate } from "../lib/server/microsoft-calendar.ts";

test("builds a thirty minute Outlook event at the task deadline", () => {
  const event = buildMicrosoftCalendarEvent({
    id: "5b39d2d1-2d6f-47c4-8dd4-8e0893b104bb",
    title: "Trabajo final",
    due_date: "2026-06-24",
    due_time: "23:50:00",
    notes: "Entregar versión final",
    material_url: "https://example.com/material",
    platform_url: "https://example.com/class",
    courses: { name: "Psicología clínica" },
  });

  assert.equal(event.subject, "[PSCV] Trabajo final");
  assert.deepEqual(event.start, {
    dateTime: "2026-06-24T23:50:00",
    timeZone: "Central Standard Time (Mexico)",
  });
  assert.deepEqual(event.end, {
    dateTime: "2026-06-25T00:20:00",
    timeZone: "Central Standard Time (Mexico)",
  });
  assert.match(event.body.content, /Entregar versión final/);
  assert.match(event.body.content, /https:\/\/example.com\/material/);
  assert.equal(event.transactionId, "5b39d2d1-2d6f-47c4-8dd4-8e0893b104bb");
});

test("does not send the immutable transaction id when updating an event", () => {
  const update = buildMicrosoftCalendarUpdate({
    id: "5b39d2d1-2d6f-47c4-8dd4-8e0893b104bb",
    title: "Trabajo final",
    due_date: "2026-06-24",
    due_time: "18:00",
    notes: null,
    material_url: null,
    platform_url: null,
    courses: null,
  });

  assert.equal("transactionId" in update, false);
});
