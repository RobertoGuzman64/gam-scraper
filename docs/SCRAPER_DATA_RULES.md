# Reglas de datos y publicación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** El original vigente puede variar por disponibilidad sin invalidar un original histórico acreditado. No copiar a los JSON comerciales fichas `review` del snapshot técnico ni reintroducir unidades sin existencias.

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

La huella se usa para detectar incompatibilidades entre la preparación almacenada y las reglas vigentes. Las extracciones editoriales y el mapeo GAM de las fases 9 y 12 afectaron esa huella aunque mantuvieran las salidas de sus pruebas de equivalencia. Un cambio de `rulesSha256` no prueba por sí solo una alteración editorial, pero tampoco habilita la reutilización automática de acreditaciones antiguas. No normalizar, sustituir ni recalcular a mano hashes de preparaciones, aprobaciones o publicaciones para adaptar un refactor. Los originales y finales acreditados permanecen inmutables; la validez de cualquier nueva preparación o decisión debe comprobarse mediante los comandos y controles previstos. Ver [Validación](VALIDATION.md).

### Stock y publicación técnica independiente

Gomariz puede descubrir una ficha desde `/venta/` y excluirla si la página declara **«Sin existencias»**. El resumen de extracción registra `excludedProductUrls` y `-errors.json` conserva las URLs excluidas con motivo; no son fallos de scraping, pero tampoco forman parte del original canónico vigente. En el corte de noviembre de 2026: 633 descubiertas, 547 elegibles y 86 excluidas. Una baja por stock frente a un histórico no autoriza a borrar ni alterar la publicación pasada.

`technical/active.json` selecciona un corte técnico independiente, con `ready/review` y sus incidencias; no equivale a `publications/active.json` comercial. Se conserva un máximo de dos versiones técnicas verificadas por proveedor. Manain solo puede publicarse desde su registro parcial contrastado con evidencias; no se convierte artificialmente en original completo. Ver [Publicaciones técnicas](TECHNICAL_PUBLICATIONS.md).

## Identidad y cobertura

- La identidad de una **unidad** no es únicamente marca/modelo: usar referencias, series, URLs canónicas y otras evidencias coherentes para deduplicar sin fusionar máquinas distintas.
- Una caída del número de anuncios requiere análisis de cobertura; no prueba venta, retirada o fallo del scraper por sí sola.
- Un estado de publicación `complete` acredita coherencia del proceso local, **no** que el portal haya enumerado todas las fichas existentes.
- Una diferencia de URL, imágenes, textos o especificaciones puede requerir revisión editorial aunque no cambie el número de productos.
- Preservar la imagen principal propia de cada ficha; evitar fotografías de productos relacionados como si fueran parte de su galería.
- **Fidelidad de imágenes a la fuente vigente:** si el proveedor deja de exponer una URL, no restaurarla desde históricos aunque aún funcione. No exigir recuentos constantes de fotos entre campañas. Si la fuente actual sí expone una imagen que el scraper omite, comprobar el adaptador; no inventar ni conservar URL externas por conveniencia.

## Calidad y decisiones editoriales

`ready` y `review` son estados locales de preparación. En preparaciones nuevas, `review` señala incidencias **técnicas y de evidencia del origen**, no la falta de `categorySellID` o de atributos comerciales. Las preparaciones heredadas pueden contener diagnósticos comerciales y no se reinterpretan como si tuvieran las reglas actuales. No eliminar atributos fiables ni rellenar los ausentes por conveniencia.

La revisión de cobertura genera un expediente con **huellas de los dos catálogos**, referencias ausentes y cambios por campo. Las decisiones empiezan pendientes. Para cerrar incidencias hacen falta motivos específicos y evidencias, especialmente en ausencias, imágenes y descripciones. Una retirada exige prueba; una ausencia acreditada de listado no equivale a una baja comercial; `no_acreditado` mantiene el bloqueo. Las decisiones deben verificarse contra los mismos archivos a los que se refieren.

La selección editorial crea productos publicables y un resumen de exclusiones **sin reescribir el catálogo original**. Las exclusiones pueden ser necesarias para proteger la calidad, pero no convierten fichas dudosas en `ready`. La salida por proveedor es un conjunto de candidatos ya definidos por el proyecto, no un request HTTP de importación.

## Corrección del motor y procedencia de las reviews

Las reviews de preparación se resuelven prioritariamente mediante cambios reutilizables en **código productivo** —extractor, parser, correspondencia entre etiqueta y magnitud, normalizador, calidad e identidad—, no alterando el canónico para conseguir un contador favorable. Los comandos de diagnóstico son herramientas auxiliares del desarrollador, no una sustitución de ese trabajo ni una obligación de inspección producto por producto del propietario. El criterio para declarar el **catálogo completo `ready`** exige `0 review` verificadas sobre todos los productos originales evaluados.

Distinguir valor técnico válido y representable, valor publicado compuesto o no escalar, unidad inconsistente, campo posiblemente cruzado y contradicción de identidad. La solución debe conservar la especificación cruda y aplicar únicamente transformaciones que se puedan justificar con evidencia. Un formato no representable por el tipo actual exige revisar el contrato o la regla de calidad, no inventar un número. La ausencia de atributos no publicados no es un fallo. Una contradicción real sin evidencia sigue como `review` y requiere tratamiento editorial separado; la exclusión nunca simula un `ready`.

Cada corrección del motor exige pruebas según el riesgo, validación del catálogo completo y comprobación de que no se pierden fichas, identidades ni garantías de trazabilidad. Las decisiones manuales, los derivados y las entregas acreditadas conservan su independencia de los originales inmutables.

## Tratamiento productivo por clase de defecto

Un origen parcialmente leído exige mejorar el **descubrimiento/extractor**; un texto o especificación transformados erróneamente exige corregir la **asociación, el parser o el normalizador**; una identidad colisionada exige corregir el **modelo de identidad/deduplicación** sin fusionar productos; una preparación técnica que genera reviews repetibles exige corregir sus **reglas de calidad**; un conjunto incoherente exige reparar la **publicación y la verificación de integridad**. `huecos`, `estado`, `comparar` y los expedientes permiten observar esos defectos, **no resolverlos**. Las correcciones se prueban contra el universo real relevante y no sobrescriben originales publicados.

Para la responsabilidad de cada frente, la evidencia de aceptación y la diferencia entre bloqueo humano y defecto reparable, consultar [Objetivos](SCRAPER_OBJECTIVES.md).


## Elegir la reparación acreditable según la procedencia

Para errores de extracción hay que reparar el parser y **recapturar el canónico íntegro**; una muestra o URL individual no se promociona como nuevo original global. Para errores de preparación se reutilizan reconciliaciones técnicas, recuperación documental o resolutores editoriales específicos del proveedor, preservando identidad, fuente, variante, orden y huella. La composición técnica está en `src/preparation/shared/technical/reconciliation/preparation-technical-stages.ts` y `shared/technical/recovery/documented-technical-recovery.ts`; la editorial en `shared/editorial/mapping/`. La clasificación común usa el registro `shared/classification/mapping/classification-provider.ts` y las adaptaciones de cada proveedor; no se crean IDs ni atributos por corregir una ficha.

Las evidencias por unidad/modelo no son intercambiables: el dato de un fabricante puede describir un **modelo** sin acreditar la configuración de la **unidad**. Las correcciones de textos por procedencia pueden emplear evidencias con URL y huellas como `src/preparation/gam/editorial/source/verified-source-matched-generals.ts`, pero **no** sustituyen la recaptura del original ni una aprobación editorial cuando el contrato la exige.

Una regla corregida no modifica la publicación activa por sí sola. Ejecutar `catalogo:preparar`, preflight `catalogo:publicar -- --simular --detalle`, FINISH y verificaciones de estado; las exclusiones nuevas necesitan las decisiones acreditadas que correspondan. Si un paso posterior a la activación falla, continuar la recuperación idempotente sin editar `manifest.json`, selectores o huellas. La proyección y exportación comercial son un circuito posterior e independiente.

Los avisos tienen propósitos diferentes: `technicalSpecs` de huecos mide claves y reconciliaciones; la semántica técnica comprueba valores; la auditoría comercial distingue pendiente/controlada/heredada/introducida. Una señal estadística sin evidencia directa no autoriza agregar información ni silenciar el auditor. Para la matriz de reparación y ejemplos reales ver [Mejora acreditada del catálogo](CATALOG_IMPROVEMENT.md).

## Frontera con la importación comercial

La campaña entrega JSON acreditados para **traspasar datos fiables**, no para efectuar una operación de importación. La **preparación técnica canónica** no asigna `categorySellID` ni IDs de atributos. Una **proyección comercial local independiente** (`src/commercial/projection/` y `src/commercial/export/`) puede asignarlos a partir de snapshots verificados, producir JSON y un manifiesto auditable, **sin modificar originales o publicaciones técnicas**. La importación, permisos y persistencia final de productos son responsabilidades del backend. **No añadir requisitos comerciales a `ready/review` ni convertir `specs` de origen en atributos comerciales sin una regla y evidencia del mapeador.**

El exportador XLSX/JSON **heredado** (`npm run exportar`) mantiene controles para preparaciones históricas con asignación comercial y rechaza las nuevas preparaciones técnicas sin ella. Es distinto de `npm run exportar:comercial`, que construye el derivado comercial actual desde publicaciones verificadas. Ninguno ejecuta peticiones HTTP de importación al backend.

Consultar [Límites de integración](EQUIPZILLA_INTEGRATION.md) para la separación de responsabilidades.

Las correcciones textuales puntuales se gestionan, cuando proceda, mediante [intervenciones manuales por campaña](CAMPAIGN_INTERVENTIONS.md), con origen intacto y sin promoción editorial automática.

Para el flujo ordinario de **todos los proveedores registrados** consultar [Campañas completas](CAMPAIGNS.md); para los criterios de aceptación ver [Validación](VALIDATION.md) y [Objetivos](SCRAPER_OBJECTIVES.md).
