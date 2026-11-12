# EQUIPZILLA — Fase 5 · Migración residual editorial

## Alcance y criterio

Este paquete es **el repositorio completo** partiendo de la Fase 4. Se ha atacado la migración residual del inventario F1 (82 capacidades y 140 módulos), sin reintroducir narradores de proveedor en el recorrido productivo y sin convertir el objetivo en una corrección generalizada de regresiones históricas.

La reforma **no puede declararse totalmente acreditada**: existen capacidades parciales o pendientes de validación y código histórico aislado que todavía conserva pruebas anteriores. No se han borrado tests para dar artificialmente un resultado positivo.

## Implementado en esta fase

1. El índice de evidencia acepta unidades sin marca o modelo cuando hay **coincidencia exacta de URL, referencia y SHA-256 del registro original**. No hereda descripciones de otras unidades por semejanza de modelo.
2. Se han incorporado dos tablas históricas que no participaban en el índice compartido: `verified-source-matched-generals` (10 generales) y `verified-source-matched-titles` (9 títulos), mediante JSON declarativo ligado a los archivos de origen. Además se han recuperado otras entradas previamente rechazadas de las colecciones compartidas por carecer de identidad estructurada, pese a tener firma válida.
3. Se ha migrado al dominio editorial común el reconocimiento de títulos documentados para carretillas todoterreno, dúmperes, manipuladores, plataformas verticales, tijeras y carretillas diésel. Se aplica a partir de origen, familia y medidas corroboradas, sin referencias cableadas. Actualmente reconoce 11 fichas originales; rechaza coherentemente anuncios con medidas discordantes.
4. Las fichas firmadas pueden recuperar texto aun si la fuente no satisface la identidad genérica, **sin permitir la composición de afirmaciones genéricas desde un origen no validado**.
5. El generador del índice verifica el SHA-256 de todas las fuentes declarativas. Dos módulos inactivos y ya sustituidos se retiran con huellas y motivos documentados.

## Datos medidos (sin publicar)

| Indicador | Fase 4 | Fase 5 |
| --- | ---: | ---: |
| Fuentes originales procesados | 1.751 | 1.751 |
| Preparados | 1.706 | 1.706 |
| En revisión | 45 | 45 |
| Excepciones de ejecución | 0 | 0 |
| Fuentes de evidencia indexadas | 23 | 25 |
| Entradas textuales firmadas | 410 | 433 |
| Títulos firmados | 9 | 18 |
| Unidades con evidencia | 366 | 391 |
| Generales firmadas efectivamente publicadas por preparación simulada | 310 | 335 |
| Cortas firmadas efectivamente aplicadas | 216 | 222 |
| Títulos firmados efectivamente aplicados | 7 | 18 |

Se mantienen 136 consensos de modelo y 26 perfiles de familia. No convierten por sí solos una característica de modelo en atributo individual confirmado.

## Controles de la entrega

- `tests-shared-editorial-guard.mjs`: PASS; cero narradores de proveedor alcanzables desde el preparador.
- `tests-commercial-contract-guard.mjs`: PASS.
- `tests-performance-guard.mjs`: PASS.
- `rebuild-editorial-knowledge.mjs --check`: PASS (25 fuentes y sus huellas de origen).
- Pruebas nuevas de Fase 5: 4/4 PASS, con falsificaciones de URL, referencia, estado, medidas y firma.
- Regresión editorial compartida: 33 PASS y 14 FAIL en 47 pruebas. No se han eliminado tests para ocultar los fallos.
- El build completo **no está acreditado** aquí: no están instaladas las dependencias npm de desarrollo ni los paquetes `cheerio` y `p-limit`, por lo que TypeScript informa módulos externos ausentes y errores de tipado derivados. El conjunto de módulos usados en los tests focales sí se emitió y ejecutó, pero esto no equivale a un build global verde.
- Originales y publicaciones de catálogo: 37 archivos comparados byte a byte contra la Fase 4, ninguno modificado.

## Deuda de migración visible

El archivo `82-capacidades-trazabilidad.csv` conserva las 82 capacidades F1, su estado F4 y la intervención F5. La mayoría de las capacidades declaradas como compartidas pero con validación histórica pendiente **siguen sin acreditación exhaustiva**. `140-modulos-trazabilidad.csv` conserva la ubicación y situación de los 140 módulos originales, incluidos los narradores antiguos aislados por pruebas históricas.

No se activan 15 entradas de las colecciones declarativas que no superan procedencia. Además, **20 generales de la tabla `verified-unit-source-generals.ts` no coinciden con la firma de los registros originales actuales** y permanecen fuera del índice. Todo ello queda relacionado en `evidencias-rechazadas.json`; no debe solucionarse eliminando la comprobación de procedencia.

El informe `resumen.json` recoge la trazabilidad, las diferencias exactas con la Fase 4 y la deuda de migración. Los cambios funcionales están acompañados por tests de equivalencia y casos negativos. **La Fase 5 cierra esta intervención, no la acreditación total de las 82 capacidades ni la estabilización del catálogo**.

## Comandos recomendados con las dependencias instaladas

```sh
npm ci
npm run build
node tests-shared-editorial-guard.mjs
node scripts/operations/rebuild-editorial-knowledge.mjs --check
node tests-performance-guard.mjs
node tests-commercial-contract-guard.mjs
npm test
npm run editorial:auditar-fase5
```
