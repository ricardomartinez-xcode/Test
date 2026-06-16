export const MATERIALS_R2_ROOT = "psicologia";

export const DEFAULT_R2_FOLDER_DESTINATIONS = [
  "psicologia/Alteraciones de la conducta",
  "psicologia/Compendio de Psicología",
  "psicologia/Compendio de Psicología/Articulos de Investigación",
  "psicologia/Compendio de Psicología/Criminología",
  "psicologia/Compendio de Psicología/Pscopatologías",
  "psicologia/Compendio de Psicología/Psicologia educativa",
  "psicologia/Compendio de Psicología/Psicología Clínica",
  "psicologia/Compendio de Psicología/Psicología general",
  "psicologia/Compendio de Psicología/Psicología organizacional",
  "psicologia/Compendio de Psicología/Test, cuestionarios, etc",
  "psicologia/Evaluacion Psicológica I",
  "psicologia/Procesos Grupales",
  "psicologia/Teorias del Aprendizaje",
];

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

  if (keyForAlias(normalizedParts[0]) !== MATERIALS_R2_ROOT) {
    normalizedParts.unshift(MATERIALS_R2_ROOT);
  } else {
    normalizedParts[0] = MATERIALS_R2_ROOT;
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
