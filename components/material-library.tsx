"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, FileText, LayoutGrid, List } from "lucide-react";
import { seedMaterials } from "@/lib/seed";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/client";

type PreviewSize = "small" | "medium" | "large";

type LibrarySection = {
  id: string;
  name: string;
  path: string;
  color: string | null;
  icon: string | null;
  card_size: string | null;
  preview_style: string | null;
  sort_order: number | null;
  material_count: number;
};

type LibraryMaterial = {
  id: string;
  title: string;
  material_type: string | null;
  provider: string | null;
  source_url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  public_url: string | null;
  r2_key: string | null;
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  section_id: string | null;
  section: LibrarySection | null;
};

type LibraryResponse = {
  ok: boolean;
  query: string;
  sectionId: string;
  summary: {
    sections: number;
    materials: number;
    providers: Record<string, number>;
  };
  sections: LibrarySection[];
  materials: LibraryMaterial[];
  error?: string;
};

type MaterialLibraryProps = {
  previewSize: PreviewSize;
  globalQuery?: string;
};

const allSectionId = "all";
const hasSupabaseConfig = hasSupabaseBrowserConfig();

export function MaterialLibrary({ previewSize, globalQuery = "" }: MaterialLibraryProps) {
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [query, setQuery] = useState(globalQuery);
  const [sectionId, setSectionId] = useState(allSectionId);
  const [view, setView] = useState<"library" | "list">("library");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(globalQuery);
  }, [globalQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void loadLibrary(controller.signal);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, sectionId]); // eslint-disable-line react-hooks/exhaustive-deps -- query and section changes own the reload lifecycle.

  async function loadLibrary(signal?: AbortSignal) {
    if (!hasSupabaseConfig) {
      setLoading(false);
      setError(null);
      setData(buildDemoLibrary(query, allSectionId));
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("limit", "400");

    try {
      const response = await fetch(`/api/materials/library?${params.toString()}`, {
        credentials: "include",
        signal,
      });
      const body = (await response.json()) as LibraryResponse;
      if (!response.ok || !body.ok) throw new Error(body.error ?? "No se pudo cargar la biblioteca.");
      setData(body);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la biblioteca.");
    } finally {
      setLoading(false);
    }
  }

  const visibleSections = useMemo(() => normalizeVisibleSections(data?.sections ?? []), [data]);
  const selectedSection = useMemo(() => {
    if (sectionId === allSectionId) return null;
    return visibleSections.find((section) => section.id === sectionId) ?? null;
  }, [sectionId, visibleSections]);
  const materials = useMemo(() => {
    const rows = data?.materials ?? [];
    if (sectionId === allSectionId) return rows;
    const selected = visibleSections.find((section) => section.id === sectionId);
    if (!selected) return [];
    return rows.filter((material) => material.section ? normalizedSectionId(material.section) === selected.id : false);
  }, [data, sectionId, visibleSections]);

  useEffect(() => {
    if (sectionId !== allSectionId && data && !visibleSections.some((section) => section.id === sectionId)) {
      setSectionId(allSectionId);
    }
  }, [data, sectionId, visibleSections]);

  return (
    <div className={`libraryShell preview-${previewSize}`}>
      <section className="libraryHero">
        <div>
          <p className="eyebrow">Biblioteca R2</p>
          <h2>{selectedSection ? selectedSection.name : "Materiales de clase"}</h2>
          <p>{selectedSection ? selectedSection.path : "Explora carpetas, filtra por sección y abre assets directamente desde R2."}</p>
        </div>
        <div className="libraryStats">
          <strong>{materials.length}</strong>
          <span>assets R2</span>
        </div>
      </section>

      <section className="libraryToolbar">
        <label className="librarySearch">
          <span>Buscar</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, carpeta o tipo" />
        </label>
        <label className="libraryFilter">
          <span>Sección</span>
          <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
            <option value={allSectionId}>Todas las secciones</option>
            {visibleSections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name} ({section.material_count})
              </option>
            ))}
          </select>
        </label>
        <div className="libraryViewToggle" aria-label="Vista">
          <button className={view === "library" ? "active" : ""} aria-label="Vista tarjetas" title="Tarjetas" type="button" onClick={() => setView("library")}><LayoutGrid size={16} /></button>
          <button className={view === "list" ? "active" : ""} aria-label="Vista lista" title="Lista" type="button" onClick={() => setView("list")}><List size={16} /></button>
        </div>
      </section>

      {data && sectionId === allSectionId && !query.trim() ? (
        <section className="sectionRail" aria-label="Secciones">
          {visibleSections.map((section) => (
            <button key={section.id} type="button" className="sectionCard" onClick={() => setSectionId(section.id)} style={{ borderColor: section.color ?? "#4285dc" }}>
              <span className="sectionIcon" style={{ background: section.color ?? "#4285dc" }}>{section.icon?.slice(0, 2) ?? "R2"}</span>
              <strong>{section.name}</strong>
              <small>{section.material_count} assets</small>
            </button>
          ))}
        </section>
      ) : null}

      {loading ? <LibrarySkeleton /> : null}
      {error ? <div className="systemBanner">{error}</div> : null}

      {!loading && !error && materials.length === 0 ? (
        <section className="emptyLibrary">
          <strong>No encontré assets R2</strong>
          <p>Prueba con otro término o selecciona otra sección.</p>
        </section>
      ) : null}

      {!loading && !error && materials.length > 0 ? (
        <section className={view === "library" ? "materialGrid" : "materialListV2"}>
          {materials.map((material) => (
            <MaterialCard key={material.id} material={material} view={view} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function MaterialCard({ material, view }: { material: LibraryMaterial; view: "library" | "list" }) {
  const section = material.section;
  const color = section?.color ?? "#4285dc";
  const previewUrl = material.preview_url ?? material.thumbnail_url ?? material.source_url;
  const openUrl = material.public_url ?? material.preview_url ?? material.source_url;
  const isPublicR2 = Boolean(openUrl?.includes("r2.dev") || openUrl?.includes("/api/materials/"));
  const fileType = material.material_type ?? material.content_type?.split("/").at(-1)?.toUpperCase() ?? "PDF";
  const isPdf = (material.content_type ?? material.file_name ?? material.title).toLowerCase().includes("pdf");
  const isImage = Boolean((material.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(material.file_name ?? material.title));
  const size = formatBytes(material.size_bytes);
  const path = material.r2_key ?? section?.path ?? material.file_name ?? "Sin ruta R2";

  return (
    <article className={`materialCardV2 ${view === "list" ? "list" : ""}`} style={{ borderColor: color }}>
      <MaterialThumbnail material={material} color={color} previewUrl={previewUrl} isPdf={isPdf} isImage={isImage} fileType={fileType} />
      <div className="materialContent">
        <div className="materialMetaLine">
          <span style={{ color }}>{section?.name ?? "Material"}</span>
          <span>{isPublicR2 ? "R2" : "link"}</span>
          {size ? <span>{size}</span> : null}
        </div>
        <strong title={material.title}>{cleanTitle(material.title)}</strong>
        <small title={path}>{path}</small>
      </div>
      <div className="materialActions">
        {previewUrl ? <a href={previewUrl} aria-label={`Previsualizar ${material.title}`} title="Previsualizar" target="_blank" rel="noreferrer"><Eye size={16} /></a> : <span><FileText size={16} /></span>}
        {openUrl ? <a href={openUrl} aria-label={`Abrir ${material.title}`} title="Abrir" target="_blank" rel="noreferrer"><ExternalLink size={16} /></a> : null}
      </div>
    </article>
  );
}

function MaterialThumbnail({ material, color, previewUrl, isPdf, isImage, fileType }: { material: LibraryMaterial; color: string; previewUrl: string | null; isPdf: boolean; isImage: boolean; fileType: string }) {
  const thumbnailUrl = material.thumbnail_url ?? (isImage ? previewUrl : null);

  if (thumbnailUrl) {
    return (
      <div className="materialThumb hasPreview" style={{ background: `${color}14`, color }}>
        <img src={thumbnailUrl} alt="" loading="lazy" />
      </div>
    );
  }

  if (isPdf && previewUrl) {
    return (
      <div className="materialThumb hasPreview pdfPreview" style={{ background: `${color}14`, color }}>
        <iframe title={`Miniatura de ${material.title}`} src={pdfPreviewUrl(previewUrl)} loading="lazy" tabIndex={-1} />
      </div>
    );
  }

  return (
    <div className="materialThumb" style={{ background: `${color}14`, color }} aria-hidden="true">
      <FileText size={20} />
      <span>{isPdf ? "PDF" : fileType.slice(0, 4)}</span>
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <section className="materialGrid" aria-label="Cargando">
      {Array.from({ length: 6 }).map((_, index) => (
        <article className="materialCardV2 skeleton" key={index}>
          <div className="materialThumb" />
          <div className="materialContent"><span /><strong /><small /></div>
        </article>
      ))}
    </section>
  );
}

function cleanTitle(value: string) {
  return value.replace(/^_+/, "").replace(/\.pdf$/i, ".pdf");
}

function formatBytes(value: number | null) {
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function pdfPreviewUrl(value: string) {
  if (value.includes("#")) return value;
  return `${value}#toolbar=0&navpanes=0&scrollbar=0&page=1&view=FitH`;
}

function normalizeVisibleSections(sections: LibrarySection[]) {
  const grouped = new Map<string, LibrarySection>();

  for (const section of sections) {
    if (section.material_count <= 0) continue;
    const id = normalizedSectionId(section);
    const current = grouped.get(id);
    if (!current) {
      grouped.set(id, { ...section, id });
      continue;
    }

    grouped.set(id, {
      ...current,
      material_count: current.material_count + section.material_count,
      path: shortestPath(current.path, section.path),
      color: current.color ?? section.color,
      icon: current.icon ?? section.icon,
      sort_order: Math.min(current.sort_order ?? 0, section.sort_order ?? 0),
    });
  }

  return Array.from(grouped.values()).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "es"));
}

function normalizedSectionId(section: Pick<LibrarySection, "name" | "path">) {
  const parts = section.path.split("/").map((part) => part.trim()).filter(Boolean);
  return `section:${slug(parts.at(-1) ?? section.name)}`;
}

function shortestPath(a: string, b: string) {
  return a.length <= b.length ? a : b;
}

function buildDemoLibrary(query: string, sectionId: string): LibraryResponse {
  const sections = Array.from(new Set(seedMaterials.map((material) => material.folder ?? material.scope))).map((name, index) => {
    const id = slug(name);
    const colors = ["#2f77d0", "#7c3aed", "#0f9f8f", "#d97706", "#dc2626"];
    return {
      id,
      name,
      path: `Psicología/Materiales de clase/${name}`,
      color: colors[index % colors.length],
      icon: "R2",
      card_size: "medium",
      preview_style: "thumbnail",
      sort_order: index,
      material_count: 0,
    } satisfies LibrarySection;
  });

  const sectionByName = new Map(sections.map((section) => [section.name, section]));
  const q = query.trim().toLowerCase();
  let materials = seedMaterials.map((material) => {
    const section = sectionByName.get(material.folder ?? material.scope) ?? sections[0] ?? null;
    return {
      id: material.id,
      title: material.name,
      material_type: material.type,
      provider: "demo",
      source_url: material.url,
      preview_url: material.previewUrl ?? material.url,
      thumbnail_url: null,
      public_url: material.url,
      r2_key: section ? `${section.path}/${material.name}` : material.name,
      file_name: material.name,
      content_type: material.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
      size_bytes: null,
      section_id: section?.id ?? null,
      section,
    } satisfies LibraryMaterial;
  });

  if (sectionId !== allSectionId) materials = materials.filter((material) => material.section_id === sectionId);
  if (q) {
    materials = materials.filter((material) => [material.title, material.file_name, material.section?.name, material.r2_key].some((value) => value?.toLowerCase().includes(q)));
  }

  const countsBySection = seedMaterials.reduce<Record<string, number>>((acc, material) => {
    const section = sectionByName.get(material.folder ?? material.scope);
    if (section) acc[section.id] = (acc[section.id] ?? 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    query,
    sectionId,
    summary: { sections: sections.length, materials: materials.length, providers: { demo: materials.length } },
    sections: sections.map((section) => ({ ...section, material_count: countsBySection[section.id] ?? 0 })),
    materials,
  };
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
