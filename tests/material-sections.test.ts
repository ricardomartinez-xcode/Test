import assert from "node:assert/strict";
import test from "node:test";
import {
  isGeneratedR2FolderPath,
  materialSectionPathFromR2Key,
} from "../lib/server/r2-paths.ts";
import { selectBucketMaterialSections } from "../lib/server/material-sections.ts";

test("maps generated year upload folders back to their parent material section", () => {
  assert.equal(
    materialSectionPathFromR2Key("Procesos Grupales/2026/1234-presentacion.pdf"),
    "Procesos Grupales",
  );
  assert.equal(
    materialSectionPathFromR2Key("Compendio de Psicología/Psicología Clínica/Abuso Sexual/manual.pdf"),
    "Compendio de Psicología/Psicología Clínica/Abuso Sexual",
  );
  assert.equal(isGeneratedR2FolderPath("Procesos Grupales/2026"), true);
});

test("selects only canonical bucket sections and ignores legacy aliases", () => {
  const sections = selectBucketMaterialSections(
    [
      "Compendio de Psicología/Articulos de Investigación",
      "Procesos Grupales",
      "Procesos Grupales/2026",
    ],
    [
      {
        id: "legacy",
        name: "Articulos de Investigación",
        path: "Psicologia/Compendio Psicología/Articulos de Investigación",
        sort_order: 1,
      },
      {
        id: "canonical",
        name: "Articulos de Investigación",
        path: "Compendio de Psicología/Articulos de Investigación",
        sort_order: 2,
      },
      {
        id: "processes",
        name: "Procesos Grupales",
        path: "Procesos Grupales",
        sort_order: 3,
      },
      {
        id: "year",
        name: "2026",
        path: "Procesos Grupales/2026",
        sort_order: 4,
      },
    ],
  );

  assert.deepEqual(
    sections.map((section) => ({ id: section.id, path: section.path })),
    [
      {
        id: "canonical",
        path: "Compendio de Psicología/Articulos de Investigación",
      },
      {
        id: "processes",
        path: "Procesos Grupales",
      },
    ],
  );
});

