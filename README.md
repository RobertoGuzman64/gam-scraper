# Equipzilla Scraper

Herramienta de línea de comandos **Node.js + TypeScript** para extraer maquinaria **nueva y de segunda mano** de **GAM, Gomariz y Mercaeleva**, publicar catálogos CSV/JSON con trazabilidad y generar Excel de **altas** mediante un exportador independiente para el importador existente de Equipzilla. No expone API HTTP ni escribe en el backend. Existe además una vía JSON `POST /product/create/many` en el backend, **todavía no integrada**, cuyo uso debe decidirse y validarse por separado.

> **Objetivo funcional y definición de terminado:** [OBJETIVOS_SCRAPER.md](docs/OBJETIVOS_SCRAPER.md). El backend permite `Nuevo` y `Segunda_Mano`; **la preparación admite ambas condiciones con evidencia de origen**, y mantiene condiciones desconocidas o contradictorias en `review`. Las fichas sin requisitos del Excel permanecen en el catálogo extraído.

> **Estado operativo:** ninguna importación masiva queda autorizada por esta documentación. La auditoría del 20/10/2026 (Mercaeleva 20/221) es **histórica**: [estado de extracciones](docs/ESTADO_EXTRACCIONES_2026-10-20.md). La línea base del **21/10/2026** es **1.374 máquinas** (GAM 1.010, Gomariz 143, Mercaeleva 221) con 748 nuevas bloqueadas por una **restricción local de preparación de aquella versión**, ya corregida en el código actual. Los totales de `ready/review` son históricos y no representan esta versión ni un entorno vivo.

## Instalación

- Node.js `>=18.18.0`, npm y acceso HTTPS a los portales.
- Chrome/Chromium para el fallback headless de Mercaeleva (`CHROME_PATH` o `CHROMIUM_PATH` si no está en `PATH`). Se invoca como proceso externo, sin Puppeteer/Playwright.
- Escritura en `storage/`. Conservar sus archivos entre ejecuciones y no añadirlos a Git.

```bash
npm ci
npm test
npm run build
```

`npm test` compila y ejecuta pruebas locales; **no** valida la cobertura ni la disponibilidad real de los portales. Comprobar que las pruebas de parsers con Cheerio no se omiten.

## Comandos habituales

Desde la raíz del repositorio; `--` separa las opciones de npm de los argumentos del scraper.

```bash
npm run scrape -- gam
npm run scrape -- gomariz
npm run scrape -- mercaeleva
npm run scrape -- all --dry-run
npm run scrape -- all --providers gam,gomariz
npm run scrape -- all
npm run validate -- gam
npm run prepare:catalog -- --help
npm run export -- --help
npm run cli -- --help
```

`npm run scrape -- gam` ejecuta un proveedor. Sin indicar proveedor, `scrape` usa GAM por compatibilidad. `all` ejecuta un **lote secuencial** de proveedores en procesos separados; `--dry-run` muestra el plan sin extraer ni escribir. El lote recopila logs individuales y muestra en consola un resumen breve. El scraper individual muestra progreso compacto y productos únicos al finalizar; `--verbose` habilita más detalle.

| Operación               | Ejemplo                                                  | Nota                                              |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| Categoría de GAM        | `npm run scrape -- gam --category elevacion`             | Se elige una clave configurada en el adaptador.   |
| Diagnóstico limitado    | `npm run scrape -- mercaeleva --pages 2 --prefix prueba` | **No usar como catálogo completo ni importar.**   |
| Selección del lote      | `npm run scrape -- all --providers gam,gomariz`          | Sin `--providers`, incluye todos los registrados. |
| Validar prefijo elegido | `npm run validate -- gam --prefix prueba-gam`            | Los archivos deben estar publicados e íntegros.   |
| Ver ayuda de extracción | `npm run scrape -- --help`                               | Incluye opciones avanzadas y alias.               |
| Ver ayuda del lote      | `npm run scrape:all -- --help`                           | Incluye rutas e historial.                        |
| Ver ayuda de validación | `npm run validate -- --help`                             | Incluye antigüedad máxima.                        |

Alias de opciones del scraper: `--category` / `--categoryKey`, `--pages` / `--maxPages`, `--out` / `--outDir`, `--prefix` / `--outPrefix`. Los nombres largos anteriores siguen funcionando; los scripts npm `scrape:all`, `validate:catalog` y `export:import` se conservan por compatibilidad.

**Atención:** `--pages 2` es un límite máximo, no una garantía de que se haya recorrido el portal. La publicación técnica `complete` tampoco prueba por sí sola la cobertura externa.

## Salidas y validación

La extracción de un proveedor se guarda por defecto en `storage/scraped/<proveedor>/`. La configuración exacta de categorías y prefijos vive en `src/scraping/providers/<proveedor>/config.ts` (GAM incluye también categorías de maquinaria nueva; no asumir únicamente las siete raíces de la auditoría histórica).

| Proveedor    | Prefijo por defecto     |
| ------------ | ----------------------- |
| `gam`        | `scrape-gam-marzo-2026` |
| `gomariz`    | `scrape-gomariz`        |
| `mercaeleva` | `scrape-mercaeleva`     |

Para un prefijo `<prefijo>`, una publicación completa genera `<prefijo>-catalog.json` (catálogo canónico íntegro `ProductRecord`) y `<prefijo>-catalog.manifest.json` (hash SHA-256 externo y metadatos de ejecución), además de `<prefijo>-all.csv`, `<prefijo>-<categoria>.csv`, `-categories.csv`, `-preparation.json`, `-summary.json`, `-changes.json`, `-errors.json` y `-snapshot-<scope>.json`. El resumen incluye `artifacts.catalogSha256`, adicional a los hashes anteriores. Los archivos `-partial-*` sirven **solo para diagnóstico**; no reemplazan el catálogo canónico ni el último CSV válido.

El catálogo canónico **no filtra por elegibilidad Excel**: contiene tanto máquinas nuevas como usadas, incluidas las que no tienen precio, condición confirmada o categoría destino. Puede reabrirse y verificarse localmente mediante `readCanonicalCatalog` (`src/infrastructure/filesystem/canonical-catalog.ts`) sin acceder al portal ni ejecutar mapeos. El historial conserva la publicación actual y hasta dos anteriores, incorporando ambos archivos canónicos en ejecuciones nuevas. Las publicaciones anteriores a este cambio mantienen sus CSV y JSON históricos: no se les reconstruye un canónico ficticio a partir del CSV.

**Etapas 1–3 integradas:** `scrape` conserva los ficheros heredados. `prepare` usa el catálogo canónico sin red. `validate --stage catalog|preparation` distingue integridad de origen y consistencia de preparación; `export` consume la nueva preparación verificando su catálogo y reglas, o admite la publicación heredada de forma compatible.

### Preparación offline y comparación

El script npm se llama `prepare:catalog`, no `prepare`, porque este último es un evento de instalación de npm que se ejecutaría también durante `npm ci`. La suborden de CLI `npm run cli -- prepare` se mantiene.

Desde la raíz del proyecto, tras una extracción completa que ya haya generado `-catalog.json`:

```bash
npm run prepare:catalog -- --help
npm run prepare:catalog -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json --dry-run
npm run prepare:catalog -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json
npm run prepare:catalog -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json --out storage/prepared/gam/scrape-gam-marzo-2026-v2-preparation.json --compare storage/prepared/gam/scrape-gam-marzo-2026-preparation.json
```

Sin `--out`, se usa `storage/prepared/<proveedor>/<prefijo>-preparation.json`. También se escriben `-preparation.manifest.json` (SHA-256 del JSON), `-diagnostics.json` y, con `--compare`, `-comparison.json`. Se rechazan sobrescrituras; para repetir una preparación se usa **otra salida**, manteniendo la anterior. `--dry-run` calcula resultados pero no escribe archivos. Los diagnósticos enumeran bloqueos del Excel, equivalencias no resueltas y problemas de origen **por contrastar**, sin atribuir pérdidas al scraper sin evidencia. La comparación mide cambios por identidad, categoría, atributos y códigos de motivo **solo si coinciden catálogo y cohorte**; si cambian reglas o snapshots lo informa. El replay lee archivos locales, no consulta portales, inventario ni API del backend.

Antes de preparar catálogos históricos es necesario publicar una extracción completa con el catálogo canónico: el CSV antiguo no permite recuperar un `ProductRecord` íntegro y verificable. Una preparación offline debe tener su manifest íntegro y corresponder exactamente al catálogo elegido; si se cambian reglas o snapshots hay que ejecutar `prepare` de nuevo, sin alterar el origen.

El lote conserva `storage/runs/<run>/run.json`, logs por proveedor y copias de informes. Su bloqueo `storage/scraped/.batch.lock` solo es válido para ejecuciones que comparten almacenamiento local compatible.

Para validar la publicación predeterminada:

```bash
npm run validate -- gam
npm run validate -- gomariz
npm run validate -- mercaeleva
```

El validador exige CSV, preparación, resumen y cambios coherentes, hashes correctos y una antigüedad máxima de 48 h por defecto. Códigos de salida: **0** conforme, **2** revisión necesaria y **1** error. No compara automáticamente los totales de la web externa. Consulta [VALIDACION.md](docs/VALIDACION.md).

### Validación por etapas

```bash
npm run validate -- gam --stage catalog --prefix scrape-gam-marzo-2026
npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json
npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-marzo-2026-v2-preparation.json --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json
```

`--stage catalog` valida catálogo, manifest, hash, proveedor, identidades, recuentos y publicación. `--stage preparation` comprueba también el manifest de preparación, fingerprint de reglas y snapshots, identidad y resultado íntegro recalculado desde la fuente **sin portales ni inventario**. Si se usó un nombre de salida distinto del prefijo original, indicar `--source`. La validación heredada `npm run validate -- gam` sigue comprobando CSV, preparación antigua, cambios y máximo de 48 h. La preparación offline puede validarse con cualquier antigüedad; **exportar** mantiene el bloqueo del origen superior a 48 h. El estado `review` de la preparación conserva el código de salida **2**.

## Exportación para importación manual

La extracción **no importa nada**. `ready` en `-preparation.json` indica controles locales satisfechos, no autorización comercial. Para planificar un Excel de altas se necesitan un `companyID` real del entorno destino, un catálogo publicado válido y un inventario **completo y actual** en CSV con `companyID,reference`:

```bash
npm run export -- gam --companyID <ID_REAL> --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json --existing storage/inventory/gam.csv --out storage/import/gam-altas.xlsx --dry-run
```

Para una preparación offline con un nombre o ruta de origen no predeterminados, incluir `--source storage/scraped/gam/<prefijo>-catalog.json`. Para informes anteriores se sigue aceptando `--preparation storage/scraped/gam/<prefijo>-preparation.json` siempre que supere el preflight heredado. **No** se relaja el precio obligatorio del Excel ni se envía nada al backend.

Tras revisar el plan y confirmar expresamente el inventario, sustituir `--dry-run` por `--confirm-inventory` para generar el `.xlsx`. `--allow-empty-inventory` existe, pero requiere justificar que la empresa realmente no tiene referencias registradas. El Excel es **solo para altas**, no actualiza ni elimina productos, no se envía automáticamente y debe revisarse con el importador real. Ver [protocolo de validación](docs/VALIDACION.md).

## Arquitectura y desarrollo

```text
src/
  cli/                 Entradas, opciones y salida de terminal
  contracts/           Tipos compartidos de catálogo y extracción
  scraping/            Motor, parsers y adaptadores de proveedor
  catalog/             Identidad, calidad, normalización e importación
  pipeline/            Ejecución, publicación, lote y validación
  infrastructure/      HTTP y escritura atómica
  shared/              CSV transversal
  tools/gam/           Utilidades históricas específicas de GAM

data/                  Snapshots de categorías y atributos usados por el importador
scripts/               Lanzador externo para Windows
storage/               Resultados y estado de ejecución (ignorado)
```

[ARQUITECTURA.md](docs/ARQUITECTURA.md) explica las fronteras entre módulos, el flujo de datos, los contratos que no deben romperse y los pasos reales para incorporar un proveedor.

### Herramientas heredadas de GAM

Siguen disponibles, independientes del flujo multiproveedor:

```bash
npm run normalize:gam -- <entrada.csv> <salida.csv> --report <informe.json>
npm run convert:gam -- <entrada.csv> <salida.ts> data/category/categorySell-flat.json
npm run category:tree
npm run slugs:gam
```

También existen los scripts `normalize:gam:default`, `convert:gam:default` y `convert:gam:raw:default`. Sus salidas/valores históricos no deben trasladarse sin revisión a otros proveedores ni al backend actual.

## Operación y documentación

- [Objetivos, alcance real y aceptación](docs/OBJETIVOS_SCRAPER.md): finalidad para nuevas y usadas, brechas, prioridades y criterio de terminado.
- [Contrato del importador Equipzilla](docs/EQUIPZILLA_INTEGRATION.md): Excel, campos y límites demostrados.
- [Reglas de datos y preparación](docs/SCRAPER_DATA_RULES.md): trazabilidad de candidatos, publicación y restricciones locales.
- [Arquitectura y contratos](docs/ARQUITECTURA.md): estructura actual, dependencias, datos y extensión de proveedores.
- [Validación y aceptación](docs/VALIDACION.md): pruebas, control de cobertura y condiciones de importación.
- [Despliegue y automatización](docs/DESPLIEGUE_AUTOMATICO.md): ejecución en servidor/Windows y requisitos cloud pendientes.
- [Auditoría del 20/10/2026](docs/ESTADO_EXTRACCIONES_2026-10-20.md): incidencias históricas y limitaciones conocidas.

**No se incluyen** Dockerfile, CI/CD, persistencia cloud ni importación automática. La reestructuración arquitectónica y la simplificación de la CLI **no equivalen a aceptación productiva**.
