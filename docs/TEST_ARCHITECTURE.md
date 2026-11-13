# Arquitectura vigente de pruebas y guards

## AI GUARD

**Protección documental.** Actualizar únicamente con autorización documental expresa y con referencia al código real. No confundir una clasificación estática del guard con una validación funcional o con el resultado de `npm test`.

**Política permanente.** Las pruebas nuevas protegen **motores, responsabilidades y contratos**, no la fotografía accidental de máquinas del catálogo. Las integraciones sobre catálogos reales solo se conservan cuando acreditan integridad, procedencia, no propagación o comportamientos que requieren censo; no crear suites individuales por cada ficha.

## Corte y principios

Referencia vigente tras la **fase 27 (13 de noviembre de 2026)**. La reforma de tests retiró redundancias, desacopló casos de dominio de catálogos completos cuando era seguro y mantuvo pruebas de integración acreditadas. Los dos guards arquitectónicos independientes informan **0 infracciones**, sin baseline ni cupos de warnings permitidos. Esto no significa que todas las pruebas del repositorio estén acreditadas como PASS global.

Prioridad de cobertura:

1. **Dominio compartido:** contratos de identidad, familia, hechos, magnitudes, variantes, negaciones, precedencias, recuperación y proyección, con casos positivos y negativos tipados.
2. **Fixtures acotadas:** entradas representativas que preservan tipos y procedencia real cuando corresponda; se puede reutilizar un registro de máquina real como evidencia, pero no crear una suite exclusiva por su ID.
3. **Integración y acreditación:** conservar los recorridos de catálogo completo si la propiedad probada es censal (aislamiento entre proveedores, recuperaciones solo de unidades firmadas, integridad, versiones o publicación). La fuente y la población forman parte de su contrato.
4. **Coste reproducible:** evitar recargar catálogos completos en cada test de dominio y respetar el guard de rendimiento. Nunca eliminar cobertura simplemente para abaratar el runner.

Una prueba que usa un dato real **no** se considera obsoleta por ello. La diferencia es si verifica una regla compartida o si exige una publicación completa y acreditada como parte de la garantía.

## Controles existentes y ejecución

El orden oficial **real** de `npm test` se define en `package.json`:

```text
GUARDS/tests-module-integrity-guard.mjs
GUARDS/tests-shared-editorial-guard.mjs
GUARDS/tests-commercial-editorial-boundary-guard.mjs
scripts/operations/rebuild-editorial-knowledge.mjs --check
GUARDS/tests-performance-guard.mjs
GUARDS/tests-commercial-contract-guard.mjs
scripts/run-build.mjs --quiet --if-needed
scripts/run-tests.mjs
```

Además se ejecutan **por separado** los dos guards arquitectónicos y sus autopruebas:

```powershell
node GUARDS/tests-editorial-architecture-guard.mjs --detail
node GUARDS/tests-domain-tests-guard.mjs --detail
node --test GUARDS/tests-architecture-guards.test.mjs
```

Están **fuera** de `npm test` por diseño actual: no afirmar que forman parte del runner oficial. `node scripts/run-tests.mjs` aislado no verifica build ni guards. `npm run build` utiliza `scripts/run-build.mjs`. Las suites `src/**/*.test.ts` son descubiertas y ejecutadas por el runner a partir de sus equivalentes compilados, junto a los tests de `scripts/` que éste admita.

Los guardias controlan fronteras, no verifican por sí solos los resultados comerciales ni los contratos de cada RE. El guard de rendimiento y el de contrato comercial también son independientes del guard de arquitectura de tests.

## Guard editorial y guard de tests

- `GUARDS/tests-editorial-architecture-guard.mjs` protege el compositor compartido, detecta narradores aislados/conectados, reescrituras fuera del propietario, ramificaciones por referencia y dependencias impropias del dominio.
- `GUARDS/tests-domain-tests-guard.mjs` inspecciona dependencias directas/transitivas de catálogos, cohortes fijas y hashes editoriales congelados. El hash de **procedencia de manifest** no es un hash de redacción.
- Ambos usan `GUARDS/guards-architecture-core.mjs`; las autopruebas están en `GUARDS/tests-architecture-guards.test.mjs`. Las excepciones son verificaciones exactas de contratos, **no** tolerancias globales.

Último corte ejecutado sobre la fase 27: **0 infracciones editoriales, 0 de tests, 25/25 autopruebas, 19 usos acreditados como excepciones (12 cohortes y 7 accesos transitivos) y 21 lecturas directas legítimas en 14 suites protegidas**. Son categorías distintas; 19 y 21 **no son** avisos pendientes. La inspección del guard de tests recorrió 173 suites de dominio y 15 módulos auxiliares; las cifras describen su alcance estático y no la batería completa de `npm test`.

Las 21 lecturas acreditadas están vinculadas al **SHA-256 completo** de cada una de las 14 suites, a una cantidad exacta de lecturas y a una responsabilidad documentada. Si cambia un archivo o aumenta su acceso, el guard lo vuelve a señalar. Los recuentos de cohortes y las dependencias indirectas también requieren coincidencia exacta de su forma autorizada. **No** añadir excepciones para hacer desaparecer una incidencia nueva: primero acreditar su contrato, o migrar el acceso si no precisa catálogo completo.

La enumeración vigente y la razón de cada autorización están en [GUARDS/README.md](../GUARDS/README.md) y, para lecturas directas, en el mapa `accreditedCatalogIntegrations` del guard. Las cifras del antiguo [plan v2](../GUARDS/PLAN-GUARDS-ARQUITECTURA-V2.md) son históricas.

## Criterio para nuevas pruebas

| Si la propiedad que se protege es… | Usar… | Evitar… |
| --- | --- | --- |
| Regla de dominio reutilizable | Fixtures acotadas y tipos reales, positivos/negativos parametrizados | Un test nuevo por máquina, hashes editoriales de una publicación completa |
| Semántica de origen | Adaptador y caso de proveedor con fuente acreditada | Fingir que un dato de otra fuente o unidad es equivalente |
| No propagación entre variantes/unidades | Casos negativos y, si se exige totalidad, integración censal acreditada | Reducir a dos ejemplos un control cuyo contrato es «ninguna otra ficha» |
| Integridad de originales o publicaciones | Manifiestos, firmas, archivos y pruebas de integración correspondientes | Prohibir indiscriminadamente el acceso legítimo al catálogo |
| Evolución de composición editorial | Comprobar título, corta, general, estado y especificaciones | Congelar texto masivo por hash o aceptar cualquier nueva redacción sin evidencia |

Para retirar una suite histórica, conservar primero la garantía que protegía; eliminar imports, fixtures y helpers sin consumidores únicamente después de acreditar equivalencia. Los 20 tests protegidos de las fases 25–27 se mantuvieron sin modificaciones, pero esa reserva no es permiso para multiplicar pruebas por referencia.

## Criterio de cierre de una modificación

Ejecutar suites relevantes, guards arquitectónicos y oficiales disponibles, comprobar prestaciones/negaciones y diferencias de catálogo cuando haya cambios productivos. Registrar separadamente PASS, FAIL real y **no ejecutado** por dependencias del entorno. No recalcular ni sobreescribir `rulesSha256`, manifests, aprobaciones o originales para acomodar cambios.

Los últimos cortes editoriales y del guard son positivos en sus alcances, pero **el build y `npm test` oficiales completos no estaban acreditados** por dependencias ausentes en el entorno anterior; esta documentación no afirma lo contrario. Ver [Validación](VALIDATION.md), [Rendimiento](TESTS_RENDIMIENTO_CAMPANAS.md) y [Motor editorial](EDITORIAL_ENGINE.md).
