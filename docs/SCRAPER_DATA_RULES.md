# Reglas de datos y publicación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Fuente de verdad y contratos

La fuente de verdad de extracción es el catálogo **`ProductRecord[]`** dentro de `<prefijo>-catalog.json`, definido en `src/contracts/catalog.ts`. Cada registro conserva:

- Identidad y origen: `providerId`, `reference`, `externalReference?`, `url`, `serialNumber`, `categoryKey`, `categoryName`.
- Contenido: `title`, `shortDescription`, `longDescription`, `shortDescriptionHtml?`, `longDescriptionHtml?`, `brand`, `model`.
- Datos técnicos y comerciales: `year`, `yearSource?`, `horometer`, `condition?`, `price`, `priceText?`, `location`, `country`, `specs?`.
- Imágenes y contexto: `image`, `images?`, `breadcrumbs?`, `subcategory?`, `technicalSheetUrl?` y metadatos de extracción.

Los valores que faltan pueden ser `null`; `condition` es `"Nuevo" | "Segunda mano" | null` y **no** coincide literalmente con el enum del receptor. `specs` es un mapa de valores escalares o listas simples. No inferir una característica por semejanza de modelo, descripción genérica o campos ajenos a otra máquina.

El catálogo canónico incluye todas las máquinas que superan la publicación estructural, **sin filtrarlas por importabilidad**. `ImportCandidate`, definido en los contratos de preparación del repositorio, es otra representación para mapeos de destino; no sustituye a `ProductRecord`.

## Artefactos de extracción

La ubicación habitual es `storage/scraped/<proveedor>/`, con prefijo configurable:

| Artefacto                               | Función                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `<prefijo>-catalog.json`                | Catálogo canónico íntegro, productos y ámbito de extracción.                         |
| `<prefijo>-catalog.manifest.json`       | Procedencia, totales y huella SHA-256 del catálogo.                                  |
| `<prefijo>-all.csv` y CSV por categoría | Inspección y procesamiento tabular, con columnas `spec__*` cuando proceda.           |
| `<prefijo>-preparation.json`            | Preparación generada en la publicación, con productos y diagnósticos `ready/review`. |
| `<prefijo>-summary.json`                | Estado y totales de publicación, incluida información de integridad.                 |
| `<prefijo>-changes.json`                | Cambios y posibles ausencias frente al contexto disponible; no autoriza bajas.       |
| `<prefijo>-errors.json` y snapshots     | Diagnóstico de extracción, descubrimiento y seguimiento.                             |

La preparación **offline** se puede escribir en `storage/prepared/<proveedor>/`. Incluye procedencia del catálogo, identidades, huellas de reglas y snapshots, calidad y candidatos preparados. Debe poder verificarse sin consultar las webs.

Los documentos de origen, los manifests y los datos de preparación deben permanecer alineados. No editar productos manualmente en un JSON publicado ni reemplazar su manifest para «validar» una modificación. Los archivos de ejecución están excluidos del control de versiones.

## Identidad y cobertura

- La identidad de una **unidad** no es únicamente marca/modelo: usar referencias, series, URLs canónicas y otras evidencias coherentes para deduplicar sin fusionar máquinas distintas.
- Una caída del número de anuncios requiere análisis de cobertura; no prueba venta, retirada o fallo del scraper por sí sola.
- Un estado de publicación `complete` acredita coherencia del proceso local, **no** que el portal haya enumerado todas las fichas existentes.
- Una diferencia de URL, imágenes, textos o especificaciones puede requerir revisión editorial aunque no cambie el número de productos.
- Preservar la imagen principal propia de cada ficha; evitar fotografías de productos relacionados como si fueran parte de su galería.
- **Fidelidad de imágenes a la fuente vigente:** si el proveedor deja de exponer una URL, no restaurarla desde históricos aunque aún funcione. No exigir recuentos constantes de fotos entre campañas. Si la fuente actual sí expone una imagen que el scraper omite, comprobar el adaptador; no inventar ni conservar URL externas por conveniencia.

## Calidad y decisiones editoriales

`ready` y `review` son estados locales de preparación. `review` señala cuestiones a investigar, pero algunas provienen de requisitos de mapeo del receptor y no necesariamente de errores en el catálogo de origen. No eliminar atributos fiables ni rellenar los ausentes por conveniencia.

La revisión de cobertura genera un expediente con **huellas de los dos catálogos**, referencias ausentes y cambios por campo. Las decisiones empiezan pendientes. Para cerrar incidencias hacen falta motivos específicos y evidencias, especialmente en ausencias, imágenes y descripciones. Una retirada exige prueba; una ausencia acreditada de listado no equivale a una baja comercial; `no_acreditado` mantiene el bloqueo. Las decisiones deben verificarse contra los mismos archivos a los que se refieren.

La selección editorial crea productos publicables y un resumen de exclusiones **sin reescribir el catálogo original**. Las exclusiones pueden ser necesarias para proteger la calidad, pero no convierten fichas dudosas en `ready`. La salida por proveedor es un conjunto de candidatos ya definidos por el proyecto, no un request HTTP de importación.

## Exportaciones auxiliares

- **XLSX:** plan de **altas** con `companyID` autorizado e inventario completo de la compañía. Requiere precio admitido por el exportador y aplica restricciones propias del receptor Excel.
- **JSON de receptor:** formato adaptado a `create/many`; mantiene su propia validación y no es el catálogo canónico.
- Ninguna exportación realiza altas, cambios ni bajas en el backend; solo genera un artefacto revisable.
- No copiar IDs de categoría o atributos de otra empresa ni presuponer que los snapshots locales reflejan la base de datos activa.

Las correcciones textuales puntuales se gestionan, cuando proceda, mediante [intervenciones manuales por campaña](INTERVENCIONES_CAMPANA.md), con origen intacto y sin promoción editorial automática.

Para el flujo ordinario de **todos los proveedores registrados** consultar [Campañas completas](CAMPANAS.md); para los criterios de aceptación ver [Validación](VALIDACION.md) y [Objetivos](OBJETIVOS_SCRAPER.md).
