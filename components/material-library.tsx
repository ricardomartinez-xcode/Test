"use client";

import { useEffect, useMemo, useState } from "react";

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
  }, [query, sectionId]);

  async function loadLibrary(signal?: AbortSignal) {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (sectionId !== allSectionId) params.set("sectionId", sectionId);
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

  const selectedSection = useMemo(() => {
    if (!data || sectionId === allSectionId) return null;
    return data.sections.find((section) => section.id === sectionId) ?? null;
  }, [data, sectionId]);

  const visibleSections = data?.sections.filter((section) => section.material_count > 0) ?? [];
  const materials = data?.materials ?? [];

  return (
    <div className={`libraryShell preview-${previewSize}`}>
      <section className="libraryHero">
        <div>
          <p className="eyebrow">Biblioteca R2</p>
          <h2>{selectedSection ? selectedSection.name : "Materiales de clase"}</h2>
          <p>{selectedSection ? selectedSection.path : "Explora carpetas, filtra por sección y abre assets directamente desde R2."}</p>
        </div>
        <div className="libraryStats">
          <strong>{data?.summary.materials ?? 0}</strong>
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
          <button className={view === "library" ? "active" : ""} type="button" onClick={() => setView("library")}>Tarjetas</button>
          <button className={view === "list" ? "active" : ""} type="button" onClick={() => setView("list")}>Lista</button>
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
  const previewUrl = material.r2_key ? `/api/materials/${material.id}/file?mode=preview` : null;
  const openUrl = material.r2_key ? `/api/materials/${material.id}/file?mode=download` : null;
  const fileType = material.material_type ?? material.content_type?.split("/").at(-1)?.toUpperCase() ?? "PDF";
  const isPdf = (material.content_type ?? material.file_name ?? material.title).toLowerCase().includes("pdf");
  const size = formatBytes(material.size_bytes);
  const path = material.r2_key ?? section?.path ?? material.file_name ?? "Sin ruta R2";

  return (
    <article className={`materialCardV2 ${view === "list" ? "list" : ""}`} style={{ borderColor: color }}>
      <div className="materialThumb" style={{ background: `${color}14`, color }} aria-hidden="true">
        <span>{isPdf ? "PDF" : fileType.slice(0, 4)}</span>
      </div>
      <div className="materialContent">
        <div className="materialMetaLine">
          <span style={{ color }}>{section?.name ?? "Material"}</span>
          <span>R2</span>
          {size ? <span>{size}</span> : null}
        </div>
        <strong title={material.title}>{cleanTitle(material.title)}</strong>
        <small title={path}>{path}</small>
      </div>
      <div className="materialActions">
        {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer">Preview</a> : <span>No R2</span>}
        {openUrl ? <a href={openUrl} target="_blank" rel="noreferrer">Abrir</a> : null}
      </div>
    </article>
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
