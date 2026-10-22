# Arquitectura del scraper de Equipzilla

Referencia técnica del **repositorio reorganizado tras las fases 1 y 2 y revisado en fase 3**. El proceso es una aplicación CLI Node.js/TypeScript ESM con comprobación estricta de tipos. No hay servidor HTTP ni conexión directa al backend de Equipzilla.

La fase 2 resolvió las rutas movidas en la fase 1 y separó contratos, reglas por proveedor, preparación, calidad, navegador y publicación. Durante la fase 3 se comprobaron **162 archivos TypeScript**, sin imports internos inexistentes ni ciclos de dependencias de ejecución. Con el compilador TypeScript global y tipos Node locales se emitió `dist/` para efectuar pruebas parciales: **96 pruebas superadas**; otras **24 suites no pudieron arrancar por falta de Cheerio o `p-limit`**, sin llegar a ejecutar sus aserciones. Se verificó además la carga del catálogo local y la integridad ZIP/XML de un XLSX de prueba con `Nuevo` y `Segunda_Mano`. La instalación `npm ci` falló por falta de conectividad al registro npm, de modo que **no se acredita un build completo ni toda la batería de tests**. Quedan pendientes `npm ci`, `npm run build` y `npm test` con las dependencias reales.

## Organización real

```text
src/
├── cli/
│   ├── index.ts, scrape.ts, batch.ts, validate.ts, export.ts
│   ├── options/           Argumentos y validaciones de CLI
│   └── reporting/         Progreso y resúmenes de consola
├── contracts/
│   ├── catalog.ts, scraping.ts, progress.ts
├── scraping/
│   ├── provider.ts, registry.ts
│   ├── engine/            scrape-category.ts
│   ├── parsing/           HTML e imágenes compartidos
│   └── providers/
│       ├── gam/           Adaptador, condición, listados, ficha, descripciones y especificaciones
│       ├── gomariz/       adapter.ts, config.ts, parsers.ts
│       └── mercaeleva/    Adaptador, navegador de catálogo y script de paginación
├── catalog/
│   ├── identity.ts, identity-conflicts.ts, product-validation.ts, snapshot.ts, quality.ts
│   ├── normalization/     Especificaciones y descripciones de productos
│   └── import/
│       ├── mapping/       Resolución común y reglas particulares bajo providers/<id>/
│       ├── preparation/   Contratos, condición, ficha, lote y validaciones de importación
│       ├── export/        Inventario de referencias y planificación de altas
│       └── tests/         Pruebas del dominio de importación
├── pipeline/
│   ├── scrape-run.ts
│   ├── preparation/       Preparación y comparación offline sobre catálogos completos
│   ├── publication/       Ensamblado de catálogo, persistencia, CSV e informes
│   ├── batch/             Ejecución, contratos y persistencia de informes
│   ├── validation/        Preflight de catálogo publicado
│   └── export/            Lectura validada de preparación e inventario
├── infrastructure/
│   ├── browser/           DevTools de Chrome compartido
│   ├── http/              Fetch y reintentos
│   ├── filesystem/        Persistencia y lectura del catálogo de destino
│   ├── locking/           Bloqueo de lotes
│   └── spreadsheet/       Generador XLSX
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
3. El motor usa el adaptador (listado, parseo, referencias, árbol; navegador específico de Mercaeleva cuando corresponde) e `infrastructure/http/fetch-html.ts`. La regla de condición comercial de GAM se resuelve mediante un punto de extensión opcional del proveedor, sin condicionales de GAM en el motor.
4. `pipeline/publication/publish.ts` deduplica mediante `catalog/identity.ts`, evalúa calidad/comparaciones y publica un `ProductRecord[]` canónico completo mediante `infrastructure/filesystem/canonical-catalog.ts` y los CSV mediante `csv-serializer.ts`. La preparación heredada sigue generándose durante la publicación por `pipeline/publication/legacy-preparation.ts`, por compatibilidad con consumidores existentes. No se descartan máquinas por su elegibilidad para Excel.
5. `cli/reporting/scrape-progress.ts` presenta el progreso compacto y el resultado; `--verbose` permite detalles adicionales.

### Lote de proveedores

`src/cli/batch.ts` invoca `pipeline/batch/run.ts`, que ejecuta en secuencia procesos hijos con el **entrypoint compilado `dist/cli/scrape.js`**. Cada proveedor tiene log independiente; los informes se archivan en `storage/runs/<run>/`. La CLI muestra un resumen total y devuelve error si el lote no es `complete`. `--dry-run` solamente describe la ejecución.

El bloqueo `storage/scraped/.batch.lock` funciona únicamente para procesos que comparten filesystem local. La extracción individual no utiliza ese lock.

### Validación y Excel de altas

`cli/validate.ts` → `pipeline/validation/{preflight,offline}.ts`: verifica coherencia temporal, integridad de hashes, totales, URLs, referencias, preparación y estado publicado. No comprueba el total anunciado en la web del proveedor.

`cli/export.ts` presenta el proceso; `pipeline/export/prepare-export.ts` consume una preparación validada y el inventario confirmado, usa `catalog/import/export/export-plan.ts` e `infrastructure/spreadsheet/xlsx.ts` y genera un Excel offline de **altas**. No llama a la API del backend, no actualiza referencias existentes y no produce bajas.

### Preparación independiente y estado de transición (22/10/2026)

`cli/prepare.ts` recibe los argumentos de `cli/options/prepare.ts`; `pipeline/preparation/prepare.ts` coordina lectura íntegra de `-catalog.json`, `prepareImportBatch` y escritura exclusiva. `catalog/import/preparation/offline-document.ts`, `offline-diagnostics.ts` y las reglas de mapeo existentes definen resultados, diagnósticos y comparaciones. `infrastructure/filesystem/preparation-inputs.ts` identifica los snapshots de destino y el código de las reglas que se ejecuta; `offline-preparation.ts` guarda/lee una huella externa de la preparación.

`npm run prepare` consume catálogos publicados completos (incluidos históricos íntegros), sin Chrome, HTML, peticiones HTTP ni consulta de inventario. La preparación nueva contiene `version`, `source` (proveedor, prefijo, ámbito, hash canónico y total), `fingerprints` (versión de reglas, SHA-256 de reglas y snapshots), `preparedAt`, `identities`, `totals`, `quality`, `published` y `products: PreparedProduct[]`. Los metadatos diagnósticos son independientes del JSON de candidatos. Se mantiene un manifest SHA-256 externo, y las salidas se crean con exclusión de sobrescrituras y rollback ante errores. Al repetir, la identidad y el hash permiten comparar la misma cohorte o marcar una comparación no homogénea; se rastrean regresiones y cambios de mapeo sin atribuirlos a scraping.

`publish.ts` **continúa** generando la preparación heredada para mantener sin cambios los comandos `validate` y `export`, y sus contratos de integridad. `validate --stage catalog|preparation` y `export` aceptan además el flujo canónico/offline verificado; `pipeline/validation/offline.ts` rehace la preparación con las reglas actuales y compara identidades, fingerprints y hashes antes del Excel. No se han cambiado endpoints ni permisos comerciales.

## Contratos que deben conservarse

- **Proveedor:** `ScraperProvider` definido en `scraping/provider.ts`; identificadores actuales `gam`, `gomariz`, `mercaeleva`. El registro y las opciones por defecto son parte del flujo de selección. `resolveCondition` es un punto de extensión opcional y compatible para resolver condiciones por proveedor.
- **CSV:** columnas base `categoryKey`, `categoryName`, `title`, `shortDescription`, `longDescription`, `price`, `reference`, `brand`, `model`, `year`, `location`, `country`, `horometer`, `serialNumber`, `image`, `url`, `specJson`, `providerId`, `imagesJson`, más columnas dinámicas `spec__*`.
- **Identidad:** las referencias, la serie y la URL ayudan a identificar unidades, **aisladas por proveedor**. Dos máquinas del mismo modelo no son necesariamente la misma unidad.
- **Publicación:** `-catalog.json` y `-catalog.manifest.json` (solo para completas), `-all.csv`, archivos por categoría, `-preparation.json`, `-summary.json`, `-changes.json`, `-errors.json`, `-categories.csv` y `-snapshot-<scope>.json`; resultados `-partial-*` no sustituyen una publicación válida. El lector canónico verifica esquema, identidad, hash externo, proveedor, ejecución y totales frente al resumen activo o histórico. El historial conserva dos generaciones anteriores y permite migración desde publicaciones sin canónico.
- **Integridad:** las huellas SHA-256 del CSV, la preparación heredada y, cuando existe, el catálogo canónico se contrastan con el resumen. Si una publicación lanza un error y existe una versión anterior protegida, se restauran sus archivos y metadatos; un corte abrupto del proceso exige comprobar el estado de `active.json` y los archivos antes de continuar. `suspectedMissing` es una observación, **no una orden de borrado**.
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
