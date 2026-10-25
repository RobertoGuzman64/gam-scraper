# Despliegue y ejecución programada — Equipzilla Scraper

## AI GUARD

**Documentación protegida.** Ninguna IA debe crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para esa intervención documental. Una petición sobre código, tests o auditorías no autoriza cambios documentales implícitos.

Guía para infraestructura basada en el código actual. **No hay Dockerfile, CI/CD, despliegue cloud, almacenamiento remoto ni importación automática implementados** en este repositorio. Antes de programar extracciones, completar [VALIDACION.md](VALIDACION.md).

## Qué se despliega

- **Runtime:** Node.js `>=18.18.0`, npm y proyecto TypeScript compilado con `tsc` a `dist/` (ESM). Dependencias de ejecución: Cheerio y `p-limit`.
- **Proceso:** CLI que termina después de extraer; **no** abre puerto HTTP ni requiere servicio web.
- **Acceso exterior:** HTTPS a portales; Mercaeleva puede utilizar Chrome/Chromium headless (`--dump-dom`) mediante `child_process` y `CHROME_PATH`/`CHROMIUM_PATH`.
- **Puntos de entrada reales:** `node dist/cli/index.js scrape <id>`, `node dist/cli/index.js batch` o, para el lote compilado, `node dist/cli/index.js scrape all`. El lote crea procesos hijos mediante `dist/cli/scrape.js`.
- **En desarrollo:** los scripts `npm run scrape -- <id>`, `npm run scrape -- all` y `npm run scrape:all` **compilan antes de arrancar**. Para producción compilada puede invocarse Node directamente.
- **Persistencia:** `storage/scraped/` (CSV/JSON, snapshots, bloqueo) y `storage/runs/` (historial, logs e informes). Los snapshots de entrada `data/category/` y `data/import/` también deben existir en el directorio de ejecución.

El lote únicamente recopila fuentes. **No envía datos a Marketplace-Back** ni llama al importador de Excel.

## Opción sencilla: servidor o VM con disco persistente

Es la alternativa con menos incompatibilidades: la publicación utiliza escrituras y renombrados atómicos en disco local y el lote usa `open(..., "wx")` para el lock. Requisitos: permisos de escritura, espacio suficiente, conectividad HTTPS, Chrome/Chromium para el proveedor que lo necesite y monitorización.

Preparación desde la raíz real del repositorio:

```bash
npm ci
npm test
npm run build
npm run scrape -- all --dry-run
```

Antes de programar, ejecutar manualmente **solo los proveedores aceptados**, por ejemplo:

```bash
npm run scrape -- all --providers gam,gomariz
```

Ese ejemplo es una selección operativa, **no una declaración de que GAM o Gomariz estén aceptados**. Examinar `storage/runs/<run>/run.json`, los logs individuales y los archivos `<prefijo>-summary.json` y `-changes.json`. El sistema debe conservar `storage/` entre reinicios y ejecuciones.

### Windows

El repositorio contiene `scripts/run-scheduled.ps1`, que se sitúa en la raíz y ejecuta el alias `scrape:all`:

```powershell
npm ci
npm test
npm run scrape -- all --dry-run
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RUTA\DEL\REPO\scripts\run-scheduled.ps1" -Providers "gam,gomariz"
```

En el Programador de tareas, usar cuenta autorizada con Node/npm/Chrome disponibles, disco persistente, código de salida supervisado y política de **no iniciar otra instancia**. Mantener el equipo encendido durante la ejecución.

### Linux

Un `cron` o unidad `systemd` puede ejecutar desde la raíz del proyecto un comando aceptado, con usuario específico y registro del código de salida. Ejemplo de comando manual (sin fijar horarios ni habilitar automatización):

```bash
cd /ruta/real/equipzilla-scraper
npm run scrape -- all --providers gam,gomariz
```

No ejecutar simultáneamente dos lotes sobre el mismo `storage/`; la protección `.batch.lock` solo funciona con filesystem local compatible. La extracción individual no está cubierta por ese bloqueo.

## Opción futura: Cloud Run Jobs + Cloud Scheduler

Puede encajar con un scraper CLI por lotes, **pero necesita trabajo de infraestructura y pruebas**, no basta con subir el repositorio. Diseño propuesto:

```text
Cloud Scheduler (solo tras autorización)
        ↓
Cloud Run Job (Node.js + Chromium, un ejecutor)
        ↓
Publicación segura hacia almacenamiento duradero
        ↓
Auditoría y aprobación separada del importador de altas
```

Pendientes necesarios:

1. Construir Dockerfile e imagen con binario Chromium, Node y dependencias necesarias, `dist/` compilado y snapshots `data/` disponibles.
2. Determinar identidad de servicio, permisos mínimos, región y estrategia de persistencia de CSV, JSON, snapshots e historial.
3. Diseñar exclusión mutua entre instancias y publicación consistente. El lock `.batch.lock` **no es distribuido**.
4. No tratar Cloud Storage FUSE como un filesystem POSIX idéntico: verificar las operaciones de escritura/renombrado y bloquear concurrencia. Preferir un paso explícito de subida/versionado desde disco local temporal si se elige almacenamiento de objetos.
5. Ensayar una ejecución manual, otra consecutiva y un fallo inducido. Verificar que se conservan snapshots e informes correctos, sin borrar inventario ni sustituir una publicación válida por otra parcial.
6. Añadir monitorización, alertas de código distinto de cero, caídas de recuentos y condiciones de `review` antes de conectar un planificador.

El filesystem efímero del contenedor **no basta** para preservar snapshots e historial entre jobs. No se han definido credenciales ni horarios en el repositorio.

Documentación oficial de referencia:

- [Crear Cloud Run Jobs](https://cloud.google.com/run/docs/create-jobs)
- [Programar jobs](https://cloud.google.com/run/docs/execute/jobs-on-schedule)
- [Montajes Cloud Storage](https://cloud.google.com/run/docs/configuring/jobs/cloud-storage-volume-mounts)

## Diagnóstico operativo

| Síntoma                                               | Acción                                                                             |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Código de salida distinto de cero                     | Revisar `run.json`, logs, `-summary.json`, `-errors.json` y archivos `-partial-*`. |
| Catálogo aparentemente completo, pero pocos productos | Contrastar páginas y contador externo; el estado técnico no garantiza cobertura.   |
| `run.json` queda en `running`                         | Comprobar interrupción y logs; no interpretar el estado como publicación aceptada. |
| Lock `.batch.lock` persistente                        | Verificar si hay un lote activo antes de retirarlo manualmente.                    |
| Proveedor con muchos candidatos `review`              | Revisar categorías/atributos y aprobar datos de negocio antes de cualquier Excel.  |
| Aparecen `suspectedMissing`                           | Conservar informe y contrastar la fuente; **nunca dar de baja automáticamente**.   |

**Orden de puesta en producción:** corregir las incidencias de cada portal (en particular la cobertura conocida de Mercaeleva), validar fuentes e inventario, probar persistencia/alertas, autorizar proveedores concretos y solo entonces programar su extracción. La importación es otro proceso con aprobación independiente.
