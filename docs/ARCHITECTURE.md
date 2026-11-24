# Arquitectura del scraper y fronteras de responsabilidades

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Mantener las fronteras entre `scraping/`, `preparation/`, `publication/`, `infrastructure/` y `commercial/`. Un índice técnico no selecciona, modifica ni autoriza una publicación comercial.

Este documento define las capas del repositorio, sus dependencias y los puntos de integración. La ejecución de campañas, los contratos de datos y los procedimientos de publicación tienen sus guías propias.

## Visión general y estructura vigente

EQUIPZILLA es una CLI local en Node.js, TypeScript estricto y ESM. No ofrece API HTTP ni realiza importaciones o escrituras en el backend. La arquitectura organiza las responsabilidades por dominio, **sin `src/pipeline/` ni `src/catalog/preparation/`**:

```text
scripts/                    Entradas, runner, tooling, inspección, mantenimiento y operaciones
src/
  campaign/                Orquestación global, entrega, referencia y retención
  catalog/                 Identidad, calidad, normalización, cobertura, editorial y diagnósticos
    interventions/records/ Intervenciones manuales permanentes y acreditadas
  cli/                     Comandos, opciones y presentación de informes
  commercial/              Proyección comercial, validación, exportación y compatibilidad legada
  contracts/               Contratos compartidos de datos y proveedores
  infrastructure/          Filesystem, integridad, locks, HTTP, navegador y XLSX
  panel/                   Lectura y visualización local de evidencias, resumen y explorador
  preparation/             Preparación en áreas compartidas y proveedores, con hasta tres niveles de carpetas
  publication/             Publicaciones individuales, acreditación y FINISH
  scraping/                Motor, batch, proveedores y salida de extracción
  shared/                  Utilidades transversales
  testing/                 Builders, casos y fixtures compartidos; pruebas de integración acreditadas
  tools/                   Herramientas internas de catálogo y semillas GAM
catalogs/providers/        Originales completos, publicaciones individuales y snapshots técnicos portátiles
catalogs/campaigns/        Instantáneas acreditadas de campañas globales
catalogs/reports/          Informes, acreditaciones versionadas y caché del explorador técnico
panel/index.html           Derivado HTML autónomo y de solo lectura del corte acreditado
storage/                   Trabajo y recuperación locales, excluidos de Git
dist/                      Compilados regenerables, excluidos de Git
```

El registro de proveedores está en `src/scraping/registry.ts` y el contrato de campaña de cuatro proveedores (GAM, Gomariz, Mercaeleva y Manain) en `src/contracts/campaign-providers.ts`. Las publicaciones individuales comerciales vigentes pueden operar para GAM, Gomariz y Mercaeleva; Manain mantiene su flujo parcial y no debe darse por completo sin acreditación. **En paralelo**, las publicaciones técnicas independientes admiten Gomariz y Manain, entre otros proveedores, con estados `ready/review` y procedencia explícita. La lectura de históricos de tres proveedores no cambia el contrato de campaña actual.

## Fronteras y dirección de dependencias

| Área                                          | Responsabilidad                                                                 | Límite que se debe proteger                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cli/`, `scripts/`                            | Opciones, ejecución y presentación                                              | No interpretar HTML ni introducir reglas técnicas o comerciales en la UI     |
| `scraping/`                                   | Descubrimiento, extracción, deduplicación y salida de origen                    | No atribuir decisiones editoriales ni importar al backend                    |
| `catalog/`                                    | Identidad, calidad, normalización, selección y diagnósticos                     | No mezclar inspección con mutación de publicaciones                          |
| `preparation/`                                | Construcción y validación de candidatos técnicos, evidencias y `ready/review`   | No exigir IDs comerciales para declarar calidad del origen                   |
| `commercial/`                                 | Proyectar categorías y atributos, acreditar y generar JSON comerciales          | No cambiar originales, finales técnicos ni reglas de importación del backend |
| `panel/`                                      | Leer y representar evidencias del corte, diferencias y clasificaciones técnicas | No duplicar reglas de preparación ni alterar originales o publicaciones      |
| `campaign/`, `publication/`                   | Orquestar campañas y publicaciones, acreditación y recuperación                 | No saltarse preflight ni inventar decisiones humanas                         |
| `infrastructure/`                             | Persistencia, hashes, manifiestos, retención y seguridad de rutas               | No decidir identidad comercial o calidad editorial                           |
| `contracts/`, `shared/`, `testing/`, `tools/` | Contratos y herramientas auxiliares                                             | No trasladar reglas específicas a capas genéricas                            |

El guard `GUARDS/tests-module-integrity-guard.mjs` revisa imports relativos ausentes en módulos productivos e impide dependencias de producción (incluido `panel/`) hacia `src/cli/`, `src/testing/` o `src/tools/`, importar suites como módulos de producción, cruces directos entre adaptadores de proveedores en preparación/scraping y dependencias comerciales indebidas en scraping, motor técnico compartido y proyección. Estas son las **fronteras que comprueba realmente**; no interpreta toda la semántica del proyecto ni impide editar otros archivos de `src/`. Las fronteras editoriales y la topología de tests tienen guards propios.

No hay una capa `pipeline` física. Los orquestadores viven junto al dominio que coordinan: `src/scraping/workflow/`, `src/scraping/batch/`, `src/preparation/workflow/`, `src/campaign/` y `src/publication/`. Tener numerosas dependencias no es por sí solo un defecto de diseño. No reorganizar carpetas, introducir capas vacías o mover reglas por estética.

### Presentación y orquestación de la CLI

Los comandos de `src/cli/commands/` coordinan las operaciones, mientras `src/cli/reporting/` transforma eventos y resultados en mensajes para el operador. `operation-progress.ts` reutiliza `live-status.ts` y `terminal.ts` para mostrar etapa activa, proveedor, contadores fiables y duración, evitando barras y mensajes de avance redundantes entre proveedores. Una notificación de avance no constituye una decisión editorial ni acredita un `PASS`. La salida no interactiva debe seguir siendo legible, sin depender de animación o ANSI, y deben mantenerse los canales y contratos de salida de los comandos.

La dirección de dependencia protegida es **comandos → reporting**, nunca **reporting → comandos**. `GUARDS/tests-module-integrity-guard.mjs` rechaza imports de `src/cli/reporting/` a `src/cli/commands/`, con prueba positiva y negativa en `GUARDS/tests-architecture-guards.test.mjs`. No convertir esta frontera en un sistema de UI paralelo ni colocar reglas de preparación, acreditación o publicación en reporting. Ver [Pruebas y guards](TESTING.md).

## Flujos y puntos de entrada

### Extracción y salida

`src/cli/commands/extraction/scrape.ts` entra en `src/scraping/workflow/run.ts`, con adaptadores registrados en `src/scraping/registry.ts`. La extracción por lote se implementa en `src/scraping/batch/`. La escritura, los CSV y la salida estructural se concentran en `src/scraping/output/publish.ts` y `csv-serializer.ts`. La salida publicada no debe reemplazarse por un parcial o por un intento incompleto. La promoción portátil de un original individual elegible corresponde a `src/infrastructure/filesystem/catalog/portable-original.ts`.

Mercaeleva tiene separado el ciclo de navegador en `src/scraping/providers/mercaeleva/browser.ts` y las comprobaciones de paginación en `browser-pagination.ts`; Manain dispone de un circuito de navegador/censo propio. Los binarios de navegador necesarios son una dependencia del entorno, no una garantía de cobertura.

### Preparación técnica y revisión

La entrada de producto es `src/preparation/prepare-product.ts`, que expone `prepareSourceProduct` y `prepareWithCatalog`. La orquestación offline reside en `src/preparation/workflow/` y las huellas en `src/infrastructure/filesystem/preparation/`. La evidencia editorial se captura en `src/preparation/editorial/claims/source-editorial-evidence.ts` y la composición se coordina desde `src/preparation/editorial/core/prepared-editorial.ts`, con conocimiento y evidencia en `core/`, texto general en `source/context/` y título y presentación final en `writing/`. La estructura compartida se reparte además entre `identity/` y `measurements/`; las interpretaciones particulares de origen viven junto a cada proveedor. **No hay narradores históricos individuales conectados** en el alcance de los guards. Ver [Motor editorial compartido](EDITORIAL_ENGINE.md).

La composición técnica usa `src/preparation/technical/preparation-technical-stages.ts`: coordina transformaciones iniciales, semántica del origen, reconciliaciones y normalización de `spec`. Las implementaciones específicas residen en `gam/reconciliation/preparation-technical-stages.ts`, `mercaeleva/technical/preparation-technical-stages.ts`, `gomariz/technical/` y `manain/`. La recuperación documental se coordina en `src/preparation/technical/documented-technical-recovery.ts`, con recuperadores propios de cada origen y **orden explícito**. Mover una regla o adelantarla puede cambiar qué evidencia prevalece: proteger precedencia, identidad y salidas antes/después.

La composición editorial utiliza `editorial/claims/source-editorial-evidence.ts`, `editorial/core/prepared-editorial-source.ts`, `editorial/core/knowledge-editorial.ts` y `editorial/writing/`. Las adaptaciones de origen se ubican en `gam/domain-source.ts`, `gomariz/domain-source.ts`, `mercaeleva/domain-source.ts` y `manain/domain-source.ts`. El conocimiento declarativo se conserva en `data/editorial/knowledge/`. No reintroducir narradores por proveedor ni colocar composición en `commercial/`; los casos firmados se verifican por identidad/procedencia y **no** se generalizan a otras unidades.

La clasificación de atributos, categorías y condición pasa por `src/preparation/classification/classification-provider.ts` y el contrato interno `classification-provider-types.ts`: el registro compone adaptaciones de `gam`, `gomariz`, `mercaeleva` y `manain`, definidas en `gam/classification/provider.ts`, `gomariz/classification/provider.ts`, `mercaeleva/classification/provider.ts` y `manain/provider.ts`. Los resolutores `attribute-mapping.ts`, `category-mapping.ts` y `src/preparation/product/condition.ts` consumen esa composición; conservan reglas comunes y validación de contratos. No eliminar registros explícitos de proveedores cuando sirven para validar el alcance del sistema.

Las reglas y evidencias específicas permanecen junto a cada proveedor, por ejemplo en `src/preparation/gam/`. La transformación de valores de atributos GAM está en `src/preparation/gam/classification/attribute-values.ts`, mientras `attributes.ts` conserva alias y decisiones relacionadas. Los parsers escalares de las semillas GAM comparten la utilidad interna `src/tools/gam/seed/internal/scalar.ts`. La normalización de especificaciones vive en `src/catalog/normalization/`, mientras la orquestación CSV, trazabilidad y preservación de campos se encuentran en `src/tools/gam/normalization/` y `src/tools/gam/normalize-csv.ts`. Las tres variantes de conversión seed comparten criterios de magnitud/unidad y deben rechazar entradas `specJson` inválidas en vez de convertirlas silenciosamente en objetos vacíos. Estas utilidades **no autorizan** nuevas categorías, atributos, IDs ni valores sin evidencia.

Una preparación técnica canónica puede producir `categorySellID: null` y `attributes: []`, conservando `spec`. Las incidencias `ready/review` no se resuelven falsificando estos campos ni excluyendo productos de la muestra.

### Campañas, portabilidad, retención y limpieza

`src/cli/commands/campaign/` delega la campaña global en `src/campaign/`, incluidas sus carpetas `discovery/`, `delivery/`, `reference/` y `retention/{admission,inventory,journal,lock,recovery}.ts`. `src/campaign/finalization.ts` coordina la consolidación acreditada; `src/campaign/portable-inventory.ts` y `portable-migration.ts` inspeccionan o migran conforme a sus modos explícitos.

`src/infrastructure/filesystem/catalog/portable-campaign.ts` coordina consolidación y retirada; `portable-campaign-inspection.ts` inspecciona manifiestos, archivos y rutas. En la retención individual, `catalog-retention-cleanup.ts` utiliza `catalog-retention-references.ts` para proteger archivos aún referenciados. `src/infrastructure/filesystem/campaign/campaign-cleanup.ts` conserva el inventario y la ejecución de limpiezas; `campaign-cleanup-validation.ts` valida rutas, históricos y artefactos. Las rutas y los symlinks sospechosos deben bloquear las operaciones sensibles. La retención global se aplica por `runId`, con máximo de dos campañas protegidas según el contrato; los originales individuales tienen un ciclo de vida separado.

No ejecutar retiradas ni consolidaciones reales como parte de una auditoría documental. `npm run estado` inspecciona, y `npm run migrar:catalogos` simula por defecto. Ninguno de esos comandos equivale a aprobar una nueva publicación.

### Publicaciones técnicas independientes

`src/publication/technical-snapshot.ts` define y valida el corte; `src/publication/technical-publication.ts` prepara, contrasta y simula/activa; `src/cli/commands/catalog/technical-publication.ts` expone el comando, mientras `src/infrastructure/filesystem/catalog/technical-publication.ts` conserva y verifica `technical/active.json` y `technical/versions/<sha256>/{snapshot,manifest}.json`. Los originales completos se contrastan con sus preparaciones; Manain se reconstruye y valida con registro `partial`, CSV y censo. Los `review` permanecen en el snapshot y no autorizan la publicación comercial.

La versión técnica activa y la anterior son las dos protegidas en la retención. Los índices, hashes, locks y temporales son propios; el publicador técnico no toca `publications/` ni activa FINISH. `huecos --tecnicas` lee estos snapshots y es independiente del auditor comercial. Ver [Publicaciones técnicas](PUBLICATIONS.md).

### Publicaciones individuales y acreditación

`src/cli/commands/catalog/prepare-individual.ts` delega en `src/preparation/workflow/individual-prepare.ts`; la acreditación automática limitada reside en `src/publication/automatic-individual-accreditation.ts` y FINISH en `src/publication/individual-finish.ts`. Los contratos de publicación y aceptación de diferencias se conservan en `publication-contracts.ts` y `publication-acceptance.ts`. La evidencia del trabajo original → publicado se ensambla en `src/publication/individual-work-report.ts` y se presenta mediante `src/cli/reporting/`.

Los finales y aprobaciones acreditados no se reescriben para acomodar refactors o diferencias de huella. Las exclusiones editoriales no convierten fichas `review` en `ready`. Ver [Publicación individual](PUBLICATIONS.md) y [Campañas](CAMPAIGNS.md).

### Proyección comercial y exportación legada

**El catálogo técnico acreditado y su derivado comercial son contratos distintos.** La proyección comercial actual vive en `src/commercial/projection/`, con la política en `category-projection.ts` y evidencia de origen en `source-category-evidence.ts` y `gam-category-evidence.ts`. `src/commercial/export/` prepara, acredita y verifica salidas comerciales procedentes de publicaciones técnicas y snapshots locales; `src/cli/commands/catalog/commercial-audit.ts` realiza la coordinación y `src/cli/reporting/commercial-audit.ts` presenta los informes. El comando `exportar:comercial` no importa datos al backend.

Por separado, `npm run exportar` es un exportador **heredado** para preparaciones comerciales compatibles: `src/commercial/legacy-export/`, `src/cli/commands/legacy-export/` y `src/infrastructure/filesystem/legacy-export/`. No debe aplicarse a nuevas preparaciones técnicas sin asignaciones. La importación HTTP, la persistencia de productos y los permisos operativos pertenecen al backend. Ver [Comercialización](COMMERCIAL_EXPORT.md) e [Integración](COMMERCIAL_EXPORT.md).

### Panel local de evidencias

`src/cli/commands/catalog/commercial-export.ts` coordina la actualización del panel únicamente tras la exportación real a `develop` con entrega predeterminada. `src/panel/evidence/prepare-explorer-technical-evidence.ts` calcula un derivado de las incorporaciones técnicas verificadas mediante `src/preparation/provenance/technical-spec-classification.ts` y lo guarda en `catalogs/reports/revision/explorer-technical-evidence.json`. `src/panel/evidence/` verifica el corte y la caché, `src/panel/explorer/` es dueño de la lectura por ficha y `src/panel/application/` compone `panel/index.html`, con interfaz en `src/panel/ui/`. `src/tools/catalog/` conserva fachadas de compatibilidad hacia `panel/`: el guard de integridad prohíbe la dependencia inversa `panel/` → `tools/`.

El HTML es **autónomo y de solo lectura**; no crea un segundo motor editorial. La clasificación se deriva de la procedencia técnica y de originales/publicaciones cotejados, nunca de una matriz de colores mantenida por el panel. La caché se vincula a las huellas del corte y no sustituye a las publicaciones acreditadas. Ver [Panel local](COMMERCIAL_EXPORT.md#panel-local-de-evidencias) y [Clasificación de incorporaciones](CATALOG_QUALITY.md#clasificación-de-incorporaciones-técnicas).

### Auditoría de contenido

`src/cli/commands/catalog/catalog-content-gaps.ts` y `src/cli/reporting/catalog-content-gaps-output.ts` presentan datos obtenidos en `src/catalog/diagnostics/`, con originales canónicos resueltos mediante `src/infrastructure/filesystem/catalog/original-catalog-sources.ts`. La preparación recalculada usa `src/preparation/prepare-product.ts`. Las comprobaciones de contenido y `--comparar --specs` no escriben originales ni crean publicaciones. Ver [Huecos de contenido](CATALOG_QUALITY.md).

## Dónde intervenir sin desplazar responsabilidades

| Trabajo                            | Código propietario                                                                                                                                    | Límites                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Descripciones, títulos y redacción | `src/preparation/editorial/{claims,core,identity,measurements,source,writing}/`, con interpretación en `src/preparation/<proveedor>/domain-source.ts` | No introducir narradores por proveedor ni reescritura comercial                    |
| Especificaciones y prestaciones    | `src/preparation/technical/`, `src/preparation/provenance/` y reglas técnicas específicas de proveedor                                                | Respetar reconciliaciones, procedencia, variante, unidades y precedencia           |
| Categorías, atributos y condición  | `src/preparation/classification/` y `src/preparation/<proveedor>/classification/`                                                                     | No añadir IDs ni trasvasar reglas al exportador                                    |
| Huecos, calidad y diagnóstico      | `src/catalog/diagnostics/`, calidad/identidad en `src/catalog/` y punto de origen del defecto                                                         | El auditor informa; no corrige ni publica por su cuenta                            |
| Datos de catálogo y manifiestos    | `src/infrastructure/filesystem/` y contratos de `src/contracts/`                                                                                      | No editar originales ni firmas para producir un PASS                               |
| Proyección comercial               | `src/commercial/`, con interfaces y pruebas existentes                                                                                                | No alterar el contrato comercial v2 sin decisión expresa                           |
| Intervenciones excepcionales       | `src/catalog/interventions/records/<proveedor>/`                                                                                                      | Solo casos permanentes acreditados y autorizados; no scripts de campaña temporales |
| Presentación y CLI                 | `src/cli/`, tooling existente en `scripts/`                                                                                                           | No mover aquí reglas de negocio                                                    |

Para elegir la reparación de una ficha, seguir [Calidad del catálogo](CATALOG_QUALITY.md); para el motor de texto, [Motor editorial](EDITORIAL_ENGINE.md); para ubicación de suites y fixtures, [Pruebas](TESTING.md). Estas rutas son **propietarios funcionales**, no permiso para crear módulos, carpetas o contratos adicionales sin autorización.

## Cómo ampliar reglas y proveedores sin acoplar el núcleo

Una mejora técnica se inicia en la interpretación/reconciliación del origen y se integra en los puntos comunes existentes. Una mejora **editorial generalizable** pertenece a `src/preparation/editorial/` en su subárea funcional correspondiente; los adaptadores de proveedor solo interpretan señales específicas y autenticidad de la fuente, y las evidencias firmadas permanecen acotadas a su origen. No introducir narradores por proveedor, referencia ni modelo. Una adaptación comercial de nuevo proveedor se expresa en el adaptador de proveedor correspondiente de `src/preparation/`; los atributos, categorías e IDs siguen perteneciendo a los contratos vigentes.

`src/preparation/prepare-product.ts` es un **orquestador**, no el lugar para acumular casos de unidades nuevas. `src/preparation/technical/documented-technical-recovery.ts` compone fuentes documentales; no debe crecer con reglas de negocio duplicadas de varios proveedores. El registro de clasificación es una composición explícita, no un sistema de plugins dinámicos. Las excepciones acreditadas por referencia y huella son legítimas cuando impiden extrapolar una especificación a otra unidad.

Las modificaciones se validan comparando los candidatos por identidad y campo, controlando la huella `rulesSha256`, el preflight, FINISH y la proyección comercial. Consultar el [manual de mejora acreditada](CATALOG_QUALITY.md) antes de añadir reglas o extender un proveedor.

## Calidad, pruebas y protección de artefactos

`npm run build` ejecuta `scripts/run-build.mjs`. `npm test` ejecuta los guards oficiales definidos en `package.json`, compila cuando es necesario, comprueba el consenso de modelos y después ejecuta `scripts/run-tests.mjs`, que descubre las suites TypeScript de `src/` y `.test.mjs` de `scripts/`. Las pruebas pueden usar caché; para una acreditación sin reutilización usar `EQUIPZILLA_TEST_CACHE=0`. Los tests deben verificar contratos reales y conservar los casos límite. Los guards de gobernanza, integridad productiva, arquitectura editorial y de tests, y sus autopruebas, se ejecutan dentro de `npm test` antes del build; después del build también se comprueba el consenso de modelos. Su política y las integraciones censales autorizadas se describen en [Arquitectura de tests](TESTING.md).

`rulesSha256` en `src/infrastructure/filesystem/preparation/preparation-inputs.ts` incorpora nombres y contenidos de módulos JS compilados. Cambiar la distribución de módulos editoriales o el mapeo GAM puede alterar la huella aunque la salida sea funcionalmente equivalente: **equivalencia funcional y compatibilidad de acreditación son comprobaciones diferentes**. No alterar hashes o preparaciones existentes para hacer coincidir la huella. Ver [Validación](VALIDATION.md) y [Mantenimiento](OPERATIONS_AND_MAINTENANCE.md).

La regla general `output/` de `.gitignore` necesita mantener la excepción `!src/scraping/output/`: sin ella pueden desaparecer del paquete los módulos de salida aunque sus consumidores sigan compilando contra imports ESM. El código de esos módulos permanece en el árbol fuente; no se regenera desde `dist/`.

Cuando se detecta un defecto, repararlo donde se origina: extracción/HTML en scraping, identidad y calidad en catálogo o preparación, integridad en filesystem, responsabilidades comerciales en proyección, presentación en CLI. No introducir excepciones ficticias por ficha ni restaurar imágenes o specs sin evidencia del origen. La aceptación final distingue compilación, pruebas, calidad del catálogo, integridad de artefactos y acreditación editorial.

## Mapa de responsabilidades estabilizadas

| Zona                    | Propietario y separación                                                                                                                                                              | Contrato que se conserva                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Normalización GAM       | `src/catalog/normalization/` y `src/tools/gam/normalization/`, con CLI en `src/tools/gam/normalize-csv.ts`                                                                            | Unidades y alias seguros, claves de origen conservadas y salidas transaccionales                                   |
| Semillas GAM            | `src/tools/gam/seed/internal/scalar.ts` compartido por parsers de categoría/URL                                                                                                       | Conversión escalar y exports de los consumidores existentes; rechazo de JSON corrupto                              |
| Editorial compartida    | `src/preparation/editorial/{claims,core,identity,measurements,source,writing}/`, adaptadores `{gam,gomariz,mercaeleva,manain}/domain-source.ts` e índices `data/editorial/knowledge/` | Única autoridad de redacción, identidad, precedencias y hechos firmados; adaptadores interpretan origen, no narran |
| Técnica acreditada      | `src/preparation/technical/preparation-technical-stages.ts` y `src/preparation/technical/documented-technical-recovery.ts`, con reglas de proveedor                                   | Orden de reconciliaciones, identidad, huellas y semántica técnica                                                  |
| Clasificación           | `src/preparation/classification/classification-provider.ts` y `src/preparation/{gam,gomariz,mercaeleva}/classification/provider.ts` y `src/preparation/manain/provider.ts`            | Composición explícita, categorías/atributos/condición sin nuevas IDs                                               |
| Comercial               | `src/commercial/projection/category-projection.ts` y evidencias `source-category-evidence.ts`/`gam-category-evidence.ts`                                                              | Decisiones de categoría y restricciones de procedencia                                                             |
| Persistencia portátil   | `src/infrastructure/filesystem/catalog/portable-campaign.ts` e `portable-campaign-inspection.ts`                                                                                      | Manifiestos, integridad, consolidación y retirada segura                                                           |
| Retención individual    | `src/infrastructure/filesystem/catalog/catalog-retention-cleanup.ts` e `catalog-retention-references.ts`                                                                              | Protección de históricos referenciados y archivos activos                                                          |
| Limpieza global         | `src/infrastructure/filesystem/campaign/campaign-cleanup.ts` y `campaign-cleanup-validation.ts`                                                                                       | Inventario, validación de rutas, simulación y eliminación segura                                                   |
| CLI comercial           | `src/cli/commands/catalog/commercial-audit.ts` y `src/cli/reporting/commercial-audit.ts`                                                                                              | Modos, informes y códigos de salida                                                                                |
| Navegador Mercaeleva    | `src/scraping/providers/mercaeleva/browser.ts` y `browser-pagination.ts`                                                                                                              | Ciclo de navegador, paginación y detección de duplicados                                                           |
| Atributos GAM           | `src/preparation/gam/classification/attributes.ts` y `attribute-values.ts`                                                                                                            | Alias, conversión validada y catálogo comercial sin cambios de IDs                                                 |
| Identidad GAM           | Reglas cohesionadas en `src/preparation/gam/identity/`                                                                                                                                | No fragmentar sin una responsabilidad real                                                                         |
| Publicación estructural | `src/scraping/output/publish.ts` y `csv-serializer.ts`                                                                                                                                | Escritura, preparación de compatibilidad, orden de columnas CSV y preservación del último resultado válido         |

Las reglas de identidad GAM se mantienen cohesionadas bajo su responsabilidad propia. Un módulo extenso no necesita refactor si su responsabilidad es clara. No restaurar carpetas históricas `src/pipeline/` o `src/catalog/preparation/`, ni inventar abstracciones compartidas sin consumidores reales.

## Extender sin duplicar reglas

- Para hechos técnicos buscar primero en reconciliación y evidencia técnica del origen. Para redacción, buscar **primero** en `src/preparation/editorial/{claims,core,identity,measurements,source,writing}/` y los índices `data/editorial/knowledge/`; solo la interpretación/autenticidad específica pertenece al adaptador editorial del proveedor. Las evidencias por unidad firmada pueden conservarse sin crear un narrador ni un `switch` por referencia.
- Conservar los puntos de composición compartidos, sin duplicar recuperadores en un auditor ni cambiar el orden por estética. `prepare-product.ts` orquesta; no debe convertirse en una tabla de excepciones.
- Para condición, atributos y categorías, ampliar el adaptador de clasificación por proveedor si procede. La existencia de registros/whitelists explícitos no es deuda por sí sola.
- Distinguir datos de una unidad, prestaciones generales de modelo y anomalías originales. Antes de hacer crecer una regla, probar la variante vecina y el origen distinto. Consultar [Mejora acreditada del catálogo](CATALOG_QUALITY.md).
- Las pruebas nuevas verifican el **motor compartido** con condiciones positivas/negativas. Conservar las integraciones censales acreditadas de los catálogos; no añadir suites por máquina. Ver [Motor editorial](EDITORIAL_ENGINE.md) y [Arquitectura de tests](TESTING.md).

## Protección de la salida del scraper

`src/scraping/output/publish.ts` y `csv-serializer.ts` son fuentes imprescindibles para scraping, preparación, publicación y tests. `.gitignore` contiene una regla general `output/` y la excepción **`!src/scraping/output/`**; conservar ambas sin excluir esos módulos en futuras limpiezas. Las funciones `writeOutputs`, `writeGroupedOutputs` y `writeCategoriesCsv` tienen consumidores que dependen de los contratos existentes. El formato CSV exige encabezados concretos (productos que comienzan por `categoryKey,categoryName,title`, categorías con `categoryUrl`). La preparación legada de `publish.ts` incorpora el catálogo comercial que esperan los consumidores de compatibilidad.

Una pérdida de esos módulos puede causar múltiples errores `TS2307` aparentemente no relacionados. Si la compilación falla, comprobar primero que el árbol fuente contiene los archivos antes de cambiar imports o contratos.

## Proveedores y extensión

Para incorporar un proveedor se debe revisar `src/scraping/provider.ts`, el registro `src/scraping/registry.ts`, el contrato de campaña (`src/contracts/campaign-providers.ts`) y, cuando proceda, la preparación, calidad e identidad bajo `src/preparation/` y `src/catalog/`. Sus pruebas deben cubrir extracción, paginación, identidad, duplicados, imagen principal, calidad y formatos. **No** añadirlo a una campaña, a las referencias comerciales o a la publicación acreditada por una coincidencia de nombre. Una ampliación de contrato exige revisión explícita, no una reforma implícita de documentación.
