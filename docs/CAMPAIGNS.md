# Protocolo operativo de campañas completas

## AI GUARD

**Protección documental.** No modificar, eliminar ni regenerar esta guía sin autorización expresa del propietario para la intervención documental concreta. Cambios de código, auditorías o correcciones puntuales no implican autorización documental.

## Objetivo y alcance

Una campaña ordinaria bajo el contrato actual incluye **GAM, Gomariz, Mercaeleva y Manain** (`CAMPAIGN_PROVIDERS`). Las extracciones limitadas por proveedor, categoría o número de páginas son auxiliares: **nunca constituyen una campaña global publicable**. La integración de Manain en el contrato y en las pruebas no demuestra por sí sola que su cobertura en la web esté acreditada: las páginas problemáticas deben tratarse con evidencia y no pueden contarse como fichas obtenidas.

La operación habitual no requiere recuperar JSON históricos, copiar SHA, adivinar rutas ni preparar los cuatro catálogos a mano. Todo se ejecuta desde la raíz del repositorio.

## Instalación inicial

Se necesita Node.js >=20.18.1, npm, acceso a los portales, permisos de escritura y un navegador Chrome/Chromium o Edge compatible para Mercaeleva y Manain. Mercaeleva usa navegador headless; Manain inicia una ventana visible que puede requerir verificación humana. En una copia nueva:

```powershell
npm ci
npm run iniciar
```

`iniciar` comprueba dependencias y referencias de `data/`, crea carpetas de trabajo y descubre el último lote mediante `run.json`, manifiestos y huellas. No realiza extracción ni publicación. Si falta una dependencia, ejecutar `npm ci` desde la raíz. Consultar `npm run ayuda` para todas las opciones.

## Consulta y efectos de los comandos

`npm run estado` inspecciona el lote y su acreditación local sin modificar campañas. Advierte de referencias heredadas inválidas o recuperables. `iniciar` puede crear directorios y `revisar` preparaciones; `comparar` es una consulta sin escritura. `referencia` sin argumentos continúa disponible para inspección del almacén legado, pero ya no forma parte del recorrido ordinario. `acreditar` crea o verifica el borrador y la selección; `--decidir` y `--aprobar` requieren decisiones humanas explícitas.

## Secuencia ordinaria

| Paso                              | Comando                                                              | Condición de avance                                                                              |
| --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 0. Inspeccionar                   | `npm run estado`                                                     | Identificar lote y bloqueos sin escritura de datos de campaña                                    |
| 1. Extraer y preparar             | `npm run extraer`                                                    | Los cuatro proveedores deben terminar y tener canónicos verificables                             |
| 2. Revisar                        | `npm run revisar`                                                    | Examinar incidencias y procedencia de cada proveedor                                             |
| 3. Comparar, si procede           | `npm run comparar`                                                   | Examinar originales frente a la última entrega válida retenida o referencia histórica íntegra    |
| 4. Intervenir, solo con evidencia | `npm run intervenir -- gam --listar` y simulación del script elegido | Aplicar únicamente una intervención justificada y revisada                                       |
| 5. Acreditar                      | `npm run acreditar`                                                  | Completar decisiones con `--decidir`, revisar con `--validar` y aprobar con `--aprobar --motivo` |
| 6. Entregar                       | `npm run entregar`                                                   | Verificar el ZIP y sus totales; el recibo local acredita la entrega                              |
| 7. Consultar cierre               | `npm run estado`                                                     | Comprobar la entrega; no actualizar referencia ni limpiar manualmente                            |

La comparación no equivale a selección editorial: una ficha excluida pero extraída sigue en el universo original. Una ausencia no equivale a una venta. La aprobación humana es obligatoria incluso cuando no hay fichas `Review`.

`extraer` prepara y revisa tras extraer los cuatro proveedores. Si existe una campaña incompleta, hay que consultar su `runId` y decidir explícitamente cómo tratarla. `npm run extraer -- --nueva` permite solicitar otro lote según el estado, pero **no autoriza a borrar la campaña fallida ni trabajos pendientes**. Un historial ambiguo o con rutas no reconocidas bloquea la admisión.

## Conservación y recuperación

La retención global admite como máximo **dos campañas**: la última válida y la actual. Cuando ambas posiciones están ocupadas, la admisión de una nueva extracción comprueba **por `runId`** las entregas de ambas y rota la más antigua solamente si no hay riesgo para la conservada. No se borran por anticipado los catálogos, manifests, resúmenes, CSV, acreditaciones o derivados de una campaña retenida. La retirada se restringe a las rutas conocidas de esa campaña; las extracciones independientes `storage/scraped/<proveedor>/` —incluido el parcial de Manain— y los scripts versionados quedan fuera. Las salidas de campañas históricas en carpetas compartidas no autorizan borrar esos originales.

Si un lote falla o se interrumpe, los siguientes comandos actúan sobre **el identificador exacto**, sin seleccionar otra campaña por ser más reciente:

```powershell
npm run recuperar -- <runId>
npm run recuperar -- --recuperar <runId>
npm run recuperar -- --abandonar <runId> --confirmar <runId>
npm run recuperar -- --reanudar-rotacion
```

La consulta inicial no elimina nada. `--recuperar` solo completa un lote interrumpido cuando **los cuatro** catálogos y sus evidencias son íntegros. Si la extracción quedó parcial, `--abandonar` exige repetir el `runId` para autorizar su retirada; se bloquea si hay trabajo editorial, datos desconocidos o un bloqueo de proceso activo. Esto incluye lotes sin proveedores registrados y carpetas de extracción aisladas creadas antes del primer `run.json`, siempre que puedan vincularse inequívocamente al `runId`. Nunca se eliminan originales compartidos ni trabajos individuales.

La retirada registra su estado en `storage/scraped/campaigns/.rotation.json` mediante escritura temporal y renombrado atómico. Si se interrumpe, la siguiente admisión intenta reanudarla con las mismas comprobaciones; `npm run recuperar -- --reanudar-rotacion` permite solicitarlo expresamente. Un temporal incompleto y regular se descarta sin eliminar campañas. Un registro inválido, rutas ajenas, bloqueos activos o una entrega conservada no verificable hacen que la operación **se detenga sin borrar más datos**. No borrar locks, temporales o archivos de campaña manualmente para superar ese control.

## Acreditación editorial

`acreditar` descubre las preparaciones actuales y crea el borrador en:

`storage/campaigns/<id-lote>/editorial/accreditation-<sha256>.json`

El archivo se inicia con `approved: false`. Consultar sus decisiones con `npm run acreditar -- --listar` y cada ficha con `--consultar <proveedor> <referencia>`. Las fichas `Review` o con contradicciones solo pueden excluirse; las intervenidas que siguen `ready` permiten decidir expresamente inclusión o exclusión. Registrar cada decisión mediante `--decidir <proveedor> <referencia> <excluir|incluir> --motivo "..." --evidencia <url-https>`, incluyendo la URL original y todas las evidencias necesarias. **No editar el JSON, sus SHA, identidades ni incidencias calculadas.** Ejecutar `--validar` para conocer los fallos de todo el conjunto; después de revisarlo humanamente, aprobar con `--aprobar --motivo "..."`. Ningún comando aprueba por defecto. Una nueva preparación o intervención produce otro borrador y no reutiliza la aprobación antigua.

Al repetir `npm run acreditar`, se valida la acreditación y se genera la selección interna. También se puede usar `npm run acreditar -- --simular` para comprobar una acreditación ya existente sin escribir resultados. Consultar [Acreditación de campañas](CAMPAIGN_ACCREDITATION.md).

## Entrega y rotación

`entregar` crea `equipzilla-AAAA-MM-DD-<runId>.zip` en el **Escritorio real** con exactamente `gam-AAAA-MM-DD.json`, `gomariz-AAAA-MM-DD.json`, `mercaeleva-AAAA-MM-DD.json` y `manain-AAAA-MM-DD.json`. Comprueba el ZIP temporal y crea el destino sin sobrescribir uno existente, incluso si se realizan dos entregas el mismo día. Un `runId` ya entregado no puede volver a entregarse. El recibo `storage/campaigns/<runId>/delivery.json` y las evidencias de selección permiten verificar la acreditación local sin exigir que el ZIP continúe en el Escritorio; cuando el ZIP está disponible, puede contrastarse físicamente con ese mismo recibo. La ausencia del ZIP no equivale a acreditación perdida.

Los originales, sus manifiestos y la procedencia editorial permanecen mientras la campaña esté retenida. **No hay `npm run limpiar` ni actualización manual de `data/reference/` en el ciclo normal.** La próxima admisión rota automáticamente la campaña más antigua solo si las entregas correspondientes están acreditadas y los archivos pertenecen al inventario permitido. Ante incertidumbre, se conserva todo y la admisión se bloquea, con recuperación explícita por `runId` cuando proceda.

`data/reference/` continúa admitiendo lecturas y traslado de referencias heredadas, incluidas las de tres proveedores; no es una segunda copia que haya que refrescar semanalmente. Las campañas históricas verificables de tres proveedores son aptas como base de comparación, pero **toda entrega nueva exige cuatro**. No se fuerza a Manain a aparecer en históricos donde no existía.

Los catálogos, manifests y decisiones internas están bajo `storage/`, fuera del ZIP público. Los scripts permanentes siguen en `interventions/<proveedor>/` y no forman parte de la rotación. `npm run limpiar:almacen` es un mantenimiento distinto, de salidas individuales, y no un paso de campaña. `npm run limpiar:versionados` y `npm run limpiar:versionados -- --aplicar` actúan sobre históricos rastreados por Git; tampoco realizan rotaciones ni reescriben el historial de Git. El scraper no importa al backend ni actualiza productos remotos.

## Diagnóstico y herramientas avanzadas

`npm run extraer:todos`, `extraer`, `preparar`, `validar`, `cobertura`, `seleccionar`, `intervenir`, `intervenir:preparar` e `intervenir:validar` se mantienen para diagnóstico, mantenimiento y compatibilidad. No son pasos obligatorios del flujo ordinario, y sus rutas explícitas no deben mezclarse entre campañas. Un resultado técnico `Ready` o una simulación no sustituyen la acreditación editorial. En preparaciones nuevas, `ready/review` expresa **calidad técnica de origen**, no resolución de categorías o atributos comerciales del backend.

Para clasificar anomalías: si la fuente actual ya no publica una foto, no recuperarla de un histórico; si la fuente sí la publica pero el extractor no la recoge, reparar el parser; si el defecto afecta a un conjunto amplio, corregir la regla de normalización; si es puntual y acreditado, usar [Intervenciones manuales](CAMPAIGN_INTERVENTIONS.md). Sin evidencia, mantener la revisión pendiente y no fabricar atributos.

Referencias: [Reglas de datos](SCRAPER_DATA_RULES.md), [Validación](VALIDATION.md), [Arquitectura](ARCHITECTURE.md) y [Operación](AUTOMATED_DEPLOYMENT.md).
