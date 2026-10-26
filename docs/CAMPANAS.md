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

## Secuencia ordinaria

| Paso | Comando | Qué revisar antes de avanzar |
| --- | --- | --- |
| 1. Extraer y preparar | `npm run campana:extraer` | Los tres proveedores deben terminar correctamente; prepara y revisa el mismo lote aislado |
| 2. Consultar incidencias | `npm run campana:revisar` | `Ready`, `Review`, referencia, URL de origen y motivos por proveedor; no fuerza cambios de estado |
| 3. Intervenir, **solo si procede** | `npm run campana:intervenir -- gam --registrar <archivo.ts>` y, tras inspeccionar la simulación, repetir con `--aplicar` | Cambios concretos y acreditados; el script se registra para el lote actual y el original queda intacto |
| 4. Solicitar/acreditar selección | `npm run campana:finalizar` | Revisar el borrador `acreditacion-<sha>.json`; aprobar expresamente las decisiones correctas; repetir el comando |
| 5. Entregar | `npm run campana:entregar` | Confirmar el ZIP del Escritorio y los totales, sin entregar `selection.json` ni los manifests |
| 6. Inspeccionar limpieza | `npm run campana:limpiar` | Lista carpetas y tamaños, pero no elimina nada |
| 7. Cerrar, cuando ya no habrá cambios | `npm run campana:limpiar -- --aplicar` | Revalida el ZIP y la acreditación; conserva los scripts y la entrega |

`campana:extraer` ya invoca la revisión offline al terminar con los tres proveedores completos; `campana:revisar` permite repetir la consulta sin nueva extracción. Si el lote previo está incompleto, investigar primero sus errores. Solo si se decide abandonarlo deliberadamente, iniciar otro con `npm run campana:extraer -- --nueva`. Un `run.json` ambiguo o corrupto no se oculta usando `--nueva`.

Si no existen incidencias que requieran cambios, **omitir el paso 3**. La aprobación editorial del paso 4 sigue siendo imprescindible: la ausencia de `Review` no constituye autorización automática para publicar.

## Acreditación editorial

`campana:finalizar` descubre las preparaciones actuales y crea el borrador en:

`storage/campanas/<id-lote>/editorial/acreditacion-<sha256>.json`

El archivo se inicia con `approved: false`. Revisar fuentes y exclusiones: las fichas en `Review` o con contradicciones deben excluirse con motivo y URL HTTPS vigente; las fichas intervenidas que quedan `ready` requieren una decisión individual de inclusión. Completar `approvalReason` y establecer `approved: true` **solo tras la revisión humana**. No editar `runId`, `sources`, SHA, identidades ni incidencias calculadas. Una nueva preparación o intervención producirá otro borrador; una aprobación antigua no se reutiliza.

Al repetir `npm run campana:finalizar`, se valida la acreditación y se genera la selección interna. También se puede usar `npm run campana:finalizar -- --simular` para comprobar una acreditación ya existente sin escribir resultados. Consultar [Acreditación de campañas](ACREDITACION_CAMPANA.md).

## Entrega y limpieza

`campana:entregar` crea `equipzilla-AAAA-MM-DD.zip` en el **Escritorio real del usuario**, con exactamente `gam-AAAA-MM-DD.json`, `gomariz-AAAA-MM-DD.json` y `mercaeleva-AAAA-MM-DD.json`. Se comprueba el ZIP temporal antes de sustituir el archivo del mismo día. Si falla la aprobación o el ZIP, se conserva la entrega correcta anterior.

**Antes de ejecutar la limpieza con `--aplicar`, decidir si aún se va a corregir o repetir la entrega de ese mismo lote.** Se necesita conservar los catálogos mientras haya trabajo pendiente. La limpieza rechaza entregas no acreditadas, ZIP alterados y carpetas desconocidas, y protege los scripts en `storage/interventions/<id-lote>/scripts/`. Tras el cierre ya no se puede rehacer esa campaña sin volver a extraer.

Los catálogos, manifests, resúmenes y derivados internos se encuentran bajo `storage/`, nunca dentro del ZIP público. El proyecto no importa al backend ni actualiza productos remotos. La limpieza de históricos rastreados por Git es **otra operación explícita**: `npm run limpiar:versionados` (simula) y `npm run limpiar:versionados -- --aplicar` (retira los archivos generados rastreados del árbol de trabajo y registra su borrado en el índice Git); no reescribe el historial.

## Diagnóstico y herramientas avanzadas

`npm run extraer:todos`, `extraer`, `preparar`, `validar`, `cobertura`, `seleccionar`, `intervenir`, `intervenir:preparar` e `intervenir:validar` se mantienen para diagnóstico, mantenimiento y compatibilidad. No son pasos obligatorios del flujo ordinario, y sus rutas explícitas no deben mezclarse entre campañas. Un resultado técnico `Ready` o una simulación no sustituyen la acreditación editorial.

Para clasificar anomalías: si la fuente actual ya no publica una foto, no recuperarla de un histórico; si la fuente sí la publica pero el extractor no la recoge, reparar el parser; si el defecto afecta a un conjunto amplio, corregir la regla de normalización; si es puntual y acreditado, usar [Intervenciones manuales](INTERVENCIONES_CAMPANA.md). Sin evidencia, mantener la revisión pendiente y no fabricar atributos.

Referencias: [Reglas de datos](SCRAPER_DATA_RULES.md), [Validación](VALIDACION.md), [Arquitectura](ARQUITECTURA.md) y [Operación](DESPLIEGUE_AUTOMATICO.md).
