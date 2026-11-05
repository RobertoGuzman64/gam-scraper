# Comercialización desde el scraper

El catálogo comercial de EQUIPZILLA **se deriva de las publicaciones técnicas acreditadas**, sin modificarlas. El scraper decide la elegibilidad, asigna categorías y atributos, prepara los textos y la metadata, y genera exportaciones auditables. El backend recibe los productos y gestiona su persistencia y operación comercial. La exportación **no** escribe en el backend.

## Fuente y contratos

- Fuente: publicación técnica vigente de cada proveedor, junto con su original canónico para contrastar la identidad y aplicar los mapeadores existentes.
- Categorías y `categorySellID`: `data/category/categorySell-flat.json`, respetando jerarquía y condición. Priorizar categorías hoja; admitir una categoría general existente solo con correspondencia semántica acreditada y una regla comercial explícita. Una categoría sin relaciones de atributos no autoriza a inventarlas: conservar las especificaciones técnicas sin cambios.
- Atributos: `data/import/attributeCatalog.json`; usar solo `attributeID` y valores válidos para el tipo, las opciones y la relación con la categoría.
- Logos y empresas por entorno: `data/commercial-reference/`; `logoID` solo con correspondencia inequívoca y `companyID` únicamente con entorno explícito.
- Mantener `providerId`, `reference`, `externalReference` y `sourceUrl`. La referencia comercial visible no identifica por sí sola una máquina.

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

## Auditor comercial: intervenciones, no avisos orientativos

**Cada incidencia representa una intervención real aprobada.** Se auditan categorías sin resolver, atributos emitidos incompatibles, valores con evidencia resoluble que no se trasladaron, contenido imprescindible ausente y pérdidas o cambios indebidos entre publicación técnica y derivado comercial.

Un valor rechazado por contradicción de identidad en el original no crea por sí solo una tarea de atributo: no existe un valor seguro que trasladar. Una ausencia sin fuente acreditada no crea una tarea. Tampoco la crean `required` heredados, precios inexistentes, logos no disponibles, títulos que difieren literalmente de la fuente bruta, métricas de cobertura, transformaciones editoriales aprobadas ni referencias visibles compartidas por máquinas distintas. Las incompatibilidades de IDs, tipos, opciones, identidad, metadata y campos preservados sí deben bloquear la acreditación. El informe JSON del auditor usa `version: 2`; el campo antiguo `coverage[].rejected` no forma parte de los contratos de intervención.

Las correcciones de datos se realizan en mapeadores y reglas reutilizables, con pruebas y comparación de regresiones. El auditor nunca modifica máquinas ni decide nuevos requisitos de publicación por sí solo.

## Operación

Desde la raíz del repositorio:

```powershell
npm run auditar:comercial
npm run auditar:comercial -- --arbol
npm run auditar:comercial -- --pendientes
npm run auditar:comercial -- --atributos-revision
npm run auditar:comercial -- --acreditacion
npm run auditar:comercial -- --json
npm run exportar:comercial -- --help
```

La opción `--arbol` es una vista de inspección: presenta la jerarquía real con IDs, conteos y una línea por producto (proveedor, referencia y título), además de las fichas pendientes. No añade incidencias ni modifica las decisiones del auditor. Para guardarla en un fichero: `npm run --silent auditar:comercial -- --arbol > categorias-comerciales.txt`.

El diagnóstico y el derivado comercial son independientes de las publicaciones técnicas. Las categorías, opciones y relaciones se validan contra los recursos locales vigentes; una exportación con categorías pendientes no equivale a una importación autorizada.

## Ajustes pendientes de integración en backend

- Cambiar a `required: false` los atributos comerciales actualmente obligatorios, sin eliminar atributos ni relaciones. El snapshot local puede conservar valores anteriores hasta su sincronización; el auditor comercial no los convierte en tareas.
- Para el flujo de importación de JSON comerciales acreditados, evitar que la IA del backend regenere categoría, atributos o descripciones ya preparadas por el scraper; conservar otros flujos independientes que necesiten IA.
- Persistir `metadata.tags` y `metadata.keywords` del scraper; en actualizaciones preservar `metadata.featured` existente salvo una acción operativa explícita.
- Resolver el alta/actualización mediante identidad técnica estable, sin fusionar unidades por `externalReference`.

Estos puntos describen **cambios acordados y todavía no aplicados al backend**. Hasta entonces no debe asumirse compatibilidad definitiva de importación. Los documentos generales del repositorio que describen la transformación comercial como tarea del receptor requieren una actualización coordinada; no se modifican automáticamente desde este módulo.
