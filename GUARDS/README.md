# EQUIPZILLA — Guards de arquitectura vigentes

## Estado y alcance (fase 27, 13 de noviembre de 2026)

Esta guía describe el guard **actual**. La calibración de la fase 7 documentada en [PLAN-GUARDS-ARQUITECTURA-V2.md](PLAN-GUARDS-ARQUITECTURA-V2.md) es histórica y no representa la deuda del repositorio vigente.

| Control ejecutado sobre el repositorio de fase 27  | Resultado                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| `tests-editorial-architecture-guard.mjs`           | 0 infracciones                                                         |
| `tests-domain-tests-guard.mjs`                     | 0 infracciones                                                         |
| Autopruebas `tests-architecture-guards.test.mjs`   | 25 correctas, 0 fallidas                                               |
| Excepciones explícitas en tests                    | 19 usos exactos: 12 recuentos de cohortes y 7 dependencias transitivas |
| Integraciones de catálogo directamente acreditadas | 21 lecturas, en 14 suites                                              |

**Cero infracciones no significa cero lecturas legítimas de catálogos ni prueba una batería `npm test` global.** Las 19 excepciones y las 21 lecturas acreditadas no cuentan como infracciones porque protegen garantías concretas; no son una tolerancia genérica, un baseline ni advertencias ocultas.

## Ejecutar los guards

Desde la **raíz del repositorio**:

```powershell
node GUARDS/tests-editorial-architecture-guard.mjs --detail
node GUARDS/tests-domain-tests-guard.mjs --detail
node --test GUARDS/tests-architecture-guards.test.mjs
```

Los dos guards arquitectónicos están **fuera del `npm test` definido en `package.json`**. Sus resultados y las autopruebas deben verificarse explícitamente cuando se modifica arquitectura editorial o de tests. El core de análisis es `GUARDS/guards-architecture-core.mjs` y requiere un compilador TypeScript disponible. Un guard comprueba dependencias/fronteras; no acredita por sí solo semántica editorial, publicaciones, cobertura web ni build completo.

## Política permanente de pruebas

Las pruebas nuevas deben proteger reglas reutilizables y contratos de motor: fuente, identidad, familias, magnitudes, procedencia, redacción y proyección, con positivos y negativos. No crear una suite por máquina ni congelar la fotografía de un catálogo mutable. Las integraciones censales se preservan cuando comprueban que **ninguna unidad no acreditada** obtiene datos, o cuando verifican integridad y publicación.

Usar entradas acotadas con tipos reales para las garantías del dominio. No sustituir una prueba censal por una muestra cuando ello debilite su contrato. Antes de podar un test, conservar en otro lugar cualquier comportamiento protegido. Ver [Arquitectura de tests](../docs/TEST_ARCHITECTURE.md).

## Doce cohortes protegidas

El mapa `cohortExceptions` de `tests-domain-tests-guard.mjs` acredita **12 aserciones** concretas en 12 suites. Sus recuentos no son una licencia para fijar tamaños arbitrarios: corresponden a garantías de unidades o cambios identificables. Cada excepción exige la coincidencia de **ruta, nombre del test y expresión exacta**. Si se añade una cohorte o cambia la aserción, el guard vuelve a señalar el caso hasta su revisión.

Estos controles incluyen galerías, identidad y colisiones, recuperaciones de seguridad, geometría, movilidad, depósitos, operaciones, acústica, mandos y neumáticos. La fuente de verdad exacta es `cohortExceptions`, no una lista copiada que deba mantenerse a mano.

## Siete dependencias transitivas acreditadas

El mapa `transitiveExceptions` identifica tres pruebas GAM que comparten `src/preparation/gam/technical/tests/support/gam-historical-category-fixture.ts`, y cuatro pruebas que utilizan `src/testing/builders/mercaeleva-source-fixture.ts`. Se conserva su garantía de identidad, variantes, categorías, condición o especificaciones documentadas.

La autorización se verifica por **pareja de test y helper** y exige la forma de lectura de origen acreditada y **una única dependencia catalogal** en la fixture. Ampliar la entrada, introducir otra lectura u otra fixture no queda exento. Una migración futura de estas pruebas requiere equivalencia de cobertura.

## Veintiuna lecturas directas en catorce suites protegidas

La fase 27 acreditó lecturas de origen y publicación que todavía son necesarias para una garantía censal o de integración. El mapa `accreditedCatalogIntegrations` de `tests-domain-tests-guard.mjs` identifica las **14 rutas, sus 21 lecturas y la responsabilidad de cada una**, con SHA-256 del archivo completo y número exacto de accesos.

Las suites incluyen controles de imágenes GAM, identidad de variantes, recuperaciones técnicas por unidad (seguridad, geometría, movilidad, limpieza y acústica), calidad semántica de fuente y consistencia de publicaciones. La autorización no es por carpeta, proveedor o nombre genérico: modificar el contenido del test, añadir otra lectura o ampliar la entrada invalida la coincidencia y devuelve la infracción. **No modificar tests protegidos para mejorar un contador.**

## Hash de manifest frente a hash editorial

`src/preparation/tests/catalog-publication-consistency.test.ts` comprueba integridad de los bytes del catálogo original frente a `manifest.source.catalogSha256`. No congela una descripción. El detector `T-FROZEN-EDITORIAL-HASH` requiere una comparación literal de hash calculado a partir de redacción; no debe confundir un manifest de procedencia con contenido editorial.

## Cierre y límites

El estado de fase 27 se obtuvo sin modificar tests protegidos y sin introducir excepciones generales. Conservar el cero exige que cualquier nueva infracción se **resuelva o acredite contractualmente con alcance exacto**, no degradar el guard ni añadir tolerancias. Una integración necesaria no justifica convertir en dependiente del catálogo todo test de dominio.

El build y `npm test` oficiales completos no quedaron acreditados en el entorno de la fase 27 por dependencias ausentes. Registrar el estado real de cada ejecución. Referencias: [Motor editorial](../docs/EDITORIAL_ENGINE.md), [Validación](../docs/VALIDATION.md) y [Rendimiento](../docs/TESTS_RENDIMIENTO_CAMPANAS.md).
