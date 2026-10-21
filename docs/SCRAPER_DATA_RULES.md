# SCRAPER_DATA_RULES.md

**Reglas de datos, preparación y exportación · Equipzilla Scraper**  
**Fecha del análisis:** 20/10/2026; **alcance de producto corregido el 21/10/2026** tras contraste del backend.  
**Procedencia:** código del scraper y `Marketplace-Back-develop.zip` (contrato receptor contrastado en código). No se ejecutaron extracciones reales ni importaciones ni se inspeccionó la base de datos de un entorno. **Documento autónomo:** su contrato de destino se resume aquí sin exigir tener el backend abierto.

## 1. Objetivo operativo que no debe perderse

Extraer maquinaria **nueva y de segunda mano** de **GAM (`gam`)**, **Gomariz (`gomariz`)** y **Mercaeleva (`mercaeleva`)**, conservar su identidad y procedencia, normalizar fichas y preparar **altas revisables**, no sincronizaciones automáticas, de productos de venta en Equipzilla. Añadir proveedores nuevos debe reutilizar motor, contratos, reglas de calidad, mapeo y publicación; no duplicar lógica de negocio en cada adaptador. **La preparación admite `Nuevo` y `Segunda_Mano` con evidencia suficiente, y conserva estados desconocidos o contradictorios en revisión.** Definición de terminado y prioridades: [OBJETIVOS_SCRAPER.md](OBJETIVOS_SCRAPER.md).

La ruta **actualmente integrada mediante exportador** es **`POST /product/import`**, autenticada, con `multipart/form-data`, campo `file` `.xlsx` (hoja exacta `Productos`, hasta 10 MiB) y `companyID` real. **No acepta directamente ninguno de los JSON listados abajo.** El backend también ofrece **`POST /product/create/many`** con otro contrato JSON (`price?` opcional, `categorySellID` y `attributes` por ID), **sin implementación de exportación ni envío en este scraper**. Ambos caminos crean altas, sin *upsert* ni bajas, y pueden devolver resultados parciales. Comparativa y decisión pendiente: [OBJETIVOS_SCRAPER.md](OBJETIVOS_SCRAPER.md).

```text
Proveedor externo → ProductRecord → calidad + deduplicación
  → CSV extraído + JSON de preparación/publicación
  → preflight + revisión + inventario de referencia por empresa
  → Excel de ALTAS con columnas que lee el importador
  → importación MANUAL del Excel en Equipzilla (acción ajena al scraper)
```

`ready` es un estado **local de preparación**, no una aceptación de Equipzilla ni una orden de publicación comercial.

## 2. Qué datos obtiene el scraper

El contrato interno `ProductRecord` de `src/contracts/catalog.ts` usa los campos siguientes. `?` indica propiedad TypeScript opcional y `| null` indica que el valor puede faltar semánticamente:

| Campo                                                                                              | Tipo                                                                                                | Uso                                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `providerId`                                                                                       | `string`                                                                                            | Identidad del origen (`gam`, `gomariz`, `mercaeleva`)                        |
| `categoryKey`, `categoryName`, `url`                                                               | `string`                                                                                            | Contexto de categoría de origen y URL de ficha                               |
| `title`, `shortDescription`, `longDescription`, `price`                                            | `string \| null`                                                                                    | Contenido comercial sin garantía de ser importable                           |
| `reference`, `brand`, `model`, `year`, `location`, `country`, `horometer`, `serialNumber`, `image` | `string \| null`                                                                                    | Referencias, datos de máquina y fotografía principal                         |
| `priceText?`                                                                                       | `string \| null`                                                                                    | Precio textual alternativo/traza                                             |
| `condition?`                                                                                       | `"Nuevo" \| "Segunda mano" \| null`                                                                 | Estado de origen; **distinto del enum backend**                              |
| `images?`                                                                                          | `readonly string[]`                                                                                 | Galería externa                                                              |
| `specs?`                                                                                           | `Readonly<Record<string, string \| number \| boolean \| readonly (string \| number \| boolean)[]>>` | Especificaciones recogidas/normalizadas                                      |
| `breadcrumbs?`, `subcategory?`                                                                     | `readonly string[]`, `string \| null`                                                               | Contexto auxiliar de catálogo                                                |
| `externalReference?`                                                                               | `string \| null`                                                                                    | Referencia externa adicional; **no sustituye automáticamente a `reference`** |
| `shortDescriptionHtml?`, `longDescriptionHtml?`                                                    | `string \| null`                                                                                    | HTML original de descripción cuando existe                                   |
| `technicalSheetUrl?`, `scrapedAt?`, `yearSource?`                                                  | `string \| null` / `string` / `"ficha" \| "descripcion" \| "titulo" \| "url" \| null`               | Procedencia, fecha y origen del año                                          |

Los parsers obtienen datos; `catalog/normalization/` estandariza especificaciones; `catalog/import/` traduce las fichas al destino. Una ficha bien extraída **puede** no ser importable si carece de precio, imagen, categoría exacta o atributos exigidos.

## 3. Inventario de JSON producidos realmente y su finalidad

Prefijo de salida por ejecución: `<P>` en `storage/scraped/<providerId>/` por defecto. Los directorios `storage/` son estado de ejecución, no fuentes versionadas. El nombre exacto de `<P>` depende de la configuración/argumentos; no se debe asumir un prefijo fijo para todos los proveedores.

| Archivo JSON                        | Estructura comprobada                                                                                                                                                                                     | Papel / consumo                                                                                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<P>-preparation.json`              | `{quality:"complete", published:true, totals:{ready,review}, products:[{status:"ready"\|"review", issues:string[], product: ImportCandidate}]}` en publicación completa                                   | **Principal JSON para preparar la exportación**. Lo lee `export` junto con resumen, CSV, cambios y catálogo local; **NO** lo importa directamente el backend          |
| `<P>-partial-preparation.json`      | `{quality:"partial"\|"blocked", published:false, totals, products:[...]}`                                                                                                                                 | Diagnóstico de ejecución incompleta. `parsePreparation` lo rechaza para exportar                                                                                      |
| `<P>-summary.json`                  | `startedAt`, `endedAt`, `quality:{status,reasons,published}`, `artifacts:{csvSha256,preparationSha256}`, `totals`, `categories[]`                                                                         | Recuento y prueba de integridad/estado del catálogo; no contiene órdenes de importación                                                                               |
| `<P>-changes.json`                  | Si publica: `{status:"comparable",scope,baseline,previousCount,currentCount,added,updated,suspectedMissing}`; si no: `{status:"not-comparable",reasons,suspectedMissing:[]}`                              | Comparación local con snapshot previo. `suspectedMissing` es **señal**, no orden de baja                                                                              |
| `<P>-errors.json`                   | `{quality:"complete"\|"partial"\|"blocked",failures:[{categoryKey,url,error}],identityConflicts:string[]}`                                                                                                | Diagnóstico de fichas fallidas/conflictos; nunca entrada de importación                                                                                               |
| `<P>-snapshot-<scope>.json`         | `{version:1,scope:string,createdAt:string,items:[{key:string,fingerprint:string}]}`                                                                                                                       | Histórico **local** de identidades y huellas para un ámbito de categorías. Se actualiza únicamente tras publicación `complete`; no representa estado de BD Equipzilla |
| `<salida>.xlsx.report.json`         | `{generatedAt,preparationFile,inventoryFile,inventoryReferences,providerId,companyID,total,newProducts,existingProducts,reviewProducts,duplicateReferences,extraImages,existing[],review[],duplicates[]}` | Informe del plan de exportación al generar un Excel o al no existir altas nuevas seguras; diagnóstico, no API                                                         |
| `storage/runs/<ejecución>/run.json` | Informe de lote generado por su runner, independiente del catálogo importable                                                                                                                             | Operación y trazabilidad de ejecución multiproveedor, no contrato con Equipzilla                                                                                      |

**Archivos no JSON relevantes:** `<P>-all.csv` es la salida tabular completa del scraper; `<P>-<categoría>.csv` separa categorías y `<P>-categories.csv` enumera las categorías procesadas cuando corresponde. Esos CSV **no son la plantilla del backend**. El inventario externo `companyID,reference` tampoco es un resultado automático de consultar la BD: debe aportarlo el operador. **El único artefacto preparado para `/product/import` es el `.xlsx` generado manualmente por `export`.**

### 3.1. `ImportCandidate` dentro del JSON de preparación

Contrato de `src/catalog/import/preparation/contracts.ts`:

```ts
type ImportCandidate = {
  providerId: string;
  sourceUrl: string;
  reference: string | null;
  title: string | null;
  categorySellID: number | null;
  category: string | null;
  condition: "Nuevo" | "Segunda_Mano" | null;
  price: number | null;
  description_title: string | null;
  description: string | null;
  description_general: string | null;
  image: string | null;
  images: readonly string[];
  spec: Readonly<Record<string, SpecValue>>;
  attributes: readonly {attributeID: number; value: string | number | boolean}[];
};
```

Cada entrada contiene `status: "ready" | "review"`, `issues: string[]` y `product`. En un archivo **publicado** pueden coexistir entradas `ready` y `review`: la completitud de extracción no implica que todo el catálogo sea apto para el backend.

## 4. Del dato del proveedor al Excel receptor: correspondencia campo a campo

| Origen / preparación en scraper                                                   | Destino real backend `.xlsx` / persistencia                               | Conversión o condición                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `record.reference` ⇒ `product.reference`                                          | `Referencia *` ⇒ `Product.reference`                                      | Debe existir; se normaliza solo por `trim` al preparar. Es identidad de negocio, no `externalReference` por defecto                                                                                                                    |
| `record.title`                                                                    | `Título *` ⇒ `Product.title`                                              | Texto no vacío                                                                                                                                                                                                                         |
| Categoría de portal ⇒ `resolveCategory` ⇒ `categorySellID`, `category`            | `Categoría *` ⇒ búsqueda `CategorySell.name` activa ⇒ `categorySellID`    | El Excel envía **nombre**, no ID. Debe corresponder de modo único a la categoría activa; el exportador comprueba esa unicidad local                                                                                                    |
| `record.condition` y procedencia                                                  | `Condición *` ⇒ enum `ProductCondition`                                   | El exportador acepta **`Nuevo` y `Segunda_Mano`** si se confirma su procedencia, la categoría pertenece a la rama correspondiente y se cumplen los requisitos del Excel. Las condiciones ausentes o contradictorias quedan en `review` |
| `record.price` texto                                                              | `Precio *` ⇒ `Product.price: Float?`                                      | Se convierte a número finito positivo; sin precio queda `review`. El backend de esta ruta exige valor *truthy*, no valida positividad explícita                                                                                        |
| `shortDescription` o `longDescription`                                            | `Descripción *` ⇒ `Product.description`                                   | Si falta, `review`                                                                                                                                                                                                                     |
| `title`                                                                           | `Descripción título` ⇒ `Product.description_title`                        | Preparación usa título                                                                                                                                                                                                                 |
| `longDescription` o descripción corta                                             | `Descripción general` ⇒ `Product.description_general`                     | En backend puede sustituirse por `description` si está vacía                                                                                                                                                                           |
| `images` + `image`                                                                | `URL 1 *`…`URL 10` ⇒ `Product.images` JSON; `Product.image` primera       | Deduplica URL HTTP(S) con extensión reconocida jpg/png/webp/avif; exige al menos una; **solo 10** llegan al Excel, el exceso se cuenta en informe                                                                                      |
| `specs`, `brand`, `model`, `year`, `horometer`, `location`                        | Columnas dinámicas de atributos ⇒ `ProductAttribute`                      | Solo definiciones del catálogo local activas para la categoría; cabeceras como `<name> (<unit_option>)` cuando procede; el backend persiste valores como texto                                                                         |
| `product.attributes[].attributeID`                                                | Nombre de columna; luego backend resuelve ID desde sus relaciones activas | El ID **no** viaja en Excel: una foto local del catálogo obsoleta puede producir cabeceras incompatibles                                                                                                                               |
| `product.spec`                                                                    | —                                                                         | No se transmite a `Product.spec` por el importador Excel actual                                                                                                                                                                        |
| `providerId`, `sourceUrl`, `externalReference`, `serialNumber`, `scrapedAt`, etc. | —                                                                         | Trazabilidad interna y normalización; **no** se guardan como tales en el `Product` creado por esa ruta                                                                                                                                 |
| `companyID` de inventario/opción de exportación                                   | Campo **multipart `companyID`**, no columna Excel                         | Operador aporta ID real de compañía autorizada                                                                                                                                                                                         |
| —                                                                                 | `logoID: 18`, `metadata` autogenerada, `active` por defecto `false`       | Comportamiento backend; **no** derivado de datos de origen                                                                                                                                                                             |
| `status`, `issues`                                                                | —                                                                         | Solo filtran exportación; `Estado de fila` se escribe vacío en el Excel seleccionado y es ignorado por el backend                                                                                                                      |

**Cabeceras fijas exactas de exportación:** `Referencia *`, `Categoría *`, `Título *`, `Condición *`, `Precio *`, `Descripción título`, `Descripción *`, `Descripción general`, `Estado de fila`, seguidas de atributos elegidos y `URL 1 *` … `URL 10`. Hoja exacta `Productos`. Los atributos de tipo `SELECT`/`BOOLEAN` no agregan unidad al encabezado; el resto sí cuando la definición tiene `unit_option` no vacío.

### 4.1. Categorías y atributos: fuentes y límites

El scraper carga **datos locales** de `data/category/categorySell-flat.json` y `data/import/attributeCatalog.json` (atributos y relaciones). La versión del ZIP contiene 109 categorías y 123 definiciones de atributos; son **conteos del fichero**, no confirmación de la BD desplegada.

- `resolveCategory` localiza la raíz `Maquinaria de Ocasión`, restringe a categorías hoja descendientes y exige correspondencia inequívoca por slug/categoría. Aplica equivalencias concretas por proveedor; si no puede decidir, devuelve `null`.
- `resolveAttributeValue` usa nombres, aliases y normalización de claves; admite ciertas conversiones **mm/cm/m** de longitud. No convierte arbitrariamente otras unidades; valores contradictorios o ambiguos se dejan sin asignar, lo que puede llevar a revisión.
- Para `NUMBER` exige número procesable, para `BOOLEAN` interpreta respuestas equivalentes a sí/no y para texto/select mantiene representación textual; los valores exportados han de ser compatibles con la categoría asociada.
- En el backend los tipos existentes incluyen también `DECIMAL`, `DATE` y `MULTISELECT`. **El cargador local del scraper solo admite `NUMBER`, `TEXT`, `SELECT`, `BOOLEAN`**. Este límite debe revisarse si cambian las definiciones usadas en el destino; **no inventar valores** para suplirlo.

## 5. Publicación, protección y calidad de la extracción

### 5.1. Identidad y duplicación en origen

`buildProductIdentity` usa una clave con proveedor y prioridad: **`reference` → `serialNumber` → URL canónica** (sin query/hash). `dedupeBy` elimina duplicados con esa clave dentro de categorías y en el agregado global. `findIdentityConflicts` detecta, entre otros, una identidad con URLs distintas, números de serie/condiciones contradictorias, una misma URL con referencias distintas y un serial con referencias incompatibles.

Esa identidad **NO es la regla del importador backend**: este último detecta duplicaciones solo dentro del fichero por referencia recortada y no consulta previamente la BD para evitar altas repetidas. Por eso el paso de inventario local es imprescindible; las referencias de distintos proveedores no se convierten en una clave compuesta persistida en Equipzilla.

### 5.2. Estados de calidad del catálogo

`assessCatalogQuality` produce `complete`, `partial` o `blocked` y `published: boolean`:

- Marca razones si no hay categorías, catálogo vacío, categorías sin productos, fallos de extracción, diferencia con `expectedProductUrls` **cuando el adaptador ofrece esa cifra**, caída de tamaño respecto a snapshot o conflictos de identidad.
- Bloquea si hay conflictos, ninguna categoría/producto, alguna categoría vacía o caída a menos de la mitad respecto a un snapshot de al menos 10 elementos. Los problemas restantes impiden que sea `complete` y dan `partial`.
- **Solo `complete` publica** CSV y preparación sin prefijo `partial`, actualiza `-snapshot-<scope>.json` y genera cambios comparables. Si está `partial/blocked`, se escriben salidas diagnósticas `-partial-*`, `-errors.json`, resumen y cambios no comparables; se conserva el último catálogo principal válido. La función lanza error para señalar ejecución no publicada.
- **Cuidado:** `complete` significa que pasaron **los controles disponibles**, no que se recorrió realmente el 100 % del portal si el proveedor no aporta una expectativa fiable.

### 5.3. Preflight antes de exportar

`validateCatalogPublication` verifica resumen `complete/published`, errores cero, recuentos coherentes entre CSV y preparación, huellas SHA-256 de ambos, antigüedad (por defecto 48 horas en `export`), fechas de escritura, cambios comparables, URL/referencia/proveedor consistentes y ausencia de duplicados. `parsePreparation` impide usar `partial-preparation` o un fichero de otro proveedor.

La validación puede emitir advertencias por productos `review`, ausencia de `ready` o `suspectedMissing`. Ninguna advertencia autoriza borrar anuncios ni saltarse la revisión del operador.

## 6. Preparación y exportación manual de **altas**

1. Ejecutar scraping completo de un proveedor y conservar salida válida, no muestras con límites de páginas como catálogo definitivo.
2. Inspeccionar `-summary.json`, `-errors.json`, `-changes.json`, `-preparation.json`; distinguir `ready` de `review` y de fallos del portal.
3. Disponer de un **inventario completo y actualizado de referencias de la compañía** en CSV con cabeceras literales `companyID,reference` y filas pertenecientes solo a esa compañía. El scraper **no lo obtiene por sí solo del backend**.
4. Ejecutar `export` con proveedor, `--companyID` real, ruta de `-preparation.json`, `--existing` y salida `.xlsx`. `--dry-run` simula y **no escribe**; para generar el archivo hay que indicar expresamente `--confirm-inventory`. `--allow-empty-inventory` permite el inventario vacío solo tras comprobarlo externamente.
5. `planProductImport` excluye referencias duplicadas en la preparación, productos `review` o con controles fallidos y referencias ya presentes en inventario (normalizadas con mayúsculas y `trim`). **No actualiza existentes**. Genera como máximo diez URLs por fila; registra imágenes adicionales.
6. Si no hay altas seleccionables, genera únicamente el informe `.report.json`, sin Excel vacío; si sí las hay, genera el Excel + informe, comprueba límite de 10 MiB, no sobreescribe archivos existentes y no transmite el fichero al backend. Una persona decide si procede importarlo.
7. Tras una importación manual, revisar `totalProcessed`, `totalCreated`, `totalFailed`, los errores por fila y el estado de los productos en destino. **La respuesta HTTP 201 no garantiza que todas las filas se hayan creado**. El backend no hace *upsert*.

Comando orientativo de ayuda, sin IDs de empresa ni rutas ficticias de ejecución:

```bash
npm run export -- --help
```

No sustituir los datos de entrada por IDs/URLs inventados. Los comandos cortos del scraper (`npm run scrape -- <proveedor>`, `npm run validate -- <proveedor>`) corresponden a la CLI real, pero las opciones de exportación requieren siempre rutas existentes y un ID real.

## 7. Diferencias detectadas y tareas técnicas pendientes (no implementadas aquí)

**Prioridad alta — impedir importación incorrecta**

| Hallazgo                                    | Hecho comprobado                                                                                                                                                                           | Implicación para próximos cambios                                                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogos de destino no consultados en vivo | El mapeo depende de dos JSON locales; backend resuelve nombres, relaciones y obligatoriedad desde su BD                                                                                    | Antes de aceptar nuevas altas, confirmar coincidencia de categoría/atributo real. La validez de los snapshots en producción **no está confirmada**                                                    |
| Riesgo de duplicado en destino              | El importador crea registros sin comprobar duplicado previo en BD ni `@@unique(companyID,reference)` en el modelo                                                                          | Inventario actualizado y fiable es condición de exportación segura; no afirmar que el backend evita repetidos                                                                                         |
| Cobertura de portales                       | La calidad usa `expectedProductUrls` solo donde está disponible; puede considerar `complete` una cobertura insuficiente si el portal no permite detectar faltantes                         | La aceptación de nuevos proveedores requiere contrastar recuentos externos. La auditoría histórica del 20/10/2026 describía paginación incompleta de Mercaeleva; **no se ha medido su estado actual** |
| Atributos/categorías no resueltos           | `prepareProduct` marca `review` cuando falta categoría o atributo obligatorio; los aliases son específicos y limitados                                                                     | Revisar mappings con datos reales, no inventar valores/IDs para convertirlos artificialmente en `ready`                                                                                               |
| Estado ausente o contradictorio             | `prepareProduct` solo acepta `Segunda mano` explícito y sin contradicción; `gomariz` no define condición en su parser y `mercaeleva` puede devolver `null` cuando no hay estado publicado. | Conservar `review` para condición desconocida y distinguirla de la exclusión artificial de `Nuevo`; no inferir uso por defecto.                                                                       |

**Prioridad alta — corregir el alcance funcional según el objetivo vigente**

| Hallazgo                                    | Situación actual y límite                                                                                                                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Productos `Nuevo`                           | El backend **ya acepta `Nuevo`**; `prepareProduct`, `ImportCandidate`, `resolveCategory` y `validateImportCandidate` los bloquean o los tratan como ocasión. **Dar soporte correcto a ambas condiciones es un requisito central pendiente**, no una decisión futura opcional |
| Actualizaciones y bajas                     | Solo se generan altas; `existing` se excluye y `suspectedMissing` es informativo. No existe sincronización de cambios de precio/stock, *upsert* ni baja automática en el flujo revisado                                                                                      |
| Metadatos de origen perdidos                | `providerId`, `sourceUrl`, `externalReference`, `spec` y `serialNumber` no pasan como campos independientes por Excel. El contrato receptor revisado no conserva toda la trazabilidad de origen                                                                              |
| `logoID` fijo                               | El importador backend asigna `18`; su existencia/correspondencia con la marca no se ha comprobado en BD                                                                                                                                                                      |
| Diferencia de validación entre herramientas | El scraper exige precio positivo e imagen URL HTTP(S) con formato de archivo conocido; el backend comprueba `!price` y al menos una URL, sin las mismas reglas. Una fila creada por otra vía no comparte necesariamente filtros locales                                      |
| Soporte de atributos                        | El backend modela `DECIMAL`, `DATE`, `MULTISELECT`; el cargador de atributos del scraper no reconoce esos tipos en su catálogo local                                                                                                                                         |
| Imágenes adicionales                        | El Excel admite diez columnas de URL; el resto se contabiliza y no se importa por esta ruta                                                                                                                                                                                  |

**La tabla anterior no fija el orden exacto del trabajo:** para corregir nuevas/usadas, atributos, descripción y precios ver [OBJETIVOS_SCRAPER.md](OBJETIVOS_SCRAPER.md).

**No confirmado en el código revisado:** estado de la BD real, inventario de cada compañía, equivalencias actuales de atributos, autoría/aprobación para importar, resultado de procesos asíncronos posteriores y disponibilidad completa de las webs. No se afirma que haya automatización de importación ni producción validada.

## 8. Contratos que debe preservar un hilo futuro

- Mantener `ProductRecord` como **dato extraído** y `ImportCandidate` como **dato preparado**. No confundir ninguno con la hoja Excel del backend.
- Mantener identidad por proveedor en extracción y comprobar duplicados del inventario por referencia de la empresa antes de alta.
- No prometer datos ausentes ni transformar `review` en `ready` sin evidencia; preservar bloqueo de publicación parcial y snapshot del último resultado válido.
- Separar adaptadores/parsers (obtención), normalización y mappers (reglas), `catalog/import` (preparación/exportación), pipeline (calidad/publicación), CLI (entrada/salida).
- No alterar los endpoints ni contratos del backend para corregir problemas del scraper sin autorización expresa.
- No tratar `-changes.json` como orden de borrado ni `-preparation.json` como petición HTTP.
- Mantener la procedencia y fecha de análisis: si cambia el backend, revalidar manualmente **el contrato receptor** y actualizar estos dos Markdown; no crear copias paralelas.

## 9. Trazabilidad concreta

**Scraper:** `src/contracts/catalog.ts`, `src/contracts/scraping.ts`, `src/scraping/registry.ts`, `src/scraping/providers/{gam,gomariz,mercaeleva}/`, `src/catalog/{identity,quality}.ts`, `src/catalog/normalization/`, `src/catalog/import/mapping/{category-mapping,attribute-mapping}.ts`, `src/catalog/import/preparation/{prepare,preparation-document,import-validation}.ts`, `src/catalog/import/export/export-plan.ts`, `src/infrastructure/filesystem/import-catalog-loader.ts`, `src/infrastructure/spreadsheet/xlsx.ts`, `src/pipeline/publication/{publish,csv-serializer}.ts`, `src/pipeline/validation/preflight.ts`, `src/cli/{index,export}.ts`; fotografías `data/category/categorySell-flat.json` y `data/import/attributeCatalog.json`.

**Backend contrastado:** `src/routes/product.routes.ts`, `src/controller/product.controller.ts` (`importProducts`), `src/utils/ProductImportParser.ts`, `src/validator/product.validator.ts` (`parseImportRow`, `importProducts`, `create`), `src/service/product.service.ts` y `prisma/schema.prisma`. La referencia compartida y más detallada del receptor es `EQUIPZILLA_INTEGRATION.md`.

**Estado documental:** fotografía del código del **20/10/2026**, destinada a futuros hilos sin necesidad de volver a abrir el backend. Este documento no es prueba de una importación exitosa.
