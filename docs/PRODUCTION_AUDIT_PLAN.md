# PSCV Room Production Audit Plan

## Hallazgos

- **Build local bloqueado por ruta:** el checkout original en `/home/ricardo/~\PSCVROOM` rompe Next/Node por el caracter `\` codificado en imports internos. El repo se movio a `/home/ricardo/dev/PSCV-ROOM`.
- **QA visual bloqueado sin Supabase:** en local sin variables, el login queda como unica pantalla y el boton Microsoft queda deshabilitado; no hay modo demo para auditar la app completa.
- **Lint roto:** `next lint` abre una migracion interactiva en Next 15 y falla en CI/local.
- **Audit de seguridad:** Next instala `postcss@8.4.31`, afectado por GHSA-qx2v-qp2m-jg93; `npm audit fix --force` propone bajar Next y no es aceptable.
- **R2 inconsistente:** el presign usa `Psicologia` por defecto y puede duplicar o desviar carpetas segun `section.path`; la raiz debe ser `Psicología/Materiales de clase/`.
- **Materiales sin miniatura real:** la biblioteca muestra chips `PDF`/tipo, no previews visuales del documento cuando existe URL de preview o thumbnail.
- **Calendario con eventos cortados:** los eventos se truncaban a 13 caracteres y no habia detalle al seleccionarlos.
- **UI operativa mejorable:** hay muchos glifos de texto como botones, admin con modulo legacy visible y logout poco explicito.

## Plan de trabajo

1. Normalizar tooling de produccion: lockfile, `typecheck`, ESLint CLI, override seguro de PostCSS y build sin warnings CSS.
2. Mantener Supabase como auth real, pero habilitar modo demo solo cuando no exista configuracion Supabase publica para QA local.
3. Consolidar la experiencia principal tipo workspace: navegacion compacta con iconos, acciones de busqueda/refresco, logout visible y admin como usuario avanzado.
4. Corregir R2 para que toda carga nueva viva bajo `Psicología/Materiales de clase/`, usando rutas relativas de seccion aunque falten carpetas en la tabla.
5. Mostrar materiales como documentos con miniatura: usar `thumbnail_url`, imagen directa o preview embebido para PDFs; mantener acciones compactas de previsualizar/abrir.
6. Rehacer calendario para que los eventos no dependan de truncado manual y al seleccionarse abran panel de detalle con estado, materia, fecha, notas y links.
7. Retirar rutas legacy visibles: eliminar API NextAuth reemplazada y quitar el tab admin legacy.
8. Verificar con TypeScript, ESLint, build, audit y Playwright en desktop/movil antes de push y deploy.
