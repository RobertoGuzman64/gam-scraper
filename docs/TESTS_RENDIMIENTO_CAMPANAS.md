# Rendimiento de tests: guard, runner y reutilización de campañas

## Objetivo y estado actual

La protección del rendimiento forma parte de `npm test`; no es un benchmark separado que sustituya a las pruebas. El contrato está en `package.json`:

```text
npm test = tests-performance-guard.mjs → scripts/run-build.mjs --quiet --if-needed → scripts/run-tests.mjs
```

El guard detecta patrones de coste y la ejecución posterior compila cuando corresponde y lanza suites compiladas. `npm run test:guard` ejecuta **solo** el guard; **no** equivale al PASS integral. `npm run build` compila mediante `scripts/run-build.mjs` y la caché de build está en `scripts/build-cache.mjs`. Si faltan `typescript`, `cheerio`, `p-limit` o tipos de Node no se debe declarar un build correcto a partir de tests aislados.

## Runner y medición reproducible

`scripts/run-tests.mjs` distribuye pruebas por carriles, ordena cargas por duración histórica y escoge una concurrencia apropiada para la máquina mediante `scripts/test-performance.mjs` y `test-runner-execution.mjs`. `test-runner-observability.mjs` y `test-runner-ui.mjs` presentan tiempos, omisiones y regresiones. `test-result-cache.mjs` puede reutilizar resultados en condiciones controladas; `test-runner-completion.mjs` decide si una ejecución es acreditable. No reducir la cobertura ni eliminar un test lento solo para mejorar la cifra global.

```powershell
npm ci
npm run test:guard
npm run build
npm test
node scripts/run-tests.mjs --medicion <ruta-informe.json>
```

`--medicion` genera un informe de tiempos del runner y debe ejecutarse desde la raíz, con compilados disponibles. Para comparar dos medidas, usar el **mismo equipo, entorno, concurrencia y estado de caché**; no comparar una ejecución en frío con una reutilizada. El runner también reconoce `--concurrencia N` (1–64) y `--medicion-cache <ruta-informe.json>` con las restricciones de `parseOptions` en `scripts/run-tests.mjs`. Los reportes de rendimiento operativos se guardan fuera de los datos/versiones acreditadas del catálogo.

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

## Reutilización de fixtures costosas de campañas

Las suites de recuperación y retención pueden reutilizar estados auténticos acreditados mediante `createDeliveryFixtures` y `reuseCampaignTestFixture.prepared(...)`. Los estados son distintos:

| Estado                      | Qué representa                           | Límite                                             |
| --------------------------- | ---------------------------------------- | -------------------------------------------------- |
| `fixture`                   | Campaña base                             | Fallos previos a aprobación y entrega              |
| `approvedFixture`           | Revisión/aprobación editorial realizadas | Casos previos a publicar o que prueban la entrega  |
| `deliveredFixture`          | Campaña aprobada y entregada             | Recuperación, protección y verificación de entrega |
| `successiveDeliveryFixture` | Dos campañas sucesivas entregadas        | Rotación y retención entre entregas                |

Cada caso recibe un workspace aislado; las mutaciones no deben contaminar el estado compartido. El creador de fixtures ejecuta realmente las transiciones una vez al preparar las variantes, **no fabrica artefactos ni sustituye por mocks** la aprobación o publicación que el test deba verificar. No reutilizar un estado posterior en una prueba de transición anterior.

## Cómo evitar regresiones de coste en nuevas reglas

- Reutilizar fixtures de catálogo ya cargadas y agregar casos a suites específicas en vez de abrir nuevos recorridos globales para una única reconciliación.
- Conservar un caso real acreditado, uno negativo de identidad/huella y uno de no regresión; la cobertura útil tiene prioridad sobre reducir número de aserciones.
- Medir los 3–4 grupos más costosos antes y después de cambios que creen bucles, cargas de disco o relecturas de publicaciones. No duplicar cargas costosas en nuevos tests.
- Ante un empeoramiento, comprobar duración por suite, carril, compilación y estado de caché antes de cambiar concurrencia o incorporar un índice compartido.
- Las métricas históricas anteriores a la reforma no son una línea base vigente. El guard y la medición controlada son los instrumentos actuales, no un número fijo de segundos.

Para los criterios de equivalencia y materialización de cambios, ver [Validación](VALIDATION.md), [Mantenimiento](MAINTENANCE.md) y [Mejora acreditada del catálogo](CATALOG_IMPROVEMENT.md).
