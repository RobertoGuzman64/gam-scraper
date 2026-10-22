# Validación y aceptación antes de producción

Protocolo operativo aplicable a las extracciones de GAM, Gomariz y Mercaeleva, para **maquinaria nueva y de segunda mano**. No es una certificación de producción. Alcance funcional y definición de terminado: [OBJETIVOS_SCRAPER.md](OBJETIVOS_SCRAPER.md).

La cadena real es **web del proveedor → extracción y catálogo canónico → preparación offline (o heredada durante transición) → revisión → Excel de altas (opcional y manual)**. Ejecutar el lote no genera ni importa productos automáticamente en Marketplace-Back.

**Antecedente documentado:** en la auditoría del 20/10/2026 se extrajeron 268 GAM, 143 Gomariz y 20 Mercaeleva. Estos números no son una expectativa para ejecuciones posteriores; en aquella muestra Mercaeleva tenía 221 resultados visibles y el scraper solo recuperó la primera página. Había 415/431 candidatos en `review`. Véase [informe histórico](ESTADO_EXTRACCIONES_2026-10-20.md).

## 1. Comprobación local

```bash
npm ci
npm test
npm run build
npm run cli -- --help
```

Revisar que las pruebas de parsers con Cheerio se ejecutan realmente y no figuran como omitidas. Son pruebas con fixtures: **no confirman** cobertura del catálogo remoto. Asegurar salida HTTPS, acceso a `storage/` y Chrome/Chromium para los listados dinámicos de Mercaeleva.

## 2. Extracciones de diagnóstico y aceptación

Para inspeccionar sin pisar prefijos de extracciones que puedan utilizarse después:

```bash
npm run scrape -- gam --category elevacion --prefix prueba-gam-elevacion
npm run scrape -- gomariz --pages 2 --prefix prueba-gomariz
npm run scrape -- mercaeleva --pages 2 --prefix prueba-mercaeleva
```

Estas pasadas **no son catálogos completos**. Para una aceptación real ejecutar los proveedores sin límites artificiales de páginas, con prefijos propios y desde la raíz del repo:

```bash
npm run scrape -- gam --prefix validacion-gam
npm run scrape -- gomariz --prefix validacion-gomariz
npm run scrape -- mercaeleva --prefix validacion-mercaeleva
```

Comprobar obligatoriamente **contra cada web** las páginas primera, intermedia y final, cantidad de artículos anunciados, URLs/referencias y posibles páginas repetidas. Verificar el solapamiento entre raíces de GAM y que se mantengan unidades distintas del mismo modelo. En Gomariz, una página sin novedades no necesariamente significa fin. En Mercaeleva no aceptar como completa una repetición de los 20 primeros artículos.

## 3. Validación de archivos publicados

```bash
npm run validate -- gam --prefix validacion-gam
npm run validate -- gomariz --prefix validacion-gomariz
npm run validate -- mercaeleva --prefix validacion-mercaeleva
```

Por defecto se utiliza `storage/scraped/<proveedor>/`; para un directorio personalizado usar `--out <ruta>`. El validador admite `--maxAgeHours <horas>` (48 por defecto). Compatibilidad con flags anteriores: `--provider`, `--outDir`, `--outPrefix`.

- **0:** archivos consistentes, sin incidencias locales que exijan revisión.
- **2:** verificación técnica completada con avisos de revisión (por ejemplo candidatos `review`, ningún `ready` o posibles ausencias).
- **1:** error técnico, de argumentos, publicación, hashes, antigüedad o datos incompatibles.

Comprobar `quality.status`, `quality.published`, fallos, productos únicos y huellas SHA-256 de `<prefijo>-all.csv`, `<prefijo>-preparation.json` y, para publicaciones nuevas, `<prefijo>-catalog.json` con su manifest externo. El lector canónico admite relectura offline de catálogos completos y rechaza mezclas de ejecuciones, identidades repetidas y archivos alterados. El validador coteja también cambios y referencias, **pero no el recuento total del portal externo**. Nunca importar `-partial-all.csv` ni interpretar `suspectedMissing` como producto vendido/baja.

Si una extracción falla, comprobar que el último CSV y `-catalog.json` válido siguen intactos y conservar `-errors.json`, snapshots y logs para diagnóstico. Históricos anteriores a la etapa canónica solo incluyen sus artefactos originales, sin reconstrucción automática. Evitar reutilizar prefijos de producción para pruebas.

## 4. Revisión funcional de las fichas

Comprobar muestras representativas **separadas por condición (`Nuevo`, `Segunda_Mano` y desconocida)** de título, marca, modelo, referencia, año, serie, horas, precio, descripción, fotos, URL, categoría final, especificaciones y atributos requeridos. La finalidad incluye ambas condiciones: que la preparación de versiones anteriores marcase toda maquinaria nueva como `review` era una **brecha ya corregida**. Las máquinas nuevas pueden continuar en `review` por datos o requisitos de importación realmente incumplidos. No confundir desbloquear condición con disponer ya de precio, categoría, descripción corta y atributos suficientes para importar. Regresiones especialmente relevantes:

- **GAM:** referencias de unidades del mismo modelo, pestañas HTML enlazadas a `#`, claves técnicas sospechosas como `spec__4880`, `spec__1930` y `spec__SI`; revisar solapamientos entre categorías.
- **Gomariz:** varias unidades con nombres semejantes, galerías con más de diez imágenes y precios ausentes en la web. No inventar precios.
- **Mercaeleva:** avance auténtico entre páginas, fotografías duplicadas como miniaturas/variantes y artículos sin precio.
- **Condiciones/categorías:** comprobar que `Nuevo` no se convierta en `Segunda_Mano`, que una nueva no acabe en una categoría de ocasión y que los estados desconocidos o contradictorios queden sin inventar. El contrato local admite ambos estados con evidencia de origen.
- **Destino Equipzilla:** comparar snapshots `data/category/` y `data/import/` con los catálogos **vigentes del entorno donde se importaría**. No forzar categorías ni atributos obligatorios de forma especulativa.

## 5. Exportación manual de altas

Antes de generar un archivo, obtener un `companyID` autorizado del entorno correcto y extraer de ese backend el inventario **completo, reciente y de la misma empresa**, en CSV con cabeceras `companyID,reference`.

Simulación para el prefijo de aceptación de GAM:

```bash
npm run export -- gam --companyID <ID_REAL> --preparation storage/scraped/gam/validacion-gam-preparation.json --existing storage/inventory/gam.csv --out storage/import/gam-altas.xlsx --dry-run
```

Revisar la cantidad de `ready`, `review`, referencias nuevas, existentes y duplicadas. Solo con aprobación de negocio y un inventario verificado cambiar `--dry-run` por `--confirm-inventory`. No usar `--allow-empty-inventory` sin acreditar que realmente no hay productos previos. Inspeccionar el `.xlsx` y su `.report.json` (máximo 10 MB y hasta diez fotos por alta) antes de una **prueba manual autorizada** con el importador existente. No hay actualizaciones ni bajas automáticas.

## 6. Autorización de ejecución programada

No programar el lote completo hasta tener todos los proveedores aceptados: cobertura externa verificable, snapshots e histórico persistentes, permisos/alertas, y fallo visible ante resultados anómalos. Se puede limitar un despliegue a proveedores aprobados usando `--providers`, sin considerar aprobadas las fuentes excluidas.

Checklist de salida:

- [ ] `npm ci`, `npm test` y `npm run build` correctos; tests de parsers no omitidos.
- [ ] Cobertura real y paginación aceptadas para cada proveedor habilitado.
- [ ] Fallos, identificaciones duplicadas y muestras de atributos/fotos revisados.
- [ ] CSV, JSON, hashes y snapshots válidos; una ejecución fallida no sustituye la última publicación.
- [ ] Categorías/atributos de destino e inventario por `companyID` contrastados.
- [ ] Dos ejecuciones controladas con historial y alertas antes del planificador.
- [ ] Importación manual de prueba y aprobación separadas, si se pretende utilizar el Excel.

Para escoger infraestructura y persistencia, consultar [DESPLIEGUE_AUTOMATICO.md](DESPLIEGUE_AUTOMATICO.md). La validación técnica **no equivale** a autorización de negocio o de importación.

### Evidencia de pruebas en esta entrega (etapa 2)

En el entorno de preparación de la entrega se compilaron los ficheros afectados sin errores propios de TypeScript y se ejecutó el subconjunto de pruebas sin dependencias externas: **108 pruebas correctas, 0 fallidas, 0 omitidas**. Se incluyeron **13 pruebas nuevas** del flujo offline, identidad, replay, tres proveedores, comparación, manifests y recuperación ante archivos existentes. La ejecución completa de `npm test` y `npm run build` **no quedó acreditada** porque el entorno carecía de los paquetes reales `cheerio` y `p-limit`: generan errores de resolución/importación y de tipado derivado; no se han sustituido por mocks en la entrega. El propietario debe ejecutar `npm ci`, `npm test` y `npm run build` en su entorno con dependencias completas antes de integrar.

## Etapa 3 — validación y exportación desacopladas (22/10/2026)

Tres vías disponibles: `npm run validate -- gam` (publicación heredada y antigüedad máxima de 48 h), `npm run validate -- gam --stage catalog --prefix scrape-gam-marzo-2026` (integridad canónica) y `npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json` (replay verificado). Si el prefijo/ruta de preparación difiere de la fuente, indicar `--source <catálogo-catalog.json>`. No se llama a los portales durante `prepare`, `validate --stage` ni `export`.

El preflight offline coteja catálogo, manifest y resumen de publicación; origen y hash de la preparación; snapshots y reglas vigentes; identidades alineadas y el contenido completo de productos regenerados desde el catálogo. El modo de preparación informa `ready/review`; no exige inventario y puede revisar orígenes antiguos. El exportador sí exige origen de antigüedad máxima de 48 h, compañía real y un inventario completo confirmado. No exporta fichas `review`, precios nulos, nuevas con categoría de ocasión ni referencias repetidas/existentes.

Ejemplo de flujo completo a ejecutar tras un scraping íntegro y con inventario real:

```powershell
npm run validate -- gam --stage catalog --prefix scrape-gam-marzo-2026
npm run prepare -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json
npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json
npm run export -- gam --companyID <ID_REAL> --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json --existing storage/inventory/gam.csv --out storage/import/gam-altas.xlsx --dry-run
```

Tras comprobar el plan, sustituir `--dry-run` por `--confirm-inventory` únicamente con autorización y un inventario actual. La simulación no crea XLSX ni informe persistido. La generación conserva `wx` (sin sobreescritura), informe JSON y rollback del Excel ante fallo del informe. Ningún comando envía POST al backend.

**Evidencia de esta entrega:** selección de 23 ficheros de pruebas, **130 casos correctos, 0 fallidos y 3 omitidos**; incluye exportación offline/legacy, manifest alterado aun refirmado, identidades, proveedor, antigüedad, plan de altas y tres proveedores. Las pruebas que importan el registro de proveedores se ejecutaron con un sustituto temporal de Cheerio que impide parsear HTML (no incluido en el repositorio). No sustituye a las dependencias reales ni acredita parsers o build completo. Ejecutar `npm ci`, `npm test` y `npm run build` con dependencias reales antes de integrar.
