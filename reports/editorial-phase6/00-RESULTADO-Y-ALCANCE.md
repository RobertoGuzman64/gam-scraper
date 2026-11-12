# EQUIPZILLA — Fase 6: autoridad editorial única

Fecha: 12 de noviembre de 2026. Base: repositorio completo de la Fase 5 (`eqz-f5-7c928d.zip`).

## Resultado

La redacción de título, descripción corta y descripción general de la preparación y de la adaptación de publicaciones históricas utiliza ahora un mismo recorrido, `normalizePreparedEditorialPresentation`. `projectCommercialPresentation` no contiene reglas de redacción: conserva esos tres campos y construye los metadatos, especificaciones comerciales y sufijos de identidad de unidad.

**No es un cierre de las 82 capacidades de Fase 1.** Esta entrega resuelve exclusivamente la frontera que la auditoría calificaba como H01. El conocimiento residual y los huecos editoriales quedan fuera de alcance.

## Recorrido implementado

1. `src/preparation/prepare-product.ts`: resuelve la ficha compartida y aplica la presentación editorial **antes** de devolver el `ImportCandidate` y de validarlo contra el catálogo de importación.
2. `src/preparation/shared/editorial/mapping/prepared-editorial-presentation.ts`: coordina redacción, normalización tipográfica y de magnitudes, motorización, altura, año acreditado y capacidad. Las reglas no dependen de una referencia concreta.
3. `src/preparation/shared/editorial/domain/`: concentra las reglas puras de normalización, motorización, altura y coherencia de capacidad. La adaptación de branding de fuente y las reglas de procedencia del año viven en `mapping`, no en el dominio independiente del proveedor.
4. `src/commercial/projection/editorial-inputs.ts`: adapta **en memoria** las publicaciones técnicas antiguas a ese mismo recorrido antes de la exportación comercial, sin reescribir los JSON almacenados. El plan, su auditor y su acreditación utilizan este mismo adaptador.
5. `src/commercial/projection/presentation-projection.ts`: conserva texto publicado ya preparado; solo agrega sufijos destinados a desambiguar unidades y deriva metadatos/representación de especificaciones. La evaluación de discrepancias de altura/año/capacidad permanece activa como validación, sin reescribir los textos.

## Reglas eliminadas y sustituidas

- Retirada la implementación `src/commercial/projection/capacity-presentation.ts` que comparaba directamente GAM 1145 y GAM 6837. La nueva regla usa el concepto **capacidad de carga**, corroboración simultánea de especificación original y publicada, identidad de marca/modelo, afirmación del resumen y una única magnitud de carga en el título. No extrae hechos de otra unidad. Se rechazan documentos con procedencia, modelo o magnitud discordantes.
- Los normalizadores comerciales de formato y motorización conservan una fachada de compatibilidad, pero su lógica reutilizable tiene una sola implementación compartida.
- La normalización del año del título/resumen/general y la reconciliación de altura ya no se ejecutan desde el compositor de exportación; la validación comercial puede seguir informando discrepancias.

## Diferencias observadas

- 1.751 originales preparados: 1.706 `ready`, 45 `review`, 0 excepciones, igual que en Fase 5.
- En Fase 5, `projectCommercialPresentation` reescribía al menos un campo editorial de **293** preparaciones originales: 206 títulos, 105 cortas y 70 generales, con solapamientos. La Fase 6 reduce esas reescrituras a **0** sobre las mismas 1.751 fichas ya preparadas.
- Comparando la salida editorial **final** F5 (preparación + proyección) con F6: **1.750/1.751 identidades sin cambio textual alguno**. La única diferencia es la general de GAM 6837: se conserva `capacidad de carga indicada de 2500 kg` en lugar de atribuir `capacidad de carga nominal de 2500 kg`, que la fuente técnica no afirma expresamente.
- Las 37 entradas de `catalogs/` presentes en el ZIP F5 son idénticas byte a byte en F6. No se publicó ningún inventario.
- Los huecos anteriores permanecen: 64 cortas ausentes y 2 generales ausentes. Se preserva la validación de exclusión y revisión; no se inventa texto comercial.

## Contratos y cautelas

Se mantiene la firma y los campos públicos de `projectCommercialPresentation`, pero **cambia la semántica** para entradas editoriales sin preparar: esta función deja de normalizarlas. Quien invoque esa proyección directamente con textos históricos sin adaptar debe llamar a `normalizePreparedEditorialPresentation` primero, o usar `planCommercialExport`, que ya realiza la adaptación. Los `ImportCandidate` preparados son idempotentes.

`commercialUnitTitleSuffixes` sigue diferenciando unidades por año/referencia cuando corresponde: es identidad del contrato comercial y no evidencia del modelo. `source-category-evidence.ts` sigue clasificando productos; no pertenece a la redacción editorial.

La regla histórica de altura GS-3246, los símbolos editoriales aislados, las capacidades parcialmente acreditadas y las discrepancias de procedencia no se declaran resueltos por esta intervención. Deben abordarse en la migración residual y en la posterior estabilización.
