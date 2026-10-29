# EQUIPZILLA Scraper

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Qué es

Herramienta de línea de comandos, desarrollada en **Node.js, TypeScript y módulos ESM**, para extraer maquinaria **nueva y de segunda mano** de **GAM, Gomariz, Mercaeleva y Manain**, normalizar sus datos, comprobar su calidad y publicar catálogos JSON trazables.

El **catálogo canónico** conserva todas las máquinas identificadas, incluidas aquellas cuya preparación tenga incidencias. La **selección editorial** es una salida separada: aparta fichas no acreditadas sin borrar el origen ni convertir artificialmente productos a `ready`.

Este repositorio no ofrece una API HTTP, no realiza altas en el backend y no automatiza importaciones. Los JSON canónicos y las selecciones acreditadas **no son solicitudes de creación de productos del backend**: la asignación de categorías e IDs comerciales corresponde a la integración receptora. El exportador Excel/JSON comercial que permanece en el código es **compatibilidad heredada**, no un paso del flujo actual; las nuevas preparaciones canónicas se rechazan en ese exportador.

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

`npm ci` **solo instala dependencias**: el script reservado `prepare` de npm no se utiliza para preparar catálogos. Los comandos operativos invocan su compilación interna cuando es necesaria. `storage/` contiene estado operativo excluido de Git. `catalogs/` guarda los originales y las campañas acreditadas que se han consolidado como datos portátiles versionables; ambos espacios tienen responsabilidades distintas. Ver [Reglas de datos](docs/SCRAPER_DATA_RULES.md).

## Catálogos definitivos y trabajo operativo

- `catalogs/providers/<proveedor>/original/` contiene **un solo original vigente** de extracción individual completa: `<prefijo>-catalog.json`, `<prefijo>-catalog.manifest.json` y `<prefijo>-summary.json`. La consolidación comprueba el trío; no guarda CSV ni resultados parciales como originales completos.
- `catalogs/campaigns/<runId>/` contiene una **instantánea acreditada e inmutable** de una campaña: `manifest.json`, `accreditation.json`, `selection.json` y, por proveedor, el trío original y `publishable.json`; si hubo intervención, también `catalog-derived.json` e `intervention-record.json`. No confundir este `publishable.json` con un JSON importado en el backend.
- `storage/` continúa siendo necesario para extraer, preparar, corregir, acreditar y entregar; incluye trabajos en curso y elementos de recuperación. **No se copia íntegramente a Git ni se elimina a mano**. Una copia limpia del repositorio puede verificar los conjuntos de `catalogs/` sin necesitar los archivos operativos originales; eso no equivale a disponer de una campaña activa para seguir editándola.

La extracción **individual completa, con opciones y destino predeterminados**, consolida su original en `catalogs/`. Una extracción de prueba, limitada, parcial o con destino personalizado no lo sustituye. Los JSON publicables definitivos de campaña se consolidan al finalizar una **acreditación editorial aprobada**; ni `ready` ni una preparación aislada generan esos finales. Una intervención acreditada queda ligada al derivado y a la selección de su campaña, sin reescribir el original.

Para incorporar fuentes locales anteriores a este almacenamiento, usar el comando existente, que **simula por defecto**:

```powershell
npm run migrar:catalogos
npm run migrar:catalogos -- --aplicar
npm run estado
```

`--aplicar` solo consolida originales completos y campañas con entrega verificable; reconoce parciales sin promocionarlos. **No reextrae, no borra `storage/` y no concede aprobaciones editoriales**. Si detecta corrupción, conflicto o retención excedida, bloquea la operación. Consultar [Reglas de datos](docs/SCRAPER_DATA_RULES.md) y [Validación](docs/VALIDATION.md) antes de migrar.

Git registra los datos de `catalogs/` **cuando tú los añades y haces commit**. El scraper no ejecuta `git add`, `commit` ni `push`; `estado` valida archivos y discrepancias con el original operativo, **no comprueba el índice ni si el último commit contiene los cambios**. Tras consolidar, revisar `npm run estado` y `git status --short`, e incluir `catalogs/` en el commit correspondiente. Los históricos internos de Git no forman parte de la retención operativa.

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

`estado` es una **consulta sin escrituras sobre campañas**: identifica el lote, preparaciones, decisiones editoriales y acreditación local de la entrega. También advierte de problemas con una referencia histórica. La acreditación local puede verificarse aunque el ZIP ya no esté en el Escritorio; su existencia física se comprueba por separado cuando se solicita. `iniciar` **puede crear carpetas de trabajo** y `revisar` puede generar preparaciones ausentes.

`extraer` ejecuta los cuatro proveedores del contrato en un lote aislado con `runId` propio y después prepara y valida sus catálogos. `revisar` permite consultar las incidencias sin reextraer. **No hay que buscar los JSON anteriores ni copiar huellas manualmente.** El sistema conserva como máximo dos campañas globales y rota la más antigua solamente si ambas entregas son verificables y la retirada es segura. Si una campaña se interrumpe, hay que inspeccionarla y recuperarla o abandonarla expresamente con `recuperar`; `--nueva` **no autoriza** su eliminación.

`acreditar` crea un borrador en `storage/campaigns/<id-lote>/editorial/accreditation-<sha256>.json`. Las decisiones se consultan con `npm run acreditar -- --listar` y `--consultar <proveedor> <referencia>`; se registran individualmente mediante `--decidir <proveedor> <referencia> <excluir|incluir> --motivo "..." --evidencia <url-https>` (repetir `--evidencia` cuando sea necesario). Tras contrastarlas humanamente, ejecutar `--validar` y aprobar explícitamente con `--aprobar --motivo "..."`. **No hay que editar JSON ni huellas SHA**. Después:

```powershell
npm run acreditar
npm run entregar
npm run estado
```

`comparar` consulta sin escribir las altas, ausencias y modificaciones entre los originales de la campaña vigente y la última entrega válida retenida; solo si no hay tal entrega utiliza una referencia histórica válida de `data/reference/`. Sin baseline anterior, indica comparación inicial. **Una ausencia no demuestra una venta ni una exclusión editorial:** se comparan todos los originales, no solo los publicables. Las campañas históricas verificables de tres proveedores pueden servir de base para los tres comunes; las entregas nuevas exigen cuatro.

`entregar` genera en el Escritorio `equipzilla-AAAA-MM-DD-<runId>.zip` con **exactamente cuatro JSON**: `gam-AAAA-MM-DD.json`, `gomariz-AAAA-MM-DD.json`, `mercaeleva-AAAA-MM-DD.json` y `manain-AAAA-MM-DD.json`. El `runId` diferencia entregas del mismo día: un ZIP existente no se sobrescribe y una campaña con recibo no se entrega dos veces. La entrega guarda su recibo y evidencias locales bajo la campaña, sin depender indefinidamente del ZIP del Escritorio. Los originales se conservan mientras la campaña siga retenida; **no hay que actualizar `data/reference/` ni ejecutar limpieza manual**. La retirada automática ocurre al admitir una nueva campaña y se bloquea si hay entregas sin acreditar, trabajos pendientes, rutas desconocidas o referencias heredadas sin resolver.

Si una ficha necesita una corrección puntual acreditada, consulta los scripts existentes con `npm run intervenir -- gam --listar` y simula uno seleccionado con `npm run intervenir -- gam --script interventions/gam/6002.ts`. Tras revisar las diferencias, autoriza expresamente `--aplicar` para ese script. Cada intervención nueva se guarda en `interventions/<proveedor>/` y se versiona en Git; no se registra en `storage/`. No hay cambios ni aprobaciones editoriales automáticas. Ver [Protocolo completo](docs/CAMPAIGNS.md), [Intervenciones](docs/CAMPAIGN_INTERVENTIONS.md) y [Acreditación](docs/CAMPAIGN_ACCREDITATION.md).

### Otros comandos disponibles

- `npm run ayuda` y `npm run ayuda -- <comando>`: ayuda desde la terminal; distingue lectura, preparación, escritura y autorización destructiva.
- `npm run estado`: inventario de fuentes operativas, originales de `catalogs/`, JSON finales acreditados, integridad y discrepancias, sin escritura.
- `npm run huecos`: auditor opcional de la última entrega íntegra conservada (o referencia histórica si no hay entrega); admite `--catalogo <ruta>` para canónicos explícitos. Ver [Auditor de huecos](docs/CATALOG_CONTENT_GAPS.md).
- `npm run build` y `npm test`: compilación y pruebas del repositorio.
- `npm run extraer:proveedor`, `extraer:todos`, `intervenir:manual`, `preparar`, `validar`, `seleccionar` y `cobertura`: operaciones avanzadas con finalidades distintas del flujo principal.
- `npm run manain:muestra` y `npm run manain:censo`: herramientas de diagnóstico específicas de Manain; no acreditan por sí solas una extracción completa.
- `npm run recuperar -- <runId>`: inspección sin borrados de un intento fallido; `--recuperar`, `--abandonar ... --confirmar ...` y `--reanudar-rotacion` son operaciones explícitas de recuperación. Ver [Protocolo de campañas](docs/CAMPAIGNS.md).
- `npm run referencia`: consulta y mantenimiento **legado** de `data/reference/`; `--actualizar` ya no es un paso habitual.
- `npm run migrar:catalogos`: inventario y migración controlada a `catalogs/` (simulación predeterminada; escritura solo con `-- --aplicar`).
- `npm run limpiar:almacen`: mantenimiento separado de extracciones individuales, no cierre ni rotación de campañas globales.
- `npm run limpiar:versionados`: simulación de retirada del índice Git de históricos rastreados; solo actúa con `-- --aplicar`.

### Auditor de huecos de contenido

`npm run huecos` agrupa los originales de la última campaña entregada íntegra, o de una referencia histórica válida cuando no existe aquella, por proveedor y categoría, con refinamiento opcional por marca o modelo declarado. Señala ausencias repetidas de claves técnicas observadas en fichas de la misma familia de origen y de descripciones, muestra referencias concretas y permite consultar las evidencias en un JSON generado por `stdout`. No depende de `categorySellID` ni de los atributos comerciales de Equipzilla. **No rellena fichas, no declara errores de calidad ni crea `Review`**.

```powershell
npm run huecos
npm run huecos -- --agrupar marca --top 10
npm run huecos -- --json > huecos-consulta.json
```

Exige una entrega íntegra conservada, una referencia histórica válida o catálogos explícitos completos verificables con `--catalogo <ruta>` (repetible). No modifica su fuente. Los recuentos se refieren a **todos los originales**, incluidos excluidos de entrega, preparados en memoria con el código actual. Es una herramienta de investigación, nunca un requisito para entregar una campaña. Ver [Auditor de huecos](docs/CATALOG_CONTENT_GAPS.md) para opciones, límites y lectura de evidencias.

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

- `catalogs/providers/<proveedor>/original/`: trío canónico individual completo y verificable que acompaña al repositorio.
- `catalogs/campaigns/<runId>/`: instantáneas acreditadas de campaña con finales por proveedor, originales, aprobación y procedencia. Máximo dos campañas portátiles conservadas.
- `storage/runs/<id-lote>/run.json`: evidencia del lote y estado por proveedor.
- `storage/scraped/campaigns/<runId>/<proveedor>/`: catálogos canónicos, manifests y diagnósticos de la extracción aislada.
- `storage/campaigns/<id-lote>/<proveedor>/`: preparaciones validadas por la revisión offline.
- `storage/campaigns/<id-lote>/editorial/`: borradores y aprobación de la campaña.
- `storage/campaigns/<id-lote>/selection/`: selección interna acreditada (no se entrega completa al usuario).
- `storage/campaigns/<runId>/delivery.json`: recibo local de entrega vinculado a la selección; no es un reemplazo del ZIP físico.
- `interventions/<proveedor>/`: scripts permanentes con ID, resumen y propuestas, versionados en Git.
- `storage/interventions/<id-lote>/results/`: expedientes y derivados del lote, no versionados.
- `storage/interventions/<id-lote>/scripts/`: solo compatibilidad con scripts antiguos; se protegen si aún existen.
- `data/reference/`: almacén legado opcional de inventario con manifiesto y diferencias, incluida lectura compatible de referencias históricas de tres proveedores; no se actualiza como paso ordinario de campaña.
- **Escritorio del usuario:** `equipzilla-AAAA-MM-DD-<runId>.zip` con los cuatro JSON publicables, sin artefactos internos; su ausencia posterior no invalida por sí sola la acreditación local.
- `data/category/` y `data/import/`: snapshots de compatibilidad para mapeos comerciales heredados; **no son dependencias de la preparación canónica actual**.

Los nombres individuales de catálogo pueden variar por proveedor: `run.json`, la procedencia y los manifests determinan qué datos pertenecen a una campaña. `storage/` está excluido de Git y conserva los datos operativos sujetos a la retención segura de campañas; no debe vaciarse manualmente. `catalogs/` es la copia portátil de los datos **ya consolidados**, no una autorización para editar manualmente originales ni selecciones. Los originales completos individuales y las instantáneas por `runId` tienen ciclos de vida distintos. No borrar originales para corregir decisiones editoriales.

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

El contrato de cuatro proveedores describe el software, **no acredita por sí solo la cobertura externa de Manain**; las páginas inaccesibles o con errores se investigan o se descartan con evidencia, sin declarar completitud ficticia. La validación local confirma integridad y coherencia, **no** que un portal haya mostrado todas sus máquinas. Las ausencias y contradicciones requieren contrastar el origen antes de aprobarlas.

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
- [Integración con Equipzilla](docs/EQUIPZILLA_INTEGRATION.md): frontera entre el scraper y la transformación comercial del backend.
- [Referencia operativa](docs/OPERATIONAL_REFERENCE.md): lectura, traslado y compatibilidad de inventarios de referencia.
