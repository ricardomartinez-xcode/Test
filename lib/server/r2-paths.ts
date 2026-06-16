export const MATERIALS_R2_ROOT = "";
export const DEFAULT_R2_FOLDER_DESTINATIONS = [
  "Alteraciones de la conducta",
  "Compendio de Psicologia",
  "Evaluacion Psicológica I",
  "Procesos Grupales",
  "Teorias del Aprendizaje",
];

function cleanPath(value: string) {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\+/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function stripKnownRoot(value: string) {
  const path = cleanPath(value);
  const root = cleanPath(MATERIALS_R2_ROOT);
  if (!root) return path;
  const rootWithoutFirstSegment = root.split("/").slice(1).join("/");

  if (path === root) return "";
  if (path.startsWith(`${root}/`)) return path.slice(root.length + 1);
  if (rootWithoutFirstSegment && path === rootWithoutFirstSegment) return "";
  if (rootWithoutFirstSegment && path.startsWith(`${rootWithoutFirstSegment}/`)) return path.slice(rootWithoutFirstSegment.length + 1);

  return path;
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function buildMaterialR2Key(input: { fileName: string; sectionPath?: string | null }) {
  const relativeSection = stripKnownRoot(input.sectionPath ?? "") || "General";
  const filename = safeFileName(input.fileName) || `material-${Date.now()}`;
  return [cleanPath(MATERIALS_R2_ROOT), relativeSection, String(new Date().getFullYear()), `${crypto.randomUUID()}-${filename}`]
    .filter(Boolean)
    .join("/");
}
