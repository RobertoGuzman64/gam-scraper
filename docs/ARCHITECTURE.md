# Arquitectura

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Visión general

Aplicación CLI de Node.js y TypeScript con módulos ESM. El scraper se ejecuta como proceso local o programado; **no tiene servidor HTTP ni persistencia en el backend de Equipzilla**.

```text
scripts/              Entrada npm, ayuda y ejecución programada
interventions/        Scripts de intervención permanentes versionados
src/
  cli/                Argumentos, comandos y presentación de resultados
  contracts/          Contratos de extracción y catálogo
  scraping/           Motor, registro y adaptadores de proveedores
    engine/           Procesamiento de categorías y fichas
    parsing/          Utilidades comunes de HTML y fotografías
    providers/        gam/, gomariz/, mercaeleva/, manain/
  catalog/            Identidad, normalización y validaciones de producto
    coverage/         Diferencias entre catálogos y expediente de revisión
    editorial/        Selección y exclusiones acreditadas
    import/           Preparación técnica actual y compatibilidad comercial heredada
  pipeline/           Orquestación de extracción, lotes, publicación,
                      preparación, validación y exportación
  infrastructure/     HTTP, navegador, archivos, bloqueos y salida XLSX heredada
  shared/             Utilidades transversales como CSV
  tools/              Consultas offline opcionales de solo lectura
    gam/              Normalización y conversión de semillas GAM

data/category/        Snapshot comercial heredado del receptor
data/import/          Snapshot de atributos comercial heredado
storage/              Datos de ejecución, recuperación y evidencias no versionadas
catalogs/
  providers/<id>/original/  Original individual completo vigente (trío verificable)
  campaigns/<runId>/      Selección editorial acreditada e instantánea verificable
```

El registro de proveedores vive en `src/scraping/registry.ts`; el conjunto de campaña actual (GAM, Gomariz, Mercaeleva y Manain) se declara en `src/contracts/campaign-providers.ts`. El contrato admite además lectura de referencias históricas de tres proveedores; esto no convierte esos lotes en campañas actuales completas. Los contratos de datos se definen en `src/contracts/`. Las pruebas `.test.ts` están próximas a los módulos que protegen. El resultado del compilador se escribe en `dist/`, que no se versiona.

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

**Extracción:** `cli` selecciona proveedor → `scraping/registry.ts` → `pipeline/scrape-run.ts` → motor y adaptador → deduplicación e integridad → `pipeline/publication/` → catálogo, CSV, preparación e informes. El adaptador de Mercaeleva puede necesitar Chrome/Chromium externo.

**Lote:** `cli/batch.ts` → `pipeline/batch/` → proveedores ejecutados secuencialmente en procesos hijos → logs individuales y resumen en `storage/runs/`. La campaña global de `cli/campaign-extract.ts` comparte el `runId` entre informe y carpeta aislada en `storage/scraped/campaigns/`; `pipeline/campaign/campaign-retention.ts` admite hasta dos campañas, verifica entregas por `runId` y registra retiradas recuperables en `.rotation.json` con escritura atómica. El lock es **local al sistema de archivos**, no distribuido; el scraping individual no comparte necesariamente esa exclusión.

**Persistencia portátil:** `pipeline/extraction/run.ts` solo promociona una extracción individual elegible (todas las categorías, opciones y salida predeterminadas), tras la publicación correcta. `infrastructure/filesystem/catalog/portable-original.ts` comprueba el trío canónico y lo sustituye mediante preparación temporal y respaldo recuperable. La existencia de `catalogs/providers/` no convierte un parcial en completo. `pipeline/campaign/finalization.ts` genera la instantánea de `catalogs/campaigns/<runId>/` **al aprobar y finalizar** la selección; `portable-campaign.ts` guarda originales, cuatro finales, selección, aprobación y, cuando proceda, el derivado y expediente de intervención. Una instantánea existente para el mismo `runId` se verifica y no se reescribe con contenidos diferentes.

**Retención y consulta:** la rotación recuperable de campañas también retira su instantánea portátil asociada cuando corresponde; se admite un máximo de dos campañas acreditadas. La limpieza de respaldos individuales exige comprobar que el trío vigente coincide byte a byte con `catalogs/`; se conserva `active.json` y no se eliminan históricos desconocidos o incompletos. `pipeline/campaign/portable-inventory.ts` alimenta el `estado` de solo lectura, detecta diferencias e integridad sin reparar ni modificar los archivos. `portable-migration.ts` permite inspeccionar o consolidar datos anteriores sin reextraer, borrar `storage/` ni aprobar decisiones. Todo dato operativo pendiente permanece sujeto a sus propios controles de recuperación.

**Preparación offline:** `cli/prepare.ts` → `pipeline/preparation/` → lectura íntegra del catálogo canónico y comprobación de procedencia → `prepareSourceProduct` → diagnóstico técnico `ready/review` y candidato con `categorySellID: null`, `attributes: []` y `spec` originales → documento con huellas del origen y reglas técnicas (`rulesVersion: 2`). No consulta portales, inventario del backend ni snapshots comerciales. Los documentos anteriores (`rulesVersion: 1`) se reconocen como formato heredado, pero no se reinterpretan como preparaciones nuevas válidas.

**Auditoría y selección:** `catalog/coverage/` compara fuentes y exige revisión acreditada; `catalog/editorial/` decide productos seleccionables y exclusiones; `cli/select-publishable.ts` genera únicamente las salidas autorizadas. Las reglas de identidad y de cohorte específicas existentes siguen siendo restricciones productivas: un refactor no puede neutralizarlas.

**Auditor de huecos de contenido:** `src/cli/commands/catalog/catalog-content-gaps.ts` conserva el diagnóstico de fuentes canónicas (`findCampaignBaseline` o `readCanonicalCatalog` → `prepareSourceProduct` → `src/catalog/diagnostics/content-gaps-source.ts`). También usa el descubrimiento de **publicaciones acreditadas vigentes** para `--finales` y `--comparar`: lee los JSON inmutables, empareja identidades con canónicos disponibles, prepara en memoria y analiza cobertura (`description-coverage.ts`), calidad (`editorial-quality.ts`), prioridades (`description-priorities.ts`) y, con `--comparar --specs`, presencia de claves técnicas (`specification-coverage.ts`). Mercaeleva se etiqueta como reconstrucción de publicación cuando no existe canónico independiente. Los diagnósticos son observacionales y **no** publican, aprueban ni modifican campañas, originales o versiones. Ver [Auditor de huecos](CATALOG_CONTENT_GAPS.md).

**Compatibilidad comercial heredada:** `pipeline/export/` y `infrastructure/spreadsheet/` conservan exportación de altas XLSX/JSON para preparaciones comerciales históricas verificables. **Una preparación canónica nueva se bloquea expresamente** en ese exportador, al carecer de asignaciones comerciales. No forma parte de la cadena de entrega, y ningún proceso realiza importaciones HTTP. La categorización y adaptación comercial actuales son responsabilidad del proceso receptor; ver [Integración](EQUIPZILLA_INTEGRATION.md).

## Reglas de mantenimiento

- Conservar APIs, contratos y formatos de archivo existentes; advertir antes de cambios incompatibles.
- Evitar mezcla de UI/CLI, red, filesystem y reglas de negocio.
- No duplicar reglas entre proveedores; tampoco generalizar comportamientos que solo estén acreditados para uno.
- Mantener la persistencia atómica o de creación exclusiva, la integridad de manifests y la preservación de la última publicación válida. No incorporar un segundo almacén definitivo ni hacer que Git decida la validez del catálogo.
- Preservar la separación entre `storage/` operativo y `catalogs/` definitivo: no promocionar pruebas, parciales o preparaciones sin aprobación; no reescribir una instantánea acreditada para corregir fichas.
- Tras una operación que cambie datos consolidados, comprobar integridad con `estado` y revisar explícitamente los cambios de Git; el programa no hace commits ni valida el índice.
- Comparar resultados reales antes y después de alterar parsers, mappers, deduplicación o selección.
- Añadir un proveedor mediante `ScraperProvider`, `registry.ts` y su configuración, con pruebas específicas de paginación, identidad y calidad.

Consulta [Reglas de datos](SCRAPER_DATA_RULES.md) para los formatos y [Validación](VALIDATION.md) para los controles operativos.
