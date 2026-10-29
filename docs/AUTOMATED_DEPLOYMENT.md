# Operación y despliegue

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Modelo de ejecución

El repositorio implementa una **CLI que termina tras ejecutar una operación**. No incorpora servidor HTTP, Dockerfile, despliegue cloud, CI/CD ni importación automática al backend. Es posible planificar ejecuciones externas, pero deben conservarse íntegros los resultados y vigilarse sus fallos.

Requisitos operativos: Node.js `>=20.18.1`, npm, dependencias instaladas, acceso HTTPS, espacio en disco y permisos sobre `storage/`. Mercaeleva y Manain utilizan Chrome/Chromium o un Edge compatible (`CHROME_PATH` o `CHROMIUM_PATH` permiten indicar el ejecutable). Mercaeleva usa modo headless; Manain inicia un navegador visible y puede requerir verificación humana, por lo que no debe presumirse apto para una ejecución desatendida. Las preparaciones canónicas actuales utilizan reglas técnicas versionadas, no los snapshots comerciales de `data/category/` y `data/import/`. Estos permanecen solo para funciones heredadas que los requieran.

## Ejecución controlada

```powershell
npm run extraer:todos -- --simular
npm run extraer:todos -- --proveedores gam,gomariz
```

El lote técnico `extraer:todos` lanza los proveedores indicados **en secuencia**, guarda informes/logs en `storage/runs/` y mantiene las salidas de extracción en `storage/scraped/`. No equivale a `npm run extraer`, que coordina la campaña global, su preparación y revisión. El bloqueo de lote se basa en **filesystem local**: no es distribuido y no evita toda concurrencia con una extracción individual. Evitar ejecuciones solapadas sobre el mismo directorio.

No planificar un proveedor hasta haber acreditado su cobertura y revisado su comportamiento ante páginas vacías, fallos de red, cambios de HTML y límites de paginación. En particular, la presencia de Manain en el registro y en las pruebas no acredita automáticamente la cobertura externa de sus páginas. Los archivos `-partial-*` y los registros de error son evidencia de fallos, no fuentes publicables.

### Windows

El repositorio incluye `scripts/run-scheduled.ps1`. Desde una tarea programada puede invocarse con la ruta real del proyecto:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RUTA\REPOSITORIO\scripts\run-scheduled.ps1" -Providers "gam,gomariz"
```

La tarea ejecuta `extraer:todos`, no el flujo completo de campaña. Debe usar una cuenta con permisos y herramientas disponibles, conservar el disco entre ejecuciones, supervisar códigos de salida y **no iniciar otra instancia** si la anterior sigue activa. Para incluir Manain hay que prever una sesión gráfica y la posible verificación humana; no asumir que funcionará sin supervisión.

### Linux

Un planificador externo puede invocar la CLI desde la raíz del proyecto con el usuario autorizado. No hay una configuración de `cron` o `systemd` implementada en este repositorio; crearla requiere aprobación operativa y política de logs, permisos y persistencia.

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
