"use client";

import { useEffect } from "react";

function toDetailDateOnly(value: string) {
  const text = value.trim();

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  const mx = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (mx) {
    const [, day, month, year] = mx;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  return text;
}

function normalizeTaskDetailDates() {
  for (const field of document.querySelectorAll<HTMLElement>(".taskDetailScreen .detailField")) {
    const label = field.querySelector("dt")?.textContent?.trim().toLowerCase();
    if (label !== "fecha de entrega") continue;

    const value = field.querySelector<HTMLElement>("dd");
    if (!value) continue;

    const next = toDetailDateOnly(value.textContent ?? "");
    if (next && value.textContent !== next) value.textContent = next;
  }
}

export function DetailDateNormalizer() {
  useEffect(() => {
    normalizeTaskDetailDates();

    const observer = new MutationObserver(() => normalizeTaskDetailDates());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
