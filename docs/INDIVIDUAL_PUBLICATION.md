# Publicación individual de catálogos: preparación, acreditación y FINISH

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** FINISH y sus preflights siguen siendo distintos de `publicacion:tecnica`. No reutilizar una aprobación editorial histórica cuando hayan cambiado la preparación, las incidencias o el original.

## Alcance y condiciones previas

El circuito simplificado usa los originales canónicos completos y verificables de `catalogs/providers/{gam,gomariz,mercaeleva}/original/`. **No incluye Manain**, que mantiene un registro parcial, ni reemplaza la campaña global de cuatro proveedores. `catalogo:preparar` produce preparaciones offline; `catalogo:publicar` realiza la comprobación previa, la acreditación automática estrictamente limitada y FINISH. La operación intermedia `catalogo:acreditar` es opcional y no interactiva.

Los originales, las aprobaciones y los finales son conjuntos distintos. Una ficha `review` no cambia a `ready` por ser excluida de una selección; un catálogo con publicaciones vigentes no acredita por ello todas las fichas originales como `ready`. Ningún comando aquí importa productos al backend.

Si una mejora nace de un defecto de extracción, primero debe existir un **original canónico íntegro y validado**. La evidencia editorial por huella puede cambiar una preparación y después una publicación, pero no actualiza por sí sola el original. Las fichas con original, preparado y publicación distintos deben investigarse por identidad, no resolverse escribiendo el JSON final.

### Diferencia con la publicación técnica independiente

`npm run publicacion:tecnica` conserva `ready` y `review` para análisis y puede activar Gomariz o el registro parcial de Manain sin ejecutar FINISH. **No** escribe en `publications/`, no selecciona candidatos comerciales ni reutiliza aprobaciones editoriales. El `catalogo:publicar` descrito en esta guía mantiene su preflight, su acreditación y su bloqueo ante decisiones nuevas. Ver [Publicaciones técnicas](TECHNICAL_PUBLICATIONS.md).

## Recorrido ordinario

Desde PowerShell, en la raíz del repositorio:

```powershell
npm ci
npm run catalogo:preparar
npm run catalogo:publicar -- --simular
npm run catalogo:publicar
npm run estado
```

Para operar solo un proveedor, añadir `-- --proveedor gam` (o `gomariz` o `mercaeleva`) a los comandos `catalogo:*`. `--simular` consulta y calcula sin efectuar escrituras ni activar publicaciones. El flujo por defecto incluye los tres proveedores; ninguno se elige por la fecha del fichero.

**Preparar.** `src/cli/commands/catalog/prepare-individual.ts` delega en `src/preparation/workflow/individual-prepare.ts`. Comprueba el original portátil y las huellas de origen/reglas; reutiliza una preparación compatible o produce otra versión con diagnósticos, preservando las anteriores. El resumen distingue `ready`, `review` y diferencias provisionales con la publicación vigente. Ausencias, revisiones o diferencias *no* son decisiones editoriales automáticas.

**Acreditar (opcional).** Si se desea comprobar por separado la reutilización de antecedentes, ejecutar:

```powershell
npm run catalogo:acreditar -- --simular
npm run catalogo:acreditar
```

No abre una sesión de decisiones humanas. `src/publication/automatic-individual-accreditation.ts` solo reutiliza exclusiones históricas acreditadas si coinciden **referencia, URL de origen, estado e incidencias**, con razones y evidencias válidas; no acredita por similitud ni inventa una decisión para una incidencia nueva. Una discrepancia detiene el proceso. La misma verificación se realiza automáticamente durante FINISH: este comando intermedio **no es obligatorio**.

**Publicar.** `src/cli/commands/catalog/publish-individual.ts` coordina `src/publication/individual-finish.ts`. FINISH hace un preflight completo: comprueba originales/preparaciones, exclusiones y aceptación de diferencias; bloquea bajas, pérdidas de descripciones, especificaciones o valores técnicos sin equivalencia acreditada, y cambios de identidad de origen. Tras superar esas comprobaciones, crea/verifica la candidata, su ZIP comercial y el recibo **antes** de seleccionar y verificar las publicaciones vigentes. No modifica el JSON anterior acreditado para forzar el éxito.

Si existe un caso nuevo o una exclusión distinta, resolverlo mediante el procedimiento editorial explícito `acreditar:proveedor` descrito en el [README](../README.md); ese procedimiento exige decisiones humanas y evidencia. La automatización no proporciona una aprobación genérica alternativa.

## Operaciones posteriores y recuperación

Tras una activación comprobada, FINISH ejecuta por separado:

1. La retención/archivado controlado con `scripts/maintenance/consolidate-local-artifacts.mjs --aplicar`.
2. El auditor de huecos (`--comparar --specs`, limitado a un resumen en consola).
3. El informe de trabajo sobre el conjunto original → publicado, con ZIP verificable en el Escritorio.

El informe se denomina `equipzilla-informe-<huella>.zip` y contiene **un solo `INFORME.md`**. Resume por proveedor y en total fichas originales/publicadas/excluidas, transformaciones, textos, títulos, campos y valores de specs, precios, condiciones, categorías y galerías. Se calcula al contrastar las publicaciones acreditadas con sus originales, no mediante estimaciones de fases ni copias de una publicación anterior. Su huella identifica la combinación verificada de orígenes, aprobaciones y publicaciones. **No sustituye un JSON publicable**, un expediente de calidad, ni una validación de completitud externa.

FINISH conserva un diario en `storage/publication/individual-finish/` para recuperar activaciones parciales. Si falla retención, auditor o informe **después** de activar, las publicaciones ya comprobadas se conservan: el error identifica el paso pendiente y se puede repetir `npm run catalogo:publicar` tras corregir la causa. Con las mismas aprobaciones ya vigentes, el comando no crea nuevos ZIP comerciales ni vuelve a publicar; verifica o completa las operaciones posteriores. No borrar manualmente el diario, originales, recibos o publicaciones.

**Estados observables distintos:** (a) preparación correcta y preflight conforme, pero publicación aún no activa; (b) publicación activada y verificada, con un paso posactivación pendiente; (c) FINISH completo, incluidos retención, auditor e informe. Acreditar cada afirmación con su recibo, selector activo y diario. En un fallo tardío no restaurar ni sobrescribir una publicación verificada; resolver el paso pendiente y repetir FINISH de forma idempotente. Una exportación comercial posterior no reemplaza el archivado histórico. La mejora por fases de catálogo sigue el [manual de mejora](CATALOG_IMPROVEMENT.md).

Una campaña global de cuatro proveedores mantiene su propio flujo y retención; no se debe confundir con este FINISH individual. Para su operación consultar [Campañas](CAMPAIGNS.md) y [Acreditación de campaña](CAMPAIGN_ACCREDITATION.md).

## Validación y límites

```powershell
npm test
npm run build
npm run estado
npm run huecos -- --comparar --specs
```

Un build verde y un FINISH completo prueban contratos distintos. `estado` inspecciona integridad y publicaciones vigentes, pero no garantiza cobertura web; `huecos` es de solo lectura. La preparación, los cambios editoriales y la acreditación requieren verificar los casos reales según [Validación](VALIDATION.md), [Arquitectura](ARCHITECTURE.md) y [Reglas de datos](SCRAPER_DATA_RULES.md).
