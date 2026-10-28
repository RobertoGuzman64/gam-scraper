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
storage/              Datos de ejecución y evidencias no versionadas
```

El registro de proveedores vive en `src/scraping/registry.ts`; el conjunto de campaña actual (GAM, Gomariz, Mercaeleva y Manain) se declara en `src/contracts/campaign-providers.ts`. El contrato admite además lectura de referencias históricas de tres proveedores; esto no convierte esos lotes en campañas actuales completas. Los contratos de datos se definen en `src/contracts/`. Las pruebas `.test.ts` están próximas a los módulos que protegen. El resultado del compilador se escribe en `dist/`, que no se versiona.

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

**Preparación offline:** `cli/prepare.ts` → `pipeline/preparation/` → lectura íntegra del catálogo canónico y comprobación de procedencia → `prepareSourceProduct` → diagnóstico técnico `ready/review` y candidato con `categorySellID: null`, `attributes: []` y `spec` originales → documento con huellas del origen y reglas técnicas (`rulesVersion: 2`). No consulta portales, inventario del backend ni snapshots comerciales. Los documentos anteriores (`rulesVersion: 1`) se reconocen como formato heredado, pero no se reinterpretan como preparaciones nuevas válidas.

**Auditoría y selección:** `catalog/coverage/` compara fuentes y exige revisión acreditada; `catalog/editorial/` decide productos seleccionables y exclusiones; `cli/select-publishable.ts` genera únicamente las salidas autorizadas. Las reglas de identidad y de cohorte específicas existentes siguen siendo restricciones productivas: un refactor no puede neutralizarlas.

**Auditor de huecos de contenido:** `cli/catalog-content-gaps.ts` → `findCampaignBaseline` (última entrega íntegra o referencia histórica) o `readCanonicalCatalog` con `--catalogo` → `prepareSourceProduct` en memoria → `analyzeSourceContentGaps` en `tools/catalog-content-gaps.ts`. Compara descripciones y claves `specs` observadas por categoría **original del proveedor** y aporta evidencias sin asumir que un campo sea obligatorio para toda la familia. No consulta catálogos comerciales ni modifica campañas, referencia o decisiones. Ver [Auditor de huecos](CATALOG_CONTENT_GAPS.md).

**Compatibilidad comercial heredada:** `pipeline/export/` y `infrastructure/spreadsheet/` conservan exportación de altas XLSX/JSON para preparaciones comerciales históricas verificables. **Una preparación canónica nueva se bloquea expresamente** en ese exportador, al carecer de asignaciones comerciales. No forma parte de la cadena de entrega, y ningún proceso realiza importaciones HTTP. La categorización y adaptación comercial actuales son responsabilidad del proceso receptor; ver [Integración](EQUIPZILLA_INTEGRATION.md).

## Reglas de mantenimiento

- Conservar APIs, contratos y formatos de archivo existentes; advertir antes de cambios incompatibles.
- Evitar mezcla de UI/CLI, red, filesystem y reglas de negocio.
- No duplicar reglas entre proveedores; tampoco generalizar comportamientos que solo estén acreditados para uno.
- Mantener la persistencia atómica o de creación exclusiva, la integridad de manifests y la preservación de la última publicación válida.
- Comparar resultados reales antes y después de alterar parsers, mappers, deduplicación o selección.
- Añadir un proveedor mediante `ScraperProvider`, `registry.ts` y su configuración, con pruebas específicas de paginación, identidad y calidad.

Consulta [Reglas de datos](SCRAPER_DATA_RULES.md) para los formatos y [Validación](VALIDATION.md) para los controles operativos.
