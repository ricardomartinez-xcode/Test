"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./academic-manager.module.css";

type CardSize = "compact" | "medium" | "large";
type Course = {
  id: string;
  name: string;
  short_name: string | null;
  color: string;
  icon: string;
  card_size: CardSize;
  active: boolean;
  sort_order: number;
};
type Student = {
  id: string;
  email: string;
  full_name: string | null;
  control_number: string | null;
  role: "student";
  active: boolean;
  created_at: string;
};
type ManagerProfile = {
  id: string;
  email: string;
  role: "student" | "admin" | "owner";
  active: boolean;
  can_manage_settings: boolean;
  can_manage_users: boolean;
};
type Notice = { tone: "success" | "error"; message: string } | null;

const INITIAL_COURSE = {
  name: "",
  shortName: "",
  color: "#2563eb",
  icon: "book-open",
  cardSize: "medium" as CardSize,
};
const INITIAL_STUDENT = { fullName: "", email: "", controlNumber: "" };

function courseSort(a: Course, b: Course) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name, "es");
}

export function AcademicManager() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profile, setProfile] = useState<ManagerProfile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseBusy, setCourseBusy] = useState(false);
  const [studentBusy, setStudentBusy] = useState(false);
  const [courseForm, setCourseForm] = useState(INITIAL_COURSE);
  const [studentForm, setStudentForm] = useState(INITIAL_STUDENT);
  const [notice, setNotice] = useState<Notice>(null);

  const canManageCourses = Boolean(profile?.role === "owner" || profile?.can_manage_settings);
  const canManageStudents = Boolean(profile?.role === "owner" || profile?.can_manage_users);

  const loadStudents = useCallback(async () => {
    const response = await fetch("/api/admin/students", {
      credentials: "include",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as { students?: Student[]; error?: string };
    if (!response.ok) throw new Error(payload.error ?? "No se pudo cargar el directorio de alumnos.");
    setStudents(payload.students ?? []);
  }, []);

  const bootstrap = useCallback(async () => {
    if (!supabase) {
      setNotice({ tone: "error", message: "Supabase no está configurado en este entorno." });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Inicia sesión para abrir la gestión académica.");

      const { data: profileData, error: profileError } = await supabase
        .from("app_profiles")
        .select("id,email,role,active,can_manage_settings,can_manage_users")
        .or(`auth_user_id.eq.${user.id},email.eq.${user.email?.toLowerCase() ?? ""}`)
        .maybeSingle();
      if (profileError || !profileData) throw new Error("No se encontró tu perfil administrativo.");

      const manager = profileData as ManagerProfile;
      setProfile(manager);

      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id,name,short_name,color,icon,card_size,active,sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (courseError) throw new Error(courseError.message);
      setCourses(((courseData ?? []) as Course[]).sort(courseSort));

      if (manager.role === "owner" || manager.can_manage_users) {
        await loadStudents();
      }
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo abrir la gestión académica.",
      });
    } finally {
      setLoading(false);
    }
  }, [loadStudents, supabase]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !canManageCourses) return;

    const name = courseForm.name.trim();
    if (!name) {
      setNotice({ tone: "error", message: "Escribe el nombre de la materia." });
      return;
    }

    setCourseBusy(true);
    setNotice(null);
    try {
      const nextSortOrder = courses.reduce((maximum, course) => Math.max(maximum, course.sort_order ?? 0), 0) + 1;
      const { data, error } = await supabase
        .from("courses")
        .insert({
          name,
          short_name: courseForm.shortName.trim() || null,
          color: courseForm.color,
          icon: courseForm.icon.trim() || "book-open",
          card_size: courseForm.cardSize,
          active: true,
          sort_order: nextSortOrder,
        })
        .select("id,name,short_name,color,icon,card_size,active,sort_order")
        .single();
      if (error) throw new Error(error.message);

      setCourses((current) => [...current, data as Course].sort(courseSort));
      setCourseForm(INITIAL_COURSE);
      setNotice({ tone: "success", message: "Materia creada y disponible para asignar tareas." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la materia." });
    } finally {
      setCourseBusy(false);
    }
  }

  async function toggleCourse(course: Course) {
    if (!supabase || !canManageCourses) return;

    setNotice(null);
    const { error } = await supabase
      .from("courses")
      .update({ active: !course.active, updated_at: new Date().toISOString() })
      .eq("id", course.id);

    if (error) {
      setNotice({ tone: "error", message: error.message });
      return;
    }

    setCourses((current) => current.map((item) => (item.id === course.id ? { ...item, active: !item.active } : item)));
    setNotice({ tone: "success", message: `${course.name} fue ${course.active ? "desactivada" : "reactivada"}.` });
  }

  async function inviteStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageStudents) return;

    setStudentBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(studentForm),
      });
      const payload = (await response.json().catch(() => ({}))) as { student?: Student; message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No se pudo invitar al alumno.");

      if (payload.student) {
        setStudents((current) => [payload.student!, ...current].sort((a, b) => a.full_name?.localeCompare(b.full_name ?? "", "es") ?? 0));
      }
      setStudentForm(INITIAL_STUDENT);
      setNotice({ tone: "success", message: payload.message ?? "Invitación enviada al alumno." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "No se pudo invitar al alumno." });
    } finally {
      setStudentBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-busy={loading}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>PSCV Room · Administración</p>
            <h1>Materias y alumnos</h1>
            <p className={styles.lead}>Crea materias, invita alumnos por correo y consulta el directorio del grupo.</p>
          </div>
          <Link className={styles.backLink} href="/">Volver al espacio</Link>
        </header>

        {notice ? <p className={notice.tone === "error" ? styles.error : styles.success}>{notice.message}</p> : null}

        {loading ? <p className={styles.loading}>Cargando configuración académica…</p> : null}

        {!loading && !profile ? (
          <section className={styles.accessCard}>
            <h2>Acceso requerido</h2>
            <p>Inicia sesión con una cuenta administradora u owner para continuar.</p>
            <Link href="/">Ir a iniciar sesión</Link>
          </section>
        ) : null}

        {!loading && profile ? (
          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Catálogo</p>
                  <h2>Agregar materia</h2>
                </div>
                <span className={styles.counter}>{courses.length} registradas</span>
              </div>

              {canManageCourses ? (
                <form className={styles.form} onSubmit={createCourse}>
                  <label>
                    Nombre de la materia
                    <input
                      value={courseForm.name}
                      onChange={(event) => setCourseForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Ej. Psicología del desarrollo"
                      required
                    />
                  </label>
                  <label>
                    Nombre corto
                    <input
                      value={courseForm.shortName}
                      onChange={(event) => setCourseForm((current) => ({ ...current, shortName: event.target.value }))}
                      placeholder="Ej. Desarrollo"
                    />
                  </label>
                  <label>
                    Color
                    <span className={styles.colorField}>
                      <input
                        aria-label="Color de la materia"
                        type="color"
                        value={courseForm.color}
                        onChange={(event) => setCourseForm((current) => ({ ...current, color: event.target.value }))}
                      />
                      <code>{courseForm.color}</code>
                    </span>
                  </label>
                  <label>
                    Icono
                    <input
                      value={courseForm.icon}
                      onChange={(event) => setCourseForm((current) => ({ ...current, icon: event.target.value }))}
                      placeholder="book-open"
                    />
                  </label>
                  <label>
                    Tamaño de tarjeta
                    <select
                      value={courseForm.cardSize}
                      onChange={(event) => setCourseForm((current) => ({ ...current, cardSize: event.target.value as CardSize }))}
                    >
                      <option value="compact">Compacta</option>
                      <option value="medium">Media</option>
                      <option value="large">Grande</option>
                    </select>
                  </label>
                  <button className={styles.primaryButton} type="submit" disabled={courseBusy}>
                    {courseBusy ? "Guardando…" : "Crear materia"}
                  </button>
                </form>
              ) : (
                <p className={styles.muted}>Tu perfil no tiene permiso para modificar el catálogo de materias.</p>
              )}

              <div className={styles.courseList}>
                {courses.map((course) => (
                  <article className={styles.courseRow} key={course.id}>
                    <span className={styles.swatch} style={{ backgroundColor: course.color }} aria-hidden="true" />
                    <div>
                      <strong>{course.name}</strong>
                      <small>{course.short_name || course.icon} · {course.card_size}</small>
                    </div>
                    <button
                      type="button"
                      className={course.active ? styles.secondaryButton : styles.outlineButton}
                      onClick={() => void toggleCourse(course)}
                      disabled={!canManageCourses}
                    >
                      {course.active ? "Desactivar" : "Reactivar"}
                    </button>
                  </article>
                ))}
                {!courses.length ? <p className={styles.muted}>Aún no hay materias registradas.</p> : null}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.kicker}>Directorio</p>
                  <h2>Agregar alumno</h2>
                </div>
                <span className={styles.counter}>{students.length} alumnos</span>
              </div>

              {canManageStudents ? (
                <form className={styles.form} onSubmit={inviteStudent}>
                  <label>
                    Nombre completo
                    <input
                      value={studentForm.fullName}
                      onChange={(event) => setStudentForm((current) => ({ ...current, fullName: event.target.value }))}
                      placeholder="Nombre y apellidos"
                      required
                    />
                  </label>
                  <label>
                    Correo institucional
                    <input
                      type="email"
                      value={studentForm.email}
                      onChange={(event) => setStudentForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="alumno@correo.edu.mx"
                      required
                    />
                  </label>
                  <label>
                    Número de control
                    <input
                      value={studentForm.controlNumber}
                      onChange={(event) => setStudentForm((current) => ({ ...current, controlNumber: event.target.value }))}
                      placeholder="Opcional"
                    />
                  </label>
                  <button className={styles.primaryButton} type="submit" disabled={studentBusy}>
                    {studentBusy ? "Enviando invitación…" : "Invitar alumno"}
                  </button>
                </form>
              ) : (
                <p className={styles.muted}>Tu perfil no tiene permiso para invitar alumnos.</p>
              )}

              <div className={styles.studentList}>
                {students.map((student) => (
                  <article className={styles.studentRow} key={student.id}>
                    <div>
                      <strong>{student.full_name || student.email}</strong>
                      <small>{student.email}{student.control_number ? ` · ${student.control_number}` : ""}</small>
                    </div>
                    <span className={student.active ? styles.activePill : styles.inactivePill}>{student.active ? "Activo" : "Inactivo"}</span>
                  </article>
                ))}
                {!students.length && canManageStudents ? <p className={styles.muted}>No hay alumnos en el directorio todavía.</p> : null}
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
