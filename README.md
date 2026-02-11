# GAM Scraper (CSV)

Scraper para extraer **productos de ocasión** de `online.gamrentals.com` por **categorías**, generando **CSV** listos para subir manualmente a Drive (Equipzilla).

El scraper:
1. Recorre páginas de listado (`?page=2`, `?page=3`, …).
2. Detecta URLs de **ficha de producto**.
3. Entra a cada ficha y extrae campos (marca, modelo, año, ubicación, horas, descripción, etc.).
4. Genera un CSV por categoría, un CSV agregado y un `summary.json`.

---

## Requisitos

- Node **18.18+** (recomendado 20+)
- NPM

---

## Instalar

```bash
npm i
```

---

## Ejecutar

### Scrape completo (todas las categorías del config)
```bash
npm run scrape
```

### Solo una categoría del config
```bash
npm run scrape -- --categoryKey elevacion --outPrefix gam-elevacion
```

### Ejecutar una URL concreta (sin depender del config)
```bash
npm run scrape -- --url "https://online.gamrentals.com/es/8-plataformas-elevadoras-segunda-mano" --key elevacion --name "Elevación" --outPrefix gam-elevacion
```

### Pruebas rápidas (limitando páginas)
Solo para tests (no recomendado para “producción”):
```bash
npm run scrape -- --categoryKey elevacion --maxPages 3 --outPrefix gam-elevacion-prueba
```

---

## “Sin límite de páginas” (lo que debes usar siempre)

Para sacar **todo lo que tiene** una categoría:
- **No pases** `--maxPages`, o ponlo muy alto.
- El scraper se detiene por el criterio de “ya no salen URLs nuevas” (`stallStopAfter`).

Ejemplo recomendado:
```bash
npm run scrape -- --categoryKey elevacion --outPrefix gam-elevacion-full
```

---

## Salida

Se escribe en `output/`:

- `<outPrefix>-<categoryKey>.csv`
- `<outPrefix>-all.csv`
- `<outPrefix>-summary.json`

### Columnas del CSV

- `categoryKey`: clave interna de la categoría (config/CLI)
- `categoryName`: nombre humano de la categoría
- `title`: título del producto (H1 / og:title)
- `descriptionLong`: descripción larga del producto (cuando existe en la ficha; puede venir de bloques de descripción o metatags)
- `price`: precio si está disponible
- `reference`: ID extraído de la URL (el número antes del guion)
- `brand`: Marca (de la ficha)
- `model`: Modelo (de la ficha)
- `year`: Año (de la ficha o inferido del título)
- `location`: Ubicación (de la ficha)
- `country`: País (de la ficha)
- `horometer`: Horómetro/horas (de la ficha)
- `serialNumber`: Nº de serie (de la ficha)
- `url`: URL de la ficha

---

## Opciones (CLI)

- `--outDir <dir>` (default: `output`)
- `--outPrefix <name>` (default: `scrape-gam-marzo-2026`)
- `--categoryKey <key>` filtra por una categoría de `src/config.ts`
- `--url <url>` scrapea una URL concreta (modo “single”)
- `--key <key>` clave de categoría para modo `--url` (default: `custom`)
- `--name <name>` nombre de categoría para modo `--url` (default: `Custom`)

### Control de paginación y parada
- `--maxPages <n>` (default: `500`)
  - Tope de seguridad. Para “sin límite”, **no lo uses** o ponlo alto (p.ej. 2000).
- `--stallStopAfter <n>` (default: `2`)
  - Se detiene cuando durante `n` tandas seguidas no aparecen URLs nuevas.

### Rendimiento / estabilidad
- `--concurrencyPages <n>` (default: `2`)
- `--concurrencyProducts <n>` (default: `6`)
- `--timeoutMs <n>` (default: `30000`)
- `--delayMs <n>` (default: `250`)
- `--userAgent <string>` (default: UA de Chrome)

---

## Arquitectura del proyecto (qué toca cada fichero)

### `src/types.ts`
Tipos del dominio y del pipeline:
- `CategoryConfig`, `ScrapeOptions`, `ProductRecord`
- `CategoryScrapeResult`, `Summary`

✅ Toca este fichero si añades/renombras campos del CSV, o cambias el shape del summary.

### `src/config.ts`
Configuración por defecto:
- `DEFAULT_CATEGORIES`: categorías de GAM (las URLs del email)
- `DEFAULT_OPTIONS`: opciones base del scraper

✅ Toca este fichero si:
- Añades/quitas categorías (URLs nuevas).
- Cambias defaults (concurrencia, delay, timeouts, etc.).

### `src/cli.ts`
Parsea flags y decide el modo:
- “config”: usa `DEFAULT_CATEGORIES` (o filtra por `--categoryKey`)
- “single”: si existe `--url`, usa esa URL con `--key`/`--name`

✅ Toca este fichero si:
- Añades nuevas opciones CLI.
- Quieres introducir “modos” (ej: solo URLs, solo productos, etc.).

### `src/http.ts`
Capa HTTP:
- `fetchHtml` con timeout y headers
- `sleep`

✅ Toca este fichero si:
- Necesitas cookies / headers especiales.
- Quieres reintentos, backoff, etc.

### `src/parsers.ts`
Parsing HTML:
- `buildPagedUrl`
- `extractProductLinksFromListing`
- `parseProductPage` (incluye `descriptionLong`)

✅ Toca este fichero si:
- Cambia el HTML de GAM (labels distintas, estructura distinta).
- Quieres extraer nuevos campos desde la ficha.

### `src/scrape.ts`
Motor de scraping por categoría:
- Recorre paginación
- Acumula URLs de producto
- Visita cada ficha con `parseProductPage`
- Retorna `CategoryScrapeResult`

✅ Toca este fichero si:
- Cambias la estrategia de paginación.
- Quieres separar “fase URLs” y “fase productos”.
- Quieres persistir un caché, reintentos por producto, etc.

### `src/io.ts`
Escritura de outputs:
- CSV por categoría
- CSV agregado (`-all.csv`)
- `summary.json`

✅ Toca este fichero si:
- Cambias formato de salida (otro nombre, otro directorio, etc.).
- Añades archivos extra (p.ej. `urls.csv`).
- Añades columnas nuevas al CSV (p.ej. `descriptionLong`).

### `src/index.ts`
Orquestación:
- Decide categorías
- Ejecuta `scrapeCategory` por cada una
- Llama a `writeOutputs`

✅ Toca este fichero si:
- Cambias el flujo general (paralelizar categorías, etc.).

---

## Checklist para cambios (para trabajar por chat sin liarnos)

Cuando pidamos un cambio, lo normal es seguir esta regla:

1) **Añadir/quitar categoría** → `src/config.ts`
2) **Nuevo flag CLI** → `src/cli.ts` (+ `src/config.ts` si hay default)
3) **Arreglar extracción de links del listado** → `src/parsers.ts` (`extractProductLinksFromListing` / `isProductUrl`)
4) **Arreglar campos que salen vacíos en la ficha** → `src/parsers.ts` (`parseProductPage`)
5) **Separar fases “categorías / URLs / productos”** → `src/cli.ts`, `src/scrape.ts`, `src/io.ts`, `src/index.ts`
6) **Problemas de bloqueo / 403 / timeouts** → `src/http.ts` y ajustar defaults en `src/config.ts`
7) **Añadir “descripción larga”** → `src/types.ts`, `src/parsers.ts`, `src/scrape.ts`, `src/io.ts`

---

## Troubleshooting rápido

### No aparecen productos (0 URLs)
- Baja `--concurrencyPages` a 1 y sube `--delayMs` (p.ej. 500–1000).
- Revisa que `extractProductLinksFromListing` está detectando fichas (en `src/parsers.ts`).

### Muchos campos vacíos (marca/modelo/ubicación/descripción)
- La ficha puede haber cambiado estructura. Ajusta `parseProductPage` en `src/parsers.ts`.

### Se queda corto de productos
- Si estás usando `--maxPages`, quítalo.
- Si te corta antes de tiempo, sube `--stallStopAfter` (p.ej. 3) y/o sube `--maxPages`.

---

## Ejemplos recomendados (los que usarás cada 6 meses)

### Todas las categorías
```bash
npm run scrape -- --outPrefix scrape-gam-marzo-2026
```

### Solo Elevación (full)
```bash
npm run scrape -- --categoryKey elevacion --outPrefix scrape-gam-marzo-2026
```