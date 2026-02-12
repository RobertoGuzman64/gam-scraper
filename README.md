# GAM Scraper → Normalizer → Seed (TypeScript)

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

Scrape completo (categorías del config):

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

### Flags (CLI)

Output:
- `--outDir <dir>` (default: `storage/scraped/gam`)
- `--outPrefix <name>` (default: `scrape-gam-marzo-2026`)

Selección:
- `--categoryKey <key>` (usa categorías de `src/scraper/config.ts`)
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

Si necesitas cambiarlos, están en el bloque `isMain(...)`.

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

- `src/scraper/*`: scraper (CLI, paginación, parsers, outputs)
- `src/normalizer/*`: reglas de normalización de specs
- `src/converter/*`: conversión a seed TS + resolución de `categorySellID`
- `src/scripts/*`: scripts CLI
- `src/shared/*`: helpers CSV

---

## Troubleshooting

- 0 URLs / 0 productos: baja `--concurrencyPages` a 1 y sube `--delayMs`.
- Campos vacíos: revisa `src/scraper/parsers.ts` (puede haber cambiado HTML).
- Corta antes de tiempo: quita/sube `--maxPages` o sube `--stallStopAfter`.
- Muchas filas descartadas en convert: revisa `output.ts.report.json` (slugs/ambiguos/missingCategorySellId).
