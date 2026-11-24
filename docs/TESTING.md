# Pruebas, guards y rendimiento del repositorio

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Las pruebas protegen motores, contratos y responsabilidades; no añadir suites por cada ficha ni convertir números históricos del censo en expectativas permanentes. Los guards no sustituyen la verificación funcional, y un build/test no acredita cobertura real del proveedor.

**Propietario:** diseño de suites, guards, runner, cuotas de ejecución, reutilización de fixtures, medición de rendimiento y criterios de regresión. La aceptación de una extracción o publicación corresponde a [Validación](VALIDATION.md).

## Corte y principios

Referencia operativa de la arquitectura de pruebas. La consolidación retiró redundancias, desacopló casos de dominio de catálogos completos cuando era seguro y mantuvo pruebas de integración acreditadas. Los dos guards arquitectónicos independientes informan **0 infracciones**, sin baseline ni cupos de warnings permitidos. Esto no significa que todas las pruebas del repositorio estén acreditadas como PASS global.

Prioridad de cobertura:

1. **Dominio compartido:** contratos de identidad, familia, hechos, magnitudes, variantes, negaciones, precedencias, recuperación y proyección, con casos positivos y negativos tipados.
2. **Fixtures acotadas:** entradas representativas que preservan tipos y procedencia real cuando corresponda; se puede reutilizar un registro de máquina real como evidencia, pero no crear una suite exclusiva por su ID.
3. **Integración y acreditación:** conservar los recorridos de catálogo completo si la propiedad probada es censal (aislamiento entre proveedores, recuperaciones solo de unidades firmadas, integridad, versiones o publicación). La fuente y la población forman parte de su contrato.
4. **Coste reproducible:** evitar recargar catálogos completos en cada test de dominio y respetar el guard de rendimiento. Nunca eliminar cobertura simplemente para abaratar el runner.

Una prueba que usa un dato real **no** se considera obsoleta por ello. La diferencia es si verifica una regla compartida o si exige una publicación completa y acreditada como parte de la garantía.

## Controles existentes y ejecución

El orden oficial **real** de `npm test` se define en `package.json`:

```text
node GUARDS/tests-repository-governance-guard.mjs
node --test GUARDS/tests-repository-governance-guard.test.mjs
node GUARDS/tests-module-integrity-guard.mjs
node GUARDS/tests-shared-editorial-guard.mjs
node GUARDS/tests-commercial-editorial-boundary-guard.mjs
node GUARDS/tests-editorial-architecture-guard.mjs
node GUARDS/tests-domain-tests-guard.mjs
node --test --test-reporter=./scripts/test-runner-ui.mjs GUARDS/tests-architecture-guards.test.mjs
node scripts/operations/rebuild-editorial-knowledge.mjs --check
node GUARDS/tests-performance-guard.mjs
node GUARDS/tests-commercial-contract-guard.mjs
node scripts/run-build.mjs --quiet --if-needed
node scripts/operations/rebuild-editorial-models.mjs --check
node scripts/run-tests.mjs
```

Los guards de gobernanza, integridad productiva, editorial y de tests, con sus autopruebas correspondientes, **forman parte de `npm test`**, antes del build. Para investigar una infracción concreta, pueden ejecutarse individualmente con detalle:

```powershell
node GUARDS/tests-module-integrity-guard.mjs
node GUARDS/tests-editorial-architecture-guard.mjs --detail
node GUARDS/tests-domain-tests-guard.mjs --detail
node --test --test-reporter=./scripts/test-runner-ui.mjs GUARDS/tests-architecture-guards.test.mjs
```

El core necesita `node_modules/typescript` local y no utiliza el TypeScript global como respaldo. `node scripts/run-tests.mjs` aislado no comprueba los guards, el consenso de modelos ni el build. `npm run build` utiliza `scripts/run-build.mjs`. Las suites `src/**/*.test.ts` son descubiertas por el runner desde sus equivalentes compilados, junto a los tests de `scripts/` que éste admita.

Los guards controlan fronteras, no verifican por sí solos los resultados comerciales ni cada contrato funcional. El guard de rendimiento y el de contrato comercial también son independientes del guard de arquitectura de tests.

## Ubicación de suites, fixtures y helpers

- Colocar las suites del dominio en el directorio `tests/` junto al módulo que validan; se conserva la excepción técnica GAM existente, cuyas suites viven junto a sus módulos técnicos. El runner solo descubre suites `*.test.ts` en `src/`: otros sufijos o extensiones de suite quedan fuera y el guard los rechaza.
- Las integraciones compartidas viven en `src/testing/integration/{catalog,commercial,preparation}/` y solo contienen suites `*.test.ts`. Los builders y sus tests viven en `src/testing/builders/` y `src/testing/builders/tests/`; los datos de prueba acotados en `src/testing/fixtures/`. El antiguo árbol `src/testing/domain-cases/` está retirado y no debe reconstruirse.
- Los helpers locales se quedan en los `tests/` de su módulo o se comparten mediante `src/testing/builders/`. Los seis helpers históricos admitidos bajo `src/preparation/testing/` tienen rutas cerradas; no ampliarlos formando otra infraestructura paralela. No importar una suite de test como si fuera un helper.
- El runner, reporter, trabajadores y medición pertenecen a `scripts/`; **no** montar runners ni orquestación de procesos en `src/testing/`. La gobernanza del inventario de scripts se decide en [Gobernanza](REPOSITORY_GOVERNANCE.md), no en el guard de pruebas.

Estas reglas son verificadas por `GUARDS/tests-domain-tests-guard.mjs` y las fronteras de producción por `tests-module-integrity-guard.mjs`. Mantener las integraciones censales acreditadas y sus fixtures cuando se requieren por el contrato; no moverlas por estética.

## Guard editorial y guard de tests

- `GUARDS/tests-editorial-architecture-guard.mjs` protege el compositor compartido, detecta narradores aislados/conectados, reescrituras fuera del propietario, ramificaciones por referencia y dependencias impropias del dominio.
- `GUARDS/tests-domain-tests-guard.mjs` inspecciona dependencias directas/transitivas de catálogos, cohortes fijas y hashes editoriales congelados. El hash de **procedencia de manifest** no es un hash de redacción.
- Ambos usan `GUARDS/guards-architecture-core.mjs`; las autopruebas están en `GUARDS/tests-architecture-guards.test.mjs`. Las excepciones son verificaciones exactas de contratos, **no** tolerancias globales.

El contrato vigente del guard permite **dos dependencias transitivas exactas** de suites de publicación Manain hacia una fixture acreditada, y **dos lecturas directas en una suite** de integridad de catálogo/publicación. Las antiguas autorizaciones de 12 cohortes y 21 lecturas en 14 suites ya no existen. Las coincidencias se comprueban por ruta y huella de contenido, no por proveedor o permiso general. **No** añadir excepciones para hacer desaparecer una incidencia nueva: primero acreditar su contrato, o desacoplar la prueba sin debilitarla.

La ejecución global comunicada por el propietario el **24-11-2026**, anterior al último blindaje de guards, superó 372/372 suites y 1.941 pruebas, con 0 fallos y build correcto. La ampliación posterior de guard incluyó dos nuevas autopruebas arquitectónicas comprobadas por separado; no presentar ese resultado previo como una ejecución global de la versión posterior. Los números son resultados de una ejecución, no cuotas ni umbrales fijos del runner.

La enumeración vigente y la razón de cada autorización están en [GUARDS/README.md](../GUARDS/README.md); el mapa `accreditedCatalogIntegrations` del guard define la única suite con lecturas directas.

## Regresión del tooling operativo

La presentación de estados y progreso reside en `src/cli/reporting/` (`operation-progress.ts`, `live-status.ts` y `terminal.ts`); los comandos y servicios siguen siendo responsables de ejecutar las operaciones y emitir información fiable. `tests-module-integrity-guard.mjs` rechaza imports desde reporting hacia `src/cli/commands/` y desde `src/panel/` hacia `src/tools/`; las autopruebas comprueban los sentidos permitidos y prohibidos. La lectura y la caché del explorador pertenecen a `panel/`, mientras `tools/catalog/` conserva fachadas hacia esa implementación. Esta protección de dependencias no sustituye las pruebas de comportamiento.

`src/cli/reporting/tests/operation-progress.test.ts` y `terminal.test.ts` comprueban avances y cierres, contadores reales, ausencia de barras/duplicados por proveedor, cancelaciones y salidas interactivas o capturadas. Los estados de éxito, advertencia y fallo se basan en resultados verificados, no en el mero avance; las salidas de error por `stderr` requieren captura expresa. No prohibir indiscriminadamente las barras de progreso por ficha del scraping.

En FINISH, las suites de `src/publication/tests/` protegen acreditaciones, diferencias, publicación, idempotencia y recuperación. La optimización de selecciones ya validadas debe conservar la comprobación de cambios entre etapas y las verificaciones previas a activar. En la exportación, conservar la equivalencia del preflight/proyección y la verificación final de fuentes. Para evitar regresiones de coste, preferir pruebas de equivalencia y de límites de responsabilidad a límites de segundos o aserciones rígidas sobre la forma del código.

Los recuentos históricos de baterías no son umbrales fijos. La ejecución global comunicada el 24-11-2026 se describe arriba; para la aceptación de cualquier nuevo cambio cuenta únicamente la ejecución sobre ese árbol concreto, indicando suites cacheadas y pruebas ejecutadas.

## Criterio para nuevas pruebas

| Si la propiedad que se protege es…       | Usar…                                                                   | Evitar…                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Regla de dominio reutilizable            | Fixtures acotadas y tipos reales, positivos/negativos parametrizados    | Un test nuevo por máquina, hashes editoriales de una publicación completa        |
| Semántica de origen                      | Adaptador y caso de proveedor con fuente acreditada                     | Fingir que un dato de otra fuente o unidad es equivalente                        |
| No propagación entre variantes/unidades  | Casos negativos y, si se exige totalidad, integración censal acreditada | Reducir a dos ejemplos un control cuyo contrato es «ninguna otra ficha»          |
| Integridad de originales o publicaciones | Manifiestos, firmas, archivos y pruebas de integración correspondientes | Prohibir indiscriminadamente el acceso legítimo al catálogo                      |
| Evolución de composición editorial       | Comprobar título, corta, general, estado y especificaciones             | Congelar texto masivo por hash o aceptar cualquier nueva redacción sin evidencia |

Para retirar una suite redundante, conservar primero la garantía que protegía; eliminar imports, fixtures y helpers sin consumidores únicamente después de acreditar equivalencia. Las suites y operaciones amparadas por `GUARDS/tests-performance-guard.mjs` conservan sus contratos de ejecución y de infraestructura; sus límites exactos se consultan en el guard, no en una cuota histórica copiada a esta guía. Esa protección no autoriza duplicar recorridos costosos.

## Criterio de cierre de una modificación

Ejecutar suites relevantes, guards arquitectónicos y oficiales disponibles, comprobar prestaciones/negaciones y diferencias de catálogo cuando haya cambios productivos. Registrar separadamente PASS, FAIL real y **no ejecutado** por dependencias del entorno. No recalcular ni sobreescribir `rulesSha256`, manifests, aprobaciones o originales para acomodar cambios.

Los cortes parciales de los guards no sustituyen un `npm test` oficial completo. Cada entrega debe acreditar por separado compilación y regresión, registrando los límites de entorno si impiden ejecutarlas. Ver [Validación](VALIDATION.md), [Rendimiento](TESTING.md) y [Motor editorial](EDITORIAL_ENGINE.md).

## Integridad del conocimiento integrado

`npm test` comprueba `data/editorial/knowledge/verified-units.json` contra los originales canónicos: identidad completa, URL, marca, modelo y SHA-256 de contenido. La integridad se comprueba contra las fuentes vigentes, sin depender de archivos temporales retirados. El guard editorial impide restaurar el árbol de fuentes archivadas o scripts de conciliación retirados.

## Rendimiento y runner de pruebas

### Objetivo y estado actual

La protección del rendimiento forma parte de `npm test`; no es un benchmark separado que sustituya a las pruebas. El contrato está en `package.json`:

```text
npm test = gobernanza y autopruebas → integridad productiva → motor compartido → frontera comercial/editorial → guard editorial → guard de tests → autopruebas arquitectónicas → conocimiento --check → rendimiento → contrato comercial v2 → build --if-needed → consenso de modelos --check → runner
```

El guard detecta patrones de coste y la ejecución posterior compila cuando corresponde y lanza suites compiladas. `npm run test:guard` ejecuta **solo** el guard; **no** equivale al PASS integral. `npm run build` compila mediante `scripts/run-build.mjs` y la caché de build está en `scripts/build-cache.mjs`. Si faltan `typescript`, `cheerio`, `p-limit` o tipos de Node no se debe declarar un build correcto a partir de tests aislados.

`npm test` incluye ahora `tests-editorial-architecture-guard.mjs`, `tests-domain-tests-guard.mjs` y `tests-architecture-guards.test.mjs` **antes del build**; comprueba además el consenso de modelos después de compilar. Estos controles requieren TypeScript instalado en el proyecto. Su ejecución aislada aporta diagnóstico, pero no sustituye el comando oficial. `npm run contrato:comercial` ejecuta el guard de contrato por separado y la exportación también lo comprueba. Una reorganización AST legítima podría exigir revisar la huella del guard comercial sin alterar el contrato externo; ver [Arquitectura de tests](TESTING.md).

Los tests de regresión históricos de Gomariz deben utilizar snapshots y publicaciones **reales y congelados** (corte de 143), no comparar hashes contra el original mutable de 547 fichas del 11 de noviembre de 2026. Los tests de aislamiento entre proveedores deben trabajar con el catálogo vigente sin suponer tamaños fijos. Reutilizar los builders y fixtures existentes evita multiplicar preparaciones costosas. Este criterio se aplica a futuros crecimientos de cobertura. Ver [Mantenimiento](OPERATIONS_AND_MAINTENANCE.md).

### Runner y medición reproducible

`scripts/run-tests.mjs` distribuye pruebas por carriles, ordena cargas por duración histórica y escoge una concurrencia apropiada para la máquina mediante `scripts/test-performance.mjs` y `test-runner-execution.mjs`. `test-runner-observability.mjs` y `test-runner-ui.mjs` presentan tiempos, omisiones y regresiones. `test-result-cache.mjs` puede reutilizar resultados en condiciones controladas; `test-runner-completion.mjs` decide si una ejecución es acreditable. No reducir la cobertura ni eliminar un test lento solo para mejorar la cifra global.

```powershell
npm ci
npm run test:guard
npm run build
npm test
node scripts/run-tests.mjs --medicion <ruta-informe.json>
```

`--medicion` genera un informe de tiempos del runner y debe ejecutarse desde la raíz, con compilados disponibles. Para comparar dos medidas, usar el **mismo equipo, entorno, concurrencia y estado de caché**; no comparar una ejecución en frío con una reutilizada. El runner también reconoce `--concurrencia N` (1–64) y `--medicion-cache <ruta-informe.json>` con las restricciones de `parseOptions` en `scripts/run-tests.mjs`. En modo de salida no interactiva, `scripts/test-runner-ui.mjs` muestra un recuento acumulado cada **15 segundos** y comunica los fallos nuevos inmediatamente; el resumen `PASS | TESTS` o `FAIL | TESTS` se emite al terminar. En terminal interactiva mantiene su presentación dinámica. Los reportes de rendimiento operativos se guardan fuera de los datos/versiones acreditadas del catálogo.

Para una batería que no reutilice resultados previos, desactivar la caché de tests **en el proceso**, sin modificar scripts ni borrar archivos de acreditación:

```powershell
$cacheAnterior = [Environment]::GetEnvironmentVariable('EQUIPZILLA_TEST_CACHE', 'Process')
try {
    $env:EQUIPZILLA_TEST_CACHE = '0'
    npm test
} finally {
    [Environment]::SetEnvironmentVariable('EQUIPZILLA_TEST_CACHE', $cacheAnterior, 'Process')
}
```

`npm test` no implica una comparación exhaustiva con la web ni acredita por sí solo las publicaciones actuales. Registrar resultado y duración por separado de `npm run estado`, del preflight y de la exportación comercial.

### Reutilización de fixtures costosas de campañas

Las suites de recuperación y retención pueden reutilizar estados auténticos acreditados mediante `createDeliveryFixtures` y `reuseCampaignTestFixture.prepared(...)`. Los estados son distintos:

| Estado                      | Qué representa                           | Límite                                             |
| --------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `fixture`                   | Campaña base                             | Fallos previos a aprobación y entrega              |
| `approvedFixture`           | Revisión/aprobación editorial realizadas | Casos previos a publicar o que prueban la entrega  |
| `deliveredFixture`          | Campaña aprobada y entregada             | Recuperación, protección y verificación de entrega |
| `successiveDeliveryFixture` | Dos campañas sucesivas entregadas        | Rotación y retención entre entregas                |

Cada caso recibe un workspace aislado; las mutaciones no deben contaminar el estado compartido. El creador de fixtures ejecuta realmente las transiciones una vez al preparar las variantes, **no fabrica artefactos ni sustituye por mocks** la aprobación o publicación que el test deba verificar. No reutilizar un estado posterior en una prueba de transición anterior.

### Cómo evitar regresiones de coste en nuevas reglas

La política vigente es crear pruebas para **responsabilidades reutilizables**, no una suite por máquina. Las pruebas de integración sobre el catálogo íntegro se conservan cuando su contrato requiere cobertura censal, integridad, firma, procedencia o exclusión entre unidades/proveedores. Consultar [Arquitectura de tests](TESTING.md) para diferenciar controles legítimos de acoplamientos indebidos.

- Reutilizar fixtures de catálogo ya cargadas y agregar casos a suites específicas en vez de abrir nuevos recorridos globales para una única reconciliación.
- Conservar un caso real acreditado, uno negativo de identidad/huella y uno de no regresión; la cobertura útil tiene prioridad sobre reducir número de aserciones.
- Medir los 3–4 grupos más costosos antes y después de cambios que creen bucles, cargas de disco o relecturas de publicaciones. No duplicar cargas costosas en nuevos tests.
- Ante un empeoramiento, comprobar duración por suite, carril, compilación y estado de caché antes de cambiar concurrencia o incorporar un índice compartido.
- Las métricas históricas anteriores a la reforma no son una línea base vigente. El guard y la medición controlada son los instrumentos actuales, no un número fijo de segundos.

Para los criterios de equivalencia y materialización de cambios, ver [Validación](VALIDATION.md), [Mantenimiento](OPERATIONS_AND_MAINTENANCE.md) y [Mejora acreditada del catálogo](CATALOG_QUALITY.md).

## Verificación técnica tras cambios estructurales

`npm test` ejecuta gobernanza e integridad productiva, además de los guards arquitectónicos editorial y de tests y sus autopruebas, **antes del build**. En cambios de arquitectura, se pueden ejecutar también por separado para obtener un diagnóstico más detallado:

```powershell
node GUARDS/tests-editorial-architecture-guard.mjs
node GUARDS/tests-domain-tests-guard.mjs
node --test GUARDS/tests-architecture-guards.test.mjs
```

La auditoría arquitectónica focal registra infracciones, excepciones exactas y lecturas de catálogo acreditadas; un resultado correcto no sustituye las pruebas funcionales ni acredita por sí solo `npm test` global. La validación exige dependencias locales completas (`npm ci`), no TypeScript global ni una compilación auxiliar. Véanse [Arquitectura de tests](TESTING.md) y [Motor editorial](EDITORIAL_ENGINE.md).

Desde la raíz del proyecto, con dependencias instaladas, ejecutar:

```powershell
npm ci
npm test
npm run build
npm run estado
git status --short
```

Para acreditar una reforma estructural sobre Windows, ejecutar además una batería **sin reutilizar caché**:

```powershell
$env:EQUIPZILLA_TEST_CACHE = "0"
npm test
Remove-Item Env:EQUIPZILLA_TEST_CACHE
npm run build
npm run estado
```

`EQUIPZILLA_TEST_CACHE=0` desactiva la reutilización de resultados; la ejecución ordinaria puede informar suites y tests cacheados. Comprobar `0 fallidos` y el número de suites efectivamente ejecutadas, no solo el total. En Windows puede omitirse la prueba de enlaces simbólicos si el usuario no tiene privilegios para crearlos: es una omisión explícita, no un test aprobado ni un fallo de compilación. Ante cualquier fallo en `npm test`, limpiar la variable de entorno antes de continuar.

`npm test` ejecuta los guards, valida el conocimiento editorial, **compila cuando corresponde, comprueba el consenso de modelos** y después lanza `scripts/run-tests.mjs`: descubre los `.test.ts` de `src/` (que se ejecutan compilados desde `dist/`) y las suites `.test.mjs` de `scripts/`. `npm run build` por separado confirma la compilación explícita. La cantidad de pruebas puede variar al añadir o mover suites; para diagnosticar resultados, ejecutar después del build `node scripts/run-tests.mjs --concurrencia 2` o `node scripts/run-tests.mjs --medicion <informe.json>`. La medición es un informe local generado, no un archivo de catálogo.

Al renombrar archivos o carpetas, comprobar además referencias dinámicas, rutas relativas desde `import.meta.url`, scripts programados, imports dentro de **cadenas que generan TypeScript temporal** y las rutas de prioridad del runner. Un `PASS` de TypeScript no garantiza que esas rutas apunten a los fixtures esperados; las suites de integración deben ejecutarse realmente. En Git, movimientos físicos pueden aparecer como eliminaciones y archivos no rastreados hasta incorporarlos al índice, por lo que se debe inspeccionar el diff antes del commit.

**Cambios exclusivamente documentales:** comprobar enlaces, referencias de rutas y que el ZIP incremental solo contenga documentación; no reinterpretar una ejecución verde anterior como una batería ejecutada de nuevo. Documentar la referencia exacta usada y conservar byte a byte `src/`, `catalogs/`, `data/`, `src/catalog/interventions/records/`, los scripts y las huellas acreditadas.

**Equivalencia tras refactor de preparación:** comparar con las mismas entradas canónicas la salida íntegra de `prepareSourceProduct` anterior y posterior, incluyendo `product`, `issues` y `status`; verificar por separado originales, manifests, aprobaciones y publicaciones acreditadas. La equivalencia en un conjunto de fichas acredita solo ese conjunto, no cobertura web, una aprobación editorial ni la compatibilidad automática de las huellas. Si cambió `rulesSha256`, no reescribir aprobaciones anteriores: usar el ciclo de preparación/acreditación vigente.

**Huellas de preparación:** `rulesSha256` se obtiene del contenido compilado y de los nombres relativos de módulos del catálogo. Tras cambios estructurales puede variar aunque los datos publicados no hayan cambiado. Verificar la compatibilidad de preparaciones y aprobaciones existentes sin reescribir sus hashes, sin regenerar de forma encubierta `catalogs/` y sin considerar `npm run estado` una acreditación de reglas nuevas. `PASS` de tests, `PASS` de build, integridad de `catalogs/` y aceptación editorial son comprobaciones diferentes.

**Validación del ciclo individual:** ejecutar `npm run catalogo:preparar -- --simular`, `npm run catalogo:publicar -- --simular` y comprobar mediante `npm run estado` los índices de publicación existentes. La simulación no acredita nuevos casos ni activa finales. Una ejecución real de FINISH requiere fuentes y decisiones verificadas; su informe interno versionado resume el trabajo original → publicado, no acredita cobertura web ni sustituye el preflight. Ver [Publicación individual](PUBLICATIONS.md).

## Validación ordinaria y de reformas

```powershell
npm ci
npm run build
$cacheAnterior = [Environment]::GetEnvironmentVariable('EQUIPZILLA_TEST_CACHE', 'Process')
try {
    $env:EQUIPZILLA_TEST_CACHE = '0'
    npm test
} finally {
    [Environment]::SetEnvironmentVariable('EQUIPZILLA_TEST_CACHE', $cacheAnterior, 'Process')
}
npm run estado
git status --short
```

Conservar los códigos de salida por separado; PowerShell puede continuar aunque falle un comando. `npm test` ejecuta primero gobernanza y sus autopruebas, después los guards de integridad, motor compartido, frontera comercial/editorial, arquitectura editorial, arquitectura de tests y sus autopruebas; después verifica conocimiento, rendimiento y contrato comercial v2, compila si es necesario, comprueba consenso de modelos y lanza las suites TypeScript/MJS. Los guards arquitectónicos **ya están integrados** en el comando oficial y requieren TypeScript local; pueden invocarse individualmente solo para diagnóstico. `npm run contrato:comercial` ejecuta explícitamente el guard del contrato comercial. No confundir un test aislado verde, un `build` correcto o `estado` íntegro con una acreditación editorial o con cobertura externa de los portales. Ante una regresión, corregir primero el fallo concreto y comprobar contratos específicos de la zona modificada.
