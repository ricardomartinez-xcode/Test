export const MATERIALS_R2_ROOT = "";

export const DEFAULT_R2_FOLDER_DESTINATIONS = [
  "Alteraciones de la conducta",
  "Compendio de Psicología",
  "Compendio de Psicología/Articulos de Investigación",
  "Compendio de Psicología/Criminología",
  "Compendio de Psicología/Pscopatologías",
  "Compendio de Psicología/Psicologia educativa",
  "Compendio de Psicología/Psicología Clínica",
  "Compendio de Psicología/Psicología general",
  "Compendio de Psicología/Psicología organizacional",
  "Compendio de Psicología/Test, cuestionarios, etc",
  "Evaluacion Psicológica I",
  "Procesos Grupales",
  "Teorias del Aprendizaje",
];

const LEGACY_BUCKET_ROOT = "psicologia";

const KNOWN_SEGMENTS: Record<string, string> = {
  psicologia: "psicologia",
  "alteraciones de la conducta": "Alteraciones de la conducta",
  "compendio de psicologia": "Compendio de Psicología",
  "compendio psicologia": "Compendio de Psicología",
  "evaluacion psicologica i": "Evaluacion Psicológica I",
  "procesos grupales": "Procesos Grupales",
  "teorias del aprendizaje": "Teorias del Aprendizaje",
  "articulos de investigacion": "Articulos de Investigación",
  criminologia: "Criminología",
  pscopatologias: "Pscopatologías",
  psicopatologias: "Pscopatologías",
  "psicologia educativa": "Psicologia educativa",
  "psicologia clinica": "Psicología Clínica",
  "psicologia general": "Psicología general",
  "psicologia organizacional": "Psicología organizacional",
  "test cuestionarios etc": "Test, cuestionarios, etc",
};

function cleanPath(value: string) {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function keyForAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeFolderSegment(value: string) {
  return KNOWN_SEGMENTS[keyForAlias(value)] ?? value;
}

export function normalizeMaterialR2Key(value: string | null | undefined) {
  const path = cleanPath(value ?? "");
  if (!path) return path;

  const parts = path.split("/").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";

  const normalizedParts = parts.map((part, index) => {
    // Preserve file names exactly. Only known folder segments are normalized.
    if (index === parts.length - 1 && /\.[a-z0-9]{2,8}$/i.test(part)) return part;
    return normalizeFolderSegment(part);
  });

  const root = cleanPath(MATERIALS_R2_ROOT);

  if (root) {
    if (keyForAlias(normalizedParts[0]) !== keyForAlias(root)) {
      normalizedParts.unshift(root);
    } else {
      normalizedParts[0] = root;
    }
  } else if (keyForAlias(normalizedParts[0]) === LEGACY_BUCKET_ROOT) {
    // The R2 bucket itself is named "psicologia"; it is not a folder prefix.
    // Strip legacy keys that were built as "psicologia/..." so public URLs target the bucket root.
    normalizedParts.shift();
  }

  return cleanPath(normalizedParts.join("/"));
}

function stripKnownRoot(value: string) {
  const normalized = normalizeMaterialR2Key(value);
  const root = cleanPath(MATERIALS_R2_ROOT);

  if (!root) return normalized;
  if (normalized === root) return "";
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1);

  return normalized;
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
  const fileName = safeFileName(input.fileName) || `material-${Date.now()}`;
  return [cleanPath(MATERIALS_R2_ROOT), relativeSection, String(new Date().getFullYear()), `${crypto.randomUUID()}-${fileName}`]
    .filter(Boolean)
    .join("/");
}
