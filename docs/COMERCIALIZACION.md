# Comercialización desde el scraper

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** La exportación comercial solo usa publicaciones individuales acreditadas y debe bloquear inventarios obsoletos; nunca consumir directamente `technical/active.json` ni hacer elegible una ficha `review` por existir en un snapshot.

El catálogo comercial de EQUIPZILLA **se deriva de las publicaciones individuales acreditadas** (`catalogs/providers/<proveedor>/publications/`), sin modificarlas. Los nuevos snapshots bajo `technical/` sirven a análisis y mejora, no son una fuente de exportación comercial. El scraper decide la elegibilidad, asigna categorías y atributos, prepara los textos y la metadata, y genera exportaciones auditables. El backend recibe los productos y gestiona su persistencia y operación comercial. La exportación **no** escribe en el backend.

## Fuente y contratos

- Fuente: publicación individual acreditada de cada proveedor comercial, contrastada con el **original históricamente acreditado** y con el inventario vigente cuando se prepara una exportación nueva. No utilizar el snapshot `technical/` como fuente de elegibilidad.
- Categorías y `categorySellID`: `data/category/categorySell-flat.json`, respetando jerarquía y condición. Priorizar categorías hoja; admitir una categoría general existente solo con correspondencia semántica acreditada y una regla comercial explícita. Una categoría sin relaciones de atributos no autoriza a inventarlas: conservar las especificaciones técnicas sin cambios.
- Atributos: `data/import/attributeCatalog.json`; usar solo `attributeID` y valores válidos para el tipo, las opciones y la relación con la categoría.
- Logos y empresas por entorno: `data/commercial-reference/`; `logoID` solo con correspondencia inequívoca y `companyID` únicamente con entorno explícito.
- Mantener `providerId`, `reference`, `externalReference` y `sourceUrl`. La referencia comercial visible no identifica por sí sola una máquina.

### Versiones históricas y disponibilidad actual

Un original puede evolucionar por cambios de stock. La auditoría histórica verifica cada publicación individual contra el **origen acreditado por su manifest y SHA-256**, no contra una captura posterior. Por el contrario, la exportación de un inventario actualmente obsoleto **debe bloquearse** hasta reconciliar sus bajas, aunque el histórico sea íntegro. En Gomariz, el corte del 11 de noviembre de 2026 retiró 86 fichas «Sin existencias» y dejó 11 identidades que figuraban en la publicación comercial anterior; no restaurarlas ni ignorar el bloqueo para conseguir `PASS`.

El guard ejecutable `tests-commercial-contract-guard.mjs` protege el contrato comercial v2; se ejecuta con `npm test`, puede invocarse con `npm run contrato:comercial` y se comprueba en la vía de exportación. No sustituye auditoría, identidad, procedencia ni revisión de disponibilidad. Ver [Publicaciones técnicas](TECHNICAL_PUBLICATIONS.md).

## Qué se exporta

- **Excluir lotes de productos y herramientas** identificados mediante evidencia de la ficha. La exclusión no elimina su original ni su publicación técnica. No confundir lotes de venta con lotes operativos del scraper.
- Los accesorios acreditados de uso dependiente de otra máquina quedan fuera de la selección comercial cuando su descripción confirma explícitamente esa naturaleza. No excluir por coincidencias aisladas del título; artículos de alcance dudoso se conservan pendientes hasta resolver su naturaleza.
- Las fichas elegibles sin categoría permanecen identificadas como `sin-categoria` en la preparación, pero **no están listas para importarse** hasta resolverla.
- Conservar `condition`, precio cuando esté acreditado, especificaciones e imágenes; no crear información que no exista. Precio ausente y logo sin correspondencia no son incumplimientos.
- Preparar `title`, `description_title`, `description`, `description_general` y `metadata` desde datos acreditados. No volver a ejecutar un enriquecimiento editorial sobre las fichas técnicas.

La `metadata` es responsabilidad del scraper comercial y se incorpora a cada producto, no a la publicación técnica:

```json
{
  "metadata": {
    "tags": ["maquinaria", "segunda-mano", "plataforma-articulada"],
    "keywords": ["genie", "z45-25j", "plataforma-articulada"],
    "featured": false
  }
}
```

Ejemplo de estructura, no una ficha acreditada. `tags` y `keywords` se generan de forma determinista, sin vacíos, duplicados ni afirmaciones inventadas. `featured: false` es el **valor inicial de alta**; conservar el valor operativo previamente guardado corresponde al backend en posteriores actualizaciones.

## Auditor comercial: defectos, señales y reconocimientos

El auditor separa **infracciones de acreditación**, **prioridades pendientes de intervención**, **señales de coherencia** y **protecciones controladas**. No toda señal de presentación o cobertura es una intervención aprobada. `--revision` prioriza casos con evidencia para investigar y muestra por separado los controlados. `--coherencia` contrasta la preparación; `--acreditacion` verifica las invariantes de la proyección comercial. `--contenido-revision` relaciona contenido con revisión transversal. `--json` y `--acreditacion-json` dan informes estructurados; las etiquetas `PENDIENTE` y `CONTROLADA` dependen de la clasificación y de las huellas vigentes, no se deducen sumando contadores crudos.

Se auditan categorías sin resolver, atributos emitidos incompatibles, valores con evidencia resoluble que no se trasladaron, contenido imprescindible ausente y pérdidas o cambios indebidos entre publicación técnica y derivado comercial.

Un valor rechazado por contradicción de identidad en el original no crea por sí solo una tarea de atributo: no existe un valor seguro que trasladar. Una ausencia sin fuente acreditada no crea una tarea. Tampoco la crean `required` heredados, precios inexistentes, logos no disponibles, títulos que difieren literalmente de la fuente bruta, métricas de cobertura, transformaciones editoriales aprobadas ni referencias visibles compartidas por máquinas distintas. Las incompatibilidades de IDs, tipos, opciones, identidad, metadata y campos preservados sí deben bloquear la acreditación. El informe JSON del auditor usa `version: 2`; el campo antiguo `coverage[].rejected` no forma parte de los contratos de intervención.

Las correcciones de datos se realizan en mapeadores y reglas reutilizables, con pruebas y comparación de regresiones. El auditor nunca modifica máquinas ni decide nuevos requisitos de publicación por sí solo.

### Procedencia, identidad y reconocimiento

`src/commercial/diagnostics/commercial-cross-coverage.ts` contrasta publicación y derivado comercial por `sourceUrl`, proveedor y referencia. Distingue señales **heredadas** del original/publicación y **introducidas** por la proyección: las introducidas exigen comprobar el mapper/exportador antes de intervenir la fuente. Las referencias visibles pueden normalizar espacios y guiones sin constituir la identidad única de una unidad; GAM 6835 y 6858 siguen siendo dos fichas distintas.

`src/commercial/diagnostics/commercial-intervention-priorities.ts` separa `pending` y `controlled`. La clasificación individual y la vigencia de huellas están en `src/commercial/diagnostics/audited-findings.ts` y `data/audit-finding-recognitions.json`: no modificar el registro para reducir avisos ni asumir que un reconocimiento histórico vale ante un origen cambiado. Las discrepancias técnicas reconocidas, como variantes de modelo o portada, pueden continuar visibles como **controladas**, sin ser incidencias pendientes de reparación. Los defectos introducidos y los reconocimientos caducados se revisan de nuevo.

Las decisiones de semántica (año, altura, capacidad, unidad, atributos) se implementan en preparación/dominio o proyección según la **primera capa defectuosa**; los auditores detectan y describen, no sustituyen la regla productiva. Ver [Mejora acreditada del catálogo](CATALOG_IMPROVEMENT.md).

## Operación

Desde la raíz del repositorio:

```powershell
npm run auditar:comercial
npm run auditar:comercial -- --arbol
npm run auditar:comercial -- --pendientes
npm run auditar:comercial -- --revision
npm run auditar:comercial -- --coherencia
npm run auditar:comercial -- --contenido-revision
npm run auditar:comercial -- --atributos-revision
npm run auditar:comercial -- --acreditacion
npm run auditar:comercial -- --acreditacion-json
npm run auditar:comercial -- --json
npm run exportar:comercial -- --help
npm run exportar:comercial -- --simular
npm run exportar:comercial -- --salida <directorio-nuevo-fuera-del-repo>
npm run auditar:comercial -- --verificar=<directorio-existente>
```

La CLI separa la **coordinación** en `src/cli/commands/catalog/commercial-audit.ts` de la **presentación** en `src/cli/reporting/commercial-audit.ts`. La política está en `src/commercial/projection/category-projection.ts` y las evidencias de procedencia en `source-category-evidence.ts` y `gam-category-evidence.ts`; la exportación y verificación están en `src/commercial/export/`. `--verificar=RUTA` compara el manifiesto comercial y los archivos exportados con el corte vigente, sin reescribirlos.

El exportador real, sin `--salida`, genera **dos ZIP verificados** (comercial e informe) en el Escritorio configurado. Con `--salida` escribe **tres JSON de proveedor y `commercial-manifest.json`** en un directorio nuevo fuera del repositorio, en lugar de los ZIP. Con `--entorno develop|production` incluye el `companyID` correspondiente si está acreditado; sin entorno no se incluye. `--simular` calcula/verifica sin escribir. El informe y la exportación no prueban importación efectiva al backend.

La opción `--arbol` es una vista de inspección: presenta la jerarquía real con IDs, conteos y una línea por producto (proveedor, referencia y título), además de las fichas pendientes. No añade incidencias ni modifica las decisiones del auditor. Para guardarla en un fichero: `npm run --silent auditar:comercial -- --arbol > categorias-comerciales.txt`.

El diagnóstico y el derivado comercial son independientes de los **nuevos snapshots técnicos bajo `technical/`**; siguen vinculados a las publicaciones individuales acreditadas y su procedencia histórica. Las categorías, opciones y relaciones se validan contra los recursos locales vigentes; una exportación con categorías pendientes no equivale a una importación autorizada.

## Ajustes pendientes de integración en backend

- Cambiar a `required: false` los atributos comerciales actualmente obligatorios, sin eliminar atributos ni relaciones. El snapshot local puede conservar valores anteriores hasta su sincronización; el auditor comercial no los convierte en tareas.
- Para el flujo de importación de JSON comerciales acreditados, evitar que la IA del backend regenere categoría, atributos o descripciones ya preparadas por el scraper; conservar otros flujos independientes que necesiten IA.
- Persistir `metadata.tags` y `metadata.keywords` del scraper; en actualizaciones preservar `metadata.featured` existente salvo una acción operativa explícita.
- Resolver el alta/actualización mediante identidad técnica estable, sin fusionar unidades por `externalReference`.

Estos puntos describen **cambios acordados y todavía no aplicados al backend**. Hasta entonces no debe asumirse compatibilidad definitiva de importación. La distinción entre preparación técnica, proyección comercial local e importación externa se mantiene en [Integración](EQUIPZILLA_INTEGRATION.md) y [Arquitectura](ARCHITECTURE.md).
