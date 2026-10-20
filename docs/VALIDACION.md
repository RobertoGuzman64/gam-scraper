# Validación y aceptación antes de producción

Protocolo operativo aplicable a las extracciones de GAM, Gomariz y Mercaeleva. Reemplaza la antigua guía numerada por fase: no es una certificación de producción.

La cadena real es **web del proveedor → extracción → CSV/JSON de preparación → revisión → Excel de altas (opcional y manual)**. Ejecutar el lote no genera ni importa productos automáticamente en Marketplace-Back.

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

Comprobar `quality.status`, `quality.published`, fallos, productos únicos y huellas SHA-256 de `<prefijo>-all.csv` y `<prefijo>-preparation.json`. El validador coteja también cambios y referencias, **pero no el recuento total del portal externo**. Nunca importar `-partial-all.csv` ni interpretar `suspectedMissing` como producto vendido/baja.

Si una extracción falla, comprobar que el último catálogo válido sigue intacto y conservar `-errors.json`, snapshots y logs para diagnóstico. Evitar reutilizar prefijos de producción para pruebas.

## 4. Revisión funcional de las fichas

Comprobar muestras representativas de título, marca, modelo, referencia, año, serie, horas, precio, descripción, fotos, URL, categoría final, especificaciones y atributos requeridos. Regresiones especialmente relevantes:

- **GAM:** referencias de unidades del mismo modelo, pestañas HTML enlazadas a `#`, claves técnicas sospechosas como `spec__4880`, `spec__1930` y `spec__SI`; revisar solapamientos entre categorías.
- **Gomariz:** varias unidades con nombres semejantes, galerías con más de diez imágenes y precios ausentes en la web. No inventar precios.
- **Mercaeleva:** avance auténtico entre páginas, fotografías duplicadas como miniaturas/variantes y artículos sin precio.
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
