"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ConfigColumn } from "@/lib/domain";

type SupabaseBrowser = NonNullable<ReturnType<typeof createSupabaseBrowserClient>>;
type AdminTab = "general" | "courses" | "sections" | "materials" | "users" | "legacy";
type CardSize = "compact" | "medium" | "large";

type CourseConfig = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  cardSize: CardSize;
  active: boolean;
};

type SectionConfig = {
  id: string;
  name: string;
  path: string;
  color: string;
  icon: string;
  cardSize: CardSize;
  previewStyle: string;
  active: boolean;
};

type AppProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  control_number: string | null;
  role: "student" | "admin" | "owner";
  active: boolean;
  can_edit_tasks: boolean;
  can_delete_tasks: boolean;
};

type AdminHubProps = {
  courses: CourseConfig[];
  sections: SectionConfig[];
  columns: ConfigColumn[];
  supabase: SupabaseBrowser | null;
  reload: () => Promise<void>;
  onCourses: (courses: CourseConfig[]) => void;
  onSections: (sections: SectionConfig[]) => void;
  onError: (error: string | null) => void;
};

const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: "general", label: "General", icon: "▣" },
  { id: "courses", label: "Materias", icon: "◉" },
  { id: "sections", label: "Secciones", icon: "▤" },
  { id: "materials", label: "Materiales", icon: "⬡" },
  { id: "users", label: "Usuarios", icon: "☷" },
  { id: "legacy", label: "Legacy", icon: "⌁" },
];

export function AdminHub({ courses, sections, columns, supabase, reload, onCourses, onSections, onError }: AdminHubProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("general");
  const [profiles, setProfiles] = useState<AppProfileRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (activeTab === "users") void loadProfiles();
  }, [activeTab]);

  async function loadProfiles() {
    if (!supabase) return;
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("app_profiles")
      .select("id,email,full_name,control_number,role,active,can_edit_tasks,can_delete_tasks")
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) onError(error.message);
    else setProfiles((data ?? []) as AppProfileRow[]);
    setLoadingUsers(false);
  }

  async function updateCourse(id: string, patch: Partial<CourseConfig>) {
    onCourses(courses.map((course) => (course.id === id ? { ...course, ...patch } : course)));
    if (!supabase) return;
    const { error } = await supabase.from("courses").update(toDbPatch(patch)).eq("id", id);
    if (error) onError(error.message);
  }

  async function updateSection(id: string, patch: Partial<SectionConfig>) {
    onSections(sections.map((section) => (section.id === id ? { ...section, ...patch } : section)));
    if (!supabase) return;
    const { error } = await supabase.from("material_sections").update(toDbPatch(patch)).eq("id", id);
    if (error) onError(error.message);
  }

  async function updateProfile(id: string, patch: Partial<AppProfileRow>) {
    setProfiles((current) => current.map((profile) => (profile.id === id ? { ...profile, ...patch } : profile)));
    if (!supabase) return;
    const { error } = await supabase.from("app_profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) onError(error.message);
  }

  const stats = useMemo(() => {
    return {
      courses: courses.length,
      sections: sections.length,
      activeSections: sections.filter((section) => section.active).length,
      legacyColumns: columns.length,
      activeLegacyColumns: columns.filter((column) => column.active).length,
    };
  }, [courses, sections, columns]);

  return (
    <div className="adminHub">
      <section className="adminHero">
        <div>
          <p className="eyebrow">Admin 2.0</p>
          <h2>Centro de configuración</h2>
          <p>Administra apariencia, materiales, usuarios y estructura sin tocar código.</p>
        </div>
        <button type="button" onClick={() => void reload()}>Actualizar datos</button>
      </section>

      <nav className="adminTabs" aria-label="Módulos de administración">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
            <span>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "general" ? <GeneralPanel stats={stats} /> : null}
      {activeTab === "courses" ? <CoursesPanel courses={courses} onUpdate={(id, patch) => void updateCourse(id, patch)} /> : null}
      {activeTab === "sections" ? <SectionsPanel sections={sections} onUpdate={(id, patch) => void updateSection(id, patch)} /> : null}
      {activeTab === "materials" ? <MaterialUploadPanel sections={sections} supabase={supabase} reload={reload} onError={onError} /> : null}
      {activeTab === "users" ? <UsersPanel profiles={profiles} loading={loadingUsers} onReload={() => void loadProfiles()} onUpdate={(id, patch) => void updateProfile(id, patch)} /> : null}
      {activeTab === "legacy" ? <LegacyPanel columns={columns} /> : null}
    </div>
  );
}

function GeneralPanel({ stats }: { stats: { courses: number; sections: number; activeSections: number; legacyColumns: number; activeLegacyColumns: number } }) {
  return (
    <section className="adminPanelGrid">
      <MetricCard label="Materias" value={stats.courses} help="Catálogo visual para tareas y calendario" />
      <MetricCard label="Secciones" value={stats.sections} help={`${stats.activeSections} visibles`} />
      <MetricCard label="Columnas legacy" value={stats.legacyColumns} help={`${stats.activeLegacyColumns} activas`} />
      <MetricCard label="Storage" value="R2" help="Subidas directas desde Admin" />
    </section>
  );
}

function MetricCard({ label, value, help }: { label: string; value: string | number; help: string }) {
  return <article className="metricCard"><span>{label}</span><strong>{value}</strong><small>{help}</small></article>;
}

function CoursesPanel({ courses, onUpdate }: { courses: CourseConfig[]; onUpdate: (id: string, patch: Partial<CourseConfig>) => void }) {
  return (
    <section className="adminCard">
      <div className="adminCardHead"><div><h3>Materias</h3><p>Define colores, iconos, tamaño y visibilidad en calendario/listas.</p></div></div>
      <div className="adminRows">
        {courses.map((course) => (
          <div className="adminEditRow" key={course.id}>
            <span className="swatch" style={{ background: course.color }} />
            <strong>{course.name}</strong>
            <input aria-label="Color" type="color" value={course.color} onChange={(event) => onUpdate(course.id, { color: event.target.value })} />
            <input aria-label="Icono" value={course.icon} onChange={(event) => onUpdate(course.id, { icon: event.target.value })} />
            <select aria-label="Tamaño" value={course.cardSize} onChange={(event) => onUpdate(course.id, { cardSize: event.target.value as CardSize })}>
              <option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option>
            </select>
            <label className="adminSwitch"><input type="checkbox" checked={course.active} onChange={(event) => onUpdate(course.id, { active: event.target.checked })} />Activa</label>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionsPanel({ sections, onUpdate }: { sections: SectionConfig[]; onUpdate: (id: string, patch: Partial<SectionConfig>) => void }) {
  return (
    <section className="adminCard">
      <div className="adminCardHead"><div><h3>Secciones de materiales</h3><p>Personaliza carpetas y subsecciones del asset R2.</p></div></div>
      <div className="adminRows">
        {sections.map((section) => (
          <div className="adminEditRow section" key={section.id}>
            <span className="swatch" style={{ background: section.color }} />
            <div className="adminNameBlock"><strong>{section.name}</strong><small>{section.path}</small></div>
            <input aria-label="Color" type="color" value={section.color} onChange={(event) => onUpdate(section.id, { color: event.target.value })} />
            <input aria-label="Icono" value={section.icon} onChange={(event) => onUpdate(section.id, { icon: event.target.value })} />
            <select aria-label="Tamaño" value={section.cardSize} onChange={(event) => onUpdate(section.id, { cardSize: event.target.value as CardSize })}>
              <option value="compact">Compacta</option><option value="medium">Media</option><option value="large">Grande</option>
            </select>
            <select aria-label="Preview" value={section.previewStyle} onChange={(event) => onUpdate(section.id, { previewStyle: event.target.value })}>
              <option value="none">Sin preview</option><option value="icon">Icono</option><option value="thumbnail">Miniatura</option><option value="embedded">Embebido</option>
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

function MaterialUploadPanel({ sections, supabase, reload, onError }: { sections: SectionConfig[]; supabase: SupabaseBrowser | null; reload: () => Promise<void>; onError: (error: string | null) => void }) {
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sectionId && sections[0]) setSectionId(sections[0].id);
  }, [sections, sectionId]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const section = sections.find((item) => item.id === sectionId);
    if (!file || !section || !supabase) {
      onError("Selecciona un archivo y una sección válida.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream", sectionPath: section.path }),
      });
      const body = await response.json() as { key?: string; uploadUrl?: string; publicUrl?: string | null; error?: string };
      if (!response.ok || !body.uploadUrl || !body.key) throw new Error(body.error ?? "No se pudo preparar la subida.");
      const upload = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!upload.ok) throw new Error("R2 rechazó el archivo.");
      const { error } = await supabase.from("materials").insert({
        section_id: sectionId,
        title: title || file.name,
        file_name: file.name,
        material_type: file.type.includes("pdf") ? "PDF" : "Archivo",
        provider: "r2",
        r2_key: body.key,
        source_url: body.publicUrl,
        preview_url: body.publicUrl,
        content_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw new Error(error.message);
      setTitle("");
      setFile(null);
      await reload();
    } catch (error) {
      onError(error instanceof Error ? error.message : "No se pudo subir el material.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="adminCard">
      <div className="adminCardHead"><div><h3>Subir material</h3><p>Guarda el archivo en R2 y registra la metadata en Supabase.</p></div></div>
      <form className="adminUpload" onSubmit={submit}>
        <label>Sección<select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>{sections.map((section) => <option key={section.id} value={section.id}>{section.path}</option>)}</select></label>
        <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Opcional" /></label>
        <label>Archivo<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        <button className="primaryAction" disabled={busy} type="submit">{busy ? "Subiendo..." : "Subir a R2"}</button>
      </form>
    </section>
  );
}

function UsersPanel({ profiles, loading, onReload, onUpdate }: { profiles: AppProfileRow[]; loading: boolean; onReload: () => void; onUpdate: (id: string, patch: Partial<AppProfileRow>) => void }) {
  return (
    <section className="adminCard">
      <div className="adminCardHead"><div><h3>Usuarios</h3><p>Consulta perfiles, roles y permisos operativos.</p></div><button type="button" onClick={onReload}>{loading ? "Cargando..." : "Recargar"}</button></div>
      <div className="adminUserList">
        {profiles.map((profile) => (
          <article className="adminUserRow" key={profile.id}>
            <div><strong>{profile.full_name ?? profile.email}</strong><small>{profile.email} · {profile.control_number ?? "sin control"}</small></div>
            <select value={profile.role} onChange={(event) => onUpdate(profile.id, { role: event.target.value as AppProfileRow["role"] })}>
              <option value="student">Alumno</option><option value="admin">Admin</option><option value="owner">Owner</option>
            </select>
            <label><input type="checkbox" checked={profile.active} onChange={(event) => onUpdate(profile.id, { active: event.target.checked })} />Activo</label>
            <label><input type="checkbox" checked={profile.can_edit_tasks} onChange={(event) => onUpdate(profile.id, { can_edit_tasks: event.target.checked })} />Edita</label>
          </article>
        ))}
        {!profiles.length && !loading ? <p className="muted">No se pudieron cargar usuarios o no hay permisos RLS para leerlos.</p> : null}
      </div>
    </section>
  );
}

function LegacyPanel({ columns }: { columns: ConfigColumn[] }) {
  return (
    <section className="adminCard">
      <div className="adminCardHead"><div><h3>Columnas legacy</h3><p>Referencia de configuración migrada desde AppSheet/Sheets.</p></div></div>
      <div className="legacyGrid">{columns.map((column) => <span className="configPill" key={column.key}>{column.name}: {column.active ? "SI" : "NO"}</span>)}</div>
    </section>
  );
}

function toDbPatch(patch: Partial<CourseConfig> | Partial<SectionConfig>) {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("color" in patch) out.color = patch.color;
  if ("icon" in patch) out.icon = patch.icon;
  if ("cardSize" in patch) out.card_size = patch.cardSize;
  if ("previewStyle" in patch) out.preview_style = patch.previewStyle;
  if ("active" in patch) out.active = patch.active;
  return out;
}
