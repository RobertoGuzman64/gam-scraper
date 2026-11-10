# Mejora acreditada del catálogo: guía operativa por causa y mecanismo

## AI GUARD

**Protección documental.** Este documento solo se modifica mediante una intervención documental expresamente autorizada. Describe mecanismos existentes; no autoriza cambios de originales, publicaciones, aprobaciones, contratos o categorías.

## Objeto y alcance

Esta guía explica **cómo mejorar una ficha desde su origen hasta la salida comercial**, utilizando los mecanismos que ya tiene EQUIPZILLA. Complementa el diagnóstico en [Auditor de huecos](CATALOG_CONTENT_GAPS.md), las reglas en [Datos y publicación](SCRAPER_DATA_RULES.md), las comprobaciones en [Validación](VALIDATION.md) y el circuito de [Publicación individual](INDIVIDUAL_PUBLICATION.md).

La mejora no es una transformación indiscriminada de JSON finales. Hay que encontrar **la primera etapa en que se pierde, altera o interpreta incorrectamente el dato**; corregir esa causa y demostrar la equivalencia de las fichas no afectadas. Son distintos una anomalía del origen, un defecto de software, una observación estadística, un reconocimiento acreditado y una intervención editorial que exige decisión humana.

La publicación técnica de GAM, Gomariz y Mercaeleva está separada de su proyección comercial. El registro de MANAIN no acredita por sí mismo una publicación individual/comercial completa. Nunca se importa a la base de datos desde este proceso.

## Ruta de decisión: síntoma, mecanismo y prueba

| Síntoma o causa localizada | Primera capa y mecanismo existente | Evidencia y protección antes de actuar |
| --- | --- | --- |
| La web contiene listas, textos o campos que no llegan al original canónico | Parser del proveedor en `src/scraping/providers/`; para GAM, `descriptions.ts` y `product.ts` | HTML real del panel, negativos (menús, recomendados), identidad y extracción íntegra; una extracción parcial **no** sustituye el original global |
| El original da un modelo, año, capacidad o magnitud contradictorios | `src/preparation/<proveedor>/technical/reconciliation/` y evidencias específicas | Contrastar URL, referencia, modelo, variante, fuente y huella; proteger unidad vecina, estado `review` y no sobrescritura |
| Un dato técnico fiable está documentado para un modelo o unidad, pero no se aprovecha | `src/preparation/<proveedor>/technical/evidence/` o `technical/models/`; recuperación en `shared/technical/recovery/` | Fabricante y variante compatibles, distinción entre prestación del **modelo** y de la **unidad**, orden de ejecución y prueba sobre una fuente distinta |
| Se pierde una clave o cambian las unidades entre original, preparación y publicación | `shared/technical/reconciliation/preparation-technical-stages.ts`, mapeadores y pruebas de `specification-coverage.ts` | Inspeccionar `technicalSpecs.cases[].stage`; `reconciliacion_acreditada` no equivale a pérdida; comparar claves y valores reales |
| Título, resumen o descripción general presentan variantes ambiguas o contenido incompleto | `src/preparation/<proveedor>/editorial/`, resolutores de procedencia y finalización compartida | Texto exacto, identidad, fuente y precedencia; no equiparar modelos distintos ni inventar especificaciones para alargar texto |
| La descripción verificada necesita una corrección por fuente/huella | Evidencia editorial del proveedor, como `gam/editorial/source/verified-source-matched-generals.ts` | Huella de origen y de preparado, URL/identidad, rechazo si cambia la fuente; la evidencia editorial no recaptura el original |
| Fotografías o portada parecen corresponder a otra máquina | `src/catalog/normalization/{gam,gomariz}/gallery.ts` y diagnósticos de presentación | Verificar propiedad real de la imagen y variante; no eliminar galerías por coincidencia de nombre o número |
| Referencia externa visible compartida entre unidades | `src/commercial/legacy-export/commercial-reference.ts`, `commercial/diagnostics/commercial-cross-coverage.ts` | Preservar `providerId`, `reference`, `sourceUrl` y unidades distintas; los guiones/espacios no autorizan deduplicar |
| Categoría, alias de atributo o condición no se resuelven correctamente | `src/preparation/<proveedor>/classification/mapping/provider.ts` y `shared/classification/mapping/classification-provider.ts` | Reutilizar IDs, tipos, opciones y relaciones actuales; contrastar `not_observed`, rechazo, contradicción y evidencia insuficiente |
| La publicación es correcta, pero la proyección comercial cambia un dato | `src/commercial/projection/`, `validation/` y `export/` | Comparar publicación vs. producto comercial por identidad, justificar exclusiones, conservar atributos/metadata y no corregir el original por un error comercial |
| Un auditor señala una discrepancia ya acreditada | `src/commercial/diagnostics/audited-findings.ts` y `data/audit-finding-recognitions.json` | Confirmar reconocimiento, etapa, identidad y huella **vigentes**; si caduca, investigar el cambio; no editar reconocimientos para silenciar la alerta |
| Corrección excepcional que requiere decisión editorial humana | `interventions/<proveedor>/` y circuitos de acreditación existentes | Usar únicamente campos admitidos y aprobación explícita; no sustituir reglas productivas repetibles por scripts por ID |

Las rutas identifican **puntos de inspección**, no instrucciones de modificar todos esos archivos. El criterio es la causa demostrada y la responsabilidad del módulo.

## Tres recorridos distintos que no deben confundirse

### 1. Extracción y original canónico

Una mejora del parser se prueba primero con HTML real reducido y casos negativos. Después se coteja el resultado de `parseProductPage` con el original canónico vigente. Si el original está anticuado, solo se promueve una **captura completa** con cardinalidad, URLs, identidad, galerías, calidad y manifiesto comprobados. `extraer:proveedor` puede afectar a todo el proveedor; consultar `npm run ayuda -- extraer:proveedor` antes de ejecutarlo. `--url`, `--pages` o un subconjunto no son una publicación canónica íntegra. Nunca escribir el original a mano.

### 2. Preparación y evidencia acreditada

`src/preparation/prepare-product.ts` conserva la procedencia de la unidad y coordina las etapas técnicas, recuperación documentada y composición editorial. `reconcileInitialTechnicalEvidence`, `reconcileTechnicalSourceForRecovery`, `reconcileTechnicalBeforeEditorial` y `reconcileTechnicalAfterEditorial` están en `shared/technical/reconciliation/preparation-technical-stages.ts`; **su secuencia es observable**. `recoverDocumentedTechnicalSpecs` combina recuperadores específicos y recibe tanto el registro de unidad como las especificaciones recuperadas. Una nueva reconciliación no debe alterar de forma accidental esa precedencia.

Las evidencias técnicas/editoriales suelen estar limitadas por referencia, URL, identidad, características y/o huella según el mecanismo concreto. No existe un único requisito universal que autorice aplicar la misma regla a todas las fichas de un modelo. Es obligatorio comprobar qué guarda implementa **esa regla** y añadir el caso negativo correspondiente. Las prestaciones documentadas de modelo no acreditan automáticamente el mástil, altura, batería, horas o configuración física de cada ejemplar.

### 3. Activación, proyección y exportación

Una preparación correcta **no es una publicación**. Usar los circuitos oficiales y comprobar diferencias de identidad, especificaciones, textos, exclusiones y estado:

```powershell
npm run catalogo:preparar -- --proveedor gam
npm run catalogo:publicar -- --proveedor gam --simular --detalle
npm run catalogo:publicar -- --proveedor gam
npm run estado
npm run auditar:comercial -- --coherencia
npm run auditar:comercial -- --acreditacion
npm run auditar:comercial -- --revision
npm run exportar:comercial -- --simular
```

Sustituir `gam` por el proveedor **realmente afectado**. FINISH puede reutilizar exclusiones acreditadas idénticas; no inventa aprobaciones humanas. Si el preflight detecta casos distintos, corresponde la acreditación editorial explícita. Si se activa una publicación pero falla el archivado, auditoría o informe posterior, consultar el diario `storage/publication/individual-finish/` y **reanudar el mismo FINISH**, sin editar selectores ni volver a publicar ciegamente. El derivado comercial puede generarse y verificarse aparte; `--simular` no equivale a la exportación real ni a una integración en BD.

## Precedentes del código: aprender de las correcciones existentes

| Precedente de catálogo | Enseñanza reutilizable | Rutas de referencia |
| --- | --- | --- |
| **GAM 1219**, PRAMAC: descripción con listas en web | Distinguir corrección del extractor, evidencia editorial por huella y recaptura del original; son resultados diferentes | `src/scraping/providers/gam/descriptions.ts`, `src/preparation/gam/editorial/source/verified-source-matched-generals.ts` |
| **GAM 6835 y 6858**, Yale ERP35VL | Dos unidades pueden compartir la referencia visible; la normalización de formato no permite fusionarlas | `src/commercial/diagnostics/commercial-cross-coverage.ts`, `src/commercial/legacy-export/tests/gam-commercial-reference.test.ts` |
| **GAM 6934 / Gomariz TE1772** | Las discrepancias de modelo/galería reconocidas mantienen su rastro y pasan a controladas solo con reconocimiento vigente | `src/commercial/diagnostics/commercial-intervention-priorities.ts`, `src/commercial/diagnostics/tests/presentation-consistency.test.ts` |
| **Mercaeleva M838-0666 y M969-4655**, JLG 450 AJ | Recuperar información del modelo después de comprobar reconciliación e identidad de unidad; preservar variantes | `src/preparation/mercaeleva/technical/evidence/documented-platform-technical-specs.ts`, `src/preparation/mercaeleva/technical/evidence/documented-source-recovery.ts` |
| **Mercaeleva M547-2372**, Toyota 6FBRE14 | Diferenciar capacidad/propulsión acreditables de altura de una unidad no verificada; preservar la fuente contradictoria | `src/preparation/mercaeleva/technical/reconciliation/mercaeleva.ts`, `src/preparation/mercaeleva/technical/evidence/documented-toyota-forklift-specs.ts` |
| **GAM 2737 / 6688**, movilidad y vehículo clásico | Consultar documentación del modelo y sus límites antes de recuperar prestaciones, sin asumir configuración particular | `src/preparation/gam/technical/models/documented-mobility-and-access-specs.ts`, `src/preparation/tests/documented-vehicle-unit-specs.test.ts` |
| **Hyster 6666/5258, Yale 2328, LGMG BA1465** | Las generales breves pueden ser correctas si el original contiene descripciones contradictorias; mejorar solo con afirmaciones independientes y acreditadas | `src/preparation/gam/technical/reconciliation/gam-hyster-h45fts5.ts`, `src/preparation/gam/technical/reconciliation/gam-yale-gp80vx.ts`, `src/preparation/gomariz/editorial/mapping/unit-specific-general.ts` |

Son **ejemplos de mecanismos y límites**, no reglas para reutilizar sus datos técnicos en otras identidades. Comprobar siempre las pruebas y el original vigente antes de extenderlos.

## Diagnóstico y significado de los avisos

```powershell
npm run huecos -- --comparar --json
npm run huecos -- --comparar --specs --json
npm run huecos -- --comparar --titulos --json
npm run huecos -- --finales --json
npm run auditar:comercial -- --contenido-revision
npm run auditar:comercial -- --revision
npm run auditar:comercial -- --acreditacion
```

- `technicalSpecs.cases[].stage` separa `diferencia_origen_preparacion`, `reconciliacion_acreditada`, `pendiente_publicacion`, `perdida_tras_publicacion`, `normalizacion_ambigua` y `sin_evidencia_directa`. La última es **observación**, no una prestación debida.
- Las P0/P1/P2 editoriales son prioridades de investigación, no objetivos de longitud para rellenar texto. Una ficha mejorada puede conservar una señal orientativa.
- `--revision` prioriza casos **pendientes** y separa los **controlados**; no elimina los hallazgos subyacentes ni sustituye el informe de coherencia. Un reconocimiento caducado exige revisar su evidencia.
- `--coherencia`, `--acreditacion`, `--contenido-revision` y `--comparar --titulos` responden a preguntas diferentes. Comparar por proveedor, referencia y fuente real; no sumar colecciones solapadas como defectos independientes.

## Criterio de aceptación por intervención

1. **Línea base:** identificar proveedor, referencia, `sourceUrl`, publicación seleccionada, origen de la señal y etapa donde nace la divergencia. Conservar métricas y hashes antes del cambio.
2. **Regla adecuada:** reutilizar evidencia/reconciliación/normalización existente y mantener las barreras de identidad, variante, fuente y precedencia; no abrir una abstracción genérica por un caso aislado.
3. **Tests:** caso real, variante vecina, origen o huella cambiados, proveedor distinto y escenarios negativos. Reutilizar suites existentes; evitar volver a cargar el catálogo en múltiples tests costosos.
4. **Equivalencia:** comparar todas las preparaciones afectadas, las no afectadas representativas y el delta de publicación; registrar altas, bajas, estados `ready/review`, motivos, specs, descripciones, imágenes y categorías.
5. **Materialización:** ejecutar el preflight y FINISH si hay cambio de preparación; acreditar aprobación humana solo si procede y nunca suplantarla. Confirmar selector y publicación activos; verificar exportación real por identidad cuando afecte a salida comercial.
6. **Cierre demostrado:** auditor correspondiente sin defecto reproducible, ausencia de regresiones, `npm test`, `npm run build`, guard de rendimiento y `npm run estado` en el entorno disponible. Señalar expresamente lo no ejecutado; código corregido **no significa** dato publicado.

No modificar umbrales, silenciar avisos por ID, editar reconocimientos, originales, manifests o publicaciones a mano para conseguir contadores estéticos. Un reconocimiento vigente puede permanecer visible como controlado; una contradicción genuina del proveedor no autoriza inventar su solución.
