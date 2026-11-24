# Operación y mantenimiento — entorno, despliegue y recuperación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Nunca convertir simulaciones en activaciones automáticas, atribuir a Manain cobertura no acreditada, sobrescribir referencias para silenciar auditores ni borrar históricos referenciados. Respetar la retención de dos versiones técnicas por proveedor y comprobar integridad antes de retirar.

**Propietario:** ejecución del entorno, despliegue técnico, restauración/migración compatible, seguridad de mantenimiento y referencias históricas. Las campañas mantienen su retención propia en [Campañas](CAMPAIGNS.md), y las publicaciones técnicas sus versiones en [Publicaciones](PUBLICATIONS.md).

## Modelo de ejecución

El repositorio implementa una **CLI que termina tras ejecutar una operación**. No incorpora servidor HTTP, Dockerfile, despliegue cloud, CI/CD ni importación automática al backend. Es posible planificar ejecuciones externas, pero deben conservarse íntegros los resultados y vigilarse sus fallos.

Requisitos operativos: Node.js `>=18.18.0` para el núcleo de la CLI, npm, dependencias instaladas, acceso HTTPS, espacio en disco y permisos sobre `storage/`. Los recorridos de Chrome por DevTools WebSocket necesitan `WebSocket` global (Node.js 22+ o runtime compatible); Manain lo utiliza y Mercaeleva lo utiliza en Windows. En sistemas no Windows Mercaeleva utiliza DevTools Pipe. La ausencia de esa API provoca un error explícito del recorrido afectado, no un cambio automático del requisito general de Node. Mercaeleva y Manain utilizan Chrome/Chromium o un Edge compatible (`CHROME_PATH` o `CHROMIUM_PATH` permiten indicar el ejecutable). Mercaeleva usa modo headless; Manain inicia un navegador visible y puede requerir verificación humana, por lo que no debe presumirse apto para una ejecución desatendida. Las preparaciones canónicas actuales utilizan reglas técnicas versionadas, no los snapshots comerciales de `data/category/` y `data/import/`. Estos snapshots también alimentan la **proyección comercial actual**, que es un circuito separado y no modifica la preparación técnica ni importa al backend.

## Finalidad de automatizar

El objetivo de la automatización es **hacer fiable el flujo productivo completo**, no programar más diagnósticos. Debe reducir pasos manuales, conservar los controles actuales y distinguir un fallo transitorio recuperable, una fuente indisponible, una pérdida de cobertura, un error del motor y un bloqueo editorial. Un lote programado que termina con `PASS` sin comprobar su contenido, su cobertura o la integridad del original no equivale a un catálogo aceptado. Cualquier mejora de automatización debe proteger datos válidos y no asumir aprobación humana; se valida en escenarios de éxito, error y recuperación.

La instrumentación y los informes operativos son medios para reparar el comportamiento de la CLI, los adaptadores o la publicación, no sustitutos de la corrección. Ver [Objetivos](CATALOG_OPERATIONS.md) y [Validación](VALIDATION.md).

## Ejecución controlada

```powershell
npm run extraer:todos -- --simular
npm run extraer:todos -- --proveedores gam,gomariz
```

El lote técnico `extraer:todos` lanza los proveedores indicados **en secuencia**, guarda informes/logs en `storage/runs/` y mantiene las salidas de extracción en `storage/scraped/`. No equivale a `npm run extraer`, que coordina la campaña global, su preparación y revisión. El bloqueo de lote se basa en **filesystem local**: no es distribuido y no evita toda concurrencia con una extracción individual. Evitar ejecuciones solapadas sobre el mismo directorio.

No planificar un proveedor hasta haber acreditado su cobertura y revisado su comportamiento ante páginas vacías, fallos de red, cambios de HTML y límites de paginación. En particular, la presencia de Manain en el registro y en las pruebas no acredita automáticamente la cobertura externa de sus páginas. Los archivos `-partial-*` y los registros de error son evidencia de fallos, no fuentes publicables.

### Windows

El repositorio incluye `scripts/operations/run-scheduled.ps1`. Desde una tarea programada puede invocarse con la ruta real del proyecto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RUTA\REPOSITORIO\scripts\operations\run-scheduled.ps1" -Providers "gam,gomariz"
```

La tarea ejecuta `extraer:todos`, no el flujo completo de campaña. Debe usar una cuenta con permisos y herramientas disponibles, conservar el disco entre ejecuciones, supervisar códigos de salida y **no iniciar otra instancia** si la anterior sigue activa. Para incluir Manain hay que prever una sesión gráfica y la posible verificación humana; no asumir que funcionará sin supervisión.

### Linux

Un planificador externo puede invocar la CLI desde la raíz del proyecto con el usuario autorizado. No hay una configuración de `cron` o `systemd` implementada en este repositorio; crearla requiere aprobación operativa y política de logs, permisos y persistencia.

## Activación técnica no comercial

La operación `npm run publicacion:tecnica -- <proveedor> ...` simula sin escrituras salvo `--activar`, que modifica exclusivamente la selección técnica. Antes de automatizar una activación hay que verificar huellas, origen, disponibilidad de archivos y `npm run estado`. Manain conserva el estado `partial`; no convertirlo en `complete` por conveniencia. La rotación automática protege dos versiones técnicas por proveedor. Ver [Publicaciones técnicas](PUBLICATIONS.md).

## Publicación y recuperación

- Conservar `storage/` entre procesos: catálogos, manifests, snapshots, preparaciones, evidencias y logs.
- Comprobar `run.json` en cada lote y los informes `-summary.json`, `-changes.json` y `-errors.json` por proveedor.
- No asumir cobertura completa porque el informe diga `complete`; contrastar recuentos externos.
- No borrar un lock persistente: para campañas globales, consultar el intento por `runId` con `npm run recuperar -- <runId>`; el abandono explícito rechaza bloqueos de procesos activos y archivos no reconocidos.
- No sobrescribir catálogos válidos por salidas parciales ni borrar originales al corregir la selección editorial.
- Las campañas globales se rotan automáticamente al admitir una nueva, con hasta dos posiciones y conservación de la última entrega acreditada. Una retirada interrumpida se reanuda de forma verificada; puede solicitarse con `npm run recuperar -- --reanudar-rotacion`. No eliminar manualmente `.rotation.json`, sus temporales ni residuos de un lote.
- `npm run limpiar:almacen` mantiene la simulación y `--aplicar` para almacenamiento **individual**, fuera del ciclo normal de campañas globales; exige inspección previa y protección de trabajos abiertos.

El scraper **no** automatiza la creación, actualización o eliminación de productos en Equipzilla. La entrega de un catálogo publicable y su importación son decisiones independientes.

## Infraestructura remota

Cualquier ejecución en contenedores o sistemas efímeros necesita un diseño adicional de **persistencia duradera**, publicación consistente, exclusión mutua distribuida, monitorización y gestión de Chromium. Un montaje remoto no debe presumirse equivalente a un filesystem POSIX local. Ninguna infraestructura remota está ya configurada por el repositorio.

Antes de automatizar, completar la [validación de fuentes](VALIDATION.md) y obtener aprobación explícita para los proveedores y el entorno elegidos.

## Alcance

Esta guía describe **la arquitectura existente**, no propone otra reorganización. Refleja la composición técnica/editorial y la clasificación por proveedor actuales, además de los mecanismos de persistencia, publicación, runner y salida consolidados. Los informes históricos no sustituyen la revisión del código vigente. Para el mapa general, ver [Arquitectura](ARCHITECTURE.md).

## Persistencia, recuperación y retención

- `storage/` es operativo y permanece fuera de Git. `catalogs/` contiene datos portátiles versionables y verificables; `estado` es observacional, no crea aprobaciones.
- La campaña global admite **dos posiciones retenidas** y protege la activa y la anterior conforme a sus referencias. No aplicar una limpieza basándose solo en el nombre de una carpeta.
- `portable-campaign-inspection.ts` verifica rutas y archivos antes de que `portable-campaign.ts` consolide o retire. Las carpetas o symlinks sospechosos son motivo de bloqueo, no de limpieza automática.
- `catalog-retention-references.ts` protege históricos que estén referenciados por huellas/acreditaciones; `campaign-cleanup-validation.ts` define qué rutas y artefactos pueden retirarse.
- Las operaciones `--simular` o `--dry-run` no deben producir escrituras. Para reparar fallos, usar los procedimientos de recuperación existentes, no borrar a mano manifests, históricos o diarios.

## Compatibilidad histórica y referencias legadas

### Responsabilidad frente a incidencias de referencia

El almacén heredado y los comandos de traslado sirven a **compatibilidad, recuperación y comparación**, no constituyen la solución a problemas de calidad del scraper. Una referencia desactualizada, una transacción incompleta o una huella inconsistente exige comprobar y, si hay defecto repetible, **reparar el mecanismo productivo** preservando la última copia válida; no sustituir a mano hashes o archivos para que la consulta muestre `PASS`. Para el ciclo vigente se usa la referencia acreditada de campaña, no se crea trabajo periódico de actualización del legado. Ver [Objetivos](CATALOG_OPERATIONS.md).

### Comandos de compatibilidad

```text
npm run referencia
npm run referencia -- --actualizar
npm run referencia -- --recuperar
npm run referencia -- --exportar <carpeta-nueva>
npm run referencia -- --importar <carpeta-existente>
npm run referencia -- --importar <carpeta-existente> --sustituir
```

- Sin argumentos: **solo lectura** del almacén legado. Comprueba huellas SHA-256, manifest, diferencias y catálogos; no exige una campaña activa. Una referencia ausente es normal; una inválida produce error y una recuperable se señala sin repararla.
- `--actualizar`: mecanismo **legado opcional** desde una campaña acreditada y entregada. No es un paso de la operación normal ni requisito para comparar el siguiente lote.
- `--recuperar`: repara explícitamente una transacción de referencia interrumpida si existe respaldo íntegro. Una transacción inválida o recuperable puede bloquear la rotación; no borrarla para desbloquear el ciclo.
- `--exportar`: crea una carpeta nueva con los archivos verificados (seis en el formato de cuatro proveedores o cinco en el histórico de tres), sin sobrescribir el destino. Guardar fuera del repositorio y solo para operadores autorizados.
- `--importar`: valida la copia y la instala transaccionalmente; no sustituye una referencia presente salvo con `--sustituir`. Si hay transacciones incompatibles o datos corruptos, bloquea el reemplazo sin borrados.

`node scripts/maintenance/migrate-storage.mjs` es una migración de **rutas heredadas** (`data/referencia/`, `diferencias.json`), no un paso de instalación nueva ni de la rotación. Ejecutarla solo al actualizar una instalación antigua que use esos nombres y tras verificar que no haya campañas o transacciones abiertas. Para una copia externa antigua admite `--transfer <carpeta-externa>`; las importaciones ordinarias usan el formato de nombres vigente.

Las operaciones de exportación/importación trasladan **solo la referencia legada**, no las campañas, sus catálogos originales retenidos, selecciones ni recibos de entrega. No son un mecanismo de copia de seguridad integral del ciclo actual y no envían archivos por red. Para operar una campaña normal no hace falta utilizar estos comandos.

### Política de Git

La referencia es **operativa, local y no versionada por defecto**. `.gitignore` excluye `data/reference/` y las carpetas/archivos de transacción `.reference-*` bajo `data/`. Los snapshots comerciales heredados `data/category/` y `data/import/` permanecen versionables, pero no condicionan la preparación canónica actual. No se generan históricos paralelos en el repositorio.

`.gitignore` **no desindexa archivos ya rastreados**. Para comprobar el repositorio local ejecutar `git ls-files -- data/reference/`. Si aparecen archivos de referencia, el propietario debe decidir y aplicar una sola retirada del índice con `git rm -r --cached -- data/reference/`, revisar `git status` y registrar ese cambio; `--cached` conserva los archivos de trabajo. No ejecutar retirada automática del índice durante la instalación, consulta ni actualización de la referencia. El archivo ZIP de origen no incluye `.git`, por lo que no acredita el estado real del índice del usuario.

Una instalación nueva sin referencia ni entrega retenida puede iniciar un lote y compararlo como inventario inicial. Las campañas entregadas conservan sus originales mientras estén retenidas, sin actualización ni limpieza manual ordinaria. La exportación/importación legada no sustituye un respaldo integral de las campañas y sus acreditaciones.
