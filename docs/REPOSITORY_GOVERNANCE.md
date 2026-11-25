# Gobernanza del repositorio — documentación y scripts

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento, otro Markdown, un script, un guard o un comando de `package.json` sin autorización explícita del propietario para el cambio concreto. El permiso para corregir fichas o ejecutar pruebas no concede permiso para ampliar herramientas ni documentación.

**Propietario:** autorización de cambios en la superficie operativa del repositorio. Esta guía no redefine arquitectura, contratos, calidad del catálogo ni procedimientos de publicación.

## Inicio de cualquier intervención

1. Leer `README.md`, esta guía y el documento propietario del trabajo. Para continuar con las fichas, leer `docs/CATALOG_QUALITY.md`; para la operativa de extracción y publicación, `docs/CATALOG_OPERATIONS.md`.
2. Consultar los auditores y guards existentes para establecer el estado real, con su universo, procedencia y límites. Las fuentes no evaluadas nunca cuentan como conformes.
3. Elegir la causa productiva corregible de mayor prioridad conforme al procedimiento del documento propietario, sin abrir frentes nuevos por iniciativa propia.
4. Modificar solo los módulos necesarios, reutilizando los existentes. No crear scripts, documentos, comandos o guards por comodidad.
5. Ejecutar pruebas relevantes y comparar el antes/después sobre poblaciones equivalentes. Si falta evidencia, informar el bloqueo y no inventar una solución ni un `PASS`.

Una petición de análisis o planificación **no autoriza cambios**. Una petición de mejora de fichas autoriza trabajar en el código productivo de ese frente, no alterar contratos, fuentes originales, publicaciones, auditorías o reglas de gobernanza. Las decisiones humanas siguen exigiendo aprobación expresa.

## RULES — DOCUMENTATION

- El inventario autorizado de **17 archivos `.md`** está en `guards/governance/repository-governance.json` (`allowedPaths.markdown`, `maxCounts.markdown`). El guard bloquea rutas nuevas no inventariadas y superar la cuota, incluso si se sustituye un documento por otro. **No calcula hashes ni bloquea ediciones de contenido**. La política humana exige autorización explícita también para editar, mover o eliminar documentos; el guard no puede comprobar por sí solo ese permiso ni detectar todas las bajas.
- Un único documento debe ser propietario de cada responsabilidad. Los cambios autorizados actualizan el documento existente; no se crean informes de ejecución, diarios de continuidad o documentos históricos por intervención.
- **Única excepción histórica autorizada:** [`RIP_ZIP_DISFRAZADO.md`](RIP_ZIP_DISFRAZADO.md), registro del hallazgo del 23-11-2026 sobre dependencias indirectas de catálogos en `testing`. No abre una categoría de documentación histórica ni autoriza futuras altas sin permiso específico.
- Quedan prohibidos nombres de archivo que identifiquen fases (`FASE_12`, `F12`, `PHASE-12`, `OPERATIVA_F8` y equivalentes), sea cual sea su extensión o directorio. Las fases son una forma temporal de trabajar, no estructura permanente del repositorio.
- No crear Markdown temporales, diarios de ejecución ni documentos de fase. La raíz `reports/` no se versiona y el guard impide rastrearla en Git; los auditores de cobertura editorial, conocimiento editorial y batería escriben salidas en `catalogs/reports/`, no en `docs/`. El panel local **ya existe** y lee informes versionados y la caché de clasificación técnica del corte. No atribuir una retención uniforme a todos los informes ni confundir esa caché con una publicación o acreditación nueva; ver [Panel local](COMMERCIAL_EXPORT.md#panel-local-de-evidencias).

## RULES — SCRIPTS

- El inventario autorizado incluye **57 rutas** de scripts, auxiliares, pruebas y declaraciones de tipos clasificadas por `guards/governance/tests-repository-governance-guard.mjs`: `scripts/`, `guards/`, herramientas externas, `bin/` y entradas de raíz. `allowedPaths.scripts` y `maxCounts.scripts` protegen rutas y cantidad, **no el contenido**. Los registros TypeScript de intervención permanente en `src/catalog/interventions/records/` son código productivo: no se cuentan entre esos 57; añadirlos requiere autorización específica y el procedimiento de [Intervenciones](INTERVENTIONS.md).
- Los **58 comandos npm** de `package.json` y su campo `bin` también están protegidos. El guard compara los nombres **y valores** de los comandos npm y la definición de `bin`; cualquier alta, edición o baja de esas entradas requiere **autorización explícita y específica**. Para Markdown y scripts inventariados, esa autorización es igualmente obligatoria por política aunque el guard permita modificar el contenido.
- Antes de solicitar autorización, acreditar qué problema productivo no resuelve ninguna pieza existente, quién consumirá el archivo, qué sustituye, cómo se prueba y qué mantenimiento adicional introduce. Se prefiere modificar la responsabilidad ya existente cuando el permiso lo permita.
- **No se permiten scripts temporales**, tampoco dentro de `storage/interventions/` para campañas nuevas, ni documentación temporal. El guard comprueba patrones de nombres temporales y archivos no autorizados en las superficies que inspecciona. No detecta toda conducta semánticamente temporal ni toda alta TypeScript bajo `src/`; esa prohibición sigue siendo una regla de autorización y revisión. Una autorización expresa para un alta permanente exige actualizar inventario y pruebas, sin introducir excepciones abiertas ni cambiar cuotas para ocultar infracciones.

## Contrato verificable y límites

`node guards/governance/tests-repository-governance-guard.mjs` inspecciona el árbol (excluye directorios operativos como `node_modules/`, `dist/` y `storage/`); `npm test` lo ejecuta antes del resto y después ejecuta sus autopruebas. Valida límites y rutas autorizadas de Markdown/scripts; los nombres y valores de comandos npm, `bin`; los nombres de fases y temporales; y, si existe índice Git, el seguimiento prohibido de `reports/`. También rechaza archivos de tipos inesperados en `docs/`, `guards/` y `scripts/`. **No usa SHA-256 de Markdown ni scripts; editar su contenido no causa infracción automática.**

La protección real contra alteraciones del **propio inventario, el guard o el comando `test`** requiere revisión obligatoria del propietario y controles de integración/ramas protegidas. Un guard local no puede verificar que hubo autorización humana ni impedir que alguien cambie o deje de ejecutar el propio guard; nunca presentar esa limitación como seguridad absoluta.

No se permite aumentar una cuota para hacer desaparecer un fallo. Si un cambio está autorizado, registrar en la revisión la razón, el alcance y la diferencia exacta de inventario, actualizar el contrato cuando proceda y comprobar las pruebas negativas. El guard no sustituye la revisión humana de bajas o ediciones permitidas por el contrato. Si no está autorizado, se rechaza la modificación y se vuelve al código productivo pertinente.

La dirección y prioridades de calidad pertenecen exclusivamente a [Calidad del catálogo](CATALOG_QUALITY.md). No crear aquí un backlog paralelo ni otro sistema de avisos.
