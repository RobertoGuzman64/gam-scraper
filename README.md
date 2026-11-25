# EQUIPZILLA Scraper

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Este índice distingue originales, publicaciones técnicas explorables, publicaciones individuales acreditadas y exportaciones comerciales. No presentar `ready/review` de un corte técnico como autorización para vender ni como finalización editorial.

## Qué es

Herramienta de línea de comandos, desarrollada en **Node.js, TypeScript y módulos ESM**, para extraer maquinaria **nueva y de segunda mano** de **GAM, Gomariz, Mercaeleva y Manain**, normalizar sus datos, comprobar su calidad y publicar catálogos JSON trazables.

El **original canónico vigente** conserva las máquinas elegibles por el criterio de extracción del proveedor, incluidas las que después queden en `review`. En Gomariz, las fichas expresamente marcadas «Sin existencias» se excluyen de ese original con motivo y URL trazables; no se confunden con errores. La **selección editorial comercial** es otra salida: aparta fichas no acreditadas sin convertir artificialmente productos en `ready`.

**Dirección permanente de calidad:** si aparecen reviews, el trabajo de desarrollo consiste en **corregir el código productivo reutilizable que origina los problemas**, no terminar en informes, comandos o revisión manual ficha a ficha. La meta para declarar todo el universo de un proveedor `ready` es **0 reviews verificadas sobre todas sus fichas**; no es condición para publicar un **snapshot técnico independiente** que conserve las revisiones, conservando los originales y sin inventar valores ni relajar validaciones. Los diagnósticos son herramientas internas del desarrollador; las contradicciones de origen realmente irresolubles permanecen identificadas y requieren una decisión editorial distinta. Ver [Operativa de catálogos](docs/CATALOG_OPERATIONS.md) y [Validación](docs/VALIDATION.md).

Este repositorio no ofrece una API HTTP, no realiza altas en el backend y no automatiza importaciones. Los JSON canónicos y las selecciones acreditadas **no son solicitudes de creación de productos del backend**. Existe, por separado, una **proyección comercial propia** que asigna categorías y atributos conforme a los snapshots locales y entrega JSON comerciales auditables. La persistencia, permisos e importación siguen en el backend. `npm run exportar` (Excel/JSON histórico) es compatibilidad heredada, mientras `npm run exportar:comercial` es el circuito comercial actual. Ver [Exportación comercial](docs/COMMERCIAL_EXPORT.md).

**Para sacar o actualizar el catálogo de un proveedor**, basta con pedirlo en lenguaje natural (por ejemplo: «Saca el nuevo catálogo de GAM»). Se aplica el recorrido de [Operativa de catálogos](docs/CATALOG_OPERATIONS.md), desde el origen hasta los JSON comerciales verificables. Este recorrido no desplaza una petición expresa de mejora del código.

Para los criterios funcionales y de cierre, consultar [Operativa de catálogos](docs/CATALOG_OPERATIONS.md).

## Regla de ejecución y cierre

El trabajo técnico se orienta al **resultado productivo**: extracción completa, fichas correctas, cobertura comprobada, catálogo íntegro `ready`, campaña acreditable y entrega verificable, según el frente que corresponda. `estado`, `revisar`, `huecos`, `validar` y los diagnósticos no son metas por sí mismos: sus resultados alimentan correcciones en los motores existentes. Cuando el error es reproducible y generalizable, se modifica el código y se verifica contra el conjunto afectado; el trabajo no se da por terminado con un listado de incidencias o con comandos para analizarlas manualmente.

Los criterios **según el tipo de problema**, las protecciones de seguridad y los límites entre catálogo técnico, selección e importación están definidos en [Calidad del catálogo](docs/CATALOG_QUALITY.md). Ninguna automatización evita las aprobaciones editoriales reales, ni un `PASS` de extracción garantiza por sí solo cobertura completa o `0 review`.


## Regla de actuación para cualquier incidencia

El criterio transversal no cambia según el comando que haya fallado: **identificar el objetivo vigente → investigar internamente → corregir el componente productivo responsable → verificar el conjunto real → continuar hasta cumplir el criterio de cierre**. No desviar una incidencia de calidad hacia listas de fichas, diagnósticos sucesivos, nuevas herramientas observacionales o una entrega prematura; tampoco iniciar refactors ajenos al encargo. El contrato de comportamiento y los límites de autorización están en [Contrato anti-deriva](docs/CATALOG_QUALITY.md#contrato-anti-deriva-comportamiento-obligatorio-del-asistente).

Una consulta o un plan no equivalen a permiso para editar; una intervención productiva acordada tampoco requiere que el propietario apruebe cada comprobación interna. Las decisiones editoriales, destructivas o de cambio de contrato siguen siendo exclusivamente humanas. No se puede afirmar `0 review` ni una entrega completa sin verificar la totalidad del catálogo y todas las garantías pertinentes.


## Límites de intervención en el repositorio

La autorización para mejorar fichas alcanza **los módulos productivos necesarios dentro de `src/`**, no una reforma general del proyecto. Para cambiar Markdown, scripts, guards, comandos npm, carpetas protegidas, datos acreditados, contratos o publicaciones se necesita autorización explícita para el cambio concreto. **No crear documentación ni scripts temporales**, tampoco como paso intermedio, y no incorporar nombres de fases a rutas o ficheros. Reutilizar código, herramientas, tests y documentos existentes; una consulta o planificación no autoriza editar.

El guard de gobernanza protege **17 rutas Markdown y 57 rutas de scripts**, además de los **58 comandos npm**; permite editar el contenido de los archivos inventariados, pero la política anterior exige permiso humano. Los guards de integridad, arquitectura editorial y tests protegen las fronteras del código. Consultar [Gobernanza](docs/REPOSITORY_GOVERNANCE.md), [Arquitectura](docs/ARCHITECTURE.md), [Pruebas](docs/TESTING.md) y [Calidad del catálogo](docs/CATALOG_QUALITY.md) antes de intervenir. No confundir un PASS de guards con permiso para cambiar contratos o datos.

## Instalaciones existentes

Una instalación nueva no requiere ejecutar migraciones de nombres. Si se actualiza una instalación antigua con rutas de almacenamiento heredadas, consultar primero [Operación y mantenimiento](docs/OPERATIONS_AND_MAINTENANCE.md) y el comportamiento de `scripts/maintenance/migrate-storage.mjs`. No mover datos ni ejecutar migraciones sobre campañas o transacciones abiertas sin comprobar su estado.

## Requisitos e instalación

- Node.js `>=18.18.0` y npm para el núcleo de la CLI. Los recorridos Chrome por WebSocket requieren además `WebSocket` global (Node.js 22+ o runtime compatible): Manain y Mercaeleva en Windows. Mercaeleva en sistemas no Windows utiliza DevTools Pipe.
- Acceso HTTPS a los portales.
- Permisos de escritura en `storage/`.
- Chrome o Chromium (o Edge compatible, según el extractor) para Mercaeleva y Manain cuando se necesite; se pueden definir `CHROME_PATH` o `CHROMIUM_PATH`. Manain puede requerir navegador visible y verificación humana.

```powershell
npm ci
npm run ayuda
```

`PASS` confirma una operación completada (incluidos `npm test` y `npm run build`), `WARN` señala revisiones o simulaciones pendientes, `FAIL` indica un error y `RUN` identifica trabajo en curso. En terminal interactiva los estados llevan color y las operaciones largas muestran un spinner; el progreso se representa mediante contadores reales. Con `NO_COLOR`, `CI=true` o salida redirigida no se emiten secuencias ANSI y los mensajes siguen siendo legibles. Los comandos siguen en español y los nombres internos de archivos y carpetas en inglés.

`npm ci` **solo instala dependencias**: el script reservado `prepare` de npm no se utiliza para preparar catálogos. Los comandos operativos invocan su compilación interna cuando es necesaria. `storage/` contiene estado operativo excluido de Git. `catalogs/` guarda los originales y las campañas acreditadas que se han consolidado como datos portátiles versionables; ambos espacios tienen responsabilidades distintas. Ver [Contratos de datos](docs/DATA_CONTRACTS.md).

## Estructura técnica y pruebas

La estructura de `src/` agrupa responsabilidades y no hitos temporales del desarrollo:

- `src/catalog/`: identidad, calidad, normalización, cobertura, diagnósticos, editorial e intervenciones.
- `src/preparation/`: preparación técnica y editorial organizada en `editorial/{claims,core,identity,measurements,source,writing}/`, `technical/`, `provenance/`, `classification/`, `quality/`, `product/`, `documents/` y `workflow/`, con reglas específicas en `{gam,gomariz,mercaeleva,manain}/`. El motor editorial es compartido; los narradores individuales no están conectados al recorrido productivo detectado por los guards.
- `src/scraping/`: extracción, lotes, salida CSV/JSON y ciclo de publicación de origen; `workflow/`, `batch/` y `output/`.
- `src/campaign/` y `src/publication/`: campaña global, acreditación y retención; publicaciones individuales, FINISH y snapshots técnicos independientes.
- `src/infrastructure/filesystem/catalog/technical-publication.ts`: almacenamiento, integridad, activación y retención de las versiones técnicas.
- `src/commercial/`: proyección y exportación comercial actual, auditorías y compatibilidad de exportación legada.
- `src/infrastructure/`: filesystem, HTTP, navegador, locks, almacenamiento, referencias y XLSX.
- `src/panel/`: propietario de la lectura, preparación de evidencias y presentación del explorador. `src/tools/catalog/` conserva fachadas de compatibilidad hacia `panel/`; no es el propietario de esa lógica. El panel no decide ni modifica fichas.
- `src/cli/`: comandos y presentación; `src/contracts/` y `src/shared/`: contratos y utilidades transversales.
- `src/testing/`: fixtures, builders, casos de dominio e integración acreditada; las suites se ubican junto a sus módulos en `tests/` o dentro de `src/testing/integration/` según su responsabilidad. No se crean suites nuevas por máquina ni se obligan a leer catálogos completos las pruebas de dominio.
- `scripts/`: entradas de ejecución y compilación en la raíz; `scripts/inspection/`, `scripts/maintenance/` y `scripts/operations/` para las herramientas especializadas.

Los nombres **internos** de archivos, directorios y módulos técnicos se mantienen en inglés; los comandos npm y la salida operativa conservan sus nombres en español. No se traducen IDs de proveedores, rutas persistidas, campos de contratos ni formatos acreditados por una cuestión estética. Ver [Arquitectura](docs/ARCHITECTURE.md).

`npm test` encadena, en el orden de `package.json`, gobernanza y sus autopruebas, integridad de módulos, motor editorial compartido, frontera comercial/editorial, **guard de arquitectura editorial**, **guard de arquitectura de tests y sus autopruebas**, verificación de conocimiento, rendimiento, contrato comercial v2, build si es necesario, **comprobación de consenso de modelos** y `scripts/run-tests.mjs`. Los guards arquitectónicos **son obligatorios y pueden bloquear la ejecución antes de compilar**; sus comprobaciones detalladas pueden invocarse individualmente para diagnosticar. Requieren el TypeScript **local** instalado mediante `npm ci`, no una resolución implícita del compilador global. `npm run contrato:comercial` permite comprobar el contrato comercial v2 de manera explícita; este guard también protege la exportación. El runner descubre recursivamente `src/**/*.test.ts`, ejecuta sus equivalentes compilados en `dist/` e incluye `scripts/**/*.test.mjs`. No fijar un número constante de archivos; para diagnosticar se puede ejecutar `node scripts/run-tests.mjs --concurrencia 2` después del build o generar una medición JSON con `--medicion <ruta.json>`. Un guard correcto no equivale a `npm test` global completo.

**Protección de los módulos de salida:** `src/scraping/output/publish.ts` y `csv-serializer.ts` deben mantenerse versionados. `.gitignore` excluye directorios genéricos `output/`, pero contiene la excepción `!src/scraping/output/`; no eliminarla al limpiar archivos generados. Ver [Mantenimiento](docs/OPERATIONS_AND_MAINTENANCE.md).

**Precaución con los renombrados:** la huella `rulesSha256` de la preparación incluye nombres relativos y contenidos de módulos JavaScript compilados. Cambiar rutas puede invalidar la compatibilidad de una preparación previa sin modificar la lógica. No modificar huellas, documentos de aprobación ni JSON publicados para forzar una coincidencia. Ver [Validación](docs/VALIDATION.md) y [Contratos de datos](docs/DATA_CONTRACTS.md).

## Catálogos definitivos y trabajo operativo

- `catalogs/providers/<proveedor>/technical/` conserva una publicación técnica activa independiente (`active.json`) y como máximo dos versiones verificadas (`versions/<sha256>/`): la activa y la anterior. Admite `ready` y `review`, sin activar la publicación comercial. Manain utiliza su registro parcial acreditado. Ver [Publicaciones](docs/PUBLICATIONS.md).
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

`--aplicar` solo consolida originales completos y campañas con entrega verificable; reconoce parciales sin promocionarlos. **No reextrae, no borra `storage/` y no concede aprobaciones editoriales**. Si detecta corrupción, conflicto o retención excedida, bloquea la operación. Consultar [Contratos de datos](docs/DATA_CONTRACTS.md) y [Validación](docs/VALIDATION.md) antes de migrar.

Git registra los datos de `catalogs/` **cuando tú los añades y haces commit**. El scraper no ejecuta `git add`, `commit` ni `push`; `estado` valida archivos y discrepancias con el original operativo, **no comprueba el índice ni si el último commit contiene los cambios**. Tras consolidar, revisar `npm run estado` y `git status --short`, e incluir `catalogs/` en el commit correspondiente. Los históricos internos de Git no forman parte de la retención operativa.

## Publicación técnica independiente para auditores

`npm run publicacion:tecnica` habilita una **vía distinta de FINISH** para activar cortes técnicos con `ready` y `review`, sin cambiar publicaciones comerciales. Un proveedor completo se basa en original canónico y preparación validada; Manain usa su registro `partial` conciliado con CSV y censo. La simulación por defecto no escribe y `--activar` selecciona solo la versión técnica. `npm run huecos -- --tecnicas --detalle` analiza estos cortes, incluido el inventario de revisiones, sin mutar fichas. La retención mantiene la versión activa y la anterior; no acumula versiones ilimitadamente.

El corte acreditado en noviembre de 2026 era Gomariz 547 (535 `ready`, 12 `review`) y Manain 384 (383 `ready`, 1 `review`); son **cifras observadas**, no expectativas fijas para los tests. Una publicación técnica puede contener pendientes editoriales y **no acredita comercialmente** sus unidades. La publicación comercial vigente de Gomariz procede de un corte anterior y requiere reconciliar bajas por falta de existencias antes de volver a exportarla. Ver [Publicaciones](docs/PUBLICATIONS.md) y [Exportación comercial](docs/COMMERCIAL_EXPORT.md).

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

**Condición previa al cierre:** la secuencia de comandos es orientativa, no una licencia para avanzar desde `revisar` hasta `acreditar` con defectos productivos pendientes. Si las preparaciones mantienen reviews por fallos del motor, **se corrige el código y se revalida primero**. Las exclusiones editoriales no transforman el original en un catálogo `0 review`.

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

Si una ficha necesita una corrección puntual acreditada, consulta los scripts existentes con `npm run intervenir -- gam --listar` y simula uno seleccionado con `npm run intervenir -- gam --script src/catalog/interventions/records/gam/6002.ts`. Tras revisar las diferencias, autoriza expresamente `--aplicar` para ese script. Cada intervención nueva se guarda en `src/catalog/interventions/records/<proveedor>/` y se versiona en Git; no se registra en `storage/`. No hay cambios ni aprobaciones editoriales automáticas. Ver [Campañas](docs/CAMPAIGNS.md) e [Intervenciones](docs/INTERVENTIONS.md).

### Publicación individual simplificada — Preparar y FINISH

`npm run catalogo:preparar` ya prepara **GAM, Gomariz y Mercaeleva** en una sola operación desde los originales completos verificados de `catalogs/providers/<proveedor>/original/`. No pide rutas ni selecciona ficheros por fecha. Reutiliza una preparación vigente con idéntico SHA de origen y reglas, o genera otra versión offline con manifest y diagnósticos, sin tocar la anterior ni las publicaciones acreditadas. El modo `--simular` no escribe archivos:

```powershell
npm run catalogo:preparar
npm run catalogo:preparar -- --proveedor gam
npm run catalogo:preparar -- --simular
```

El resumen incluye `ready`, `review`, incidencias, referencias y diferencias **provisionales** respecto a la publicación vigente. Las ausencias observadas no autorizan exclusiones ni bajas. Si los originales son ambiguos, faltan evidencias, hay un manifest corrupto o dos preparaciones coincidentes, el proveedor queda bloqueado con diagnóstico; no se elige un fichero «más reciente» ni se sobrescribe nada. Manain y las campañas globales de cuatro conservan sus circuitos. **El ciclo individual ordinario tiene dos pasos:** preparar y publicar. `catalogo:publicar` realiza el preflight y reutiliza automáticamente solo exclusiones históricas idénticas con evidencia acreditada; un caso nuevo o distinto queda bloqueado, sin aprobación inventada. `catalogo:acreditar` es una operación opcional y no interactiva. Ver [Publicación individual](docs/PUBLICATIONS.md).

**Operación opcional — acreditación automática por separado:**

```powershell
npm run catalogo:acreditar -- --simular
npm run catalogo:acreditar
npm run catalogo:acreditar -- --proveedor gam
```

No abre una sesión interactiva: valida las preparaciones y únicamente puede reutilizar exclusiones históricas cuya referencia, fuente, estado e incidencias coincidan con los antecedentes acreditados. `--simular` no escribe. Si aparece una incidencia nueva, una exclusión distinta o una incompatibilidad, se bloquea; las decisiones nuevas requieren el procedimiento editorial explícito de `acreditar:proveedor`, no una aceptación automática. Ejecutar este comando no es obligatorio antes de FINISH.

**Paso 2 — FINISH**, con las preparaciones verificadas:

```powershell
npm run catalogo:publicar
npm run catalogo:publicar -- --proveedor gam
npm run catalogo:publicar -- --simular
```

FINISH realiza el preflight del conjunto, contrasta diferencias y pérdidas, crea y verifica las candidatas internas acreditadas sin ZIP, y solo después activa y comprueba las publicaciones individuales. Un diario en `storage/publication/individual-finish/` permite recuperar activaciones parciales repitiendo el mismo comando. Después de activar, FINISH ejecuta retención y actualiza el `INFORME.txt` interno versionado y verificable que resume el trabajo sobre los originales hasta las publicaciones vigentes. Un fallo posterior a la activación se informa por separado: repetir FINISH completa los pasos pendientes sin republicar las mismas acreditaciones. Cuando ya están vigentes no genera nuevas publicaciones ni ZIP externos; el informe se vuelve a comprobar o crear si corresponde. Los auditores de huecos y normalización técnica se ejecutan bajo demanda, fuera de FINISH. Siguen existiendo las campañas globales de cuatro proveedores. Si hay bloqueo previo a la activación, se preservan las publicaciones anteriores. Ver [Publicación individual](docs/PUBLICATIONS.md).

### Acreditación editorial individual explícita (casos que no se pueden reutilizar)

Cuando una incidencia es nueva o ha cambiado, el flujo automático no puede acreditarla por analogía. La preparación completa de un proveedor puede verificarse y acreditarse por separado mediante `seleccionar:proveedor` y `acreditar:proveedor`. Debe aportarse el catálogo original y la preparación offline correspondiente; ambos se validan contra sus huellas actuales. Este recorrido no acepta catálogos intervenidos ni promueve extracciones parciales a una entrega.

```powershell
$gam = "./catalogs/providers/gam/original/scrape-gam-catalog.json"
$preparacion = Read-Host "Ruta de la preparación GAM verificada para este origen y huella de reglas"
npm run acreditar:proveedor -- gam --origen $gam --preparacion $preparacion
npm run acreditar:proveedor -- gam --origen $gam --preparacion $preparacion --listar
npm run acreditar:proveedor -- gam --origen $gam --preparacion $preparacion --consultar 6682
```

Antes de usar `$preparacion`, comprobar su procedencia, versión del original y `rulesSha256`; **no elegirla solo por fecha de modificación**. Puede prepararse mediante `npm run catalogo:preparar -- --proveedor gam --detalle` y utilizarse la ruta verificada que comunique el circuito. El comando de acreditación vuelve a validar esas huellas. Tras contrastar la ficha con su origen, se puede registrar una decisión con `--decidir 6682 excluir --motivo "..." --evidencia <URL original mostrada por --consultar>`, repitiendo `--evidencia` para pruebas adicionales. `--validar` comprueba decisiones sin escritura y `--aprobar --motivo "..."` exige una aprobación humana global y bloquea cambios posteriores. El borrador se conserva en `storage/providers/<proveedor>/editorial/` con huella de las fuentes: no se reutiliza después de cambiar la preparación. Una vez aprobadas las decisiones y la aprobación global individual, el JSON comercial de un solo proveedor puede generarse sin campaña global:

```powershell
npm run entregar:proveedor -- gam --source $gam --preparation $preparacion --dry-run
npm run entregar:proveedor -- gam --source $gam --preparation $preparacion
npm run entregar:proveedor -- gam --source $gam --preparation $preparacion --verificar
```

La entrega se guarda en `catalogs/providers/<proveedor>/publications/<alias-o-sha-aprobacion>/`: `<proveedor>-publishable.json` (`ImportCandidate[]`), `accreditation.json` y `manifest.json`. La aprobación editorial humana sigue siendo obligatoria y debe corresponder a la preparación verificada. El comando definitivo entrega el JSON y, salvo `--solo-json`, verifica el ZIP y su recibo **antes** de evaluar las diferencias y seleccionar automáticamente la publicación individual vigente. El lector oficial debe resolver la nueva selección; no es necesario ejecutar después `publicacion:vigente --activar`. Las bajas de fichas, los vaciados de descripciones y las claves técnicas retiradas sin equivalencia acreditada bloquean la activación; la candidata verificada queda íntegra y la versión vigente anterior no se sustituye. Una campaña global vigente no puede ser reemplazada parcialmente.

`--dry-run` simula sin escrituras, `--verificar` comprueba sin activar, `--solo-candidata` genera y verifica sin activar y `--solo-json` omite el ZIP sin omitir la activación en modo definitivo. La repetición de una entrega ya verificada puede completar la selección y, una vez vigente, es idempotente. Los directorios acreditados son inmutables. Para recuperar o consultar una selección excepcional permanece disponible `publicacion:vigente`, sujeto a la política de protección. Las reclasificaciones técnicas no demostradas se bloquean; no existe una opción para forzarlas genéricamente. `acreditar` y `entregar` conservan el contrato global de cuatro proveedores.

### Otros comandos disponibles

- `npm run ayuda` y `npm run ayuda -- <comando>`: ayuda desde la terminal; distingue lectura, preparación, escritura y autorización destructiva.
- `npm run estado`: inventario de fuentes operativas, originales de `catalogs/`, JSON finales acreditados, integridad y discrepancias, sin escritura.
- `npm run build` y `npm test`: compilación y pruebas del repositorio.
- `npm run extraer:proveedor`, `extraer:todos`, `intervenir:manual`, `preparar`, `validar`, `seleccionar`, `seleccionar:proveedor`, `acreditar:proveedor`, `entregar:proveedor` y `cobertura`: operaciones avanzadas con finalidades distintas del flujo principal.
- `npm run manain:muestra` y `npm run manain:censo`: herramientas de diagnóstico específicas de Manain; no acreditan por sí solas una extracción completa.
- `npm run recuperar -- <runId>`: inspección sin borrados de un intento fallido; `--recuperar`, `--abandonar ... --confirmar ...` y `--reanudar-rotacion` son operaciones explícitas de recuperación. Ver [Protocolo de campañas](docs/CAMPAIGNS.md).
- `npm run referencia`: consulta y mantenimiento **legado** de `data/reference/`; `--actualizar` ya no es un paso habitual.
- `npm run migrar:catalogos`: inventario y migración controlada a `catalogs/` (simulación predeterminada; escritura solo con `-- --aplicar`).
- `npm run limpiar:almacen`: mantenimiento separado de extracciones individuales, no cierre ni rotación de campañas globales.
- `npm run limpiar:versionados`: simulación de retirada del índice Git de históricos rastreados; solo actúa con `-- --aplicar`.

### Herramientas de desarrollo: huecos y normalización técnica

Ambos auditores se ejecutan explícitamente, antes o después de una intervención de desarrollo. No son pasos de preparación, FINISH, entrega o exportación; tampoco sustituyen `validar`, la acreditación ni el contrato comercial. Sus resultados se consultan por separado y no requieren regenerar publicaciones.

#### Auditor de normalización técnica

`npm run normalizar:auditar` contrasta las representaciones de las prestaciones disponibles entre origen, preparación actual en memoria y publicación acreditada. Ejecuta los cuatro proveedores bajo demanda, con `--top N`, `--detalle` o `--json` (salida completa, usar `npm run --silent` para JSON limpio). Las señales no son defectos confirmados ni bloqueos de publicación. No escribe catálogos ni informes y no forma parte de FINISH. Ver [Diagnóstico de normalización técnica](docs/CATALOG_QUALITY.md#diagnóstico-de-normalización-técnica).

#### Auditor de huecos de contenido

`npm run huecos` es un diagnóstico de desarrollo independiente de la publicación, la retención y la entrega comercial. Permite seleccionar el trabajo editorial o técnico por **carencia real**. Con `--comparar` analiza por identidad las descripciones publicadas y la preparación recalculada, muestra vacíos recuperados, pendientes, extremos, diferencias familiares y posibles pérdidas. Con `--comparar --specs` añade un informe separado de claves técnicas del original, la preparación y el final: sus ausencias familiares son **observaciones, no datos obligatorios**. `--finales` mide contenido editorial, densidad y semántica técnica de las publicaciones seleccionadas. `--comparar --titulos` es un modo alternativo a `--comparar --specs`. Para originales de campaña/referencia o canónicos explícitos mantiene el diagnóstico agrupado por proveedor y categoría original.

```powershell
npm run huecos -- --comparar
npm run huecos -- --comparar --specs --json
npm run huecos -- --comparar --titulos --json
npm run huecos -- --finales
npm run huecos -- --catalogo catalogs/providers/gam/original/scrape-gam-catalog.json --agrupar marca --top 10
```

La población depende de la **publicación vigente seleccionada** o de la fuente explícita; no asumir que la última carpeta SHA está activa. En Mercaeleva la comparación parte de su publicación si no existe un original canónico independiente: no debe atribuirse a extracción original. El auditor es de **solo lectura**: no rellena fichas, no genera `review`, no acredita ni publica. La recuperación se implementa en el motor, con evidencia y comparación antes/después. Ver [Auditor de huecos](docs/CATALOG_QUALITY.md) para criterios, prioridades y límites.

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

**Normalización CSV GAM.** `normalizar:gam` admite `--report <ruta.json>`, `--allow-unknown`, `--expand-spec-columns` y `--max-values-per-key <n>`. Las salidas predeterminadas son `storage/normalized/gam/<prefijo>-all.normalized.csv` y `storage/normalized/gam/normalize.report.json`; las opciones y rutas se resuelven en `src/tools/gam/normalize-csv.ts`. El normalizador no inventa números a partir de multiplicadores, alternativas, unidades incompatibles, dimensiones corruptas ni años abreviados. Conserva en `specJson` las claves desconocidas sin convertirlas en atributos técnicos reconocidos; informa descartes con motivo y referencia de fila. Por defecto, una clave desconocida bloquea la generación; `--allow-unknown` permite conservarla, **pero no permite JSON inválido ni conflictos de alias**. Si hay bloqueo, devuelve error y **no reemplaza** el CSV ni el informe previos. Las tres variantes de conversión a seed también rechazan `specJson` corrupto sin producir nuevas salidas. Ver [Contratos de datos](docs/DATA_CONTRACTS.md) y [Validación](docs/VALIDATION.md).

## Dónde están los resultados

- `catalogs/providers/<proveedor>/original/`: trío canónico individual completo y verificable que acompaña al repositorio.
- `catalogs/campaigns/<runId>/`: instantáneas acreditadas de campaña con finales por proveedor, originales, aprobación y procedencia. Máximo dos campañas portátiles conservadas.
- `storage/runs/<id-lote>/run.json`: evidencia del lote y estado por proveedor.
- `storage/scraped/campaigns/<runId>/<proveedor>/`: catálogos canónicos, manifests y diagnósticos de la extracción aislada.
- `storage/campaigns/<id-lote>/<proveedor>/`: preparaciones validadas por la revisión offline.
- `storage/campaigns/<id-lote>/editorial/`: borradores y aprobación de la campaña.
- `storage/providers/<proveedor>/editorial/`: borrador y aprobación individual ligados a la huella vigente de la preparación; aún no representan una entrega.
- `storage/campaigns/<id-lote>/selection/`: selección interna acreditada (no se entrega completa al usuario).
- `storage/campaigns/<runId>/delivery.json`: recibo local de entrega vinculado a la selección; no es un reemplazo del ZIP físico.
- `src/catalog/interventions/records/<proveedor>/`: intervenciones permanentes con ID, resumen y propuestas, versionadas en Git; solo se agregan con autorización específica.
- `storage/interventions/<id-lote>/results/`: expedientes y derivados del lote, no versionados.
- `storage/interventions/<id-lote>/scripts/`: solo compatibilidad con scripts antiguos; se protegen si aún existen.
- `data/reference/`: almacén legado opcional de inventario con manifiesto y diferencias, incluida lectura compatible de referencias históricas de tres proveedores; no se actualiza como paso ordinario de campaña.
- **Escritorio del usuario:** `equipzilla-AAAA-MM-DD-<runId>.zip` con los cuatro JSON publicables, sin artefactos internos; su ausencia posterior no invalida por sí sola la acreditación local.
- `data/category/` y `data/import/`: snapshots usados por la proyección comercial actual y por compatibilidad histórica; **no son dependencias de la preparación canónica técnica**.
- `catalogs/reports/`: resultados de auditoría y evidencias de informes versionados que consulta el panel. `catalogs/reports/revision/explorer-technical-evidence.json` contiene la clasificación técnica precalculada del corte; no es una fuente editorial independiente ni una publicación.
- `panel/index.html`: panel local autónomo, de solo lectura, generado desde publicaciones, originales, informes y salida comercial acreditados. Se actualiza al ejecutar `npm run exportar:comercial -- --entorno develop` con entrega predeterminada; no con `--simular`, `--salida` ni `production`. Ver [Panel local](docs/COMMERCIAL_EXPORT.md#panel-local-de-evidencias).

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
                salida JSON técnico acreditado (sin importar al backend)
                                                 ↓
                     proyección comercial local separada
                                                 ↓
                  JSON comerciales + manifest verificable
```

El contrato de cuatro proveedores describe el software, **no acredita por sí solo la cobertura externa de Manain**; las páginas inaccesibles o con errores se investigan o se descartan con evidencia, sin declarar completitud ficticia. La validación local confirma integridad y coherencia, **no** que un portal haya mostrado todas sus máquinas. Las ausencias y contradicciones requieren contrastar el origen antes de aprobarlas.

## Documentación

Cada procedimiento y contrato tiene un documento propietario. Para producir un catálogo completo y entregarlo comercialmente, empezar por [Operativa de catálogos](docs/CATALOG_OPERATIONS.md); para corregir fichas o reducir `review`, usar [Calidad del catálogo](docs/CATALOG_QUALITY.md).

- [Arquitectura](docs/ARCHITECTURE.md): capas y responsabilidades.
- [Campañas](docs/CAMPAIGNS.md): campañas globales, acreditación y entrega.
- [Operativa de catálogos](docs/CATALOG_OPERATIONS.md): producción desde scraping hasta JSON comerciales.
- [Calidad del catálogo](docs/CATALOG_QUALITY.md): `review`, auditores de huecos y normalización técnica, evidencia y mejora por causas.
- [Gobernanza del repositorio](docs/REPOSITORY_GOVERNANCE.md): autorización e inventario de scripts, Markdown y comandos; reglas de continuidad.
- [Exportación comercial](docs/COMMERCIAL_EXPORT.md): proyección, auditoría, contratos y frontera del backend.
- [Contratos de datos](docs/DATA_CONTRACTS.md): originales, normalización, identidades y procedencias.
- [Motor editorial](docs/EDITORIAL_ENGINE.md): composición y conocimiento compartido.
- [Intervenciones](docs/INTERVENTIONS.md): scripts acreditados, simulación y aprobación.
- [Operación y mantenimiento](docs/OPERATIONS_AND_MAINTENANCE.md): entorno, despliegue, recuperación y referencias legadas.
- [Publicaciones](docs/PUBLICATIONS.md): publicación técnica y publicación individual acreditada.
- [Pruebas y guards](docs/TESTING.md): arquitectura de tests, regresiones y rendimiento.
- [RIP ZIP disfrazado](docs/RIP_ZIP_DISFRAZADO.md): caso histórico excepcional sobre datasets camuflados y límites de los guards.
- [Validación](docs/VALIDATION.md): comprobaciones y criterios de aceptación.
