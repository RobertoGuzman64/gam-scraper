# Gobernanza del repositorio — documentación y scripts

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento, otro Markdown, un script, un guard o un comando de `package.json` sin autorización explícita del propietario para el cambio concreto. El permiso para corregir fichas o ejecutar pruebas no concede permiso para ampliar herramientas ni documentación.

**Propietario:** autorización de cambios en la superficie operativa del repositorio. Esta guía no redefine arquitectura, contratos, calidad del catálogo ni procedimientos de publicación.

## Inicio de cualquier intervención

1. Leer `README.md`, esta guía y el documento propietario del trabajo. Para continuar con las fichas, leer `docs/CATALOG_QUALITY.md`; para la operativa de extracción y publicación, `docs/CATALOG_OPERATIONS.md`.
2. Consultar los auditores y guards existentes para establecer el estado real, con su universo, procedencia y límites. Las fuentes no evaluadas nunca cuentan como conformes.
3. Elegir la causa productiva corregible de mayor prioridad conforme al procedimiento del documento propietario, sin abrir frentes nuevos por iniciativa propia.
4. Modificar solo los módulos necesarios, reutilizando los existentes. No crear scripts, documentos, comandos o guards por comodidad.
5. Ejecutar pruebas relevantes y comparar el antes/después sobre poblaciones equivalentes. Si falta evidencia, informar el bloqueo y no inventar una solución ni un `PASS`.

Una petición de análisis o planificación **no autoriza cambios**. Una petición de mejora de fichas autoriza trabajar en el código productivo de ese frente, no alterar contratos, fuentes originales, publicaciones, auditorías o reglas de gobernanza. Las decisiones humanas siguen exigiendo aprobación expresa.

## RULES — DOCUMENTATION

- El inventario de **todos los `.md`** es cerrado: rutas y SHA-256 están en `GUARDS/repository-governance.json`. Se controlan altas, bajas, movimientos y modificaciones, no solo el número total.
- Un único documento debe ser propietario de cada responsabilidad. Los cambios autorizados actualizan el documento existente; no se crean informes de ejecución, diarios de continuidad o documentos históricos por intervención.
- Quedan prohibidos nombres de archivo que identifiquen fases (`FASE_12`, `F12`, `PHASE-12`, `OPERATIVA_F8` y equivalentes), sea cual sea su extensión o directorio. Las fases son una forma temporal de trabajar, no estructura permanente del repositorio.
- Los informes, métricas temporales y capturas viven fuera del árbol versionado; `reports/` no es una fuente de verdad ni una carpeta de documentación permanente.

## RULES — SCRIPTS

- El inventario cerrado incluye los ejecutables, auxiliares y tests bajo `scripts/`, `GUARDS/`, `interventions/`, las entradas de `tools/` o `bin/` y los scripts de la raíz. Se registran rutas y SHA-256.
- Los comandos npm de `package.json` y su campo `bin` también están protegidos. Dar de alta, modificar, eliminar, mover o renombrar cualquiera de esas piezas requiere **autorización explícita y específica**.
- Antes de solicitar autorización, acreditar qué problema productivo no resuelve ninguna pieza existente, quién consumirá el archivo, qué sustituye, cómo se prueba y qué mantenimiento adicional introduce. Se prefiere modificar la responsabilidad ya existente cuando el permiso lo permita.
- El guard **no puede autorizar excepciones por sí mismo**. Una autorización aprobada obliga a actualizar el inventario tras el cambio y a pasar pruebas y guards. No se aceptan listas de exclusión abiertas ni actualización automática de hashes para silenciar errores.

## Contrato verificable y límites

`node GUARDS/tests-repository-governance-guard.mjs` compara el árbol con el inventario; `npm test` lo ejecuta antes del resto. Comprueba las cantidades de Markdown, scripts y comandos, sus rutas y contenidos, los nombres de fases y los archivos versionados bajo `reports/` cuando existe un índice Git.

La protección real contra alteraciones del **propio inventario, el guard o el comando `test`** requiere revisión obligatoria del propietario y controles de integración/ramas protegidas. Un guard local no puede verificar que hubo autorización humana ni impedir que alguien cambie o deje de ejecutar el propio guard; nunca presentar esa limitación como seguridad absoluta.

No se permite aumentar una cuota para hacer desaparecer un fallo. Si un cambio está autorizado, registrar en la revisión la razón, el alcance y la diferencia exacta de inventario, actualizar el contrato y comprobar las pruebas negativas. Si no está autorizado, se rechaza la modificación y se vuelve al código productivo pertinente.

La dirección y prioridades de calidad pertenecen exclusivamente a [Calidad del catálogo](CATALOG_QUALITY.md). No crear aquí un backlog paralelo ni otro sistema de avisos.
