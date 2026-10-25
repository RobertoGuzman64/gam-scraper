# Validación y aceptación del catálogo JSON

## AI GUARD

**Documentación protegida.** Ninguna IA debe crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para esa intervención documental. Una petición sobre código, tests o auditorías no autoriza cambios documentales implícitos.

Protocolo operativo aplicable a las extracciones de GAM, Gomariz y Mercaeleva, para **maquinaria nueva y de segunda mano**. No es una certificación de producción. Alcance funcional y definición de terminado: [OBJETIVOS_SCRAPER.md](OBJETIVOS_SCRAPER.md).

La cadena central es **web del proveedor → extracción → catálogo JSON canónico completo → preparación y auditoría de calidad → 100 % `ready`, 0 `review`**. La exportación hacia Excel o `create/many` es una **rama auxiliar del receptor**, que no determina si el catálogo está terminado. Ejecutar el lote no importa ni publica productos automáticamente en Marketplace-Back.

**Criterio de aceptación vigente (23/10/2026):** todas las máquinas de la cohorte real deben estar `ready` mediante datos verificables, sin pérdidas de identidad ni valores inventados. Un requisito exclusivo del backend no es, por sí mismo, un defecto de calidad del JSON. Las reglas actuales deben analizarse antes de reclasificar casos; nunca forzar `ready` escondiendo contradicciones.

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

Comprobar muestras representativas **separadas por condición (`Nuevo`, `Segunda_Mano` y desconocida)** de título, marca, modelo, referencia, año, serie, horas, precio, descripción, fotos, URL, categoría final, especificaciones y atributos requeridos. La finalidad incluye ambas condiciones: que la preparación de versiones anteriores marcase toda maquinaria nueva como `review` era una **brecha ya corregida**. Las máquinas nuevas pueden continuar en `review` por contradicciones, identidades o normalizaciones no resueltas. **No confundir esos problemas de calidad con la falta de campos exigidos por un receptor externo.** El precio ausente tiene tratamientos distintos en Excel y `create/many`, pero ninguno de ellos dirige la aceptación del catálogo JSON. Regresiones especialmente relevantes:

- **GAM:** referencias de unidades del mismo modelo, pestañas HTML enlazadas a `#`, claves técnicas sospechosas como `spec__4880`, `spec__1930` y `spec__SI`; revisar solapamientos entre categorías.
- **Gomariz:** varias unidades con nombres semejantes, galerías con más de diez imágenes y precios ausentes en la web. No inventar precios.
- **Mercaeleva:** avance auténtico entre páginas, fotografías duplicadas como miniaturas/variantes y artículos sin precio.
- **Condiciones/categorías:** comprobar que `Nuevo` no se convierta en `Segunda_Mano`, que una nueva no acabe en una categoría de ocasión y que los estados desconocidos o contradictorios queden sin inventar. El contrato local admite ambos estados con evidencia de origen.
- **Destino Equipzilla:** comparar snapshots `data/category/` y `data/import/` con los catálogos **vigentes del entorno donde se importaría**. No forzar categorías ni atributos obligatorios de forma especulativa.

## 5. Exportación manual de altas (opcional, fuera del criterio de aceptación JSON)

Esta sección se conserva únicamente como **referencia operativa para el receptor**. No es un paso necesario para cerrar los JSON ni una tarea prioritaria del scraper. Si otra persona decide generar altas, antes de producir el archivo debe obtener un `companyID` autorizado del entorno correcto y extraer un inventario **completo, reciente y de la misma empresa**, en CSV con cabeceras `companyID,reference`.

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
- [ ] Todas las máquinas incluidas en los JSON y preparaciones; `ready` del 100 % y `review` igual a 0, con evidencias y sin modificar las reglas por conveniencia.
- [ ] Contradicciones, fuentes y atributos recuperados contrastados con regresiones controladas.
- [ ] Dos ejecuciones controladas con historial y alertas antes del planificador.
- [ ] Si se pretende utilizar Excel/`create/many`, validación del receptor y autorización **por separado**; no condicionan la aceptación JSON.

Para escoger infraestructura y persistencia, consultar [DESPLIEGUE_AUTOMATICO.md](DESPLIEGUE_AUTOMATICO.md). La validación técnica **no equivale** a autorización de negocio o de importación.

### Evidencia de pruebas en esta entrega (etapa 2)

En el entorno de preparación de la entrega se compilaron los ficheros afectados sin errores propios de TypeScript y se ejecutó el subconjunto de pruebas sin dependencias externas: **108 pruebas correctas, 0 fallidas, 0 omitidas**. Se incluyeron **13 pruebas nuevas** del flujo offline, identidad, replay, tres proveedores, comparación, manifests y recuperación ante archivos existentes. La ejecución completa de `npm test` y `npm run build` **no quedó acreditada** porque el entorno carecía de los paquetes reales `cheerio` y `p-limit`: generan errores de resolución/importación y de tipado derivado; no se han sustituido por mocks en la entrega. El propietario debe ejecutar `npm ci`, `npm test` y `npm run build` en su entorno con dependencias completas antes de integrar.

## Etapa 3 — validación y exportación desacopladas (22/10/2026)

Tres vías disponibles: `npm run validate -- gam` (publicación heredada y antigüedad máxima de 48 h), `npm run validate -- gam --stage catalog --prefix scrape-gam-marzo-2026` (integridad canónica) y `npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json` (replay verificado). El modo preparación utiliza el prefijo original guardado en el documento, aunque la salida tenga otro nombre (por ejemplo `-alturas-preparation.json`). Si el catálogo está fuera del directorio predeterminado del proveedor, indicar `--source <catálogo-catalog.json>`. No se llama a los portales durante `prepare`, `validate --stage` ni `export`.

El preflight offline coteja catálogo, manifest y resumen de publicación; origen y hash de la preparación; snapshots y reglas vigentes; identidades alineadas y el contenido completo de productos regenerados desde el catálogo. El modo de preparación vigente puede reflejar requisitos de `create/many` en sus diagnósticos `ready/review` (sin exigir precio), conserva `price: null` cuando falta y muestra indicadores de receptor en consola. **Este comportamiento técnico existente no redefine el objetivo:** se debe separar la calidad real del JSON de las exigencias de importación cuando se investiguen los bloqueos. No exige inventario y puede revisar orígenes antiguos. El exportador sí exige origen de antigüedad máxima de 48 h, compañía real y un inventario completo confirmado. El Excel exige precio positivo y descarta precios nulos aunque la ficha esté `ready`; JSON omite el precio cuando es nulo. Ambos mantienen bloqueados los atributos obligatorios como el tipo de mástil, las categorías/condiciones no válidas, las identidades contradictorias y las referencias repetidas/existentes. Ninguno importa automáticamente.

Ejemplo histórico del flujo con una **rama adicional de exportación** (el último comando es opcional y ajeno a la aceptación JSON):

```powershell
npm run validate -- gam --stage catalog --prefix scrape-gam-marzo-2026
npm run prepare:catalog -- gam --source storage/scraped/gam/scrape-gam-marzo-2026-catalog.json
npm run validate -- gam --stage preparation --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json
npm run export -- gam --companyID <ID_REAL> --preparation storage/prepared/gam/scrape-gam-marzo-2026-preparation.json --existing storage/inventory/gam.csv --out storage/import/gam-altas.xlsx --dry-run
```

Tras comprobar el plan, sustituir `--dry-run` por `--confirm-inventory` únicamente con autorización y un inventario actual. La simulación no crea XLSX ni informe persistido. La generación conserva `wx` (sin sobreescritura), informe JSON y rollback del Excel ante fallo del informe. Ningún comando envía POST al backend.

**Evidencia de esta entrega:** selección de 23 ficheros de pruebas, **130 casos correctos, 0 fallidos y 3 omitidos**; incluye exportación offline/legacy, manifest alterado aun refirmado, identidades, proveedor, antigüedad, plan de altas y tres proveedores. Las pruebas que importan el registro de proveedores se ejecutaron con un sustituto temporal de Cheerio que impide parsear HTML (no incluido en el repositorio). No sustituye a las dependencias reales ni acredita parsers o build completo. Ejecutar `npm ci`, `npm test` y `npm run build` con dependencias reales antes de integrar.

## Contraste de cobertura entre extracciones (F49)

Para una extracción nueva, la conformidad estructural del catálogo no demuestra que se hayan mantenido las referencias de una cohorte histórica. El contraste se activa únicamente con `--baseline` y no cambia los JSON:

```powershell
npm run validate -- gam --stage catalog --source "storage/scraped-20261025-010603/gam/scrape-gam-marzo-2026-catalog.json" --baseline "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json"
```

Se validan ambos catálogos con sus respectivos manifests e informes de publicación, y se comprueba que pertenecen al mismo proveedor y ámbito. La comparación usa identidades canónicas, no el contador total: informa ausencias, incorporaciones y cambios. Si hay referencias ausentes devuelve código `2` (revisión de cobertura); `1` indica error o catálogos no comparables y `0` ausencia de bajas sospechosas. No se reincorporan productos históricos ni se dan de baja automáticamente. El contraste no permite asegurar si la causa fue venta, retirada, traslado de categoría o pérdida de descubrimiento. Para la cohorte del 25/10/2026 GAM aparecen como ausentes `6942`, `6948`, `6366` y `6676`; antes de decidir su publicación se requiere verificar la fuente actual.

F49 también admite preparar de nuevo el JSON canónico recién obtenido de Gomariz sin reescribirlo. En las tres referencias SS0507E `TE1858`, `TE1621` y `TE1622`, cuando la ficha mantiene exactamente la identidad y las especificaciones comprobadas, se normaliza a **4,3 m** la altura de plataforma publicada erróneamente como **14,30 m**. La evidencia es la tabla SS0507E del fabricante en `https://www.gomarizrent.com/wp-content/uploads/2025/11/FICHA-TECNICA-LGMG-SS0407E-SS0507E-SS0607E.pdf` (6,3 m altura de trabajo, 4,3 m plataforma, 985 kg y 230 kg de capacidad). Valores o variantes diferentes continúan sujetos al control de calidad existente. La ficha canónica conserva el texto original.

F48 no se reutiliza sobre esta extracción porque su selección editorial requiere los hashes y recuentos de la cohorte anterior. No se reescriben exclusiones sin una decisión editorial de la cohorte nueva.

## Revisión editorial del scraping del 25/10/2026 (F50–F54)

La ejecución real en Windows superó tests y compilación. El lote de 25/10/2026 produjo 1.004 fichas GAM, 143 Gomariz y 218 Mercaeleva. Tras F49: 1.362 `ready`, 3 `review`; las únicas exclusiones técnicas siguen siendo GAM `6682`/`6703` y Mercaeleva `M827-8304`. La comparación histórica de GAM detectó **cuatro ausencias y 24 referencias cambiadas**, sin incorporaciones. Las diferencias se cerraron posteriormente mediante el expediente editorial de F51–F54. La accesibilidad de una ficha no acredita por sí sola presencia en la cobertura española.

F50 amplía `validate --stage catalog --baseline`: además del recuento muestra `CAMBIADA | referencia | campos ...`, incluyendo las claves concretas de `specs`. Las fechas `scrapedAt` no cuentan como cambios; cualquier modificación real exige revisión y devuelve código `2`, al igual que una ausencia. Esto **no** cambia los JSON de origen ni el algoritmo de scraping.

Para generar un expediente que permita revisar todas las diferencias sin inventar decisiones:

```powershell
$raw = "storage/scraped-20261025-010603"
$prep = "storage/prepared-20261025-f49"
$baseline = "storage/scraped/gam/scrape-gam-marzo-2026-catalog.json"
$current = "$raw/gam/scrape-gam-marzo-2026-catalog.json"

npm run review:coverage -- --baseline $baseline --current $current --out "storage/coverage-f50/review.json"
```

El JSON contiene los hashes de ambos catálogos, las referencias ausentes, las fichas cambiadas y las claves modificadas. Todos los campos `decision` y `reason` se generan vacíos. Revisar cada ficha y los datos de origen antes de completar el expediente: cada ausencia confirmada como retirada debe llevar `decision: "retirado"`, motivo específico y una o más URLs HTTPS de evidencia; cada cambio contrastado debe llevar `decision: "aceptado"`, motivo y evidencia. No basta observar un HTTP 404 o un resultado indexado: deben contrastarse cobertura, anuncios y existencia real en el portal pertinente. Ante ausencia de evidencia, dejar la decisión `null` y **no publicar**. No se copian fichas históricas al catálogo actual.

F50 también permite simular la selección editorial sobre la nueva cohorte de 1.365 referencias, protegida por los hashes exactos del scraping del 25/10:

```powershell
npm run select:publishable -- --gam "storage/prepared-20261025-010603/gam/scrape-gam-marzo-2026-preparation.json" --gomariz "$prep/gomariz/scrape-gomariz-preparation.json" --mercaeleva "storage/prepared-20261025-010603/mercaeleva/scrape-mercaeleva-preparation.json" --dry-run
```

La simulación permite comprobar **1.362 publicables y tres exclusiones técnicas**, pero todavía **no** autoriza generar los JSON finales. Tras completar y revisar honestamente el expediente de cobertura, el mismo comando puede escribirse con `--outDir "storage/publicable-20261025-f50"` en lugar de `--dry-run`, añadiendo `--baseline $baseline --catalog $current --coverage-review "storage/coverage-f50/review.json"`. El proceso verifica los catálogos, manifests, hashes, cuatro ausencias, 24 cambios, referencias, campos, motivos y evidencias. Si falta alguna revisión o la fuente cambia, falla sin escribir nada.

Una exportación autorizada mediante `--outDir` genera `gam-publishable.json`, `gomariz-publishable.json`, `mercaeleva-publishable.json` y `selection.json`. Los tres primeros son arrays de los contratos `ImportCandidate` ya existentes, filtrados únicamente por calidad editorial; **no** son una importación automática ni acreditan conformidad con Excel o `create/many`. `selection.json` conserva el resumen, procedencia y exclusiones. La salida es de creación exclusiva y no sobrescribe ficheros preexistentes. La selección F48 sobre su cohorte histórica sigue soportada sin cambiar sus contratos.

Cierre editorial posterior del 25/10/2026: 24 referencias con cambios y 33 controles de campo revisados; selección final de 1.359 fichas (GAM 999, Gomariz 143, Mercaeleva 217), con seis exclusiones. Las cuatro ausencias se clasificaron sin atribuirles una retirada comercial no probada. La evidencia aprobada y los JSON de entrega son artefactos externos a este repositorio; no se deben reconstruir motivos ni decisiones sin ellos.
