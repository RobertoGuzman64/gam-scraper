# Despliegue automático del scraper — guía operativa

**Versión documental:** 20/10/2026. **No se ha desplegado un entorno cloud ni se ha añadido un Dockerfile a este repositorio en esta actualización.** Esta guía distingue los comandos que **ya existen** de la infraestructura por preparar y probar.

## 1. Respuesta técnica para infraestructura

- **Stack:** Node.js + TypeScript (`tsc` a JavaScript), npm, Cheerio y `p-limit`.
- **Tipo de proceso:** aplicación **CLI por lotes**; no abre un puerto ni expone rutas HTTP, por lo que no necesita Next.js ni un servidor permanente.
- **Navegación:** HTTP y análisis HTML con Cheerio. Para listados dinámicos de **Mercaeleva** hay fallback a Google Chrome/Chromium en modo headless, invocado por `child_process` con `--dump-dom` (sin Puppeteer/Playwright).
- **Punto de entrada manual:** `npm run scrape -- --provider <id>`.
- **Punto de entrada para lotes:** `npm run scrape:all`, que compila y ejecuta los proveedores en secuencia, con `run.json`, logs e informes.
- **Salidas y estado:** CSV/JSON, snapshots de inventario, diferenciales, logs y fichero de bloqueo en `storage/`.
- **Base de datos/backend:** **no se conecta ni publica a la API**. El Excel para el importador de altas se genera aparte y requiere inventario/ID real y confirmación manual.

**Decisión de puesta en marcha:** se puede programar un lote de prueba o únicamente GAM/Gomariz tras validación individual, pero el conjunto de las tres compañías **no está aceptado** por el problema de paginación de Mercaeleva. La automatización de scraping y la importación a Equipzilla son dos hitos separados.

## 2. Opción operativa sencilla: VM o servidor con disco persistente

Este es el despliegue **más cercano a lo que soporta el código actual**, porque el scraper trabaja con archivos y renombrados, y el lote usa un bloqueo local basado en `open(..., "wx")`.

### Linux (cron o systemd)

1. Instalar Node.js compatible (`>=18.18`, recomendable LTS mantenida), npm y Chromium/Chrome en una VM o servidor con salida HTTPS.
2. Clonar el repositorio en una carpeta dedicada y comprobar acceso de escritura para el usuario del proceso.
3. Instalar dependencias, compilar y probar:

```bash
cd /ruta/real/al/gam-scraper
npm ci
npm test
npm run scrape:all -- --dry-run
```

4. Ejecutar primero los proveedores aceptados, manualmente, antes de crear ninguna recurrencia:

```bash
npm run scrape:all -- --providers gam,gomariz
```

5. Examinar `storage/runs/<run>/run.json`, logs `*.log` y en cada proveedor `<prefijo>-summary.json`, `-changes.json`, `-preparation.json` y `-all.csv`. Confirmar permisos, salida y cumplimiento de [validación](PHASE7_VALIDACION.md).
6. **Solo tras aceptación formal**, utilizar el planificador del sistema para ejecutar **desde el directorio raíz del repo**. Cron, ejemplo de estructura (no activar sin aprobar días, hora, zona y rutas):

```cron
# Ejemplo ilustrativo: elegir la periodicidad aprobada por el equipo.
# <min> <hora> <día-mes> <mes> <día-semana> cd /ruta/real/al/gam-scraper && /ruta/real/a/npm run scrape:all -- --providers gam,gomariz
```

7. Configurar alertas operativas: código de salida, estado `run.json`, `quality.status`, duración anómala, faltantes y ausencia de ficheros de una ejecución esperada.

**Requisitos de servidor:** conservar `storage/` entre ejecuciones (CSV completos, snapshots, run history y lock). No compartir prefijos con tareas de prueba. No iniciar dos jobs contra la misma carpeta, aunque las URLs de proveedores sean distintas. El proceso crea el lock solo para el lote, no para `npm run scrape` individual.

### Windows (Programador de tareas)

El repo ya incluye `scripts/run-scheduled.ps1`:

```powershell
npm ci
npm test
npm run scrape:all -- --dry-run
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\RUTA\DEL\REPO\scripts\run-scheduled.ps1" -Providers "gam,gomariz"
```

La tarea programada debe ejecutar **`powershell.exe`** con el parámetro `-File`, cuenta con permisos de escritura y acceso a Node/npm/Chrome. Establecer “no iniciar segunda instancia” y revisar el último código de salida e historial. El script fija automáticamente la carpeta raíz del repositorio. **La máquina debe permanecer encendida**.

## 3. Opción cloud propuesta: Cloud Run Jobs + Cloud Scheduler

Arquitectura propuesta, **pendiente de implementar**:

```text
Cloud Scheduler (periodicidad autorizada)
    ↓ trigger autenticado
Cloud Run Job (1 tarea, Node.js + Chromium)
    ↓ publicación validada
Almacén persistente y seguro de CSV/JSON/snapshots + histórico/logs
    ↓ revisión / aprobación separada
Exportador de Excel (offline) → importador existente de Equipzilla (manual)
```

Cloud Run **Jobs** es adecuado para procesos que terminan tras ejecutar una tarea, a diferencia de un servicio HTTP que debe responder peticiones. Cloud Scheduler permite programar el job con IAM. Referencias oficiales:

- [Crear Cloud Run Jobs](https://docs.cloud.google.com/run/docs/create-jobs)
- [Programar Cloud Run Jobs con Cloud Scheduler](https://docs.cloud.google.com/run/docs/execute/jobs-on-schedule)
- [Configurar volúmenes de Cloud Storage para jobs](https://docs.cloud.google.com/run/docs/configuring/jobs/cloud-storage-volume-mounts)
- [Contrato del filesystem de Cloud Run](https://docs.cloud.google.com/run/docs/container-contract)

### Qué hay que implementar antes de pulsar «Deploy»

| Área | Trabajo pendiente | Motivo |
| --- | --- | --- |
| Contenedor | Dockerfile de producción y prueba de construcción | El repo actual **no** trae Dockerfile |
| Runtime | Node.js + dependencias y binario Chromium accesible (`CHROME_PATH`) | Listados dinámicos Mercaeleva |
| Entrypoint | `node dist/automation/run.js` desde raíz de proyecto, con `data/category/` y `data/import/` disponibles | Evitar compilar en cada arranque, respetar rutas de snapshots |
| Persistencia | Diseñar almacenamiento duradero de CSV, `preparation`, `summary`, snapshots, cambios e historial | El filesystem del contenedor es **efímero** |
| Exclusión mutua | Bloqueo **distribuido** o configuración que impida ejecución solapada | `.batch.lock` solo protege correctamente una carpeta local compatible |
| Alertas | Logs centralizados + fallos/cobertura anómala | Éxito de proceso no implica catálogo completo |
| Seguridad | Cuenta de servicio de mínimo privilegio, sin secretos en repositorio | Acceso al almacenamiento y programación |
| QA | Test end-to-end del contenedor y aceptación de cada proveedor | No basta `npm test` |

**Atención especial a Cloud Storage FUSE:** un bucket montado como volumen **no es un filesystem POSIX completo** y **no proporciona control de concurrencia** entre escritores. El código actual usa `rename` para escrituras temporales y `open("wx")` para `.batch.lock`; por tanto **no se debe declarar compatible directamente con un montaje FUSE sin rediseñar o probar esas operaciones**. Una opción segura es producir los archivos en un volumen local temporal de un único job, y después implementar una etapa explícita de publicación a Cloud Storage usando generación/versionado, checksums y bloqueo externo o serialización del planificador. Esta etapa **no existe todavía** en el código.

**Tampoco basta ejecutar el contenedor sobre filesystem efímero:** perdería snapshots e historial entre invocaciones, invalidando las comparaciones de nuevas/desaparecidas y la trazabilidad. No declarar desplegado un flujo productivo así.

### Checklist de plataforma antes de crear la tarea recurrente

1. Definir proyecto, región, cuenta de servicio, bucket/esquema de persistencia y responsables (infraestructura).
2. Preparar Dockerfile y probar `npm test` en pipeline; instalar binario Chromium dentro de la imagen.
3. Incluir `dist/`, dependencias de runtime y JSON `data/category`, `data/import` en imagen; el código los lee **en tiempo de ejecución**.
4. Conectar la salida persistente garantizando escrituras coherentes y conservación de snapshots anteriores ante errores.
5. Ejecutar manualmente **una sola tarea**, comprobar su código de salida, datos y logs; no usar Mercaeleva mientras persista el fallo P0.
6. Ejecutar dos pasadas controladas para verificar histórico, comparaciones y `suspectedMissing` sin generar bajas.
7. Probar una excepción de red y comprobar que los datos publicados válidos no se reemplazan por parciales.
8. Configurar Cloud Scheduler y alertas solo tras aceptación; evitar ejecuciones superpuestas o dobles disparadores.

No se fijan credenciales, regiones, buckets ni cron concretos aquí porque son decisiones de infraestructura que deben confirmar los responsables del entorno.

## 4. Convenciones para operaciones y fallos

- `npm run scrape:all -- --dry-run`: inspección sin peticiones.
- `npm run scrape:all -- --providers gam,gomariz`: selección limitada (la selección es una decisión de operación y debe documentarse).
- `--outRoot` y `--historyDir`: controlan directorios del runner; **requieren persistencia consistente** si hay ejecuciones recurrentes.
- `run.json`: `complete`, `partial` o `failed`; algunos `run.json` pueden quedar en `running` si el proceso se corta.
- Código distinto de cero: revisar logs, `-errors.json`, `-summary.json` y `-partial-*` del proveedor afectado.
- Cambio brusco de recuentos: detener importación y comparar con portal; las reglas de calidad no detectan automáticamente todas las pérdidas de cobertura.
- `.batch.lock` antiguo: verificar actividad real **antes** de retirarlo manualmente, nunca hacerlo a ciegas.
- Nunca borrar registros de Equipzilla a partir de `suspectedMissing`.

## 5. Próximos pasos para un despliegue real

**Orden recomendado:** (1) corregir y verificar cobertura de Mercaeleva, (2) decidir qué proveedores quedan autorizados, (3) elegir VM persistente o implementar Docker + persistencia segura para Cloud Run, (4) añadir alertas y ejecutar dos ciclos controlados, (5) programar scraping, y **más adelante, por separado**, validar generación/importación de XLSX con IDs e inventario reales.

**Resultado documental actual:** el proyecto es *automatizable*, tiene un runner de lotes, pero **no es aún un servicio de scraping cloud listo para desplegar sin trabajo adicional**, ni un conector de importación automática al backend.
