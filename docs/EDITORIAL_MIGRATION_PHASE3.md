# EQUIPZILLA — Fase 3: migración de conocimiento editorial histórico

> **Archivo histórico; no es un plan vigente.** Las cifras, fallos, brechas y tareas de continuación de esta página pertenecen exclusivamente al corte de la fase 3. Tras la fase 27 se retiraron los narradores históricos detectados del recorrido productivo y se consolidó una arquitectura de tests con guard en cero. Para trabajar hoy usar [Motor editorial compartido](EDITORIAL_ENGINE.md), [Arquitectura de tests](TEST_ARCHITECTURE.md) y [Arquitectura](ARCHITECTURE.md). No reutilizar los porcentajes o decisiones pendientes de este informe como estado presente.

## Alcance y resultado

La Fase 3 migra **evidencia acreditable** de los 22 conjuntos históricos y habilita su consumo desde el motor editorial común implantado en la Fase 2. Esta fase **no** declara terminada la migración funcional de la matriz de 82 capacidades de la Fase 1: su cierre queda previsto para la Fase 4, sin definir todavía una fase posterior de estabilización.

La generación editorial de producción es común para GAM, Gomariz y Mercaeleva; sus adaptadores conservan la validación del origen. No se reactivan redactores históricos por máquina ni se publica catálogo nuevo en este cambio.

### Conocimiento compartido

| Ámbito | Datos operativos | Restricción |
| --- | --- | --- |
| Familia | 26 perfiles en `data/editorial/knowledge/family-guidance.json` | Texto genérico, sin afirmar configuración no acreditada |
| Modelo | 136 grupos con 424 magnitudes concordantes procedentes de distintas fichas en `model-consensus.json` | Son observaciones del catálogo y **no** fichas de fabricante; se redactan únicamente como referencia condicionada |
| Fabricante / modelo acreditado | Una regla de familia documental en `manufacturer-models.json` | No atribuir propiedades a otra variante o unidad sin prueba |
| Unidad exacta | 383 entradas textuales y 8 títulos acreditados por huella de fuente en `verified-units.json`, para 343 unidades distintas | Requiere proveedor, referencia, URL, marca, modelo y digest SHA-256 del registro original |

En el código, `editorial-knowledge.ts` resuelve ámbitos y `knowledge-editorial.ts` combina el índice con hechos técnicos reconciliados. `prepared-editorial-source.ts` y `prepared-editorial.ts` realizan la composición y selección finales; la validación de huellas se implementa en `infrastructure/filesystem/editorial/knowledge.ts`.

### Procedencia y rechazos

El regenerador `scripts/operations/rebuild-editorial-knowledge.mjs` lee los 22 JSON preservados bajo `data/editorial/evidence/legacy/`. Valida cada candidato contra los **originales** del scraping antes de incorporarlo; los candidatos sin correspondencia exacta se registran en `migration-report.json` y no se aplican.

19 de las 22 colecciones aportan entradas activas; las restantes se conservan y figuran en la cobertura por fuente. Dos contienen textos comerciales con snapshots históricos que ya no coinciden exactamente, y la tercera contiene datos de modelos MB sin una unidad original equivalente y verificable bajo el mismo contrato. **No se han convertido estos datos en verdades de modelo por simple semejanza**.

El contrato de `model-consensus.json` se genera desde los originales, utiliza solo magnitudes concordantes en las fichas donde se declaran y conserva referencias de procedencia. Su evidencia no acredita especificaciones de una unidad entrante. El diagnóstico registra los casos en los que el motor usa esta referencia, sin contabilizarlos como confirmación técnica de unidad.

## Ejecución y controles

Desde la raíz del repositorio:

- `npm run editorial:actualizar-conocimiento`: regenerar índices declarativos tras actualizar originales o evidencias.
- `npm run editorial:verificar-conocimiento`: comprobar sincronía de índices y los tests focales.
- `npm run editorial:auditar-reutilizacion`: evaluar las 1.751 fichas originales sin publicar catálogos.

Indicadores del diagnóstico de Fase 3 (`reports/editorial-phase3/audit.json`): 1.751 originales procesados, 1.706 preparados, 45 en revisión y **0 excepciones**. Aplicación efectiva: 310 generales verificadas de unidad, 189 cortas, 7 títulos, 107 referencias no vinculantes de modelo y 1.042 orientaciones familiares. Permanecen 65 descripciones cortas y 2 generales vacías según el diagnóstico; no se han inventado textos para completar esos huecos.

Controles en este entorno: guard de arquitectura editorial, guard comercial y guard de rendimiento superados; comprobación de índices y 6/6 tests focales de Fase 3 superados; tipos estrictos de las unidades compiladas focalmente, sin errores. La suite editorial histórica registra **21 pruebas correctas y 14 fallidas de 35**, principalmente por precedencias y textos heredados que dejaron de ser activos tras la demolición. La compilación total y `npm test` **no se han acreditado**, porque el entorno no pudo recuperar todas las dependencias npm (`cheerio`, `p-limit` y sus tipos), aunque el código de la migración ha sido compilado y ejecutado de forma focal.

## Continuidad de Fase 4 (decisión histórica)

`reports/editorial-phase3/82-capabilities-traceability.csv` mantiene una fila para cada una de las **82 capacidades originales**. En Fase 3 constan 11 como compartidas, 34 como compartidas con equivalencia histórica pendiente, 30 parciales y 7 pendientes. Estos estados no deben interpretarse como 82 reglas completamente migradas.

La Fase 4 debe finalizar la conversión de reglas aún atrapadas en módulos históricos, reconciliar evidencias no coincidentes sin rebajar controles, distinguir condiciones de variante explícitas y verificar las precedencias semánticas antes de acometer la estabilización posterior. **No devolver los narradores viejos a producción para hacer pasar tests.**
