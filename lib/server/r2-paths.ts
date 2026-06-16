export const MATERIALS_R2_ROOT = "Psicología/Materiales de clase";

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
  return `${MATERIALS_R2_ROOT}/${relativeSection}/${new Date().getFullYear()}/${crypto.randomUUID()}-${filename}`;
}
