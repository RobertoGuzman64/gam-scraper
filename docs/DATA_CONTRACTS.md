# Contratos de datos — origen, identidad y normalización

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** El original vigente puede variar por disponibilidad sin invalidar el original histórico acreditado. Ningún parser debe inventar valores, cambiar unidades implícitamente, atribuir propiedades de otra unidad o mutar publicaciones para hacerlas pasar controles.

**Propietario:** esquema de datos y procedencia, identidad de producto, captura y persistencia de originales, `rulesSha256`, normalización y rechazo conservador. La resolución de `review` vive en [Calidad del catálogo](CATALOG_QUALITY.md), la aceptación en [Validación](VALIDATION.md) y la exportación en [Comercial](COMMERCIAL_EXPORT.md).

## Fuente de verdad y contratos

La fuente de verdad de extracción es el catálogo **`ProductRecord[]`** dentro de `<prefijo>-catalog.json`, definido en `src/contracts/catalog.ts`. Cada registro conserva:

- Identidad y origen: `providerId`, `reference`, `externalReference?`, `url`, `serialNumber`, `categoryKey`, `categoryName`.
- Contenido: `title`, `shortDescription`, `longDescription`, `shortDescriptionHtml?`, `longDescriptionHtml?`, `brand`, `model`.
- Datos técnicos y comerciales: `year`, `yearSource?`, `horometer`, `condition?`, `price`, `priceText?`, `location`, `country`, `specs?`.
- Imágenes y contexto: `image`, `images?`, `breadcrumbs?`, `subcategory?`, `technicalSheetUrl?` y metadatos de extracción.

Los valores que faltan pueden ser `null`; `condition` es `"Nuevo" | "Segunda mano" | null` y **no** coincide literalmente con el enum del receptor. `specs` es un mapa de valores escalares o listas simples. No inferir una característica por semejanza de modelo, descripción genérica o campos ajenos a otra máquina.

El catálogo canónico incluye todas las máquinas que superan la publicación estructural, **sin filtrarlas por importabilidad**. `ImportCandidate`, definido en los contratos de preparación, es una representación auxiliar. En la preparación canónica actual **no asigna IDs comerciales**: `categorySellID` es `null`, `attributes` es `[]`, la categoría de origen permanece como texto y `spec` conserva las especificaciones originales. Esta representación **no** sustituye a `ProductRecord` ni equivale a un objeto importable por el backend.

## Artefactos de extracción

La ubicación habitual es `storage/scraped/<proveedor>/`, con prefijo configurable:

| Artefacto                               | Función                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `<prefijo>-catalog.json`                | Catálogo canónico íntegro, productos y ámbito de extracción.                         |
| `<prefijo>-catalog.manifest.json`       | Procedencia, totales y huella SHA-256 del catálogo.                                  |
| `<prefijo>-all.csv` y CSV por categoría | Inspección y procesamiento tabular, con columnas `spec__*` cuando proceda.           |
| `<prefijo>-preparation.json`            | Preparación generada en la publicación, con productos y diagnósticos `ready/review`. |
| `<prefijo>-summary.json`                | Estado y totales de publicación, incluida información de integridad.                 |
| `<prefijo>-changes.json`                | Cambios y posibles ausencias frente al contexto disponible; no autoriza bajas.       |
| `<prefijo>-errors.json` y snapshots     | Diagnóstico de extracción, descubrimiento y seguimiento.                             |

La preparación **offline** se puede escribir en `storage/prepared/<proveedor>/`. Incluye procedencia del catálogo, identidades, huella de las reglas técnicas (`rulesVersion: 2`, `rulesSha256`), calidad y candidatos preparados. Los snapshots comerciales solo figuran en el formato histórico `rulesVersion: 1`; no son entradas de la preparación nueva. Debe poder verificarse sin consultar las webs.

Los documentos de origen, los manifests y los datos de preparación deben permanecer alineados. No editar productos manualmente en un JSON publicado ni reemplazar su manifest para «validar» una modificación. Los archivos de ejecución están excluidos del control de versiones.

## Persistencia definitiva y ciclo de vida

El repositorio separa **fuentes operativas** y **artefactos definitivos portátiles**:

| Espacio                                                        | Contenido admitido                                                                                                                                                | Regla de conservación                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `storage/scraped/<proveedor>/`                                 | Extracción individual, canónico vigente, parciales, CSV y diagnósticos                                                                                            | Operativo, fuera de Git; preservación y limpieza seguras          |
| `storage/scraped/campaigns/` y `storage/campaigns/`            | Fuentes de lote, preparaciones, decisiones y recibos                                                                                                              | Operativo y recuperable; retención por `runId`                    |
| `storage/prepared/`, `storage/runs/`, `storage/interventions/` | Preparaciones, ejecuciones, evidencias y derivados en trabajo                                                                                                     | No se consideran resultados definitivos por existir               |
| `catalogs/providers/<proveedor>/original/`                     | Exactamente un `<prefijo>-catalog.json`, `<prefijo>-catalog.manifest.json` y `<prefijo>-summary.json`                                                             | Original individual completo vigente, verificable y versionable   |
| `catalogs/campaigns/<runId>/`                                  | `manifest.json`, `accreditation.json`, `selection.json` y por proveedor original (trío) y `publishable.json`; opcionalmente derivado y expediente de intervención | Instantánea editorial inmutable y verificable, hasta dos campañas |

La **fuente de verdad de una extracción** sigue siendo su catálogo canónico y procedencia. Al consolidarlo en `catalogs/`, se copian y verifican sus bytes; no se crea un nuevo original ni se reescribe su contenido. El original individual vigente puede sustituirse por otro **completo y más reciente**, conservando recuperación transaccional. Los originales de una campaña acreditada siguen ligados a su `runId` y no se confunden con el original individual más reciente.

Una extracción solo actualiza `catalogs/providers/` cuando se publica íntegra desde las **categorías, opciones y destino predeterminados**. Muestras, límites de páginas, parciales, simulaciones y destinos personalizados no promocionan datos. El fallo conserva la publicación válida anterior. Un `ready` técnico tampoco es una selección comercial ni autoriza un JSON final.

Los **JSON finales** de `catalogs/campaigns/<runId>/<proveedor>/publishable.json` proceden exclusivamente de la selección editorial validada y aprobada de una campaña de cuatro proveedores. Se conserva la aprobación, la selección y las huellas necesarias para verificar originales, exclusiones, finales y, si hubo cambios manuales, el expediente y el derivado. La preparación o intervención aislada **no** actualiza un JSON final acreditado. Si cambia una preparación, la corrección debe verificarse y requerir una nueva acreditación coherente; una instantánea existente para un `runId` no se sobrescribe silenciosamente con otro contenido.

La **retención global** de hasta dos campañas se aplica por `runId` y mediante rotación recuperable tanto al material operativo correspondiente como a su instantánea portátil. Los originales independientes y los parciales no se borran por rotar campañas. Los archivos de recuperación individuales solo se limpian cuando el original activo coincide byte a byte con el consolidado; se conserva `active.json` y cualquier historial desconocido, pendiente o corrupto bloquea la limpieza. La limpieza operativa **no implica** que `storage/` esté vacío ni que todas sus carpetas tengan la misma política de expiración.

`npm run migrar:catalogos` **solo inspecciona** por defecto; `npm run migrar:catalogos -- --aplicar` incorpora originales completos y entregas históricas verificadas. Reconoce parciales sin elevarlos a originales completos; ante ambigüedad, corrupción o más de dos campañas, se detiene. No borra fuentes, reextrae ni toma decisiones editoriales. `npm run estado` lee los datos de ambos espacios y detecta diferencias, campañas dañadas o consolidaciones pendientes, sin alterar archivos.

**Git versiona el árbol de trabajo, no valida los catálogos.** `storage/` permanece excluido y `catalogs/` es versionable. Los procesos actualizan los datos consolidados; el propietario decide `git add`, commit y push. El comando `estado` no determina qué está staged ni qué contiene el último commit. Antes de cerrar un cambio de catálogo, comprobar que el conjunto definitivo afectado está validado y que figura en el commit correspondiente. Los históricos internos de Git son independientes de la retención del scraper. Una copia limpia puede comprobar `catalogs/` sin `storage/`, pero sin este último no se reanudan trabajos operativos antiguos ni se reconstruyen acreditaciones pendientes.

## Huella de reglas y estabilidad de las rutas

Para preparaciones con `rulesVersion: 2`, `rulesSha256` se calcula en `src/infrastructure/filesystem/preparation/preparation-inputs.ts` leyendo los módulos JavaScript compilados de preparación, normalización, identidad y componentes heredados incluidos explícitamente. El hash depende **tanto de sus nombres relativos como de su contenido**; por eso un renombrado de carpetas, un import recompilado o una redistribución del código puede modificar la huella sin cambiar los datos originales.

La huella se usa para detectar incompatibilidades entre la preparación almacenada y las reglas vigentes. La redistribución de reglas editoriales o del mapeo GAM puede afectar esa huella aunque las salidas mantengan equivalencia funcional. Un cambio de `rulesSha256` no prueba por sí solo una alteración editorial, pero tampoco habilita la reutilización automática de acreditaciones antiguas. No normalizar, sustituir ni recalcular a mano hashes de preparaciones, aprobaciones o publicaciones para adaptar un refactor. Los originales y finales acreditados permanecen inmutables; la validez de cualquier nueva preparación o decisión debe comprobarse mediante los comandos y controles previstos. Ver [Validación](VALIDATION.md).

### Stock y publicación técnica independiente

Gomariz puede descubrir una ficha desde `/venta/` y excluirla si la página declara **«Sin existencias»**. El resumen de extracción registra `excludedProductUrls` y `-errors.json` conserva las URLs excluidas con motivo; no son fallos de scraping, pero tampoco forman parte del original canónico vigente. En el corte de noviembre de 2026: 633 descubiertas, 547 elegibles y 86 excluidas. Una baja por stock frente a un histórico no autoriza a borrar ni alterar la publicación pasada.

`technical/active.json` selecciona un corte técnico independiente, con `ready/review` y sus incidencias; no equivale a `publications/active.json` comercial. Se conserva un máximo de dos versiones técnicas verificadas por proveedor. Manain solo puede publicarse desde su registro parcial contrastado con evidencias; no se convierte artificialmente en original completo. Ver [Publicaciones técnicas](PUBLICATIONS.md).

## Identidad y cobertura

- La identidad de una **unidad** no es únicamente marca/modelo: usar referencias, series, URLs canónicas y otras evidencias coherentes para deduplicar sin fusionar máquinas distintas.
- Una caída del número de anuncios requiere análisis de cobertura; no prueba venta, retirada o fallo del scraper por sí sola.
- Un estado de publicación `complete` acredita coherencia del proceso local, **no** que el portal haya enumerado todas las fichas existentes.
- Una diferencia de URL, imágenes, textos o especificaciones puede requerir revisión editorial aunque no cambie el número de productos.
- Preservar la imagen principal propia de cada ficha; evitar fotografías de productos relacionados como si fueran parte de su galería.
- **Fidelidad de imágenes a la fuente vigente:** si el proveedor deja de exponer una URL, no restaurarla desde históricos aunque aún funcione. No exigir recuentos constantes de fotos entre campañas. Si la fuente actual sí expone una imagen que el scraper omite, comprobar el adaptador; no inventar ni conservar URL externas por conveniencia.

## Normalización de especificaciones y herramientas GAM

La normalización estructural se implementa en `src/catalog/normalization/normalize-specs.ts` y `spec-parsers.ts`; el procesamiento del CSV GAM en `src/tools/gam/normalization/normalize-rows.ts` y la CLI en `src/tools/gam/normalize-csv.ts`. Los conversores seed residen en `src/tools/gam/seed/`. **No mezclar** esta transformación de datos con el motor de redacción editorial compartido: los textos, el estado de una preparación y las publicaciones acreditadas tienen contratos propios.

- Los números y medidas se aceptan únicamente con sintaxis y unidades compatibles. Se rechazan multiplicadores, alternativas no representables, valores condicionales, signos o dimensiones ambiguas y años incompletos; la excepción expresa de pares «con/sin carga» solo se aplica al campo que la admite. No inferir un valor para forzar la normalización.
- Los alias reconocidos se normalizan bajo un destino único; si varias fuentes colisionan con valores incompatibles, se registra `alias_conflict` y no se elige una arbitrariamente. Los atributos originales no reconocidos se conservan en `specJson` sin promocionarlos a columnas técnicas canónicas.
- El informe de CSV contiene filas y referencias afectadas, razones de descarte (`null_like`, `invalid_value`, `unit_mismatch`, `conditional_value`, `alias_conflict`), claves desconocidas e `invalid_spec_json`. `--allow-unknown` únicamente permite conservar claves desconocidas; **no** elude JSON inválido o conflictos de alias.
- El comando bloquea JSON inválido, conflictos de alias y claves desconocidas no autorizadas antes de escribir; conserva el CSV e informe anteriores. Sus escrituras de salida se preparan y se publican con restauración ante error. Las tres variantes de conversión seed rechazan JSON corrupto sin emitir un producto semilla válido. No editar el origen ni reemplazar manualmente los descartes por cero.

Las suites de seguridad de números, modelos, alias, CLI y seed viven bajo `src/catalog/normalization/tests/` y `src/tools/gam/**/tests/`. Ante una modificación, comprobar casos positivos, negativos y un censo real antes/después; los cambios de valores normalizados **no** equivalen por sí mismos a cambios de preparaciones ni a permisos de publicación. Ver [Validación](VALIDATION.md).

## El riesgo de `rulesSha256`

`src/infrastructure/filesystem/preparation/preparation-inputs.ts` calcula `rulesSha256` leyendo el JS compilado y sus rutas relativas. El hash es sensible incluso a redistribuir imports. Una comparación de JSON preparados idénticos **no garantiza** que sean compatibles sus huellas ni que se puedan reutilizar acreditaciones anteriores. Las redistribuciones del mapeo GAM pueden modificar esa huella sin autorizar cambios en publicaciones ya acreditadas.

Ante cualquier cambio de reglas: capturar la línea base, comparar salidas, calcular la huella antes/después, ejecutar pruebas y `estado`, y gestionar cualquier nueva preparación/acreditación por los procedimientos formales. Nunca reescribir huellas ni aprobar de forma automática.
