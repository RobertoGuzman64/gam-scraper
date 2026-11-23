# Publicaciones — técnica independiente e individual acreditada

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** No usar `publicacion:tecnica` como sustituto de FINISH, ni reutilizar aprobaciones históricas si ha cambiado original, preparación o incidencias. La activación técnica no autoriza selección editorial ni exportación comercial; respetar los hashes y la retención verificable.

**Propietario:** operación, versionado y recuperación de publicaciones. Los dos circuitos siguientes son independientes: un snapshot técnico puede registrar `review`; FINISH exige la acreditación individual correspondiente. La elegibilidad comercial se detalla únicamente en [Exportación comercial](COMMERCIAL_EXPORT.md).

## Publicación técnica independiente

Sirve para registrar cortes técnicos trazables, incluidas revisiones, sin convertirlos en publicación individual comercializable.

### Finalidad y frontera comercial

`publicacion:tecnica` activa un **snapshot técnico independiente** destinado a comparación y mejora del catálogo. Conserva `PreparedProduct`, `status`, `issues`, identidades y huellas; no transforma `review` en `ready` ni constituye una acreditación editorial o comercial. No sustituye `catalogo:publicar`, `acreditar:proveedor`, FINISH ni la campaña global.

- **GAM, Gomariz y Mercaeleva**: entrada desde original canónico completo y preparación offline **compatible con las huellas vigentes**.
- **Manain**: entrada desde `manain-record.json`, CSV parcial y censo contrastados. El corte se identifica como `partial`; no es legítimo declararlo `complete` ni incorporarlo como publicación comercial individual mediante este comando. `publicacion:tecnica -- manain --ver` comprueba también el registro preservado frente al corte técnico activo (huella, identidades, preparados y descartes) sin reconstruir los CSV ni el censo ausentes; esta verificación interna no acredita la adquisición original ni habilita FINISH.
- **Exportación comercial**: sigue leyendo las publicaciones individuales acreditadas bajo `publications/`, no `technical/`. El original comercial históricamente acreditado se verifica contra su versión correspondiente; una exportación nueva con identidades ausentes del original vigente debe bloquearse hasta reconciliar las bajas.

**Estado acreditado el 11 de noviembre de 2026, no cifra contractual permanente:** Gomariz mantiene 547 fichas (535 `ready`, 12 `review`) con origen `complete`; Manain, 384 (383 `ready`, 1 `review`) con registro `partial`. Las otras tres publicaciones individuales comerciales permanecen en su circuito propio. Las cifras cambian legítimamente al evolucionar las fuentes.

### Operación: simulación, activación y lectura

La simulación es el comportamiento predeterminado y **no escribe**:

```powershell
npm run publicacion:tecnica -- gomariz --preparacion "storage/prepared/gomariz/<preparation-validada>.json"
npm run publicacion:tecnica -- manain --csv "storage/scraped/manain/scrape-manain-partial-all.csv" --censo "storage/diagnostics/manain/<censo-acreditado>.json"
```

Las rutas entre `<...>` son marcadores explicativos, no archivos que el script genere. No elegir una preparación solo por fecha: contrastar origen, huella de reglas y validación previa.

Tras verificar la simulación, la activación **solo del índice técnico** exige `--activar` en el mismo comando y fuente. Puede comprobarse sin escrituras:

```powershell
npm run publicacion:tecnica -- gomariz --ver
npm run publicacion:tecnica -- gomariz --listar
npm run publicacion:tecnica -- manain --ver
npm run publicacion:tecnica -- manain --listar
npm run publicacion:tecnica -- gomariz --comparar <sha256-de-version-verificada>
npm run estado
```

`--comparar` necesita una huella SHA-256 completa (64 caracteres) de una versión existente; los listados son de versiones verificables, **no** de los directorios por orden de nombre. `--json` ofrece salidas estructuradas; `--ver`, `--listar` y `--comparar` son consultas. El comando acepta las variantes `--preparation`/`--compare` que puede propagar el despachador, pero las formas públicas documentadas son `--preparacion`/`--comparar`.

### Versionado, retención e integridad

```text
catalogs/providers/<proveedor>/technical/
  active.json
  versions/<sha256>/
    snapshot.json
    manifest.json
```

Cada versión se identifica por el SHA-256 del snapshot y exige manifest correspondiente, identidades consistentes y archivos regulares. El índice activo registra la versión actual y, en las activaciones nuevas, `previousSha256`. La implementación de `src/infrastructure/filesystem/catalog/technical-publication.ts` conserva como máximo **la activa y la inmediatamente anterior** al rotar; no deduce cronología de nombres hash. La retirada solo actúa tras validar índices, versiones y rutas; rechaza elementos inesperados, corrupción o enlaces simbólicos. La activación idempotente no crea versiones adicionales.

Los archivos `.active.lock`, `.active-*.tmp` y `versions/.pending-*` son temporales de transacción; no son publicaciones definitivas. Se comprueban y limpian en el ciclo protegido de activación, no mediante un borrado genérico. `.gitignore` evita rastrear esos temporales, **no** el índice activo ni las versiones finales. Las simulaciones no activan versiones ni ejecutan retención destructiva.

No editar manualmente JSON, hashes ni índices para corregir diferencias. Si falla la validación, preservar las publicaciones vigentes y reparar el productor, la procedencia o la transacción responsable.

### Auditoría técnica y revisión editorial

```powershell
npm run huecos -- --tecnicas --detalle
npm run huecos -- --tecnicas --json
```

`--tecnicas` examina los snapshots técnicos activos, **incluidos** los `review` y sus incidencias. Es un modo de consulta exclusivo: no combinarlo con `--finales`, `--comparar`, `--specs`, `--titulos`, `--catalogo` o `--publicacion`. Las señales de longitud, repetición editorial, densidad y semántica son **orientativas**, no defectos acreditados ni permisos para rellenar valores. Si una familia presenta textos ausentes de forma masiva, contrastar primero el mapper y la proyección técnica antes de iniciar una campaña de correcciones.

El circuito comercial conserva su propia auditoría y exportación. Un corte técnico correcto **no acredita stock actual, exclusiones comerciales, decisiones editoriales ni importación en el backend**.

### Gomariz: exclusiones por disponibilidad

El extractor descubre anuncios desde `/venta/` y reconoce la señal explícita **«Sin existencias»** en la ficha individual. Estas URLs se registran en `storage/scraped/gomariz/scrape-gomariz-errors.json` como `exclusions` (URL y motivo), mientras el resumen publica `excludedProductUrls`. No se contabilizan como fallos de scraping ni se reintroducen en el original vigente. «Sin existencias» acredita indisponibilidad en el momento de consulta, no necesariamente venta definitiva.

En el corte del 11 de noviembre de 2026 se descubrieron 633 URLs, se incluyeron 547 y se justificaron 86 exclusiones sin errores de extracción. Once identidades de la publicación comercial histórica dejaron de estar presentes en el original vigente. **La auditoría histórica debe poder verificar el origen anterior; la exportación comercial de esas once identidades no debe reaparecer como válida sin reconciliación.** Esta comprobación es independiente de la retención técnica.

### Validación de cambios

```powershell
npm run contrato:comercial
npm run test:guard
npm test
npm run build
npm run estado
npm run publicacion:tecnica -- gomariz --ver
npm run publicacion:tecnica -- manain --ver
```

`npm test` incluye el guard de rendimiento, el guard del contrato comercial v2, la compilación requerida y las suites; `npm run exportar:comercial` también ejecuta el guard por el despachador. Un resultado verde no sustituye la validación de datos y procedencia. No generar nuevas versiones de un catálogo para validar un cambio documental.

Consultar también [Arquitectura](ARCHITECTURE.md), [Publicación individual](PUBLICATIONS.md), [Comercialización](COMMERCIAL_EXPORT.md), [Auditor de huecos](CATALOG_QUALITY.md) y [Mantenimiento](OPERATIONS_AND_MAINTENANCE.md).

## Publicación individual acreditada (FINISH)

Es el circuito de proveedor que produce los datos publicables acreditados y las fuentes para la exportación comercial vigente.

### Alcance y condiciones previas

El circuito individual usa los originales canónicos completos y verificables de `catalogs/providers/{gam,gomariz,mercaeleva}/original/`. Para **Manain**, admite exclusivamente el registro oficial `catalogs/providers/manain/records/manain-record.json` conciliado por huella e identidades con su publicación técnica; su procedencia permanece identificada como `partial` y no se presenta como una extracción canónica completa. No reemplaza la campaña global de cuatro proveedores. `catalogo:preparar` produce preparaciones offline; `catalogo:publicar` realiza la comprobación previa, la acreditación estrictamente limitada y FINISH. La operación intermedia `catalogo:acreditar` es opcional y no interactiva.

Los originales, las aprobaciones y los finales son conjuntos distintos. Una ficha `review` no cambia a `ready` por ser excluida de una selección; un catálogo con publicaciones vigentes no acredita por ello todas las fichas originales como `ready`. Ningún comando aquí importa productos al backend.

Si una mejora nace de un defecto de extracción, primero debe existir un **original canónico íntegro y validado**. La evidencia editorial por huella puede cambiar una preparación y después una publicación, pero no actualiza por sí sola el original. Las fichas con original, preparado y publicación distintos deben investigarse por identidad, no resolverse escribiendo el JSON final.

#### Diferencia con la publicación técnica independiente

`npm run publicacion:tecnica` conserva `ready` y `review` para análisis y puede activar Gomariz o el registro parcial de Manain sin ejecutar FINISH. **No** escribe en `publications/`, no selecciona candidatos comerciales ni reutiliza aprobaciones editoriales. El `catalogo:publicar` descrito en esta guía mantiene su preflight, su acreditación y su bloqueo ante decisiones nuevas. Ver [Publicaciones técnicas](PUBLICATIONS.md).

### Recorrido ordinario

Desde PowerShell, en la raíz del repositorio:

```powershell
npm ci
npm run catalogo:preparar
npm run catalogo:publicar -- --simular
npm run catalogo:publicar
npm run estado
```

Para operar solo un proveedor, añadir `-- --proveedor gam` (o `gomariz`, `mercaeleva` o `manain`) a los comandos `catalogo:*`. `--simular` consulta y calcula sin efectuar escrituras ni activar publicaciones. El flujo por defecto sigue incluyendo únicamente los tres proveedores con original canónico; Manain debe solicitarse expresamente. Ninguno se elige por la fecha del fichero.

**Manain:** la preparación oficial debe existir y su acreditación editorial debe estar aprobada expresamente mediante `acreditar:proveedor`. La revisión `MA3727` solo se excluye cuando consta una decisión válida con motivo y evidencia; la exclusión no modifica el registro original. FINISH genera la publicación individual con las fichas seleccionadas, verifica su procedencia y ejecuta el cierre ordinario. La exportación comercial por el circuito compartido requiere una integración independiente y no se presupone por la activación de esta publicación.

**Preparar.** `src/cli/commands/catalog/prepare-individual.ts` delega en `src/preparation/workflow/individual-prepare.ts`. Comprueba el original portátil y las huellas de origen/reglas; reutiliza una preparación compatible o produce otra versión con diagnósticos, preservando las anteriores. El resumen distingue `ready`, `review` y diferencias provisionales con la publicación vigente. Ausencias, revisiones o diferencias *no* son decisiones editoriales automáticas.

**Acreditar (opcional).** Si se desea comprobar por separado la reutilización de antecedentes, ejecutar:

```powershell
npm run catalogo:acreditar -- --simular
npm run catalogo:acreditar
```

No abre una sesión de decisiones humanas. `src/publication/automatic-individual-accreditation.ts` solo reutiliza exclusiones históricas acreditadas si coinciden **referencia, URL de origen, estado e incidencias**, con razones y evidencias válidas; no acredita por similitud ni inventa una decisión para una incidencia nueva. Una discrepancia detiene el proceso. La misma verificación se realiza automáticamente durante FINISH: este comando intermedio **no es obligatorio**.

**Publicar.** `src/cli/commands/catalog/publish-individual.ts` coordina `src/publication/individual-finish.ts`. FINISH hace un preflight completo: comprueba originales/preparaciones, exclusiones y aceptación de diferencias; bloquea bajas, pérdidas de descripciones, especificaciones o valores técnicos sin equivalencia acreditada, y cambios de identidad de origen. Tras superar esas comprobaciones, crea/verifica la candidata, su ZIP comercial y el recibo **antes** de seleccionar y verificar las publicaciones vigentes. No modifica el JSON anterior acreditado para forzar el éxito.

**Validaciones y coste operativo.** FINISH evita repetir dentro de una misma etapa ciertas reconstrucciones y validaciones de selecciones que ya han sido comprobadas; esto no autoriza a reutilizarlas sin límite. La acreditación, la inspección y la eventual activación preservan sus fronteras de comprobación: se detectan modificaciones de origen, preparación o decisiones entre pasos, y en la publicación real se conserva la verificación bajo bloqueo y de la selección activa. La CLI no necesita anteponer otra simulación completa al preflight propio de FINISH. La simulación `--simular` valida y calcula sin escrituras; no prueba por sí sola la activación real.

**Observabilidad.** El progreso distingue las etapas `ACREDITACIÓN` e `INSPECCIÓN`, y en publicación real también `ENTREGA`, `VERIFICACIÓN` y `ACTIVACIÓN`. Los contadores representan proveedores procesados, no fichas publicadas ni aprobaciones nuevas. Las duraciones se informan sin imponer límites fijos: una etapa lenta no debe ocultarse ni sortearse. La presentación corresponde a `src/cli/reporting/`, no a las reglas editoriales.

Si existe un caso nuevo o una exclusión distinta, resolverlo mediante el procedimiento editorial explícito `acreditar:proveedor` descrito en el [README](../README.md); ese procedimiento exige decisiones humanas y evidencia. La automatización no proporciona una aprobación genérica alternativa.

### Operaciones posteriores y recuperación

Tras una activación comprobada, FINISH ejecuta por separado:

1. La retención/archivado controlado con `scripts/maintenance/consolidate-local-artifacts.mjs --aplicar`.
2. El auditor de huecos (`--comparar --specs`, limitado a un resumen en consola).
3. El informe de trabajo sobre el conjunto original → publicado, con ZIP verificable en el Escritorio.

El informe se denomina `equipzilla-informe-<huella>.zip` y contiene **un solo `INFORME.md`**. Resume por proveedor y en total fichas originales/publicadas/excluidas, transformaciones, textos, títulos, campos y valores de specs, precios, condiciones, categorías y galerías. Se calcula al contrastar las publicaciones acreditadas con sus originales, no mediante estimaciones de trabajo previo ni copias de una publicación anterior. Su huella identifica la combinación verificada de orígenes, aprobaciones y publicaciones. **No sustituye un JSON publicable**, un expediente de calidad, ni una validación de completitud externa.

FINISH conserva un diario en `storage/publication/individual-finish/` para recuperar activaciones parciales. Si falla retención, auditor o informe **después** de activar, las publicaciones ya comprobadas se conservan: el error identifica el paso pendiente y se puede repetir `npm run catalogo:publicar` tras corregir la causa. Con las mismas aprobaciones ya vigentes, el comando no crea nuevos ZIP comerciales ni vuelve a publicar; verifica o completa las operaciones posteriores. No borrar manualmente el diario, originales, recibos o publicaciones.

**Estados observables distintos:** (a) preparación correcta y preflight conforme, pero publicación aún no activa; (b) publicación activada y verificada, con un paso posactivación pendiente; (c) FINISH completo, incluidos retención, auditor e informe. Acreditar cada afirmación con su recibo, selector activo y diario. En un fallo tardío no restaurar ni sobrescribir una publicación verificada; resolver el paso pendiente y repetir FINISH de forma idempotente. Una exportación comercial posterior no reemplaza el archivado histórico. La mejora continua del catálogo sigue el [manual de mejora](CATALOG_QUALITY.md).

Una campaña global de cuatro proveedores mantiene su propio flujo y retención; no se debe confundir con este FINISH individual. Para su operación consultar [Campañas](CAMPAIGNS.md) y [Acreditación de campaña](CAMPAIGNS.md).

### Validación y límites

```powershell
npm test
npm run build
npm run estado
npm run huecos -- --comparar --specs
```

Un build verde y un FINISH completo prueban contratos distintos. `estado` inspecciona integridad y publicaciones vigentes, pero no garantiza cobertura web; `huecos` es de solo lectura. La preparación, los cambios editoriales y la acreditación requieren verificar los casos reales según [Validación](VALIDATION.md), [Arquitectura](ARCHITECTURE.md) y [Reglas de datos](DATA_CONTRACTS.md).
