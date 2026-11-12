# 01 · Cartografía de reglas editoriales actuales y conocimiento trasladable

## Cómo leer el inventario completo

El inventario de **82 capacidades funcionales** de `09-MATRIZ-CAPACIDADES-COMPARTIDAS.csv` es una clasificación transversal, **no un límite al número de reglas**. Su complemento exhaustivo es `01-INVENTARIO-TOTAL-EDITORIAL-140.csv`: contiene todas las rutas editoriales productivas reales, con exportaciones y propietario previsto; `02-INVENTARIO-SIMBOLOS.csv` identifica funciones, variables y contratos internos; `03-GUARDIAS-Y-PRECEDENCIAS.csv` localiza posibles condiciones de aplicación. Cada regla concreta deberá reconstruirse desde esos elementos, incluidos cuerpos de `if` y tablas de evidencia. No se puede declarar individualizable un fichero entero por su nombre ni compartible una tabla entera por contener un modelo.

La auditoría anterior describió 16 grupos K01–K16; **se mantienen como clasificación histórica**, sin confundir los grupos con implementaciones finales. En el ZIP actual los diez módulos nuevos se cruzan con esos grupos en la columna `grupo_f0_complementaria`. Las reglas por máquina pueden aparecer en múltiples ficheros: una evidencia en `evidence`, un validador en `mapping`, un remate en `prepared-*` y otro en `prepare-product.ts`.

## Reglas de lectura de fuente que deben dejar de decidir la prosa

- **GAM:** `gam/editorial/source/domain-source.ts` comprueba host, estructura `/es/...`, referencia en slug, marca/modelo y campos fuente. No aporta por sí sola altura de trabajo al nuevo dominio (`workingHeight: undefined`), aunque el repositorio conserve otras vías GAM capaces de componerla. Esto demuestra un **hueco de extracción de hechos**, no falta de una plantilla.
- **Gomariz:** `gomariz/editorial/mapping/domain-source.ts` reconoce algunas rutas fuera de `/venta/`; `source-family.ts` de la ruta histórica exige `/venta/<sección>/<familia>/<slug>`. Las antiguas `short-description.ts`, `general-description.ts`, `additional-short-description.ts`, `editorial-title.ts` no se han convertido en reglas genéricas de dominio y conservan filtros propios.
- **Mercaeleva:** `mercaeleva/editorial/mapping/domain-source.ts` verifica artículo, identidad, fuente técnica y alturas, y construye pistas de familia. Otros resolutores de este proveedor aún redactan cortas, títulos y generales propios (`descriptions.ts`, `concise-description.ts`, `general-description.ts`, `documented-*`, `prepared-source.ts`).
- **Compartido:** `editorial-source-contract.ts` valida identidad; `editorial-facts.ts` decide cuatro familias y normaliza magnitudes y motorización; `editorial-composition.ts` compone dos campos. En estos módulos hay reglas **compartidas reales** que deben conservarse/descomponerse, pero no una interpretación semántica completa de todas las fuentes ni familias.

**Decisión:** cada proveedor debe conservar la interpretación de su fuente, sin escribir frases de dominio. La ruta puede probar autenticidad y aportar una pista; **no** determinar por sí sola qué plantilla universal de una tijera es aplicable.

## Qué reglas técnicas sirven a cualquier proveedor si se prueba equivalencia

| Bloque técnico | Código actual ilustrativo | Reglas por trasladar |
|---|---|---|
| Familia y subtipo | `shared/editorial/domain/editorial-facts.ts`; `gomariz/editorial/mapping/general-description.ts` | Tijera, articulada, telescópica, oruga, mástil vertical, carretilla frontal/retráctil, apilador, transpaleta, preparapedidos, tractor de arrastre, manipulador, barredora, fregadora, especialidades |
| Magnitudes verticales | `gomariz/editorial/mapping/{short-description,general-description}.ts`; `shared/editorial/domain/editorial-facts.ts` | Altura de trabajo ≠ plataforma ≠ almacenaje ≠ elevación/mástil; rangos, formatos, unidad y procedencia |
| Carga y geometría | `gam/editorial/source/source-forklift-measures-general.ts`; `gam/editorial/general/family-technical-description.ts` | Capacidad nominal / plataforma / carga residual / peso / centro de carga; longitud, anchura, altura, alcance, giros |
| Energía y equipamiento | `gam/editorial/models/forklift-fuel-editorial.ts`; `gam/editorial/source/source-battery-voltage-general.ts` | Eléctrico, diésel, GLP, mixtos, baterías, tensión, frenada, pendiente; equipamiento verificado vs opcional |
| Estado de unidad | `gam/editorial/source/{used-year,used-hours,used-unit}-general.ts`; `shared/editorial/mapping/source-year-general.ts` | Año, horas, condición, número de serie, localización solo si pertenecen a esa unidad |
| Validación semántica | `shared/editorial/domain/editorial-source-contract.ts`; `gam/editorial/general/long-description.ts` | No inventar hechos, no mezclar modelos, eliminar contradicciones y frases sueltas conservando información |

El código productivo contiene **otras** capacidades técnicas utilizadas en redacción en `src/preparation/gam/technical/{energy,mobility,operations,safety,models,reconciliation}/` y `src/preparation/mercaeleva/technical/{evidence,reconciliation}/`: estas rutas se listan en `05-FRONTERAS-FUERA-EDITORIAL.csv` y en la clausura completa de `08-DEPENDENCIAS-DE-PREPARACION.csv`. Migrar el texto NO implica trasladar la recuperación o validación técnica de datos si ya tiene propietario correcto.

## Familias editoriales, sin reducirlas a cuatro

**Elevación y plataformas:** tijeras, articuladas, telescópicas, orugas y mástiles verticales. La composición actual Gomariz muestra frases parciales por altura, carga, alcance, dimensiones y energía; `mercaeleva/editorial/mapping/documented-*.ts` añade documentación de plataforma/modelo; GAM posee enriquecimientos de cesta, dimensiones y variantes. Una regla de altura de trabajo o capacidad de cesta es compartible cuando la magnitud y el subtipo son equivalentes; un dato de una Genie concreta sigue ligado a versión/evidencia.

**Manutención:** carretillas elevadoras (eléctricas, GLP y diésel), retráctiles, transpaletas, apiladores, preparapedidos, tractores de arrastre y manipuladores telescópicos. GAM mezcla composiciones familiares, conciliaciones de carga, datos de horómetro/año, combustible y casos por número de serie. Mercaeleva aporta documentación de carretillas y Gomariz reconoce categorías afines. Extraer «carga», «altura» y «motor» no basta si no se conserva **el concepto técnico correcto**.

**Limpieza industrial:** barredoras, fregadoras y variantes por fabricante/configuración. El bloque GAM `general/verified-industrial-cleaning-editorial.ts` y sus evidencias de `cleaning.ts`/`tennant.ts` contienen texto de dominio, prestaciones declaradas y datos de versión mezclados; el objetivo es un compositor de limpieza con fuentes de hechos contrastadas.

**Equipos especiales y logísticos:** módulos y almacenaje vertical, fuentes de energía/torres de iluminación, dúmper y especialidades GAM (`models/specialty-editorial.ts`, `models/modula-storage-editorial.ts`, etc.). No se declarará una familia universal inexistente: cada una nace con hechos mínimos, negativas y plantillas propias; **nunca** con copia íntegra de los resolutores de un proveedor.

`09-MATRIZ-CAPACIDADES-COMPARTIDAS.csv` descompone estas familias en 82 responsabilidades concretas, con evidencia exigida, negativa y ruta de origen en el código actual. No significa que todos los subtipos tengan ya fuente transversal suficiente.

## Redacción compartida por campo

**Título:** el titular se resuelve en `shared/editorial/mapping/prepared-editorial-title.ts` desde `resolveGomarizEditorialTitle`, `resolveGamConciseTitle`, `resolveMercaelevaEditorialTitle`, el título de origen, después `resolveGomarizVerifiedUnitSpecificTitle`, `resolveGamVerifiedSourceMatchedTitle`, `refineTechnicalTitle` y `reconcileGamVerifiedCapacityTitle`. La regla de presentación por familia debe ser común; la coincidencia exacta de la corrección permanece en evidencia de modelo/unidad.

**Corta:** combinaciones de atributos técnicos y frases breves, saneamiento de largas y equilibrio corta/general (`gam/editorial/short/*.ts`, `gomariz/editorial/mapping/*short*.ts`, `mercaeleva/editorial/mapping/{descriptions,concise-description}.ts`). Es necesario un generador único capaz de salida parcial legítima y de explicar por qué falta un hecho.

**General:** cláusulas técnicas, descripción documentada de familia/modelo, estado de unidad y remates de calidad (`gam/editorial/{general,source}/*.ts`, `gomariz/editorial/mapping/*general*.ts`, `mercaeleva/editorial/mapping/*general*.ts`, `shared/editorial/{evidence,mapping}/*.ts`). Lo correcto es **componer cláusulas independientes** y resolver prioridades explícitas, no acumular una general preescrita de 200 palabras por cada máquina.

**Saneamiento:** frases repetidas, aperturas conversacionales, textos truncados, listas de vehículos, promesas genéricas o detalles huérfanos. Estas son reglas generales de integridad, no excusas para permitir una segunda generación particular.

## Las evidencias: la parte valiosa que NO se debe confundir con reglas de redacción

- **GAM:** `editorial/evidence/` contiene mapas firmados por ámbitos (limpieza, carretillas, plataformas, almacén, Hyster, Tennant, multisección); `source/verified-source-condensed-generals.ts` y `source/verified-source-matched-*` contienen candidatos/editoriales identificados por ficha o huella.
- **Gomariz:** `editorial/evidence/priority-short-descriptions.ts`, `verified-priority-general.ts`, `verified-model-general.ts`, `verified-unit-specific-titles.ts` y resolutores `mapping/{individualized-general,unit-specific-general,verified-*}.ts` aportan exactitud de modelo/fuente/unidad.
- **Mercaeleva:** `editorial/evidence/verified-unit-general-data.ts`, `verified-unit-specific-generals.ts`, `verified-source-editorial.ts`, `critical-general-descriptions.ts`, `priority-*` y `mapping/documented-*` aportan datos, textos documentados y garantías por fuente.
- **Compartido:** `editorial/evidence/verified-{unit-summary,unit-context,family-proportion,canonical-brief,editorial-closure}.ts` y `mapping/verified-editorial-provenance.ts` aplican verificaciones y composiciones documentadas, aunque parte de la salida sigue asociada a huellas exactas.

**Tratamiento obligatorio por entrada literal:** decidir si contiene (A) hecho universal de familia, (B) hecho de modelo/variante, (C) hecho de unidad, (D) corrección de contradicción de una fuente o (E) texto estilístico no verificable. Extraer **A** al dominio, parametrizar las frases de **B** y **C** mediante el dominio pero preservar ámbito/procedencia, ubicar **D** en validación/adaptación, no propagar **E**. Una entrada puede contener varias clases y debe **partirse**, no migrarse como bloque.

El índice de claves `04-CLAVES-DE-EVIDENCIA.csv` permite recorrer las entradas literales y sus ubicaciones. Algunas claves se repiten en varias tablas porque distintas reglas responden a la misma ficha; eso es justamente lo que hay que consolidar. Las claves de una tabla no equivalen necesariamente a referencias de máquina; se debe contrastar con el registro fuente.

## Fuentes de deuda de propiedad

1. **Dos nociones de familia Gomariz**, incompatibles como puerta única: legacy `/venta/` y dominio nuevo con rutas distintas.
2. **Tres proveedores produciendo prosa de familia** donde debería existir un único compositor, más excepciones exactas.
3. **General de origen por delante de la general común** en parte de la selección; el nuevo motor funciona como último recurso, no como propietario.
4. **Dominio común parcial** que solo reconoce cuatro familias y pierde datos técnicos de algunas fuentes: ejemplo de GAM `workingHeight: undefined`.
5. **Preparación compartida dependiente de GAM** (`prepared-editorial-model.ts`, `prepared-editorial-completion.ts`).
6. **Composición encadenada** dentro de `gam/editorial/prepared-completion.ts` y `gam/editorial/prepared-model.ts` con prioridades implícitas.
7. **Remates posteriores a finalize** en `prepare-product.ts` (Hyster, tractores, Modula, capacidad, coherencia y eliminación de marcadores); una salida común no puede declararse final antes de pasar por ellos.
8. **Fichas firmadas que contienen párrafos enteros** con hechos modelo, hechos unidad y plantilla mezclados: extraer solo frases comunes sin retener firmantes sería inseguro; retenerlas como resolutores TypeScript individuales perpetúa la deuda.

**Conclusión funcional:** no hay que dedicar otras 100 fases a «mejorar fichas». El éxito de Fase 2 es hacer que una regla nueva se defina **una sola vez por semántica/ámbito**, y que cualquier máquina con hechos compatibles pueda recibirla, venga del proveedor que venga.
