# Arquitectura del scraper de Equipzilla

Referencia técnica del **repositorio actual tras su reestructuración**. El proceso es una aplicación CLI Node.js/TypeScript ESM con comprobación estricta de tipos. No hay servidor HTTP ni conexión directa al backend de Equipzilla.

## Organización real

```text
src/
├── cli/
│   ├── index.ts, scrape.ts, batch.ts, validate.ts, export.ts
│   ├── options/           Argumentos y validaciones de CLI
│   └── reporting/         Progreso y resúmenes de consola
├── contracts/
│   ├── catalog.ts, scraping.ts
├── scraping/
│   ├── provider.ts, registry.ts
│   ├── engine/            scrape-category.ts
│   ├── parsing/           HTML e imágenes compartidos
│   └── providers/
│       ├── gam/           adapter.ts, config.ts, parsers.ts, tree.ts
│       ├── gomariz/       adapter.ts, config.ts, parsers.ts
│       └── mercaeleva/    adapter.ts, browser.ts, config.ts, parsers.ts
├── catalog/
│   ├── identity.ts, quality.ts
│   ├── normalization/     Especificaciones técnicas
│   └── import/            Catálogos, mapeo, preparación y Excel
├── pipeline/
│   ├── scrape-run.ts
│   ├── publication/       Publicación, CSV y snapshots
│   ├── batch/             Ejecución secuencial e historial
│   └── validation/        Preflight de catálogo publicado
├── infrastructure/
│   ├── http/              Fetch y reintentos
│   └── filesystem/        Escritura atómica local
├── shared/                Lectura/escritura CSV transversal
└── tools/gam/             Normalizador y conversores de seeds heredados

data/category/            Snapshot de categorías del destino
data/import/              Snapshot de atributos del destino
scripts/run-scheduled.ps1 Lanzador del lote para Windows
storage/                  Datos de ejecución, fuera de Git
```

Las pruebas `.test.ts` están junto a cada área: `scraping/tests`, `catalog/**/tests`, `pipeline/**/tests` y `cli/**/tests`.

## Límites de responsabilidad

| Capa             | Responsabilidad                                                                           | Evitar                                                       |
| ---------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `cli`            | Interpretar comandos, presentar progreso/resúmenes, establecer códigos de salida.         | Implementar parsers HTML o reglas de catálogo.               |
| `contracts`      | Tipos compartidos (`ProductRecord`, `ScrapeOptions`, `Summary`, etc.).                    | IO y dependencias de ejecución.                              |
| `scraping`       | Extraer categorías, listados y fichas mediante `ScraperProvider`.                         | Escribir Excel o decidir reglas de importación.              |
| `catalog`        | Identidad de máquinas, deduplicación, calidad, normalización y preparación de candidatos. | Presentación en terminal o peticiones de scraping.           |
| `pipeline`       | Orquestar extracción, publicación, validación y lotes.                                    | Incorporar HTML específico de proveedores.                   |
| `infrastructure` | Acceso HTTP y escritura local reutilizable.                                               | Conocer el catálogo del proveedor o permisos de importación. |
| `shared`         | CSV transversal sin reglas de negocio.                                                    | Incorporar lógica de proveedores.                            |
| `tools/gam`      | Compatibilidad con normalización y seeds históricos de GAM.                               | Acoplarse al camino ordinario de los otros proveedores.      |

La dirección principal es **CLI → pipeline → scraping/catalog/infrastructure**. `scraping` usa contratos e infraestructura; `catalog` mantiene las reglas y los mapeos. Los adaptadores se registran en **un único punto**, `src/scraping/registry.ts`. No crear reexports genéricos que disimulen dependencias con GAM ni introducir capas vacías.

## Flujos de ejecución

### Extracción individual

1. `src/cli/index.ts` distribuye a `src/cli/scrape.ts` y `cli/options/scrape.ts` obtiene proveedor, modo y opciones.
2. `scraping/registry.ts` entrega el adaptador; `pipeline/scrape-run.ts` organiza categorías y pide resultados a `scraping/engine/scrape-category.ts`.
3. El motor usa el adaptador (listado, parseo, referencias, árbol; navegador específico de Mercaeleva cuando corresponde) e `infrastructure/http/fetch-html.ts`.
4. `pipeline/publication/publish.ts` deduplica mediante `catalog/identity.ts`, evalúa calidad/comparaciones, genera preparación desde `catalog/import` y publica salidas mediante `csv-serializer.ts` y escritura atómica.
5. `cli/reporting/scrape-progress.ts` presenta el progreso compacto y el resultado; `--verbose` permite detalles adicionales.

### Lote de proveedores

`src/cli/batch.ts` invoca `pipeline/batch/run.ts`, que ejecuta en secuencia procesos hijos con el **entrypoint compilado `dist/cli/scrape.js`**. Cada proveedor tiene log independiente; los informes se archivan en `storage/runs/<run>/`. La CLI muestra un resumen total y devuelve error si el lote no es `complete`. `--dry-run` solamente describe la ejecución.

El bloqueo `storage/scraped/.batch.lock` funciona únicamente para procesos que comparten filesystem local. La extracción individual no utiliza ese lock.

### Validación y Excel de altas

`cli/validate.ts` → `pipeline/validation/preflight.ts`: verifica coherencia temporal, integridad de hashes, totales, URLs, referencias, preparación y estado publicado. No comprueba el total anunciado en la web del proveedor.

`cli/export.ts` consume una preparación validada y el inventario confirmado, usa `catalog/import/export-plan.ts` y `xlsx.ts` y genera un Excel offline de **altas**. No llama a la API del backend, no actualiza referencias existentes y no produce bajas.

## Contratos que deben conservarse

- **Proveedor:** `ScraperProvider` definido en `scraping/provider.ts`; identificadores actuales `gam`, `gomariz`, `mercaeleva`. El registro y las opciones por defecto son parte del flujo de selección.
- **CSV:** columnas base `categoryKey`, `categoryName`, `title`, `shortDescription`, `longDescription`, `price`, `reference`, `brand`, `model`, `year`, `location`, `country`, `horometer`, `serialNumber`, `image`, `url`, `specJson`, `providerId`, `imagesJson`, más columnas dinámicas `spec__*`.
- **Identidad:** las referencias, la serie y la URL ayudan a identificar unidades, **aisladas por proveedor**. Dos máquinas del mismo modelo no son necesariamente la misma unidad.
- **Publicación:** `-all.csv`, archivos por categoría, `-preparation.json`, `-summary.json`, `-changes.json`, `-errors.json`, `-categories.csv` y `-snapshot-<scope>.json`; resultados `-partial-*` no sustituyen una publicación válida.
- **Integridad:** las huellas SHA-256 del CSV y la preparación se contrastan con el resumen. `suspectedMissing` es una observación, **no una orden de borrado**.
- **Snapshots de destino:** `data/category/categorySell-flat.json` y `data/import/attributeCatalog.json` se leen en tiempo de ejecución. No moverlos ni cambiar su formato al añadir proveedores.
- **Scripts npm existentes:** conservar los alias históricos mientras haya consumidores (`scrape:all`, `validate:catalog`, `export:import` y herramientas GAM).
- **Importación:** `ready` es solo un indicador local de preparación; importación a Equipzilla requiere aprobación, `companyID` real e inventario de la empresa actualizado.

## Incorporar un proveedor sin expandir la arquitectura

1. Crear `src/scraping/providers/<id>/` con `adapter.ts`, `config.ts` y `parsers.ts` según las necesidades reales. No copiar el navegador de Mercaeleva si el portal no lo necesita.
2. Implementar la interfaz **existente** `ScraperProvider` en `adapter.ts` y definir las categorías/opciones en `config.ts`. Reutilizar `scraping/engine/`, `scraping/parsing/` e infraestructura; mantener selectores y paginación en el adaptador.
3. Registrarlo en `src/scraping/registry.ts`.
4. Añadir fixtures/pruebas de parser, referencias y paginación; ejecutar `npm test`.
5. Ejecutar extracción real, contrastar recuentos del portal y revisar categorías/atributos del destino. Un proveedor que corre sin lanzar excepciones todavía puede tener cobertura incompleta.
6. Solo después de la aceptación operativa, incorporarlo a un lote programado. El runner detecta los IDs registrados; no necesita código específico de la empresa.

## Decisiones de mantenimiento

- No mezclar reglas de negocio con UI de terminal o IO.
- No crear directorios, interfaces, módulos índice ni servicios genéricos sin una necesidad concreta.
- No mover el lector de snapshots sin corregir su ruta de resolución.
- Tratar cambio de CSV, esquema JSON, snapshots, flags o códigos de salida como **cambio de contrato**, no como simple refactor.
- Antes de aceptar cambios: compilar, probar, extraer una muestra real y confirmar cobertura externa. La prueba funcional detallada está en [VALIDACION.md](VALIDACION.md).
