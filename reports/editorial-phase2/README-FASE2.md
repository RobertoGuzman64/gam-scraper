# EQUIPZILLA · Fase 2 — Demolición del propietario editorial

**Estado de esta entrega:** repositorio completo modificado, fase de demolición funcional realizada, **NO acreditada como migración exhaustiva de las 82 capacidades**. Se permite incompatibilidad transitoria por indicación expresa. **No publicar ni reaprobar fichas desde esta rama** antes de cerrar los fallos editoriales y la cobertura de procedencia.

## Corte arquitectónico aplicado

- `src/preparation/prepare-product.ts` ejecuta la preparación técnica y entrega `description` y `description_general` exclusivamente desde `resolvePreparedEditorial()`; se retiran sus remates narrativos tardíos (GAM Hyster, tractor, Modula y saneadores particulares). El contrato público `PreparedProduct` y el contrato comercial v2 permanecen.
- `src/preparation/shared/editorial/domain/` dispone de clasificación semántica de **24 familias**, interpretación estricta de medidas, hechos válidos y un compositor único de título, corta y general. La regla de composición no bifurca por referencia ni por proveedor. La verificación de procedencia permanece en **3 adaptadores** específicos de fuente.
- Se han retirado `prepared-editorial-model.ts`, `prepared-editorial-completion.ts`, `verified-editorial-finalization.ts`. Sus rutas no forman parte del grafo productivo nuevo. Los narradores antiguos de GAM, Gomariz y Mercaeleva continúan como **código histórico aislado**; no se conectan a la salida de preparación.
- Los reconciliadores técnicos siguen siendo propietarios de la recuperación/verificación de datos. No deben reescribir prosa comercial. La transformación de capacidad de tractor de arrastre ahora es una regla de manutención en `shared/technical/reconciliation/handling-family-specifications.ts`, sin referencia concreta.
- La descripción de origen se conserva únicamente como **fallback** cuando no hay hechos suficientes o la procedencia impide composición. El compositor común tiene prioridad para los registros acreditados.

## Alcance y deuda sin maquillar

- El inventario de Fase 1 contiene **140 módulos** y **82 capacidades**. `editorial-140-module-migration.csv` adjudica una decisión de recorrido productivo a **cada uno de los 140**. `editorial-82-capabilities-status.csv` clasifica las **82** como cobertura genérica, parcial o pendiente. Estas clasificaciones no equivalen a que las 82 hayan sido migradas y validadas semánticamente.
- Se extrajeron **22 ficheros JSON** de evidencias literales, respaldados por la huella SHA256 de su fuente TypeScript. La tabla `data/editorial/legacy-evidence-extraction.json` detalla exportaciones convertidas y no convertidas. Estos JSON son **inventarios declarativos no ejecutables**; no se han conectado todavía al compositor, para evitar trasladar hechos de unidades a otras máquinas como si fueran reglas universales.
- Queda pendiente migrar capacidades con documentación específica de fabricante, excepciones de modelo/variante, cierres largos verificados, módulos especiales (almacenaje vertical/Modula y equipamiento singular) y negativas de texto que requieren acreditación. Eliminar esos textos históricos antes de descomponerlos perdería información; su código permanece físicamente disponible y fuera del grafo productivo.
- En una nueva máquina que comparta familia y **hechos corroborados**, el motor ya aplica la misma composición. Aún **no** aporta automáticamente prestaciones de un modelo antiguo cuando a la nueva ficha le falten las pruebas de variante/modelo; ese mecanismo de conocimiento compartido es trabajo pendiente, no una capacidad que se deba afirmar disponible.

## Barrido de los originales (no implica acreditación comercial)

| Fuente | Productos | Ready | Review | Candidatas reutilizables | Corta compuesta | General compuesta | Corta vacía | General vacía |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| GAM | 983 | 953 | 30 | 557 | 366 | 361 | 3 | 3 |
| GOMARIZ | 547 | 535 | 12 | 480 | 480 | 480 | 64 | 0 |
| MERCAELEVA | 221 | 218 | 3 | 178 | 171 | 171 | 40 | 5 |

Total: **1751 originales** procesados; **0 excepciones**; **45 para revisión**. `reuseAvailable` se mide en los registros originales y los campos aplicados en la preparación final, por lo que no deben confundirse con una tasa de equivalencia histórica. El control comercial v2 no audita la veracidad semántica de cada redacción.

## Ejecución real de controles en este entorno

- `node tests-shared-editorial-guard.mjs`: **PASS**, **192 módulos** en la clausura productiva, **0 narradores de proveedor** conectados (solo 3 adaptadores de fuentes).
- `node tests-commercial-contract-guard.mjs`: **PASS**. `node tests-performance-guard.mjs`: **PASS**.
- `node --test dist/preparation/shared/editorial/tests/editorial-motor-demolition.test.js`: **4/4 PASS** tras emisión temporal de JS con `tsc` global.
- Subconjunto editorial histórico `node --test dist/preparation/shared/editorial/tests/*.test.js`: **13/29 PASS, 16 FAIL**. No se han rebajado ni cambiado las expectativas de los snapshots anteriores para que pasen. Estos fallos incluyen precedencias antiguas, contenido de unidades y recuperación documentada de fichas vacías; la siguiente fase debe valorar y reparar su propósito sin reinstalar narradores por proveedor.
- `npm ci` no pudo completar la descarga de dependencias en este entorno. `tsc --noEmit` encuentra errores por dependencias `cheerio`/`p-limit` ausentes y tipos derivados; **la compilación íntegra y el `npm test` oficial no están acreditados**. Las comprobaciones focales se hicieron con `dist` temporal **no incluido** en el ZIP.
- Comparación de bytes de los tres catálogos originales y de **todas las publicaciones existentes** con el ZIP recibido: **idénticas**. No se han generado publicaciones nuevas.

## Siguientes fases, con una sola arquitectura

1. Convertir las tablas de evidencia conservadas a hechos de **familia, modelo/variante o unidad**, con ámbito, fuente, firma y pruebas negativas; hacerlas consumibles por un servicio genérico, **no** por funciones nuevas de referencias individuales.
2. Cubrir familias y características que faltan de la matriz de 82 capacidades; consolidar conceptos de cesta/carga, potencia, equipos especiales, configuración y seguridad según modelo. No interpolar características de unidades distintas.
3. Restaurar el significado de los tests de auditoría, descomponer los 16 fallos por regresión semántica y deuda de snapshot, ejecutar build/test completos con dependencias y acreditar las 1.751 salidas sin publicar cambios hasta el cierre.

## Trazabilidad

- `phase1-inventory/`: auditoría de Fase 1 completa, incluidos símbolos, 777 claves, precedencias, fronteras y grafo inicial.
- `editorial-140-module-migration.csv`: posición del corte productivo de cada módulo inicial.
- `editorial-82-capabilities-status.csv`: matriz completa de responsabilidad y deuda por capacidad.
- `phase2-status.json`: resultados de ejecución, integridad y cobertura legibles por máquina.
- `data/editorial/evidence/legacy/`: copias de datos literales acreditados, sin generalización automática y con origen y hash.
