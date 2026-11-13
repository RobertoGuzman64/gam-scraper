# EQUIPZILLA — Fase 4: segunda migración de reglas editoriales

> **Archivo histórico; no es un plan vigente.** Los inventarios de módulos, 82 capacidades, fallos de suites, huecos y pasos de continuidad corresponden al corte de la fase 4. No describen el motor ni los tests tras la fase 27. La documentación actual es [Motor editorial compartido](EDITORIAL_ENGINE.md), [Arquitectura de tests](TEST_ARCHITECTURE.md) y [Arquitectura](ARCHITECTURE.md). Este documento se conserva para trazabilidad, no para reabrir una migración antigua.

## Naturaleza de la entrega

Esta fase **continúa la migración editorial** iniciada en las fases 2 y 3. No es una fase de estabilización, publicación comercial ni cierre artificial de las regresiones. Su inventario de control sigue siendo el de **82 capacidades y 140 módulos de la Fase 1**. Se conserva el repositorio completo, el contrato comercial y las fuentes originales.

**Resultado de ejecución:** el único compositor editorial permanece en `src/preparation/shared/editorial/`; los tres proveedores solo aportan adaptación y autenticación de datos. El guard de arquitectura certifica **cero narradores antiguos de proveedor accesibles desde `prepare-product.ts`**. Esta afirmación arquitectónica no equivale a asegurar que todas las reglas antiguas estén migradas o sean universalmente aplicables.

## Nueva migración efectiva

| Ámbito | Cambio | Condición para aplicar |
| --- | --- | --- |
| Identidad cruzada | 27 evidencias históricas incorporadas desde `crossed-identity-editorial.ts` a un JSON declarativo; 6 permiten recuperar la redacción de su propia fuente pese a una contradicción de identidad | Coincidencia exacta de URL, proveedor, referencia, marca, modelo y SHA-256 del origen; `identityOverride` explícito en dato, nunca en el compositor |
| Modelo/unidad | Índice `verified-units.json` regenerado desde 23 colecciones históricas | Las reglas con procedencia insuficiente se excluyen, no se atribuyen a otras unidades |
| Carretillas | Centro de carga, radio de giro y mástil mediante conceptos tipados y unidades estrictas | Negativa ante unidad incorrecta y discrepancia de 900/600 mm de centro de carga dentro de la misma ficha |
| Plataformas | Medidas comprobadas de cesta e integración en el texto genérico | No se heredan dimensiones entre unidades ni variantes |
| Limpieza | Anchura de trabajo independiente de proveedor y familia comercial | Solo conceptos técnicos compatibles, validación de unidades |
| Seguridad y frenado | 9 familias de afirmación extraídas del origen y anexadas por el motor común | Fuente autenticada, coincidencia de identidad, afirmación positiva, sin negaciones ni opcionalidad |
| Contexto de unidad | Ubicación y número de serie con coincidencia de campos | No se generalizan datos de una unidad a un modelo |
| Maquinaria sin modelo | Composición de dos módulos sanitarios sin marca o modelo | URL original autenticada, tipología y dimensiones corroboradas |
| Higiene de textos | Eliminación conservadora de marcadores e introducciones conversacionales | Solo texto original autenticado; las descripciones históricas firmadas se mantienen literalmente |
| Tractores de arrastre | `Tiro a la barra nominal` reconocido en N | Hay parser, pero no ocurrencias originales válidas en este corte: **no acreditado en producción** |

Se han retirado 8 módulos de preparación editorial antiguos sin importaciones productivas ni referencias necesarias en el recorrido principal. Sus nombres y huellas SHA-256 están en `reports/editorial-phase4/legacy-unused-removed.json`.

## Datos declarativos y aplicación medible

Los archivos bajo `data/editorial/evidence/legacy/` son registros de evidencia, no narradores TypeScript. El regenerador `scripts/operations/rebuild-editorial-knowledge.mjs` valida cada entrada contra los originales del scraping antes de publicar en `data/editorial/knowledge/verified-units.json`. Los controles de unidad se ejecutan **contra la fuente recibida**, aun cuando la preparación haya reconciliado campos técnicos antes de redactar. Las referencias de modelo consensuadas se redactan como conocimiento condicionado: no demuestran que otra unidad lleve el mismo equipamiento.

| Indicador | Resultado Fase 4 |
| --- | ---: |
| Originales analizados | 1.751 |
| Preparados / para revisión / excepciones | 1.706 / 45 / 0 |
| Colecciones declarativas de origen | 23 |
| Entradas textuales acreditadas / títulos acreditados / unidades | 410 / 8 / 366 |
| Grupos de consenso de modelo / familias | 136 / 26 |
| Cortas firmadas aplicadas / generales firmadas aplicadas | 216 / 310 |
| Títulos firmados aplicados | 7 |
| Excepciones de identidad firmadas aplicadas | 27 |
| Centros de carga / radios de giro / cestas | 116 / 55 / 98 |
| Anchuras de trabajo de limpieza / módulos sin modelo | 24 / 2 |
| Afirmaciones de fuente elegibles / aplicadas | 100 / 65 |
| Contextos de unidad / referencias de modelo utilizadas | 196 / 107 |
| Descripciones cortas / generales vacías | 65 / 2 |

Las magnitudes miden oportunidades del corte actual, no el número de reglas universales ni su precisión para cualquier futuro anuncio. Los registros que requieren revisión conservan su estado anterior; no se han modificado los originales o publicaciones. La comparación binaria con Fase 3 confirma **30 archivos de catálogos originales/publicaciones idénticos**.

## Matriz completa de la Fase 1

Los 82 requisitos originales están en `reports/editorial-phase4/82-capacidades-trazabilidad.csv`, con precondición y negativa de la Fase 1, estado anterior, destino y evidencias/limitaciones por capacidad.

| Estado Fase 4 | Número | Lectura correcta |
| --- | ---: | --- |
| Compartida | 11 | Reutilización común operativa ya acreditada en Fases 2/3 |
| Compartida, validación histórica pendiente | 33 | Implementación común, falta demostrar equivalencia completa |
| Operativa condicionada | 9 | Regla migrada y probada bajo fuente/condición explícita; no universaliza datos unitarios |
| Compartida sin ocurrencias | 1 | Implementada, sin muestra productiva que acredite aplicación |
| Parcial reforzada | 7 | Más reglas o restricciones migradas, pero alcance incompleto |
| Parcial | 20 | Falta migración de parte de la semántica/evidencia histórica |
| Pendiente | 1 | Sin implementación acreditada de la capacidad completa |
| **Total** | **82** | **No afirmar cierre integral: 54 capacidades necesitan trabajo o validación** |

Se aporta también `140-modulos-f1-a-f4.csv`: 99 módulos viejos siguen aislados del compositor, 27 son antiguos contenedores de evidencia TS sin conexión al motor, 8 se retiraron aquí, 3 se retiraron en fases anteriores y 3 permanecen como adaptadores activos. El inventario de símbolos de Fase 1 debe seguir disponible para acreditar la migración individual de cada responsabilidad aún alojada en esos módulos. **No se ha borrado código histórico con reglas no clasificadas simplemente por estar aislado**.

## Validaciones y límites

Comprobaciones que sí pasaron en este entorno:

- `node tests-shared-editorial-guard.mjs`: 0 narradores de proveedor en el camino productivo.
- `node tests-performance-guard.mjs`: protección de las cuotas de suites.
- `node tests-commercial-contract-guard.mjs`: contrato comercial v2 intacto.
- `node scripts/operations/rebuild-editorial-knowledge.mjs --check`: 23 fuentes, 410 textos, 8 títulos, 366 unidades.
- Tests focales de conocimiento, arquitectura y casos nuevos: **19/19 correctos**.
- Barrido completo de 1.751 originales: **0 excepciones**.

El conjunto de tests editoriales reunidos registra **29 correctos y 14 fallidos de 43**. Los 14 fallos reflejan regresiones de precedencia, redacción y cortes históricos posteriores a la demolición. Están reproducidos en `reports/editorial-phase4/editorial-test-run.log`; **no son tests verdes ni se han desactivado**. La compilación total y `npm test` no se acreditan en este entorno: `node_modules` carece de `cheerio` y `p-limit` y sus tipos, lo que además produce errores derivados de tipado en el scraper. No se incluyen `node_modules` ni `dist` en la entrega.

## Comandos para una instalación completa

```bash
npm ci
npm run build
npm test
npm run editorial:auditar-fase4
```

El auditor de esta fase es de **solo lectura del catálogo** y escribe `reports/editorial-phase4/audit.json`; requiere que exista `dist` generado por compilación. El índice declarativo se valida con el `--check` del regenerador.

## Decisión de continuidad (histórica)

Las fases 3 y 4 han migrado otra parte relevante del conocimiento histórico sin introducir narradores nuevos por ficha. Sin embargo, **no se puede certificar la migración absoluta de las 82 capacidades**. Persisten reglas parciales y equivalencias históricas por acreditar, así como 14 regresiones y 67 huecos de texto en el corte actual. La decisión sobre la siguiente etapa debe partir de estas evidencias y no de ocultar los tests o copiar excepciones TypeScript por máquina.
