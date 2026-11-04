# Arquitectura

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Visión general

Aplicación CLI de Node.js y TypeScript con módulos ESM. El scraper se ejecuta como proceso local o programado; **no tiene servidor HTTP ni persistencia en el backend de Equipzilla**.

```text
scripts/
  run-build.mjs, run-tests.mjs, tooling.mjs, terminal.mjs
  inspection/, maintenance/, operations/
interventions/                Scripts permanentes de intervención
src/
  cli/                       Comandos, opciones y presentación
    commands/{campaign,catalog,extraction,interventions,legacy-export,maintenance,providers}/
  contracts/                 Contratos compartidos
  scraping/                  Motor, parsing y adaptadores por proveedor
  catalog/
    coverage/, diagnostics/, editorial/, interventions/
    normalization/, preparation/, reference/, legacy-export/
    preparation/{source,reconciliation,recovery}/
    preparation/evidence/{documented-technical-evidence.ts,providers/<id>/}
    preparation/mapping/{source-editorial-evidence.ts,prepared-editorial.ts,verified-editorial-finalization.ts,providers/<id>/}
    preparation/tests/{providers,cross-cutting}/
  pipeline/
    batch/, campaign/, extraction/, preparation/, publication/, validation/, legacy-export/
    campaign/{discovery,delivery,reference,retention}/
    campaign/tests/{discovery-flow,finalization-and-delivery,operations,portability-and-retention,reference}/
  infrastructure/            HTTP, navegador, filesystem, locks, salida heredada
  testing/{builders,fixtures}/  Soporte de pruebas reutilizable
  shared/                    Utilidades transversales
  tools/{catalog,gam}/       Auditoría y herramientas auxiliares
storage/                     Estado operativo local, no versionado
catalogs/providers/<id>/original/   Original completo portátil
catalogs/campaigns/<runId>/        Campaña acreditada portátil
```

El registro de proveedores vive en `src/scraping/registry.ts`; el conjunto de campaña actual (GAM, Gomariz, Mercaeleva y Manain) se declara en `src/contracts/campaign-providers.ts`. El contrato admite además lectura de referencias históricas de tres proveedores; esto no convierte esos lotes en campañas actuales completas. Los contratos de datos se definen en `src/contracts/`. Los tests de TypeScript están junto a sus responsabilidades, agrupados en `tests/` por proveedor o función; los helpers reutilizables están en `src/testing/`. Las pruebas MJS de scripts están en `scripts/inspection/tests/` y `scripts/maintenance/tests/`. El resultado compilado se escribe en `dist/`, que no se versiona.

## Calidad como responsabilidad del código productivo

Cuando `prepareSourceProduct` o sus validadores producen reviews, su diagnóstico es una **entrada de desarrollo**. La corrección reusable corresponde al módulo que pueda demostrar la causa: `scraping/` para lectura y asociación de campos; `catalog/` para normalización, reglas de calidad e identidad; `pipeline/` para orquestar y comprobar resultados; `cli/` solo para exponer el estado. No reparar silenciosamente el dato con una decisión en CLI, una mutación del original ni una excepción por referencia.

El flujo de ingeniería normal es reproducir en el catálogo completo → corregir el motor → probar el comportamiento y sus contraejemplos → volver a preparar/validar el conjunto hasta acreditar `0 review`. Una review que exige evidencia externa se mantiene visible sin falsear el `ready`. Los diagnósticos y auditores sirven a este ciclo, no son un objetivo de producto independiente. Ver [Objetivos](SCRAPER_OBJECTIVES.md) y [Validación](VALIDATION.md).

## Regla de reparación según el componente

Un defecto de **descubrimiento/cobertura** se resuelve en el adaptador y motor de scraping; uno de **campo cruzado o magnitud mal interpretada**, en extracción semántica o normalización; uno de **identidad o duplicados**, en contratos y reglas de catálogo; uno de **reviews injustificadas**, en calidad/contratos con contraejemplos, sin apagar el control; uno de **artefactos, recuperaciones o comandos encadenados**, en pipeline e infraestructura; uno de **presentación del estado**, en CLI. La corrección se ubica donde evitará repetir el defecto en otras fichas y campañas, sin duplicar la regla en un script de diagnóstico, un CLI o un editor manual.

Modificar código productivo no autoriza cambios indiscriminados de arquitectura: reutilizar el motor existente, mantener TypeScript estricto, comprobar consumidores, exigir pruebas proporcionales al riesgo y verificar el efecto sobre el universo completo. Los contratos de aceptación por frente se enumeran en [Objetivos](SCRAPER_OBJECTIVES.md).


## Criterio transversal de cambio productivo

La ubicación de una corrección depende de **dónde se origina el comportamiento defectuoso**, no del comando que lo muestra. No añadir parches de presentación a `cli/` para silenciar síntomas del motor; no alterar `ProductRecord` o el original portátil para remediar una preparación; no incorporar excepciones por producto cuando la causa pertenece al parser, al normalizador o a las reglas de calidad. Un cambio de contrato exige rastrear consumidores y preservar garantías de persistencia e identidad. El comportamiento de actuación y cierre está en [Objetivos](SCRAPER_OBJECTIVES.md#contrato-anti-deriva-comportamiento-obligatorio-del-asistente).


## Responsabilidades

| Capa                   | Debe hacer                                                                    | No debe hacer                                              |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `cli` y `scripts`      | Interpretar órdenes, preparar parámetros, mostrar ayuda, errores y resúmenes. | Decidir identidades o parsear HTML.                        |
| `scraping`             | Descubrir listados, obtener fichas y devolver registros de origen.            | Importar al backend o aplicar políticas de Excel.          |
| `catalog`              | Normalizar, deduplicar, contrastar evidencia y resolver reglas editoriales.   | Ejecutar peticiones de scraping o presentar UI de consola. |
| `pipeline`             | Coordinar flujos y mantener integridad de las publicaciones.                  | Repetir reglas de proveedor.                               |
| `infrastructure`       | I/O, HTTP, navegador, locks y escritura segura.                               | Inventar reglas de producto.                               |
| `contracts` y `shared` | Tipos y utilidades reutilizables.                                             | Acoplarse a CLI o a un portal particular.                  |

Dirección preferente: `cli → pipeline → scraping/catalog/infrastructure`. Los adaptadores implementan el contrato `ScraperProvider`; las excepciones de un proveedor deben permanecer en su propio módulo. No introducir capas vacías, duplicar mappers ni mover contratos públicos sin revisar consumidores.

## Procesos principales

**Extracción individual:** `src/cli/commands/extraction/scrape.ts` y el registro `src/scraping/registry.ts` coordinan adaptadores y motor mediante `src/pipeline/extraction/`. La publicación, los CSV y la aceptación se realizan en `src/pipeline/publication/`. El adaptador de Mercaeleva puede necesitar Chrome/Chromium externo.

**Lotes y campaña global:** `src/cli/commands/campaign/batch.ts` utiliza `src/pipeline/batch/` para ejecutar proveedores en secuencia y registrar evidencias en `storage/runs/`. `src/cli/commands/campaign/campaign-extract.ts` orquesta la campaña con `src/pipeline/campaign/`, comparte el `runId` y aísla fuentes en `storage/scraped/campaigns/`. La retención y recuperación están repartidas entre `src/pipeline/campaign/retention/{admission,inventory,journal,lock,recovery}.ts`, con exclusión mutua local y rotación recuperable; no es un lock distribuido ni bloquea necesariamente toda extracción individual.

**Persistencia portátil:** `src/pipeline/extraction/run.ts` solo promociona una extracción individual elegible (categorías, opciones y salida predeterminadas). `src/infrastructure/filesystem/catalog/portable-original.ts` comprueba el trío canónico y lo sustituye de manera recuperable. `src/pipeline/campaign/finalization.ts` consolida la instantánea de `catalogs/campaigns/<runId>/` al aprobar y finalizar; `src/infrastructure/filesystem/catalog/portable-campaign.ts` conserva originales, finales y acreditación, incluyendo derivados de intervención cuando proceda.

**Retención y consultas:** `src/pipeline/campaign/portable-inventory.ts` y `portable-migration.ts` verifican o consolidan datos portátiles sin modificar acreditaciones por una mera consulta. La retención conserva como máximo dos campañas acreditadas; los originales individuales tienen ciclo de vida independiente. Los controles sobre archivos antiguos y respaldos se implementan en `src/infrastructure/filesystem/catalog/` y los componentes de almacenamiento y retención.

**Preparación offline:** `src/cli/commands/catalog/prepare.ts` utiliza `src/pipeline/preparation/` y `src/catalog/preparation/` para comprobar origen, normalizar, resolver evidencias y emitir `ready/review` con huellas `rulesVersion: 2`. `prepareSourceProduct` y `prepareWithCatalog` siguen siendo las entradas de `src/catalog/preparation/prepare-product.ts`. La preparación canónica mantiene `categorySellID: null`, `attributes: []` y la información técnica en `spec`; el modo con catálogo comercial es distinto. La recuperación técnica, la composición editorial y las validaciones están separadas como se detalla a continuación.

**Cobertura, selección e intervenciones:** `src/catalog/coverage/` y `src/catalog/editorial/` aplican los controles productivos; `src/cli/commands/catalog/select-publishable.ts` expone la selección. Los scripts permanentes están en `interventions/`, los contratos en `src/catalog/interventions/contracts.ts` y su carga y validación en `src/infrastructure/filesystem/intervention-scripts/`. La composición y aprobación de intervenciones no autoriza sobrescribir originales ni publicaciones acreditadas.

**Auditor de huecos de contenido:** `src/cli/commands/catalog/catalog-content-gaps.ts` conserva el diagnóstico de fuentes canónicas (`findCampaignBaseline` o `readCanonicalCatalog` → `prepareSourceProduct` → `src/catalog/diagnostics/content-gaps-source.ts`). También usa el descubrimiento de **publicaciones acreditadas vigentes** para `--finales` y `--comparar`: lee los JSON inmutables, empareja identidades con canónicos disponibles, prepara en memoria y analiza cobertura (`description-coverage.ts`), calidad (`editorial-quality.ts`), prioridades (`description-priorities.ts`) y, con `--comparar --specs`, presencia de claves técnicas (`specification-coverage.ts`). Mercaeleva se etiqueta como reconstrucción de publicación cuando no existe canónico independiente. Los diagnósticos son observacionales y **no** publican, aprueban ni modifican campañas, originales o versiones. Ver [Auditor de huecos](CATALOG_CONTENT_GAPS.md).

**Compatibilidad comercial heredada:** `src/catalog/legacy-export/`, `src/pipeline/legacy-export/` y `src/infrastructure/spreadsheet/` conservan exportación de altas XLSX/JSON para preparaciones comerciales históricas verificables. **Una preparación canónica nueva se bloquea expresamente** en ese exportador, al carecer de asignaciones comerciales. No forma parte de la cadena de entrega, y ningún proceso realiza importaciones HTTP. La categorización y adaptación comercial actuales son responsabilidad del proceso receptor; ver [Integración](EQUIPZILLA_INTEGRATION.md).

## Flujo interno de preparación y límites de cambio

`prepare-product.ts` coordina un único recorrido sobre cada `ProductRecord` y construye el `PreparedProduct`, pero no debe alojar los algoritmos de cada proveedor. La secuencia efectiva es:

1. Capturar evidencia editorial de la fuente (`mapping/source-editorial-evidence.ts`), comprobar semántica y conflictos de publicación, y aplicar reconciliaciones de origen de GAM y Mercaeleva (`reconciliation/`, evidencia de specs de plataforma).
2. Recuperar specs de base (`recovery/gam-technical-recovery.ts`) y después specs documentadas (`recovery/documented-technical-recovery.ts`) mediante resolutores por proveedor en `evidence/providers/`. El orden de aplicación es parte del comportamiento: los resultados de una recuperación alimentan la siguiente. `evidence/documented-technical-evidence.ts` concentra comprobaciones compartidas; las evidencias verificadas permanecen identificadas por modelo, familia o procedencia, **no por número de fase**.
3. Reconciliar identidad y campos antes de componer las descripciones en `mapping/prepared-editorial.ts`, que delega en los mapeadores por proveedor. Las descripciones condensadas acreditadas de GAM viven en `evidence/providers/gam/editorial/condensed/`, con un resolutor común en `mapping/providers/gam/editorial-descriptions/condensed-editorial-resolver.ts`.
4. Calcular incidencias de fuente, condición, referencia, precio, campos técnicos y conflictos editoriales; solo si no hay incidencias permitir enriquecimientos finales en `mapping/verified-editorial-finalization.ts`. Construir `ImportCandidate`, mantener las comprobaciones de importación exclusivamente para `prepareWithCatalog`, y devolver `ready` o `review` sin publicar.

**Regla para ampliar evidencias:** situar el dato acreditado en la familia/proveedor de `evidence/`; encapsular la transformación reutilizable en su resolutor o en `mapping/`; incorporar un nuevo paso de recuperación únicamente en el orquestador correspondiente y con pruebas de aplicabilidad, variantes negativas y no sobrescritura. No copiar specs entre máquinas por similitud de modelo, introducir ramas cronológicas (`phase`, `pending`, `residual`) ni convertir la CLI en un motor de recuperación. Si se cambia el orden o cualquier archivo compilado incluido en las reglas, revisar la huella `rulesSha256` y la compatibilidad de preparaciones antes de activar nuevos finales.

**Auditor de gaps:** `src/cli/commands/catalog/catalog-content-gaps.ts` coordina los modos; `catalog-content-gaps-options.ts` valida opciones, `src/infrastructure/filesystem/catalog/original-catalog-sources.ts` resuelve originales canónicos y `src/cli/reporting/catalog-content-gaps-output.ts` presenta los diagnósticos. El análisis de descripción, prioridades, densidad técnica y specs permanece en `src/catalog/diagnostics/`. Ningún resultado del auditor modifica una ficha ni autoriza una publicación. Ver [Auditor de huecos](CATALOG_CONTENT_GAPS.md).

**Publicación e informe de trabajo:** `src/pipeline/publication/individual-finish.ts` realiza preflight, entrega, activación y recuperación; la aceptación de diferencias está aislada en `publication-acceptance.ts` y sus tipos en `publication-contracts.ts`. La medición del trabajo original → publicado reside en `src/catalog/diagnostics/{preparation-work,published-work}.ts`, la recopilación verificada en `src/pipeline/publication/individual-work-report.ts` y la presentación/ZIP en `src/cli/reporting/{published-work,published-work-archive}.ts`. El informe refleja transformaciones del conjunto acreditado, **no** crea una versión de catálogo ni sustituye auditoría, aprobación o publicación. Ver [Publicación individual](INDIVIDUAL_PUBLICATION.md).

## Naming, pruebas y huellas

La organización de carpetas técnicas usa **inglés** y agrupa por dominio y responsabilidad. Se conservan en español los comandos operativos (`npm run estado`, `npm run revisar`, etc.) y los textos de salida. Los IDs, el contenido persistido, los contratos públicos y los scripts de intervención ya acreditados no se renombran sin analizar expresamente su compatibilidad.

`npm test` ejecuta primero la compilación (`scripts/run-build.mjs --quiet`) y después `scripts/run-tests.mjs`. El runner descubre archivos `.test.ts` bajo `src/`, lanza los `.test.js` de `dist/` e incorpora las suites `.test.mjs` de `scripts/`. La prioridad de determinadas suites se define mediante rutas compiladas en `scripts/run-tests.mjs`; mover tests requiere actualizar esa lista y comprobar fixtures construidas con `import.meta.url`. Los scripts de prueba que generan código TypeScript deben mantener las rutas de importación **desde la ubicación del archivo generado**, no desde la ubicación del test que contiene la cadena.

`src/infrastructure/filesystem/preparation/preparation-inputs.ts` calcula `rulesSha256` a partir del conjunto ordenado de nombres relativos y contenidos de reglas **JavaScript compiladas**. Un movimiento de carpetas o un cambio en imports compilados puede cambiar esa huella aunque el comportamiento productivo sea equivalente. La nueva huella no autoriza editar manualmente preparaciones anteriores, aprobaciones ni finales; deben verificarse procedencia, compatibilidad y acreditación con el procedimiento vigente. La comparación de `npm run estado`, el build y los tests protege aspectos distintos y no certifica por sí sola una re-acreditación.

## Reglas de mantenimiento

- Conservar APIs, contratos y formatos de archivo existentes; advertir antes de cambios incompatibles.
- Evitar mezcla de UI/CLI, red, filesystem y reglas de negocio.
- No duplicar reglas entre proveedores; tampoco generalizar comportamientos que solo estén acreditados para uno.
- Nombrar módulos por equipo, familia, evidencia o responsabilidad estable. Los números de campañas y etiquetas `pending`/`residual` solo son apropiados en artefactos históricos cuyo significado dependa realmente de ellos; no usarlos para bautizar nueva lógica productiva.
- Mantener la persistencia atómica o de creación exclusiva, la integridad de manifests y la preservación de la última publicación válida. No incorporar un segundo almacén definitivo ni hacer que Git decida la validez del catálogo.
- Preservar la separación entre `storage/` operativo y `catalogs/` definitivo: no promocionar pruebas, parciales o preparaciones sin aprobación; no reescribir una instantánea acreditada para corregir fichas.
- Tras una operación que cambie datos consolidados, comprobar integridad con `estado` y revisar explícitamente los cambios de Git; el programa no hace commits ni valida el índice.
- Comparar resultados reales antes y después de alterar parsers, mappers, deduplicación o selección.
- Añadir un proveedor mediante `ScraperProvider`, `registry.ts` y su configuración, con pruebas específicas de paginación, identidad y calidad.

Consulta [Reglas de datos](SCRAPER_DATA_RULES.md) para los formatos y [Validación](VALIDATION.md) para los controles operativos.
