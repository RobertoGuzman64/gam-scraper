# Rendimiento de tests: campañas, entrega y retención

## Fase 2 — reutilización de estados acreditados

Las suites de recuperación y retención necesitan comprobar la integridad de campañas ya entregadas, pero no necesitan repetir la aprobación editorial ni la creación del ZIP en cada escenario. La fixture `createDeliveryFixtures` prepara una única vez por archivo de test cada estado reutilizable:

| Estado | Preparación real y compartida | Uso |
| --- | --- | --- |
| `fixture` | Campaña original acreditada | Fallos anteriores a la aprobación o la entrega |
| `approvedFixture` | Revisión y aprobación editorial | Comprobar la entrega en sí, o casos previos a publicarla |
| `deliveredFixture` | Campaña aprobada y entregada | Recuperación, bloqueo, verificación y conservación de una entrega |
| `successiveDeliveryFixture` | Primera entrega y segunda campaña entregada | Rotación y retención entre dos entregas |

Las variantes se derivan de la precedente mediante `reuseCampaignTestFixture.prepared(nombre, preparar, origen)`. Cada solicitud restaura una **copia aislada** en el workspace del test; las alteraciones no contaminan la semilla ni los siguientes casos. Las operaciones de aprobación, entrega y rotación se ejecutan realmente **una vez al crear la variante**; no se sustituyen por mocks ni por artefactos inventados. Las pruebas que verifican el comportamiento de la propia entrega siguen invocando el flujo real y sus comprobaciones.

No debe reutilizarse un estado posterior para un escenario que tenga que comprobar la transición anterior. Los escenarios de extracción fallida, intervención, selección alterada y limpieza de auxiliares siguen modificando workspaces aislados con sus precondiciones específicas.

## Alcance y validación

- Se conservan las aserciones y los escenarios existentes de `delivery`, `delivery-recovery`, `delivery-recovery-resumption`, `delivery-retention` y `delivery-retention-historic`.
- Se añadieron pruebas del aislamiento entre variantes derivadas y de la recuperación después de una preparación interrumpida.
- `scripts/run-tests.mjs` y el resto del ejecutor no se modifican.
- La medición del 6 de noviembre de 2026 es una referencia anterior a estas optimizaciones, no una medición de rendimiento posterior.
- En el entorno de preparación se ejecutaron correctamente las 6 pruebas de la fixture; TypeScript no informó errores en los archivos modificados. La batería de integración y el build completo no pudieron validarse por la ausencia de `cheerio` y `p-limit` en ese entorno. Es necesario acreditar ambos con las dependencias instaladas.

Después de integrar los cambios, ejecutar `npm ci`, `npm run build` y `npm test` sin caché. Repetir la medición `--medicion` del runner existente en el mismo equipo para poder atribuir ahorros con rigor. El objetivo es disminuir reconstrucciones del entorno, no alterar los contratos de retención, los productos acreditados ni la cobertura.
