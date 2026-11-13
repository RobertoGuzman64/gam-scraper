# EQUIPZILLA — Guards de arquitectura: garantías legítimas de tests

## Alcance y decisión

Esta revisión afecta exclusivamente al guard de arquitectura de tests y a sus autopruebas. No modifica el motor editorial, las fixtures, los catálogos, el runner, las cuotas de rendimiento ni los tests de dominio. Su propósito es **conservar comprobaciones legítimas de evidencia sin contarlas como deuda arquitectónica**.

Sobre el repositorio integrado hasta la fase 20, la inspección anterior registraba **188 hallazgos**: 168 accesos directos a catálogos, 12 recuentos, 7 accesos transitivos y 1 hash. Tras esta revisión se mantienen **168 infracciones directas** pendientes de migrar. Los 19 usos justificados se reconocen como excepciones exactas y el hash deja de ser un falso positivo.

**Integración posterior a la macrofase 21:** el guard anterior registraba **141 hallazgos** (121 accesos directos, 12 recuentos, 7 dependencias indirectas y 1 hash). Con esta revisión y sin modificar las suites protegidas, registra **121 hallazgos directos pendientes**, **19 excepciones acreditadas** y ningún falso positivo de hash. La cifra de 168 accesos directos corresponde únicamente al corte previo a la macrofase 21.

El guard sigue siendo estricto: no hay baseline, cuota global, directorios ignorados ni `WARN` autorizados. Una nueva dependencia, un nuevo recuento o una excepción que deje de corresponder con su caso exacto vuelve a generar una infracción. El conjunto de 168 accesos directos **no queda exento** por aparecer en archivos que contienen un recuento o fixture acreditados.

## Doce recuentos acreditados

Estas aserciones no fijan el tamaño comercial total del inventario: comprueban unidades individuales o cohortes históricas identificadas, habitualmente junto a una comparación de referencias y a casos de no propagación entre proveedores.

| Prueba                                                                               | Garantía conservada                                                              | Recuento |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------: |
| `src/catalog/normalization/gam/tests/gallery.test.ts`                                | Número de vistas acreditadas del módulo sanitario y descarte de una imagen ajena |        7 |
| `src/preparation/gam/identity/tests/gam-identity-variants.test.ts`                   | Seis referencias concretas con colisiones de número de serie y bloqueo selectivo |        6 |
| `src/preparation/gam/quality/tests/gam-verified-operational-safety.test.ts`          | Prestaciones de seguridad verificadas por unidad                                 |       20 |
| `src/preparation/gam/technical/measurements/gam-clearance-platform.test.ts`          | Unidades con medidas de despeje o plataforma acreditadas, sin contagio a Gomariz |       30 |
| `src/preparation/gam/technical/measurements/gam-qualified-geometry-evidence.test.ts` | Geometría acreditada solamente para unidades identificadas                       |       20 |
| `src/preparation/gam/technical/mobility/gam-traction-braking-evidence.test.ts`       | Evidencia de tracción/frenado por unidad                                         |       21 |
| `src/preparation/gam/technical/mobility/gam-verified-drivetrain-brakes.test.ts`      | Prestaciones de transmisión y frenos demostradas y preservadas                   |       38 |
| `src/preparation/gam/technical/operations/gam-cleaning-tank-evidence.test.ts`        | Recuperaciones de depósitos sin trasladar evidencia a Gomariz                    |       27 |
| `src/preparation/gam/technical/operations/gam-unit-performance-specs.test.ts`        | Unidades con prestaciones técnicas acreditadas                                   |       56 |
| `src/preparation/gam/technical/safety/gam-acoustic-evidence.test.ts`                 | Recuperación de niveles sonoros de las unidades verificadas                      |       22 |
| `src/preparation/gam/technical/safety/gam-verified-operator-controls.test.ts`        | Mandos y controles de presencia acreditados por unidad                           |       25 |
| `src/preparation/gam/technical/tests/gam-verified-tyre-and-noise-details.test.ts`    | Identidades con ruedas y acústica verificadas, sin propagación a Gomariz         |       20 |

Cada excepción se limita **simultáneamente** a la ruta de la prueba, el título del caso y la expresión exacta de la aserción. No excluye otras aserciones del mismo archivo. Un cambio de cohorte, de título o de expresión exige revisar y reacreditar la excepción; no permite silenciar un recuento nuevo.

## Siete dependencias indirectas acreditadas

| Fixture acreditada                                                               | Pruebas consumidoras | Garantía conservada                                                                                                          |
| -------------------------------------------------------------------------------- | -------------------: | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/preparation/gam/technical/tests/support/gam-historical-category-fixture.ts` |                    3 | Clasificación, equivalencias de categorías e interpretación de la condición sobre una muestra histórica identificable de GAM |
| `src/testing/builders/mercaeleva-source-fixture.ts`                              |                    4 | Reconciliación de modelo y especificaciones documentales, incluidas discrepancias semánticas del anuncio original            |

Las tres consumidoras de GAM son `gam-verified-category-equivalences.test.ts`, `gam-categories-condition.test.ts` y `gam-source-category-and-condition.test.ts`. Las cuatro de Mercaeleva son `jlg-450aj-base-model-evidence.test.ts`, `mercaeleva-documented-equipment-technical-specs.test.ts`, `mercaeleva-documented-platform-technical-specs.test.ts` y `source-semantic-quality.test.ts`.

La exención se asigna exclusivamente a esas siete **parejas de prueba y fixture**. Además se comprueba la forma acreditada de la fuente: fixture histórica identificada para GAM, o lectura del único original canónico de Mercaeleva. La excepción exige **una sola dependencia catalogal detectable en la fixture**: si se añade otra, deja de aplicarse y el guard vuelve a informar la dependencia transitiva. Importar otra fixture o ampliar la fuente no queda cubierto por estas autorizaciones. Si una macrofase sustituye la fixture por entradas mínimas equivalentes, la excepción deja de aplicarse y puede retirarse del guard.

Estos accesos están autorizados por su **función de contrato**; ello no implica que sean gratuitos en tiempo de ejecución. Las cuotas del guard de rendimiento siguen siendo independientes. No se deben eliminar tests ni degradar su cobertura por reducir el contador.

## Hash de procedencia: no es hash editorial

En `src/preparation/tests/catalog-publication-consistency.test.ts` se contrasta el SHA-256 de los **bytes originales** con `manifest.source.catalogSha256`. Es un control de integridad de origen, no la inmovilización de una descripción.

El detector `T-FROZEN-EDITORIAL-HASH` ahora exige que el hash se calcule a partir de campos de redacción editorial y se compare contra un literal congelado. La aparición de `description` en otro punto del archivo no basta para dispararlo. No se registra ninguna excepción para este hash legítimo: se ha corregido la clasificación.

## Comprobaciones y continuidad

Desde la raíz del repositorio:

```powershell
node GUARDS/tests-domain-tests-guard.mjs --detail
node --test GUARDS/tests-architecture-guards.test.mjs
node GUARDS/tests-editorial-architecture-guard.mjs
```

Para el corte auditado se esperan **19 excepciones reconocidas**, **168 infracciones directas pendientes** y **0** en las otras tres clases mencionadas. El primer comando **debe seguir devolviendo código 1 mientras queden accesos directos**; no hay un falso PASS. Las autopruebas verifican la excepción exacta, la detección de variantes y la distinción entre hash editorial y manifest de procedencia.

Esta revisión no equivale a validar los 188 tests como correctos ni acredita una ejecución global de `npm test`. Las macrofases deben seguir migrando los accesos directos, preservar la procedencia y demostrar equivalencia de comportamiento. Los 19 usos acreditados se conservan por su contrato, pero pueden sustituirse posteriormente por mecanismos más eficientes con pruebas equivalentes.
