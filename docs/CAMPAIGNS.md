# Protocolo operativo de campañas completas

## AI GUARD

**Protección documental.** No modificar, eliminar ni regenerar esta guía sin autorización expresa del propietario para la intervención documental concreta. Cambios de código, auditorías o correcciones puntuales no implican autorización documental.

## Objetivo y alcance

Una campaña ordinaria incluye **GAM, Gomariz y Mercaeleva**, todos los proveedores exigidos actualmente para la entrega. Las extracciones limitadas por proveedor, categoría o número de páginas son auxiliares: **nunca se consideran una campaña global publicable**. Si se incorporan proveedores nuevos al registro habrá que adaptar también el contrato editorial y de entrega antes de dar por cerrada una campaña.

La operación habitual no requiere recuperar JSON históricos, copiar SHA, adivinar rutas ni preparar tres catálogos a mano. Todo se ejecuta desde la raíz del repositorio.

## Instalación inicial

Se necesita Node.js >=18.18.0, npm, acceso a los portales, permisos de escritura y Chrome/Chromium para el extractor que lo requiera. En una copia nueva:

```powershell
npm ci
npm run iniciar
```

`iniciar` comprueba dependencias y referencias de `data/`, crea carpetas de trabajo y descubre el último lote mediante `run.json`, manifiestos y huellas. No realiza extracción ni publicación. Si falta una dependencia, ejecutar `npm ci` desde la raíz. Consultar `npm run ayuda` para todas las opciones.

## Consulta y efectos de los comandos

`npm run estado` comprueba en **solo lectura** el lote, sus preparaciones, la acreditación editorial, el justificante/ZIP de entrega cuando existe y la referencia operativa. Sugiere el siguiente comando según las comprobaciones reales: borrador pendiente, decisiones válidas sin aprobar, selección pendiente, entrega acreditada o referencia que ya coincide con el lote. Una referencia válida del mismo lote no se pide actualizar de nuevo. Los avisos de entrega no verificable impiden considerarla lista para limpiar o actualizar.

`npm run iniciar` comprueba el entorno **y puede crear directorios de trabajo**. `revisar` puede crear preparaciones cuando faltan; no se debe confundir con `estado`. `comparar`, `referencia` sin argumentos y los modos `--listar`, `--consultar` y `--validar` de la acreditación consultan sin escribir. `acreditar` sin argumentos crea el borrador o la selección cuando corresponde. `--decidir` escribe decisiones; `--aprobar`, `--actualizar` y `--aplicar` siguen siendo autorizaciones explícitas y distintas.

## Secuencia ordinaria

| Paso                                  | Comando                                                                                                                                                                 | Qué revisar antes de avanzar                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Consultar situación                | `npm run estado`                                                                                                                                                        | Estado y siguiente comando sin escrituras; puede usarse entre cualquier paso                                                                |
| 1. Extraer y preparar                 | `npm run extraer`                                                                                                                                                       | Los tres proveedores deben terminar correctamente; prepara y revisa el mismo lote aislado                                                   |
| 2. Consultar incidencias              | `npm run revisar`                                                                                                                                                       | `Ready`, `Review`, referencia, URL de origen y motivos por proveedor; no fuerza cambios de estado                                           |
| 3. Comparar inventarios               | `npm run comparar`                                                                                                                                                      | Altas, ausencias y modificaciones respecto a la referencia única; solo lee catálogos originales completos, no publica ni guarda nada        |
| 4. Intervenir, **solo si procede**    | `npm run intervenir -- gam --listar` y después `--script interventions/gam/6002.ts`; aplicar **solo** tras revisar la simulación, repitiendo el comando con `--aplicar` | Scripts versionados y elegidos manualmente; no se registran por lote y el original queda intacto                                            |
| 5. Solicitar/acreditar selección      | `npm run acreditar`                                                                                                                                                     | Consultar `--listar`, decidir con `--decidir`, revisar `--validar` y aprobar con `--aprobar --motivo`; repetir el comando                   |
| 6. Entregar                           | `npm run entregar`                                                                                                                                                      | Confirmar el ZIP del Escritorio y los totales, sin entregar `selection.json` ni los manifests                                               |
| 7. Actualizar referencia              | `npm run referencia -- --actualizar`                                                                                                                                    | **Orden explícita**, después de acreditar y entregar, antes de limpiar; conserva los catálogos originales completos de los tres proveedores |
| 8. Inspeccionar limpieza              | `npm run limpiar`                                                                                                                                                       | Lista carpetas y tamaños, pero no elimina nada                                                                                              |
| 9. Cerrar, cuando ya no habrá cambios | `npm run limpiar -- --aplicar`                                                                                                                                          | Revalida el ZIP y la acreditación; conserva los scripts históricos y la entrega                                                             |

El paso 3 es de solo lectura y puede repetirse tantas veces como sea necesario. La comparación de un lote sin referencia previa indica **referencia inicial**, sin inventar altas. En lotes posteriores diferencia por proveedor altas, ausencias, cambios y coincidencias. Una ausencia de inventario **no** demuestra una venta ni retira scripts de intervención; una ficha excluida editorialmente pero extraída sigue presente en el catálogo completo.

El paso 7 es una actualización **voluntaria**, pero si se desea conservar la referencia para comparar la siguiente campaña hay que ejecutarlo **antes de la limpieza**: después se habrán eliminado los catálogos originales necesarios. `--actualizar` no evita ni sustituye la acreditación o la entrega; el programa las vuelve a comprobar. Guarda únicamente los tres catálogos, `manifest.json` y el último `differences.json` en `data/reference/`, sustituyendo la referencia anterior con recuperación ante fallos. No se acumulan campañas ni informes. `limpiar` no exige tener referencia, no la actualiza automáticamente y no bloquea una entrega válida por simples diferencias de inventario.

`extraer` ya invoca la revisión offline al terminar con los tres proveedores completos; `revisar` permite repetir la consulta sin nueva extracción. Si el lote previo está incompleto, investigar primero sus errores. Solo si se decide abandonarlo deliberadamente, iniciar otro con `npm run extraer -- --nueva`. Un `run.json` ambiguo o corrupto no se oculta usando `--nueva`.

Si no hacen falta comparaciones de inventario en ese momento, se puede omitir el paso 3; la referencia se actualizará de forma explícita solo cuando se desee conservarla. La aprobación editorial sigue siendo imprescindible: la ausencia de `Review` no constituye autorización automática para publicar.

## Acreditación editorial

`acreditar` descubre las preparaciones actuales y crea el borrador en:

`storage/campaigns/<id-lote>/editorial/accreditation-<sha256>.json`

El archivo se inicia con `approved: false`. Consultar sus decisiones con `npm run acreditar -- --listar` y cada ficha con `--consultar <proveedor> <referencia>`. Las fichas `Review` o con contradicciones solo pueden excluirse; las intervenidas que siguen `ready` permiten decidir expresamente inclusión o exclusión. Registrar cada decisión mediante `--decidir <proveedor> <referencia> <excluir|incluir> --motivo "..." --evidencia <url-https>`, incluyendo la URL original y todas las evidencias necesarias. **No editar el JSON, sus SHA, identidades ni incidencias calculadas.** Ejecutar `--validar` para conocer los fallos de todo el conjunto; después de revisarlo humanamente, aprobar con `--aprobar --motivo "..."`. Ningún comando aprueba por defecto. Una nueva preparación o intervención produce otro borrador y no reutiliza la aprobación antigua.

Al repetir `npm run acreditar`, se valida la acreditación y se genera la selección interna. También se puede usar `npm run acreditar -- --simular` para comprobar una acreditación ya existente sin escribir resultados. Consultar [Acreditación de campañas](CAMPAIGN_ACCREDITATION.md).

## Entrega y limpieza

`entregar` crea `equipzilla-AAAA-MM-DD.zip` en el **Escritorio real del usuario**, con exactamente `gam-AAAA-MM-DD.json`, `gomariz-AAAA-MM-DD.json` y `mercaeleva-AAAA-MM-DD.json`. Se comprueba el ZIP temporal antes de sustituir el archivo del mismo día. Si falla la aprobación o el ZIP, se conserva la entrega correcta anterior.

**Antes de ejecutar la limpieza con `--aplicar`, decidir si aún se va a corregir o repetir la entrega de ese mismo lote.** Se necesita conservar los catálogos mientras haya trabajo pendiente. La limpieza rechaza entregas no acreditadas, ZIP alterados y carpetas desconocidas, y protege las carpetas de scripts históricos en `storage/interventions/<id-lote>/scripts/` para mantener compatibilidad. Los scripts nuevos viven en `interventions/<proveedor>/` y nunca se limpian con una campaña. Tras el cierre ya no se puede rehacer esa campaña sin volver a extraer.

Los catálogos, manifests, resúmenes y derivados internos se encuentran bajo `storage/`, nunca dentro del ZIP público. La referencia operativa se conserva por separado en `data/reference/` y contiene los tres catálogos originales completos, el manifiesto de integridad y el último informe. No debe usarse como entrada de tests ni sustituye el contenido entregado. El proyecto no importa al backend ni actualiza productos remotos. La limpieza de históricos rastreados por Git es **otra operación explícita**: `npm run limpiar:versionados` (simula) y `npm run limpiar:versionados -- --aplicar` (retira los archivos generados rastreados del árbol de trabajo y registra su borrado en el índice Git); no reescribe el historial.

## Diagnóstico y herramientas avanzadas

`npm run extraer:todos`, `extraer`, `preparar`, `validar`, `cobertura`, `seleccionar`, `intervenir`, `intervenir:preparar` e `intervenir:validar` se mantienen para diagnóstico, mantenimiento y compatibilidad. No son pasos obligatorios del flujo ordinario, y sus rutas explícitas no deben mezclarse entre campañas. Un resultado técnico `Ready` o una simulación no sustituyen la acreditación editorial.

Para clasificar anomalías: si la fuente actual ya no publica una foto, no recuperarla de un histórico; si la fuente sí la publica pero el extractor no la recoge, reparar el parser; si el defecto afecta a un conjunto amplio, corregir la regla de normalización; si es puntual y acreditado, usar [Intervenciones manuales](CAMPAIGN_INTERVENTIONS.md). Sin evidencia, mantener la revisión pendiente y no fabricar atributos.

Referencias: [Reglas de datos](SCRAPER_DATA_RULES.md), [Validación](VALIDATION.md), [Arquitectura](ARCHITECTURE.md) y [Operación](AUTOMATED_DEPLOYMENT.md).
