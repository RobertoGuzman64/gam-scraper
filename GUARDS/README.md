# EQUIPZILLA — Guards de arquitectura vigentes

## AI GUARD

Ninguna IA puede crear, modificar, mover ni eliminar esta guía sin autorización explícita del propietario para el cambio documental concreto. La protección transversal de scripts, Markdown y comandos está definida en [Gobernanza del repositorio](../docs/REPOSITORY_GOVERNANCE.md).

## Estado y alcance

Esta guía describe los controles **vigentes**, sus autorizaciones exactas y sus límites. Los resultados deben comprobarse contra cada repositorio nuevo; no son una licencia para reducir cobertura.

| Control arquitectónico comprobado                  | Resultado                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------- |
| `tests-editorial-architecture-guard.mjs`           | 0 infracciones                                                            |
| `tests-domain-tests-guard.mjs`                     | 0 infracciones                                                            |
| Autopruebas `tests-architecture-guards.test.mjs`   | 48 correctas, 0 fallidas en el corte comunicado en `develop` (22-11-2026) |
| Excepciones explícitas en tests                    | 19 usos exactos: 12 recuentos de cohortes y 7 dependencias transitivas    |
| Integraciones de catálogo directamente acreditadas | 21 lecturas, en 14 suites                                                 |

**Cero infracciones no significa cero lecturas legítimas de catálogos ni prueba una batería `npm test` global.** Las 19 excepciones y las 21 lecturas acreditadas no cuentan como infracciones porque protegen garantías concretas; no son una tolerancia genérica, un baseline ni advertencias ocultas.

El guard de inventario (`tests-repository-governance-guard.mjs`) se ejecuta primero en `npm test`, junto a sus pruebas negativas. `repository-governance.json` registra **16 rutas Markdown, 57 rutas de scripts y 57 comandos npm**: bloquea rutas nuevas fuera de inventario, exceso de cuota y cambios en los comandos o en `bin`. **No usa hashes de contenido ni impide editar o eliminar un Markdown/script existente**; esas acciones siguen exigiendo autorización humana, aunque el guard no pueda verificarla. También comprueba nombres de fases y temporales, tipos de archivos en carpetas protegidas y seguimiento Git de `reports/` raíz.

## Ejecutar los guards

Desde la **raíz del repositorio**:

```powershell
node GUARDS/tests-repository-governance-guard.mjs
node GUARDS/tests-module-integrity-guard.mjs
node GUARDS/tests-editorial-architecture-guard.mjs --detail
node GUARDS/tests-domain-tests-guard.mjs --detail
node --test --test-reporter=./scripts/test-runner-ui.mjs GUARDS/tests-architecture-guards.test.mjs
```

Los guards de gobernanza, integridad productiva, arquitectura editorial y arquitectura de tests, junto con sus autopruebas, están **incluidos y son obligatorios en `npm test`**, antes de los controles de conocimiento, rendimiento y build. Los comandos anteriores siguen siendo útiles para diagnósticos puntuales, pero no sustituyen la batería completa. El core de análisis `GUARDS/guards-architecture-core.mjs` carga exclusivamente `node_modules/typescript` desde el repositorio: ejecutar `npm ci` para instalar la dependencia declarada, sin recurrir a una instalación global implícita. Un guard comprueba dependencias y fronteras; no acredita por sí solo semántica editorial, publicaciones, cobertura web ni build completo.

## Fronteras adicionales ya protegidas

`tests-module-integrity-guard.mjs` comprueba los imports relativos de los módulos productivos; no permite dependencias hacia `src/cli/`, `src/tools/`, `src/testing/` o suites de test, ni imports entre implementaciones de proveedores de preparación o entre adaptadores de scraping. Mantiene el motor técnico compartido independiente de `src/commercial/`, la proyección comercial independiente de `src/scraping/` y extracción sin dependencia comercial. Detecta también rutas retiradas `src/pipeline/` y `src/catalog/preparation/`.

`tests-domain-tests-guard.mjs` protege además las ubicaciones de tests: suites de dominio en `tests/` local (con excepción técnica GAM existente), integración en `src/testing/integration/{catalog,commercial,preparation}/`, builders y fixtures en sus zonas, prohibición de imports de suites como helpers y de runners paralelos en `src/testing/`. Rechaza suites que el runner no descubriría por no usar `*.test.ts` y nuevos árboles `testing/` paralelos, conservando seis helpers históricos expresamente autorizados. Un guard arquitectónico no acredita que el trabajo de calidad haya mejorado una ficha.

## Frontera operativa y protección del progreso

`tests-module-integrity-guard.mjs` impide que `src/cli/reporting/` importe módulos de `src/cli/commands/`: la presentación no depende de orquestadores CLI. La autoprueba en `tests-architecture-guards.test.mjs` comprueba tanto dependencias permitidas (entre módulos de reporting y hacia diagnósticos) como el import prohibido de un comando. Se trata de una ampliación del guard existente, **sin un guard ni un comando npm nuevo**. No prohíbe a los comandos consumir reporting ni sustituye las pruebas funcionales de terminal.

El contrato de progreso se verifica en `src/cli/reporting/tests/operation-progress.test.ts` y `terminal.test.ts`: etapas, contadores válidos, cierres e interrupciones, mensajes sin barras de proveedores redundantes y compatibilidad con terminales interactivas/no interactivas. Los fallos que se escriben en `stderr` deben verificarse también en ese canal. El avance de un proveedor no equivale automáticamente a una publicación acreditada ni a un resultado `PASS`. Los indicadores granulares de scraping conservan su finalidad propia.

Las pruebas de FINISH y exportación protegen preflight, integridad, recuperación, decisiones y equivalencia de entregables; no se fija un tiempo de ejecución ni se prohíbe una revalidación necesaria al cruzar etapas o activar bajo bloqueo. El guard de rendimiento controla patrones y cuotas de **tests**, no acredita por sí solo una aceleración del proceso editorial.

## Política permanente de pruebas

Las pruebas nuevas deben proteger reglas reutilizables y contratos de motor: fuente, identidad, familias, magnitudes, procedencia, redacción y proyección, con positivos y negativos. No crear una suite por máquina ni congelar la fotografía de un catálogo mutable. Las integraciones censales se preservan cuando comprueban que **ninguna unidad no acreditada** obtiene datos, o cuando verifican integridad y publicación.

Usar entradas acotadas con tipos reales para las garantías del dominio. No sustituir una prueba censal por una muestra cuando ello debilite su contrato. Antes de podar un test, conservar en otro lugar cualquier comportamiento protegido. Ver [Pruebas y guards](../docs/TESTING.md).

## Doce cohortes protegidas

El mapa `cohortExceptions` de `tests-domain-tests-guard.mjs` acredita **12 aserciones** concretas en 12 suites. Sus recuentos no son una licencia para fijar tamaños arbitrarios: corresponden a garantías de unidades o cambios identificables. Cada excepción exige la coincidencia de **ruta, nombre del test y expresión exacta**. Si se añade una cohorte o cambia la aserción, el guard vuelve a señalar el caso hasta su revisión.

Estos controles incluyen galerías, identidad y colisiones, recuperaciones de seguridad, geometría, movilidad, depósitos, operaciones, acústica, mandos y neumáticos. La fuente de verdad exacta es `cohortExceptions`, no una lista copiada que deba mantenerse a mano.

## Siete dependencias transitivas acreditadas

El mapa `transitiveExceptions` identifica tres pruebas GAM que comparten `src/preparation/gam/technical/tests/support/gam-source-category-fixture.ts`, y cuatro pruebas que utilizan `src/testing/builders/mercaeleva-source-fixture.ts`. Se conserva su garantía de identidad, variantes, categorías, condición o especificaciones documentadas.

La autorización se verifica por **pareja de test y helper** y exige la forma de lectura de origen acreditada y **una única dependencia catalogal** en la fixture. Ampliar la entrada, introducir otra lectura u otra fixture no queda exento. Una migración futura de estas pruebas requiere equivalencia de cobertura.

## Veintiuna lecturas directas en catorce suites protegidas

Hay lecturas de origen y publicación acreditadas que siguen siendo necesarias para garantías censales o de integración. El mapa `accreditedCatalogIntegrations` de `tests-domain-tests-guard.mjs` identifica las **14 rutas, sus 21 lecturas y la responsabilidad de cada una**, con SHA-256 del archivo completo y número exacto de accesos.

Las suites incluyen controles de imágenes GAM, identidad de variantes, recuperaciones técnicas por unidad (seguridad, geometría, movilidad, limpieza y acústica), calidad semántica de fuente y consistencia de publicaciones. La autorización no es por carpeta, proveedor o nombre genérico: modificar el contenido del test, añadir otra lectura o ampliar la entrada invalida la coincidencia y devuelve la infracción. **No modificar tests protegidos para mejorar un contador.**

## Hash de manifest frente a hash editorial

`src/preparation/tests/catalog-publication-consistency.test.ts` comprueba integridad de los bytes del catálogo original frente a `manifest.source.catalogSha256`. No congela una descripción. El detector `T-FROZEN-EDITORIAL-HASH` requiere una comparación literal de hash calculado a partir de redacción; no debe confundir un manifest de procedencia con contenido editorial.

## Cierre y límites

El corte acreditado se obtuvo sin modificar tests protegidos y sin introducir excepciones generales. Conservar el cero exige que cualquier nueva infracción se **resuelva o acredite contractualmente con alcance exacto**, no degradar el guard ni añadir tolerancias. Una integración necesaria no justifica convertir en dependiente del catálogo todo test de dominio.

El propietario ha comunicado el resultado completo de `npm test` en `develop` el 22 de noviembre de 2026: **540 suites, 2.799 tests correctos, 0 fallidos y 0 omitidos**, con reutilización de caché en parte de la batería, además de `npm run build` correcto. Es una instantánea de ejecución comunicada, no una garantía permanente; registrar el resultado real de cada nueva ejecución. Referencias: [Motor editorial](../docs/EDITORIAL_ENGINE.md), [Validación](../docs/VALIDATION.md) y [Pruebas y rendimiento](../docs/TESTING.md).
