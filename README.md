# Scraper multiproveedor → Normalizer → Seed (TypeScript)

Motor multiproveedor con adaptadores **GAM**, **Gomariz** y **Mercaeleva**. Los dos nuevos adaptadores necesitan validación de extracción completa contra las webs reales antes de automatizar su importación.

Repo para automatizar:
- **Scrape** (GAM → CSV)
- **Normalize** de `specJson` (CSV → CSV)
- **Convert** (CSV → seed TS)

---

## Requisitos

- Node **>= 18.18** (recomendado 20+)
- NPM

---

## Instalación

```bash
npm i
```

---

## Flujo recomendado (end-to-end)

### 1) Scrape

```bash
npm run scrape -- --outPrefix scrape-gam-2026-02
```

### 2) Normalize

```bash
npm run normalize:gam -- \
  storage/scraped/gam/scrape-gam-2026-02-all.csv \
  storage/normalized/gam/scrape-gam-2026-02-all.normalized.csv \
  --report storage/normalized/gam/normalize.report.json
```

### 3) Convert (seed TS)

```bash
npm run convert:gam -- \
  storage/normalized/gam/scrape-gam-2026-02-all.normalized.csv \
  storage/seeds/seedDataProduct.gam.ts \
  data/category/categorySell-flat.json
```

---

## Scraper

### Qué hace

- Recoge URLs de productos desde los listados por categoría.
- Visita cada ficha y extrae campos + `specJson`.
- Deduplica por `reference`, luego `serialNumber`, y si no existe, por URL canónica (sin query/hash).
- Escribe CSV por categoría, CSV agregado, CSV de categorías y `summary.json`.

### Ejecutar

Scrape completo de GAM (proveedor por defecto):

```bash
npm run scrape
```

Solo una categoría del config:

```bash
npm run scrape -- --categoryKey elevacion --outPrefix gam-elevacion-2026-02
```

Scrapear una URL concreta (modo single):

```bash
npm run scrape -- --url "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano" --key elevacion --name "Elevación" --outPrefix gam-elevacion-2026-02
```

Descubrir categorías desde una raíz (modo árbol):

```bash
npm run scrape -- --discoverTree --rootUrl "https://online.gamrentals.com/es/3-maquinaria-segunda-mano" --outPrefix gam-tree-2026-02
```

Descubrir subcategorías desde las raíces del config:

```bash
npm run scrape -- --discoverSubcategories --outPrefix gam-subcats-2026-02
```

Para generar solo el CSV de categorías y terminar:

```bash
npm run scrape -- --discoverTree --rootUrl "https://online.gamrentals.com/es/3-maquinaria-segunda-mano" --onlyCategories --outPrefix gam-tree-2026-02
```

### Arquitectura de proveedores (fases 1 y 2)

- `src/scraper/providers/contracts.ts`: contrato de un adaptador (categorías, paginación, parsing, referencia y descubrimiento).
- `src/scraper/providers/index.ts`: registro explícito de adaptadores disponibles; añadir uno nuevo aquí tras implementarlo.
- `src/scraper/providers/gam/*`: implementación GAM, con selectores, URLs y reglas de descubrimiento propias.
- `src/scraper/providers/gomariz/*`: paginación `/venta/page/N/` y referencias recuperadas desde cada ficha.
- `src/scraper/providers/mercaeleva/*`: fichas Mercaeleva y lectura dinámica de listados con Chrome/Chromium cuando el HTML inicial no trae enlaces.
- `src/scraper/scrape.ts`, `http.ts`, `io.ts`, `cli.ts` e `index.ts`: ejecución, red, deduplicación y salidas compartidas.
- `src/scraper/{config,parsers,tree}.ts`: reexportaciones compatibles con imports existentes.

Seleccionar proveedor explícitamente:

```bash
npm run scrape -- --provider gam --categoryKey elevacion --maxPages 1
```

También pueden ejecutarse de forma independiente:

```bash
npm run scrape -- --provider gomariz --maxPages 2 --outPrefix prueba-gomariz
npm run scrape -- --provider mercaeleva --maxPages 2 --outPrefix prueba-mercaeleva
```

Mercaeleva muestra los productos del listado de forma dinámica. Para procesar esa página es necesario tener Chrome/Chromium accesible como comando o indicar su ruta, por ejemplo en PowerShell:

```powershell
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run scrape -- --provider mercaeleva --maxPages 2
```

El adaptador intenta primero una petición HTML normal; si no hay enlaces de maquinaria, renderiza la página con el navegador. **Si tampoco encuentra productos en la portada, detiene el proceso con un error**. La paginación `?page=N` en Mercaeleva debe comprobarse en una ejecución real, porque el listado puede depender de navegación dinámica. No asumir que un CSV de prueba representa el catálogo completo.

Gomariz conserva el identificador visible de cada unidad (por ejemplo, `TE1617`), aunque varias máquinas compartan título y modelo. Los precios de «Ver precio» se guardan vacíos.

`--discoverTree` y `--discoverSubcategories` de los dos nuevos proveedores solo devuelven la categoría principal de venta: no replican el árbol de categorías de GAM.

Un `--provider` desconocido falla antes de hacer peticiones; no se generan productos para empresas sin adaptador.

Los registros incorporan `providerId` y las claves de deduplicación incluyen ese campo. Las columnas CSV previas se mantienen, añadiendo `providerId` al final de las columnas base. La normalización y el conversor `convert:gam` siguen siendo específicos de GAM; no ejecutar ese conversor para otros proveedores hasta implementar su mapeo con IDs reales de empresa y categoría. Los CSV y las salidas de los nuevos proveedores se guardan en `storage/scraped/{proveedor}/`.

Pruebas unitarias y de regresión locales (sin conexión a las webs):

```bash
npm test
```

### Flags (CLI)

Output:
- `--outDir <dir>` (default: `storage/scraped/gam`)
- `--outPrefix <name>` (default: `scrape-gam-marzo-2026`)

Selección:
- `--provider <id>` (default: `gam`, disponibles: `gam`, `gomariz`, `mercaeleva`)
- `--categoryKey <key>` (categorías del adaptador seleccionado; `venta` en Gomariz y Mercaeleva)
- `--url <url>` activa modo single
- `--key <key>` (solo para `--url`, default: `custom`)
- `--name <name>` (solo para `--url`, default: `Custom`)

Descubrimiento:
- `--discoverTree` (requiere `--rootUrl` o `--url`)
- `--rootUrl <url>`
- `--discoverSubcategories`
- `--onlyCategories`

Paginación / parada:
- `--maxPages <n>` (default: `500`)
- `--stallStopAfter <n>` (default: `2`) para cuando no aparecen URLs nuevas

Estabilidad:
- `--concurrencyPages <n>` (default: `2`)
- `--concurrencyProducts <n>` (default: `6`)
- `--timeoutMs <n>` (default: `30000`)
- `--delayMs <n>` (default: `250`)
- `--userAgent <string>`

### Salida

Por defecto en `storage/scraped/gam/`:

- `<outPrefix>-categories.csv`
- `<outPrefix>-<categoryKey>.csv`
- `<outPrefix>-all.csv`
- `<outPrefix>-summary.json`

### Columnas del CSV

Base (siempre):
- `categoryKey`, `categoryName`
- `title`
- `shortDescription`, `longDescription`
- `price`
- `reference`
- `brand`, `model`, `year`
- `location`, `country`
- `horometer`, `serialNumber`
- `image`
- `url`
- `specJson`

Además, columnas dinámicas:
- `spec__<clave>` (una por clave detectada)

---

## Normalizer (specJson)

Normaliza `specJson` (claves + valores) y genera un report.

### Uso

```bash
npm run normalize:gam -- <input.csv> <output.csv> [--report <path>] [--allow-unknown] [--expand-spec-columns] [--max-values-per-key <n>]
```

Flags:
- `--report <path>`: ruta del report JSON
- `--allow-unknown`: permite claves no contempladas (se reportan igualmente)
- `--expand-spec-columns`: recalcula columnas `spec__*` desde el spec normalizado
- `--max-values-per-key <n>`: límite de valores del “top” del report (min 10, max 200)

Salidas:
- CSV normalizado (mantiene columnas base y actualiza `specJson`)
- Report JSON con estadísticas (unknown keys, renames, ejemplos, etc.)

---

## Converter (CSV → seed TS)

Convierte un CSV (idealmente normalizado) a un seed TS y escribe un report de resolución de categoría.

### Uso

```bash
npm run convert:gam -- <input.csv> <output.ts> <categorySell-flat.json>
```

Salidas:
- `output.ts`
- `output.ts.report.json`

### Defaults hardcoded del convert

En el entrypoint (`src/converter/convertGamCsvToSeedTs.ts`) se usan:
- `idStart: 681`
- `companyID: 208`
- `defaultImage: https://online.gamrentals.com/img/p/es-default.jpg`
- `referencePrefix: GAM-`

Son los valores históricos del comando de GAM y no deben aplicarse a los nuevos proveedores. Para cambiarlos sin editar código, el comando `convert:gam` admite `--idStart`, `--companyID`, `--defaultImage` y `--referencePrefix` tras los tres argumentos posicionales.

---

## Scripts útiles

Imprimir árbol de categorías (CategorySell):

```bash
npm run category:tree
```

Extraer slugs de categorías desde URLs de GAM:

```bash
npm run slugs:gam
```

---

## Estructura

- `src/scraper/*`: motor común (CLI, paginación, outputs)
- `src/scraper/providers/*`: adaptadores por proveedor
- `src/normalizer/*`: reglas de normalización de specs
- `src/converter/*`: conversión a seed TS + resolución de `categorySellID`
- `src/scripts/*`: scripts CLI
- `src/shared/*`: helpers CSV

---

## Troubleshooting

- 0 URLs / 0 productos: baja `--concurrencyPages` a 1 y sube `--delayMs`.
- Campos vacíos: revisa `src/scraper/providers/gam/parsers.ts` (puede haber cambiado HTML).
- Corta antes de tiempo: quita/sube `--maxPages` o sube `--stallStopAfter`.
- Muchas filas descartadas en convert: revisa `output.ts.report.json` (slugs/ambiguos/missingCategorySellId).

## Fase 3 — Seguridad, informes y regresión

La fase 3 no publica automáticamente en el backend de Equipzilla. Los CSV completos solo se actualizan si la extracción supera el control de calidad. Una ejecución fallida finaliza con código de error para que un programador de tareas pueda detectarlo.

### Validación y aislamiento

- Cada proveedor sigue ejecutándose por separado (`--provider`); su catálogo y sus informes se guardan bajo su propio `outDir`.
- Se rechazan las fichas sin título o sin URL HTTP(S) válida; sus fallos se incluyen en el informe. Si falla una categoría, las demás pueden continuar procesándose y el conjunto se marca como incompleto.
- La concurrencia real de listados y fichas no supera la configurada por defecto en el adaptador de cada proveedor, aunque se soliciten valores mayores en la CLI. `--concurrencyPages` y `--concurrencyProducts` permiten reducir estos límites, no aumentarlos. El tiempo entre lotes nunca es menor que `delayMs` del proveedor.
- Un catálogo vacío, una categoría sin productos o una caída superior al 50 % respecto de un inventario previo con al menos 10 productos bloquean la publicación. Cualquier fallo de extracción hace que la ejecución se considere incompleta.
- Una ficha que desaparece del listado **no** equivale a una venta: solo se marca como `suspectedMissing` para revisión. El scraper no borra productos de Equipzilla.

### Archivos generados

Con `--provider gomariz --outPrefix gomariz-diario`, las salidas se guardan en `storage/scraped/gomariz/`:

| Nombre | Uso |
| --- | --- |
| `gomariz-diario-all.csv` | Último CSV agregado completo y aprobado |
| `gomariz-diario-<categoria>.csv` | Último CSV completo de cada categoría |
| `gomariz-diario-summary.json` | Métricas y `quality.status`: `complete`, `partial` o `blocked` |
| `gomariz-diario-errors.json` | Errores por URL y categoría |
| `gomariz-diario-changes.json` | Altas, modificaciones y posibles ausencias; no se calculan bajas si la extracción falla |
| `gomariz-diario-snapshot-<scope>.json` | Huellas del inventario válido para comparaciones futuras |
| `gomariz-diario-partial-all.csv` | Datos diagnósticos de una ejecución incompleta: **no importar** |

Si la extracción falla, el CSV y snapshot completos del último resultado válido **permanecen sin cambios** y se generan los archivos `-partial-`, `summary`, `errors` y `changes` con la causa del bloqueo.

Los snapshots separan ejecuciones por combinación de categorías/URLs y por modo agrupado o normal. Un `--categoryKey` no se compara con otro ámbito. Para evitar que una ejecución completa de una sola categoría sustituya el CSV agregado de otra selección, se recomienda dar a los trabajos parciales un `--outPrefix` propio.

### Comprobar antes de importar

```bash
npm ci
npm test
npm run scrape -- --provider gam --categoryKey elevacion --maxPages 2 --outPrefix prueba-gam
npm run scrape -- --provider gomariz --maxPages 2 --outPrefix prueba-gomariz
npm run scrape -- --provider mercaeleva --maxPages 2 --outPrefix prueba-mercaeleva
```

Los tres últimos comandos requieren conexión real. Mercaeleva necesita además Chrome/Chromium si su listado no incluye enlaces en el HTML inicial. Antes de programar ejecuciones reales, comprobar el contenido de los CSV y los informes por proveedor, especialmente la paginación y las fichas de Mercaeleva.

Los tests HTML incluyen fixtures sintéticas basadas en las estructuras previstas de GAM, Gomariz y Mercaeleva. **No sustituyen una muestra del HTML real ni pruebas end-to-end contra las tres webs.** Ejecutar con dependencias instaladas (`npm ci`) para que puedan correr también los tests de parsing de Cheerio.

La programación periódica y la integración automática con Equipzilla pertenecen a la fase 4. No configurar una importación automática de CSV parciales.

---

## Automatización multiproveedor (fase 4)

La automatización ejecuta por separado los **proveedores registrados**, en serie y en el orden seleccionado. Cada ejecución se hace en un proceso independiente: un error de GAM no impide que se intente Gomariz o Mercaeleva. No importa productos directamente a Equipzilla ni elimina productos desaparecidos; conserva las protecciones y los informes de calidad de la fase 3.

### Comandos

```bash
npm ci
npm run scrape:all -- --dry-run
npm test
npm run scrape:all -- --providers gam
npm run scrape:all
```

- `--dry-run`: muestra proveedores, directorios y prefijos; no realiza peticiones ni modifica archivos.
- `--providers gam,gomariz`: selecciona únicamente esos adaptadores (admite todos los identificadores de `src/scraper/providers/index.ts`). Si se omite, ejecuta **todos los registrados**.
- `--outRoot storage/scraped`: cambia la raíz de CSV y snapshots; se crea un directorio por proveedor.
- `--historyDir storage/runs`: cambia la ubicación del historial de ejecuciones.
- `--help`: muestra la ayuda.

`npm run scrape:all` compila el proyecto antes de ejecutar. El comando finaliza con código distinto de cero si algún proveedor falla o no publica un catálogo completo. La salida visible informa de cada proveedor, resultado e informe del lote.

La extracción de cada empresa mantiene las opciones, categorías, límites de concurrencia y prefijo definidos en su adaptador. **No hay un límite artificial de páginas en la ejecución programada**: los ensayos rápidos con `--maxPages` se hacen con `npm run scrape -- --provider ... --outPrefix prueba-...` y un prefijo de prueba separado, para no contaminar los snapshots productivos.

### Datos, calidad e historial

```text
storage/
  scraped/
    .batch.lock
    gam/          <prefijo GAM>-all.csv, -summary.json, -changes.json, -snapshot-*.json
    gomariz/      <prefijo Gomariz>-all.csv, -summary.json, -changes.json, -snapshot-*.json
    mercaeleva/   <prefijo Mercaeleva>-all.csv, -summary.json, -changes.json, -snapshot-*.json
  runs/
    <fecha-UTC>-<id>/
      run.json
      gam.log
      gam-summary.json, gam-changes.json, gam-errors.json (si se generaron)
      gomariz.log
      gomariz-summary.json, gomariz-changes.json, gomariz-errors.json (si se generaron)
      mercaeleva.log
      mercaeleva-summary.json, mercaeleva-changes.json, mercaeleva-errors.json (si se generaron)
```

Cada `run.json` registra hora de inicio y fin, proveedor, estado, duración, rutas, número de productos y cambios detectados cuando la publicación fue válida. Los logs conservan la salida de cada proceso, y se archivan copias de los informes JSON realmente generados en la ejecución para que el historial de cambios no se pierda con la siguiente pasada. El registro se escribe al comenzar y tras cada proveedor; un `status: "running"` antiguo indica una posible interrupción, no un éxito confirmado. El lote devuelve `complete`, `partial` o `failed`.

Los datos publicados se mantienen por proveedor y con sus prefijos existentes. Ante una extracción parcial o bloqueada, el proceso retorna error y **no considera válidos los CSV parciales**. Los CSV publicados y snapshots anteriores están protegidos por las reglas de la fase 3. Los productos desaparecidos son `suspectedMissing`, nunca bajas automáticas.

El archivo `storage/scraped/.batch.lock` evita solapar ejecuciones automáticas. Si el equipo se apaga o se termina el proceso a la fuerza, puede quedar un bloqueo antiguo: verificar que no hay ningún proceso de scraping activo antes de eliminarlo manualmente. No lanzar ejecuciones individuales de `npm run scrape` contra los mismos prefijos mientras corre la automatización, porque esas ejecuciones no utilizan el bloqueo del lote.

### Programar en Windows

1. Comprobar primero `npm run scrape:all -- --dry-run`, `npm test` y un scraping completo por proveedor. Los adaptadores de Gomariz y Mercaeleva **no cuentan todavía con validación real de catálogo completo**.
2. Abrir **Programador de tareas** de Windows y crear una tarea con la periodicidad y hora que decida el equipo.
3. Configurar **Programa o script**: `powershell.exe`.
4. En **Agregar argumentos**: `-NoProfile -ExecutionPolicy Bypass -File "C:\RUTA\AL\PROYECTO\scripts\run-scheduled.ps1"` (sustituir por la ruta real). Si solo se quieren ciertos proveedores, añadir `-Providers "gam,gomariz"`.
5. Ejecutar con una cuenta que tenga permisos de escritura en `storage/`, Node y npm instalados; seleccionar las opciones del Programador de tareas para impedir instancias paralelas y revisar el código de salida / historial.

El script usa su propia ubicación para fijar la carpeta de trabajo del proyecto, por lo que no depende del directorio de inicio de la tarea. El equipo debe permanecer encendido durante las ejecuciones.

En Linux/macOS se puede programar desde cron un comando como `cd /ruta/absoluta/proyecto && /ruta/a/npm run scrape:all`, utilizando la ruta real de npm y un usuario con permisos. El scheduler externo se configura explícitamente: **el proyecto no activa tareas por sí mismo**.

### Añadir la cuarta, quinta y sexta compañía

1. Crear `src/scraper/providers/<id>/` con su configuración y adaptador `ScraperProvider`, respetando los contratos y la validación de productos existentes.
2. Registrar el adaptador en `src/scraper/providers/index.ts`. El comando de lote detectará automáticamente el nuevo identificador; no se modifica el motor ni el programador.
3. Implementar y probar paginación, navegación, referencias únicas por unidad, campos e imágenes con HTML de referencia y un scraping real **con prefijo de prueba**, no con el prefijo productivo.
4. Validar el CSV y el informe completo con `npm run scrape -- --provider <id> --outPrefix prueba-<id>`; comprobar que las páginas cubren el catálogo entero.
5. Ejecutar el lote con `--providers <id>` y revisar `run.json`, `-summary.json` y `-changes.json`. Añadirlo al lote general únicamente después de superar las validaciones.

**Límite de esta fase:** automatiza scraping e informes, **no** normaliza automáticamente al formato final de Equipzilla para proveedores que todavía no tienen mapeo ni realiza subida a su API. El conversor existente sigue siendo `convert:gam`. No configurar imports automáticos sin IDs y contratos reales del backend.

Para ejecutar todas las pruebas locales:

```bash
npm test
```

Las pruebas de orquestación utilizan procesos simulados y no hacen peticiones a los catálogos reales; las pruebas de parsing que requieran Cheerio deben ejecutarse con dependencias reales instaladas mediante `npm ci`.

---

## Normalización y revisión de importación (fase 5)

Tras cada scraping, junto a los CSV habituales se crea `<prefijo>-preparation.json` con:

- `totals.ready` y `totals.review` y detalle por referencia.
- Datos estructurados en el formato de producto/atributos del backend: `reference`, `title`, `categorySellID`, `category`, `condition`, `price`, `description*`, `image`, `images`, `spec`, `attributes`.
- `issues` específicos cuando falta precio, descripción, imagen, referencia, categoría inequívoca o alguno de los atributos obligatorios.

`imagesJson` se añade al final del CSV existente; `image` se mantiene como imagen principal. GAM, Gomariz y Mercaeleva intentan extraer imágenes de la galería de cada ficha. No se fabrica un precio para las fichas que publican «Ver precio».

La correspondencia de categorías es **conservadora**: únicamente nombres o slugs exactos y unívocos del catálogo `data/category/categorySell-flat.json`. Para los listados genéricos `venta` de Gomariz o Mercaeleva, puede ser necesaria revisión: **no** se asigna por similitud arbitraria ni por palabras sueltas del título. El archivo `data/import/attributeCatalog.json` contiene un snapshot de las definiciones y relaciones de atributos del backend entregado el 15/10/2026. Antes de importar, comprobar que siguen coincidiendo con la base de datos activa.

El informe no crea ni actualiza productos. Tampoco indica que una imagen sea accesible o que el catálogo entero haya sido validado en las webs reales. Si la extracción es parcial o bloqueada, el informe se guarda como `<prefijo>-partial-preparation.json` y no sustituye al último informe publicado, ni a los CSV/snapshots válidos. Los informes de preparación de las ejecuciones completas también se archivan en `storage/runs/` cuando se utiliza el ejecutor del lote.

Esta fase **no** genera el Excel exigido por `POST /product/import`, no fija un `companyID` y no evita las duplicaciones del importador actual. Esas responsabilidades corresponden a la fase 6, una vez confirmados los IDs de empresas, categorías y atributos reales en producción.

```bash
npm ci
npm test
npm run scrape -- --provider gam --maxPages 2 --outPrefix prueba-f5-gam
npm run scrape -- --provider gomariz --maxPages 2 --outPrefix prueba-f5-gomariz
npm run scrape -- --provider mercaeleva --maxPages 2 --outPrefix prueba-f5-mercaeleva
```

Revisar los archivos `*-preparation.json` y `*-summary.json` antes de plantear una importación. Ejecutar una extracción completa real de cada empresa y sus galerías para validar selectores y cobertura; las pruebas locales no demuestran esa cobertura.

---

## Fase 6 — Excel compatible con el importador actual (sin tocar Marketplace-Back)

`npm run export:import` transforma un informe `-preparation.json` completo y publicado en una hoja `.xlsx` llamada **Productos**, siguiendo literalmente el contrato de `Marketplace-Back/src/utils/ProductImportParser.ts` y su validador. No se realiza ninguna petición al backend ni se modifica el esquema de Prisma.

### Inventario previo obligatorio

Antes de generar altas hay que exportar desde **la base de datos de destino** todas las referencias de la empresa correcta. La tabla Prisma es `Product`, con `companyID` y `reference`. La consulta equivalente es:

```sql
SELECT companyID, reference
FROM Product
WHERE companyID = <ID_REAL_DE_LA_EMPRESA>
  AND reference IS NOT NULL
  AND TRIM(reference) <> '';
```

Guardar el resultado como `storage/import/inventory-<proveedor>.csv`, con las cabeceras **exactas** `companyID,reference` y todas las filas de esa empresa. Confirmar con el responsable de datos que el inventario está actualizado y es **completo**. Comprobar también si los seeds existentes introdujeron prefijos de referencia distintos de los del proveedor; el exportador no inventa ni corrige prefijos. Si la consulta no devuelve productos, la generación se bloquea salvo que se pase explícitamente `--allow-empty-inventory` después de verificar que la empresa realmente no tiene referencias previas.

El ID de empresa debe confirmarse en la base de datos real: no se deduce del proveedor ni de ejemplos históricos. Especialmente, el seed antiguo de Mercaeleva contiene IDs no verificados para el entorno de destino.

### Comandos

```bash
npm ci
npm test
npm run export:import -- --provider gam --companyID ID_REAL --preparation storage/scraped/gam/MI_PREFIJO-preparation.json --existing storage/import/inventory-gam.csv --out storage/import/altas-gam.xlsx --dry-run
npm run export:import -- --provider gam --companyID ID_REAL --preparation storage/scraped/gam/MI_PREFIJO-preparation.json --existing storage/import/inventory-gam.csv --out storage/import/altas-gam.xlsx --confirm-inventory
```

Sustituir `ID_REAL` por un `companyID` verificado y `MI_PREFIJO` por el prefijo real publicado por el adaptador. El directorio de salida debe existir. Los comandos son iguales para `gomariz` y `mercaeleva`, cambiando **proveedor, inventario, companyID y prefijo**. No reutilizar un inventario de otra empresa.

El comando también exige el `-summary.json` del mismo prefijo, comprueba que la **última ejecución** fuera completa y bloquea un `-preparation.json` obsoleto tras una ejecución fallida.

`--dry-run` muestra los recuentos sin generar archivos. `--confirm-inventory` habilita la exportación offline y expresa que se ha comprobado el inventario. No se pueden usar los dos flags juntos. La generación no sobrescribe un `.xlsx` o informe ya existente; cada ejecución debe usar nombres nuevos.

El resultado consta de:

- `altas-gam.xlsx`: hoja **Productos** con las columnas exactas `Referencia *`, `Categoría *`, `Título *`, `Condición *`, `Precio *`, `Descripción título`, `Descripción *`, `Descripción general`, `Estado de fila`, atributos (`Nombre (unidad)` cuando corresponde) y `URL 1 *` a `URL 10`. Los atributos proceden de `data/import/attributeCatalog.json`; el precio se guarda como número y se usa el enum existente `Segunda_Mano`.
- `altas-gam.xlsx.report.json`: altas exportadas, referencias ya existentes excluidas, productos para revisión, duplicados internos y número de imágenes que exceden las 10 admitidas. Si no hay altas, solo se genera el informe y **no** un Excel vacío.

Se descartan de la exportación los registros de revisión, los que no superan una segunda validación, las referencias que ya existen y **todas** las filas que comparten referencia en la misma extracción. Los existentes **no se actualizan**; las posibles desapariciones tampoco se dan de baja. Si falta un campo necesario, hay que corregir los datos de origen y volver a preparar el lote, no rellenar valores ficticios.

### Limitaciones y procedimiento de importación

1. Validar que `*-preparation.json` procede de un scraping completo reciente y que `summary.json` indica extracción completa. Nunca usar `-partial-preparation.json`.
2. Exportar el inventario real de productos de la empresa **justo antes** de preparar el Excel, comprobar el ID empresarial, ejecutar el `--dry-run` y leer los recuentos.
3. Generar el Excel con `--confirm-inventory`, abrirlo y revisar una muestra de categorías, precios, imágenes y atributos, utilizando el contrato de la base de datos real.
4. Importar manualmente una muestra con el mecanismo existente de Equipzilla y validar el resultado antes de importar el resto. `POST /product/import` recibe `multipart/form-data` con el archivo `file` y el campo `companyID`; requiere autenticación y autorización. No se incluye aquí un cliente que lo invoque.
5. Consultar de nuevo el inventario antes de cada lote o repetición. **Una lista de referencias obsoleta o incompleta no puede impedir duplicados** porque el importador actual no aplica deduplicación persistente en la base de datos. El Excel se limita a **altas**; los cambios de productos existentes deben gestionarse por separado.

El backend impone un máximo de **10 MB** por archivo `.xlsx`. Si el libro resultante supera ese límite, dividir las altas en lotes revisados antes de subirlos. El validador, las categorías, los atributos y los registros de las compañías pueden cambiar en la base de datos: este repositorio conserva un **snapshot**, no una conexión en vivo. La fase 7 debe comprobar el importador real y la extracción contra las tres webs; las pruebas locales no sustituyen esas verificaciones.

---

## Fase 7 — Validación de extracción completa y preproducción

Esta fase refuerza la publicación con comprobaciones SHA-256 del CSV y la preparación, impide catalogar como completas las extracciones que alcanzan el límite de páginas sin comprobar el final e introduce un validador de preproducción. La exportación de la fase 6 ahora comprueba automáticamente la integridad del conjunto de informes y no acepta catálogos antiguos sin estas huellas.

```bash
npm ci
npm test
npm run scrape -- --provider gam
npm run validate:catalog -- --provider gam --outDir storage/scraped/gam --outPrefix scrape-gam-marzo-2026
```

Ejecutar `npm run validate:catalog -- --help` para ver opciones. El validador no genera ni modifica productos. Sus códigos de salida son 0 (coherente), 2 (revisión manual) y 1 (error técnico). **No equivale a un scraping real exitoso ni certifica el importador del entorno de destino.**

El protocolo operativo y la lista de aceptación para GAM, Gomariz, Mercaeleva y los próximos proveedores están en [`docs/PHASE7_VALIDACION.md`](docs/PHASE7_VALIDACION.md). **Marketplace-Back no cambia** y la subida de Excel continúa siendo manual y revisada.
