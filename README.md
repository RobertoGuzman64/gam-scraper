# Equipzilla · Scraper multiproveedor de maquinaria de ocasión

Scraper **CLI en Node.js + TypeScript** para obtener fichas de maquinaria en venta desde **GAM, Gomariz y Mercaeleva**, generar CSV/JSON auditables y preparar candidatos para el importador existente de Equipzilla. No requiere un servidor HTTP ni modifica el backend.

> **Estado a 20/10/2026:** las tres fuentes se han ejecutado con datos reales, pero **NO se ha autorizado su importación ni su automatización desatendida en producción**. Mercaeleva presenta una pérdida de cobertura por paginación; las categorías y atributos del backend siguen sin resolver para gran parte de la maquinaria. Véase [Estado real de las extracciones](docs/ESTADO_EXTRACCIONES_2026-10-20.md).

## 1. Qué hay implementado

| Capacidad                                                      | Situación                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| Adaptadores `gam`, `gomariz`, `mercaeleva`                     | Implementados, con extracciones reales efectuadas          |
| Scraping por proveedor o categoría y paginación                | Implementado; cobertura Mercaeleva pendiente de corrección |
| Deduplicación por unidad, CSV + JSON                           | Implementado                                               |
| Preparación de categorías, atributos y estado `ready`/`review` | Implementado contra snapshots; mapeo industrial incompleto |
| Control de calidad, snapshots, cambios e integridad SHA-256    | Implementado; no garantiza cobertura del portal externo    |
| Lote `scrape:all`, logs, historial y bloqueo local             | Implementado                                               |
| Exportación `.xlsx` de **altas** con inventario confirmado     | Implementada, **manual y condicionada**                    |
| Dockerfile, CI/CD y ejecución cloud programada                 | **No incluidos en este repositorio**                       |
| Persistencia cloud de CSV, snapshots e historial               | **No implementada**                                        |
| Importación automática al backend o actualización/baja         | **No implementada**                                        |

Documentos de referencia:

- [Arquitectura y salidas](#4-arquitectura-y-archivos-de-salida)
- [Validación de preproducción](docs/PHASE7_VALIDACION.md)
- [Despliegue y automatización](docs/DESPLIEGUE_AUTOMATICO.md)
- [Estado de auditoría real](docs/ESTADO_EXTRACCIONES_2026-10-20.md)

## 2. Instalación y requisitos

- Node.js **>= 18.18** (`package.json`); para un entorno nuevo, usar una versión LTS compatible.
- npm y salida HTTPS hacia las webs de proveedores.
- **Google Chrome o Chromium** accesible en el `PATH`, o variable `CHROME_PATH` / `CHROMIUM_PATH`, para el fallback de páginas dinámicas de Mercaeleva. **No se utiliza Puppeteer ni Playwright**: el navegador se invoca con `child_process` en modo `--headless --dump-dom`.
- Escritura sobre `storage/`, incluida su persistencia entre ejecuciones si se programa en un servidor.

Desde la raíz del repositorio:

```bash
npm ci
npm test
npm run build
```

`npm test` compila y ejecuta las pruebas con `node --test` (fixtures locales). **No descarga los catálogos públicos** ni certifica que la paginación real funcione. Verificar que los tests de Cheerio no figuren como omitidos.

En PowerShell, si Chrome no es detectado:

```powershell
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## 3. Uso inmediato

### Extraer un proveedor

```bash
npm run scrape -- --provider gam --outPrefix gam-completo
npm run scrape -- --provider gomariz --outPrefix gomariz-completo
npm run scrape -- --provider mercaeleva --outPrefix mercaeleva-completo
```

Los prefijos anteriores reproducen los nombres usados en las extracciones del 20/10/2026, **no los prefijos por defecto**. Si se omite `--outPrefix`, se aplica la configuración de cada adaptador:

| Proveedor  | Categorías raíz                                                                           | Prefijo predeterminado  | Carpeta                       |
| ---------- | ----------------------------------------------------------------------------------------- | ----------------------- | ----------------------------- |
| GAM        | `elevacion`, `manutencion`, `manipulacion`, `energia`, `otros`, `movilidad`, `maquinaria` | `scrape-gam-marzo-2026` | `storage/scraped/gam/`        |
| Gomariz    | `venta`                                                                                   | `scrape-gomariz`        | `storage/scraped/gomariz/`    |
| Mercaeleva | `venta`                                                                                   | `scrape-mercaeleva`     | `storage/scraped/mercaeleva/` |

Una categoría aislada, con prefijo independiente:

```bash
npm run scrape -- --provider gam --categoryKey elevacion --outPrefix prueba-elevacion
```

Diagnóstico de unas pocas páginas (**no es una extracción completa**):

```bash
npm run scrape -- --provider gomariz --maxPages 2 --outPrefix prueba-gomariz
```

No usar `--maxPages 1/2` para publicar catálogos; al alcanzar el límite sin comprobar el final, la ejecución debe considerarse parcial. La comprobación de Mercaeleva es especialmente importante: **`quality.status=complete` no demuestra cobertura total** cuando la paginación devuelve repetidamente la primera página.

### Lote de las tres empresas (ejecutor ya existente)

```bash
npm run scrape:all -- --dry-run
npm run scrape:all -- --providers gam,gomariz
npm run scrape:all
```

`--dry-run` muestra rutas sin ejecutar scraping. Sin `--providers`, el lote ejecuta todos los adaptadores registrados, de manera secuencial, en procesos independientes. Acepta `--outRoot <carpeta>` y `--historyDir <carpeta>`. Si falla un proveedor, continúa con los demás y termina con código distinto de cero. El bloqueo `storage/scraped/.batch.lock` evita **dos lotes simultáneos sobre el mismo almacenamiento local**, pero **no es un bloqueo distribuido para cloud**.

**No activar el lote general de forma programada todavía:** hay que corregir la paginación real de Mercaeleva y completar la aceptación definida en [PHASE7_VALIDACION.md](docs/PHASE7_VALIDACION.md).

### Validar una publicación existente

```bash
npm run validate:catalog -- --provider gam --outDir storage/scraped/gam --outPrefix gam-completo
npm run validate:catalog -- --provider gomariz --outDir storage/scraped/gomariz --outPrefix gomariz-completo
npm run validate:catalog -- --provider mercaeleva --outDir storage/scraped/mercaeleva --outPrefix mercaeleva-completo
```

Usar exactamente el mismo `outPrefix` de la extracción. El validador comprueba coherencia de CSV, preparación, resumen, hashes y antigüedad (48 h por defecto), **no verifica por sí solo el total de productos publicados en la fuente externa**. Código de salida: `0` = coherencia técnica, `2` = requiere revisión, `1` = error técnico.

## 4. Arquitectura y archivos de salida

```text
src/
  scraper/
    providers/
      contracts.ts, index.ts       # contrato y registro de proveedores
      gam/                         # listados y fichas GAM
      gomariz/                     # listado de venta Gomariz
      mercaeleva/                  # Mercaeleva + fallback Chrome/Chromium
    scrape.ts, io.ts, quality.ts    # extracción, publicación y seguridad
  automation/                      # lote, ejecuciones e historial
  import/                          # preparación y exportación de XLSX
  validation/                      # verificación local de publicación
  normalizer/                      # normalización histórica de GAM
  converter/                       # CSV a seed TypeScript (GAM)
  shared/                           # utilidades CSV
scripts/run-scheduled.ps1          # programador de tareas de Windows
storage/                           # DATOS generados (ignorado por Git)
data/category/                     # snapshot de categorías de Equipzilla
data/import/                       # snapshot de atributos y relaciones
```

Por cada ejecución completa, en `storage/scraped/<proveedor>/` se encuentran los archivos principales:

| Patrón                                                            | Significado                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `<prefijo>-all.csv`                                               | Inventario agregado con deduplicación                            |
| `<prefijo>-<categoria>.csv`                                       | Salida por categoría del proveedor                               |
| `<prefijo>-categories.csv`                                        | Categorías extraídas/configuradas                                |
| `<prefijo>-preparation.json`                                      | Candidatos de importación, estado `ready`/`review` y motivos     |
| `<prefijo>-summary.json`                                          | Métricas, calidad, publicación y huellas SHA-256                 |
| `<prefijo>-changes.json`                                          | Altas, cambios y posibles ausencias respecto del snapshot previo |
| `<prefijo>-errors.json`                                           | Incidencias de páginas y productos, si se producen               |
| `<prefijo>-snapshot-<scope>.json`                                 | Último inventario válido de ese ámbito                           |
| `<prefijo>-partial-all.csv`, `<prefijo>-partial-preparation.json` | Diagnósticos parciales: **no importar**                          |

El lote añade `storage/runs/<fecha>-<id>/run.json` y logs/informes archivados de cada proveedor. **Conservar snapshots, historial y errores en el repositorio de ejecución**; que no se incluyeran en el ZIP de auditoría no significa que sobren operacionalmente.

### CSV: contrato actual

Columnas base: `categoryKey`, `categoryName`, `title`, `shortDescription`, `longDescription`, `price`, `reference`, `brand`, `model`, `year`, `location`, `country`, `horometer`, `serialNumber`, `image`, `url`, `specJson`, `providerId`, `imagesJson`.

Se añaden columnas variables `spec__<nombre de especificación>` en función de las fichas. `imagesJson` contiene el listado de URLs de imágenes; `image` es la imagen principal. Algunas fuentes tienen datos ausentes: deben mantenerse vacíos, nunca inventarse.

La deduplicación utiliza referencia, serie y finalmente URL canónica, con aislamiento por `providerId`. **Título/modelo repetidos no equivalen a producto duplicado**: varias unidades pueden tener el mismo modelo y referencias diferentes. La identidad externa de comparación es la pareja `providerId + reference`.

### Seguridad de publicación

Una ejecución con fallos o catálogo vacío/incompleto no debe sustituir el último catálogo aprobado. Las ausencias se registran como `suspectedMissing`, no como bajas. Las huellas SHA-256 permiten verificar que el CSV y la preparación corresponden al resumen. Los controles actuales **no contrastan automáticamente** el total de páginas/resultados del proveedor: por eso Mercaeleva pudo registrarse como `complete` aunque solo se recuperaron 20 fichas.

## 5. Preparación e importación con Equipzilla

**Tres niveles distintos:**

1. `-all.csv`: datos obtenidos de la web; **no es** el archivo consumido por el importador de Equipzilla.
2. `-preparation.json`: candidatos con categorías/atributos calculados desde `data/category/categorySell-flat.json` y `data/import/attributeCatalog.json`; `ready` significa que pasaron controles locales, **no** que estén cargados en Equipzilla.
3. `.xlsx`: archivo para el importador existente de **altas**; se genera **solo tras verificar `companyID` real e inventario actualizado**. No modifica productos ya existentes y no se envía por sí solo a ninguna API.

Para estudiar las opciones:

```bash
npm run export:import -- --help
```

Ejemplo de análisis **sin crear archivo** (sustituir `<ID_REAL>` y la ruta del inventario):

```bash
npm run export:import -- --provider gam --companyID <ID_REAL> --preparation storage/scraped/gam/gam-completo-preparation.json --existing storage/inventory/gam.csv --out storage/import/gam-altas.xlsx --dry-run
```

El inventario debe ser un CSV completo, **actual** y correspondiente a la empresa, con columnas `companyID,reference`. Solo tras validarlo se sustituye `--dry-run` por `--confirm-inventory`. El comando rechaza inventarios vacíos salvo `--allow-empty-inventory` explícito y justificado, revisa integridad/frescura, omite referencias existentes y limita el Excel a **10 MB**. Consultar [PHASE7_VALIDACION.md](docs/PHASE7_VALIDACION.md) antes de intentar la importación manual en pruebas.

**Precauciones:** los 16 productos marcados `ready` en la auditoría del 20/10/2026 son vehículos ligeros de GAM, no maquinaria industrial. La importación de esos registros **también requiere aprobación de negocio**. Para Gomariz, 143 fichas carecen de precio público. No asignar categorías, atributos obligatorios o importes de manera artificial. No reutilizar `companyID` histórico sin confirmar el entorno destino.

### Herramientas históricas específicas de GAM

El flujo `normalize:gam` → `convert:gam` sigue disponible, pero **no es el flujo recomendado para incorporar automáticamente otros proveedores**:

```bash
npm run normalize:gam -- <entrada.csv> <salida.csv> --report <informe.json>
npm run convert:gam -- <entrada.csv> <salida.ts> data/category/categorySell-flat.json
npm run category:tree
npm run slugs:gam
```

Opciones de normalización: `--allow-unknown`, `--expand-spec-columns`, `--max-values-per-key <n>`. El conversor conserva opciones históricas `--idStart`, `--companyID`, `--defaultImage`, `--referencePrefix`, con valores que **no deben aplicarse a otros proveedores ni asumirse válidos** en el backend actual.

## 6. Comandos avanzados de scraping

```bash
# Ficha/listado puntual
npm run scrape -- --provider gam --url "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano" --key elevacion --name "Elevación" --outPrefix inspeccion

# Descubrir árbol GAM
npm run scrape -- --provider gam --discoverTree --rootUrl "https://online.gamrentals.com/es/3-maquinaria-segunda-mano" --onlyCategories --outPrefix categorias-gam

# Subcategorías configuradas
npm run scrape -- --provider gam --discoverSubcategories --outPrefix subcategorias-gam
```

Flags principales: `--provider`, `--categoryKey`, `--outDir`, `--outPrefix`, `--url`, `--key`, `--name`, `--discoverTree`, `--rootUrl`, `--discoverSubcategories`, `--onlyCategories`, `--maxPages`, `--stallStopAfter`, `--concurrencyPages`, `--concurrencyProducts`, `--timeoutMs`, `--delayMs`, `--userAgent`.

Cada proveedor limita la concurrencia máxima y el retardo mínimo efectivo a sus valores de seguridad, aunque la CLI solicite otros mayores. Descubrimiento de árbol de Gomariz/Mercaeleva: actualmente solo la categoría raíz de venta; no equivale a un mapa real de sus subcategorías.

## 7. Operaciones, despliegue y nuevas empresas

- **Windows:** `scripts/run-scheduled.ps1` funciona con Programador de tareas, una vez aprobadas las extracciones. Ejemplo de argumentos: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RUTA\scripts\run-scheduled.ps1" -Providers "gam,gomariz"`.
- **Linux:** cron/systemd pueden ejecutar desde la raíz `npm run scrape:all`, en una máquina con Node, Chromium y almacenamiento persistente.
- **Cloud:** un **Cloud Run Job** encaja con el proceso CLI, y **Cloud Scheduler** puede invocarlo. Pero faltan contenedor, autenticación/configuración cloud y, sobre todo, persistencia **segura** de snapshots, CSV e historial. **No asumir que montar un bucket con Cloud Storage FUSE conserva la semántica POSIX del lock/renombrado atómico.** Véase [guía de despliegue](docs/DESPLIEGUE_AUTOMATICO.md).
- **Nuevos proveedores:** crear `src/scraper/providers/<id>/`, implementar `ScraperProvider`, registrar en `src/scraper/providers/index.ts`, añadir fixtures y validar extracción completa; después podrá seleccionarse con `--providers <id>` sin modificar el runner.

### Resolución rápida de problemas

| Síntoma                              | Qué mirar                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `0` productos o pocas páginas        | Paginación real y cambios HTML; **no** asumir catálogo vacío                          |
| Mercaeleva siempre devuelve 20       | Incidencia de paginación; no permitir despliegue sin corrección                       |
| Error de selector Cheerio en GAM     | Verificar que se ha integrado la corrección del enlace `#` en el parser de pestañas   |
| Gomariz sin precio                   | La web muestra «Ver precio»; no fabricarlo                                            |
| Muchas fichas `review`               | Revisar snapshot categorías/atributos, requeridos y disponibilidad real del dato      |
| Bloqueo `.batch.lock`                | Verificar que no se ejecuta un lote; retirar manualmente solo si es antiguo           |
| CSV válido, importador rechaza Excel | Revisar inventario, `companyID`, categorías, atributos obligatorios y límite de 10 MB |

**Regla de proyecto:** todo cambio del scraper debe superar `npm test`, una muestra real por proveedor y una auditoría de cobertura antes de permitir programación o importación. **Marketplace-Back queda fuera de alcance.**
