# EQUIPZILLA Scraper

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Qué es

Herramienta de línea de comandos, desarrollada en **Node.js, TypeScript y módulos ESM**, para extraer maquinaria **nueva y de segunda mano** de **GAM, Gomariz y Mercaeleva**, normalizar sus datos, comprobar su calidad y publicar catálogos JSON trazables.

El **catálogo canónico** conserva todas las máquinas identificadas, incluidas aquellas cuya preparación tenga incidencias. La **selección editorial** es una salida separada: aparta fichas no acreditadas sin borrar el origen ni convertir artificialmente productos a `ready`.

Este repositorio no ofrece una API HTTP, no realiza altas en el backend y no automatiza importaciones. Las exportaciones a Excel o JSON adaptado al receptor son herramientas auxiliares, con autorización independiente.

Para los criterios funcionales, consultar [Objetivos](docs/SCRAPER_OBJECTIVES.md).

## Instalaciones existentes

Una instalación nueva no requiere ejecutar migraciones de nombres. Si se actualiza una instalación antigua con rutas de almacenamiento heredadas, consultar primero [Referencia operativa](docs/OPERATIONAL_REFERENCE.md) y el comportamiento de `scripts/migrate-storage.mjs`. No mover datos ni ejecutar migraciones sobre campañas o transacciones abiertas sin comprobar su estado.

## Requisitos e instalación

- Node.js `>=18.18.0` y npm.
- Acceso HTTPS a los portales.
- Permisos de escritura en `storage/`.
- Chrome o Chromium accesible desde el sistema para el mecanismo headless de Mercaeleva, cuando se necesite; se pueden definir `CHROME_PATH` o `CHROMIUM_PATH`.

```powershell
npm ci
npm run ayuda
```

`PASS` confirma una operación completada (incluidos `npm test` y `npm run build`), `WARN` señala revisiones o simulaciones pendientes, `FAIL` indica un error y `RUN` identifica trabajo en curso. En terminal interactiva los estados llevan color y las operaciones largas muestran un spinner; el progreso se representa mediante contadores reales. Con `NO_COLOR`, `CI=true` o salida redirigida no se emiten secuencias ANSI y los mensajes siguen siendo legibles. Los comandos siguen en español y los nombres internos de archivos y carpetas en inglés.

`npm ci` **solo instala dependencias**: el script reservado `prepare` de npm no se utiliza para preparar catálogos. Los comandos operativos invocan su compilación interna cuando es necesaria. `storage/` contiene estado de ejecución y está excluido de Git.

## Uso habitual: de una instalación limpia al ZIP final

Ejecutar desde la raíz del repositorio:

```powershell
npm ci
npm run iniciar
npm run estado
npm run extraer
npm run revisar
npm run comparar
npm run acreditar
```

`estado` es una **consulta sin escrituras**: identifica el lote, preparaciones, decisiones editoriales, entrega acreditada y situación de la referencia. Muestra el siguiente comando adecuado al estado actual. Puede repetirse en cualquier momento, incluso tras la limpieza; si el ZIP entregado ya no verifica, avisa y no considera el lote listo para cerrar. `iniciar`, en cambio, **crea las carpetas de trabajo que falten** y muestra la orientación operativa. `revisar` puede crear preparaciones ausentes, por lo que no es una consulta estricta.

`extraer` extrae los tres proveedores en una campaña aislada y prepara y valida los catálogos; al terminar ya muestra las incidencias. `revisar` permite consultarlas otra vez. **No hay que suministrar JSON anteriores ni buscar rutas o huellas manualmente.** Si una campaña anterior falló, revisarla primero o iniciar deliberadamente otra con `npm run extraer -- --nueva`.

`acreditar` crea un borrador en `storage/campaigns/<id-lote>/editorial/accreditation-<sha256>.json`. Las decisiones se consultan con `npm run acreditar -- --listar` y `--consultar <proveedor> <referencia>`; se registran individualmente mediante `--decidir <proveedor> <referencia> <excluir|incluir> --motivo "..." --evidencia <url-https>` (repetir `--evidencia` cuando sea necesario). Tras contrastarlas humanamente, ejecutar `--validar` y aprobar explícitamente con `--aprobar --motivo "..."`. **No hay que editar JSON ni huellas SHA**. Después:

```powershell
npm run acreditar
npm run entregar
npm run referencia -- --actualizar
npm run limpiar
```

`comparar` consulta sin escribir las altas, ausencias y modificaciones frente a `data/reference/`. Si todavía no hay referencia, indica que el lote servirá como inicial. **No confundir una ausencia con una venta ni con una exclusión editorial:** se comparan todos los productos originales extraídos, no solo los publicables.

`entregar` genera en el Escritorio `equipzilla-AAAA-MM-DD.zip` con **exactamente tres JSON**: `gam-AAAA-MM-DD.json`, `gomariz-AAAA-MM-DD.json` y `mercaeleva-AAAA-MM-DD.json`. La entrega solo se sustituye tras comprobar el ZIP nuevo. Después, `referencia -- --actualizar` comprueba de nuevo la entrega acreditada y conserva únicamente los tres catálogos originales completos, `manifest.json` y el último `differences.json`; no guarda históricos ni modifica la aprobación. La actualización requiere `--actualizar` y es opcional, pero debe hacerse **antes de limpiar** si se quiere comparar el inventario de la siguiente campaña. `limpiar` **simula** la limpieza y muestra si la referencia ya corresponde al lote, evitando pedir una segunda actualización; cuando el ZIP esté comprobado y no se prevean más correcciones del lote, `npm run limpiar -- --aplicar` cierra su trabajo conservando el ZIP y los scripts versionados en Git (y los scripts históricos, si existen). La limpieza no obliga a actualizar la referencia.

Si una ficha necesita una corrección puntual acreditada, consulta los scripts existentes con `npm run intervenir -- gam --listar` y simula uno seleccionado con `npm run intervenir -- gam --script interventions/gam/6002.ts`. Tras revisar las diferencias, autoriza expresamente `--aplicar` para ese script. Cada intervención nueva se guarda en `interventions/<proveedor>/` y se versiona en Git; no se registra en `storage/`. No hay cambios ni aprobaciones editoriales automáticas. Ver [Protocolo completo](docs/CAMPAIGNS.md), [Intervenciones](docs/CAMPAIGN_INTERVENTIONS.md) y [Acreditación](docs/CAMPAIGN_ACCREDITATION.md).

### Otros comandos disponibles

- `npm run ayuda` y `npm run ayuda -- <comando>`: ayuda desde la terminal; distingue lectura, preparación, escritura y autorización destructiva.
- `npm run estado`: estado autónomo de campaña y referencia, sin escrituras.
- `npm run huecos`: consulta estadística opcional de contenido ausente sobre los originales de la referencia válida; no interviene en campañas. Ver [Auditor de huecos](docs/CATALOG_CONTENT_GAPS.md).
- `npm run build` y `npm test`: compilación y pruebas del repositorio.
- `npm run extraer:proveedor`, `extraer:todos`, `intervenir:manual`, `preparar`, `validar`, `seleccionar` y `cobertura`: operaciones avanzadas con finalidades distintas del flujo principal.
- `npm run limpiar:almacen`: retención anterior, distinta del cierre de campaña.
- `npm run limpiar:versionados`: simulación de retirada del índice Git de históricos rastreados; solo actúa con `-- --aplicar`.

### Auditor de huecos de contenido

`npm run huecos` agrupa originales de `data/reference/` por proveedor y categoría, con refinamiento opcional por marca o modelo declarado. Señala ausencias repetidas en atributos aplicables, descripción corta y descripción general, muestra referencias concretas y permite consultar los datos originales y preparados en un JSON generado por `stdout`. **No rellena fichas, no declara errores de calidad ni crea `Review`**.

```powershell
npm run huecos
npm run huecos -- --agrupar marca --top 10
npm run huecos -- --json > huecos-consulta.json
```

Exige una referencia íntegra; no la crea, recupera ni modifica. Los recuentos se refieren a **todos los originales**, incluidos excluidos de entrega, preparados en memoria con el código actual. Es una herramienta de investigación, nunca un requisito para entregar una campaña. Ver [Auditor de huecos](docs/CATALOG_CONTENT_GAPS.md) para opciones, límites y lectura de evidencias.

### Herramientas complementarias

| Comando                                                                | Finalidad                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------- |
| `npm run normalizar:gam -- <entrada.csv> <salida.csv>`                 | Normalizar un CSV GAM.                             |
| `npm run normalizar:gam:base`                                          | Usar las rutas GAM preconfiguradas.                |
| `npm run convertir:gam -- <entrada.csv> <salida.ts> <categorias.json>` | Convertir un CSV a semilla de productos.           |
| `npm run convertir:gam:original` / `convertir:gam:base`                | Conversión con rutas heredadas preconfiguradas.    |
| `npm run categorias:arbol -- <opciones>`                               | Generar semillas GAM por categoría.                |
| `npm run urls:gam -- <opciones>`                                       | Generar semillas GAM por URL.                      |
| `npm run consola -- <subcomando>`                                      | Acceder a operaciones avanzadas de CLI.            |
| `npm run build` / `npm test`                                           | Compilación TypeScript y batería de pruebas.       |
| `npm run clean`                                                        | Eliminar únicamente la salida regenerable `dist/`. |

Las operaciones GAM con rutas preconfiguradas son **herramientas de compatibilidad**, no una garantía de que esos archivos correspondan a la extracción que se desea procesar. Preferir rutas explícitas y verificar las entradas. No confundir `npm run clean` con `npm run limpiar:almacen`.

## Dónde están los resultados

- `storage/runs/<id-lote>/run.json`: evidencia del lote y estado por proveedor.
- `storage/scraped/campaigns/<id-extraccion>/<proveedor>/`: catálogos canónicos, manifests y diagnósticos de la extracción aislada.
- `storage/campaigns/<id-lote>/<proveedor>/`: preparaciones validadas por la revisión offline.
- `storage/campaigns/<id-lote>/editorial/`: borradores y aprobación de la campaña.
- `storage/campaigns/<id-lote>/selection/`: selección interna acreditada (no se entrega completa al usuario).
- `interventions/<proveedor>/`: scripts permanentes con ID, resumen y propuestas, versionados en Git.
- `storage/interventions/<id-lote>/results/`: expedientes y derivados del lote, no versionados.
- `storage/interventions/<id-lote>/scripts/`: solo compatibilidad con scripts antiguos; se protegen si aún existen.
- `data/reference/`: referencia única opcional de inventario; tres originales completos, manifiesto verificable y último informe de diferencias.
- **Escritorio del usuario:** `equipzilla-AAAA-MM-DD.zip` con los tres JSON publicables, sin los archivos internos.
- `data/category/` y `data/import/`: referencias versionadas necesarias para los mapeadores.

Los nombres individuales de catálogo pueden variar por proveedor: `run.json`, la procedencia y los manifests determinan qué datos pertenecen a una campaña. `storage/` es efímero y está excluido de Git. No borrar originales para corregir decisiones editoriales.

## Cómo funciona

```text
Portales → adaptadores → motor de extracción → ProductRecord
                                                 ↓
                                  identidad, calidad y publicación
                                                 ↓
                         catálogo JSON íntegro + manifiestos e informes
                                                 ↓
                    preparación offline / revisión de cobertura
                                                 ↓
                          selección editorial de publicables
                                                 ↓
                salida JSON para entregar (sin importar al backend)
```

La validación local confirma integridad y coherencia, **no** que un portal haya mostrado todas sus máquinas. Las ausencias y contradicciones requieren contrastar el origen antes de aprobarlas.

## Documentación

- [Objetivos y alcance](docs/SCRAPER_OBJECTIVES.md): prioridades y criterios de aceptación.
- [Arquitectura](docs/ARCHITECTURE.md): módulos, responsabilidades y extensibilidad.
- [Auditor de huecos de contenido](docs/CATALOG_CONTENT_GAPS.md): consulta opcional, campos observados, evidencias originales y límites.
- [Reglas de datos](docs/SCRAPER_DATA_RULES.md): contratos, origen, preservación y revisión editorial.
- [Protocolo de campañas completas](docs/CAMPAIGNS.md): extracción global obligatoria, validación de todos los proveedores, intervenciones excepcionales y entrega acreditada.
- [Intervenciones manuales por campaña](docs/CAMPAIGN_INTERVENTIONS.md): principios y controles de la ejecución manual.
- [Composición de intervenciones independientes](docs/INTERVENTION_COMPOSITION.md): varios scripts, campos acreditables, simulación conjunta y selección final con aprobación humana.
- [Acreditación editorial de campañas](docs/CAMPAIGN_ACCREDITATION.md): procedimiento de aprobación y entrega de JSON.
- [Validación](docs/VALIDATION.md): verificaciones, códigos de salida y evidencias.
- [Operación y despliegue](docs/AUTOMATED_DEPLOYMENT.md): ejecución manual o programada y seguridad operacional.
- [Integración con Equipzilla](docs/EQUIPZILLA_INTEGRATION.md): límites del receptor y exportaciones auxiliares.
