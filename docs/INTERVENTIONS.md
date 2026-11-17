# Intervenciones acreditadas — scripts, simulación y aplicación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Una observación de `huecos` o una ficha `review` no autoriza una intervención. La simulación no aprueba el script; no se modifica el original ni se suplanta la decisión humana. Conservar identidad, fuente, huella y campos permitidos en cada propuesta.

**Propietario:** correcciones manuales sobre derivados de campañas, catálogo de scripts, propuestas, composición, simulación, aplicación y aprobación explícita. Antes de intervenir, clasificar si el fallo requiere corregir el motor compartido: [Calidad](CATALOG_QUALITY.md).

## Cuándo utilizarlas

Una intervención es una corrección **puntual y acreditada**, decidida por una persona tras contrastar la ficha con la fuente vigente. No es un formateador general, no completa datos por intuición y **no se ejecuta automáticamente al extraer, revisar o finalizar**. Si el problema se repite en numerosas fichas, corregir el extractor, mapeador o formateador responsable.

El contrato vigente es `ManualInterventionProposal` en `src/catalog/interventions/contracts.ts`. Admite estos campos, y ningún otro:

- `title`, `shortDescription`, `longDescription`, `brand` y `model`: texto o `null` cuando lo permita el contrato; `brand` y `model` requieren como nuevo valor texto no vacío.
- `spec:<clave>`: **solo** un atributo técnico ya existente en `product.specs`, con valores concretos del tipo admitido (`string`, `number`, `boolean` o array no vacío de estos). No se añaden claves ausentes ni se establece `null` como valor nuevo.

No se admiten imágenes, identidad, referencia, serie, categoría ni precios. Una foto que la fuente ya no publica no debe restaurarse desde una URL histórica. Si la fuente actual sí la muestra pero el scraper no la obtiene, se investiga y repara el extractor.

## Por qué no sustituyen al desarrollo productivo

El sistema de intervenciones está reservado para correcciones **aisladas, excepcionales y acreditadas** que no se pueden expresar con seguridad como una regla común. Si varias fichas comparten un defecto del parser, las unidades, la deduplicación, las descripciones o la validación, **se corrige antes el código productivo**; no se crean decenas de scripts por referencia para conseguir `0 review`. Los scripts existentes tampoco se ejecutan automáticamente en campañas nuevas ni se convierten en un segundo normalizador permanente.

También existen **reconciliaciones específicas productivas** y evidencias editoriales por identidad y huella en `src/preparation/<proveedor>/`, distintas de las intervenciones manuales de campaña: pueden ejecutarse durante la preparación por las guardas y el orden del motor, sin exigir aplicar un script de `src/catalog/interventions/records/`. Deben probarse con la unidad real, variante vecina y fuente distinta; tampoco autorizan aprobar manualmente una review. Para escoger entre reparar extracción, añadir una evidencia verificable o solicitar una decisión humana, consultar el [manual de mejora acreditada](CATALOG_QUALITY.md).

La decisión humana no se reemplaza por una excepción automática. Si el proveedor publica una contradicción genuina sin evidencia concluyente, se conserva el bloqueo y la revisión editorial; **no se proclama un catálogo completo `ready` por excluirla**. Ver [Objetivos](CATALOG_OPERATIONS.md) y [Validación](VALIDATION.md).

## Consultar y mantener el catálogo versionado

Desde la raíz del repositorio, sin necesidad de una campaña activa:

```powershell
npm run intervenir -- gam --listar
npm run intervenir -- gam --consultar gam-6002
npm run intervenir -- gam --consultar gam:ref:6002
```

La consulta obtiene metadatos, identidades, campos, motivos y evidencias mediante análisis **estático**; no importa ni ejecuta el script. Un archivo inválido bloquea el catálogo. Para evaluar su vigencia contra campañas completas y verificables:

```powershell
npm run intervenir -- gam --mantenimiento
```

Este comando tampoco aplica cambios ni elimina scripts. El mantenimiento consulta el historial íntegro disponible y, bajo la retención de dos campañas globales, puede disponer de menos observaciones que en instalaciones anteriores; **no reconstruye un historial inexistente**. Una ausencia aislada no es suficiente para recomendar la retirada; cuando hay evidencia consecutiva y comparable propone una **revisión humana**, no un borrado automático. Tras comprobar la fuente y las campañas, se puede retirar **solo** el script afectado con `git rm -- src/catalog/interventions/records/gam/6002.ts` (ejemplo: ejecutar únicamente si realmente se decide retirar esa intervención).

## Crear y simular una intervención permanente

Tras `npm run extraer` y `npm run revisar`, identificar el problema concreto y contrastar los valores con la ficha vigente. Añadir un archivo `.ts` independiente bajo `src/catalog/interventions/records/<proveedor>/<archivo>.ts`, bajo control de Git. Debe exportar **dos declaraciones estáticas**:

- `metadata`: objeto con `id` estable y exclusivo (prefijo `<proveedor>-`) y `summary` descriptivo no vacío.
- `proposals`: array no vacío de propuestas con `providerId`, `identity`, `field`, `expected`, `next`, `reason` y `evidence`.

No duplicar en `metadata` datos ya deducibles de `proposals`. `identity` procede de `buildProductIdentity` sobre el catálogo original; `expected` debe coincidir con la fuente vigente y `next` exige evidencia actual. Se rechazan imports ejecutables, valores computados y propuestas de otro proveedor. No se deben utilizar scripts no revisados: la consulta es estática, pero **la aplicación sí evalúa TypeScript de confianza**.

Se incluyen `src/catalog/interventions/records/gam/6002.ts`, `6003.ts` y `6004.ts` como casos reales, cada uno retirable sin los demás. Para simular uno o varios scripts seleccionados:

```powershell
npm run intervenir -- gam --script src/catalog/interventions/records/gam/6002.ts
npm run intervenir -- gam --script src/catalog/interventions/records/gam/6002.ts --script src/catalog/interventions/records/gam/6003.ts
```

La comparación muestra intervenciones pendientes, corregidas en origen, ausentes, parciales o divergentes. Las corregidas en origen y las ausentes **no se reaplican**; las parciales o divergentes bloquean el conjunto. Ningún script se ejecuta por existir en Git o por figurar en el catálogo.

**Compatibilidad histórica:** `--registrar` y `npm run intervencion:conservar` ya no pertenecen al flujo actual. No crear scripts en `storage/interventions/<lote>/scripts/` ni en `interventions/permanentes/<lote>/`. Los scripts temporales de campañas anteriores y sus expedientes `version: 1` siguen admitidos para lectura y recuperación; no moverlos ni borrarlos mientras puedan ser necesarios. Los módulos antiguos de registro ya no forman parte del repositorio y no requieren comandos adicionales de migración.

## Aplicar y acreditar

Cuando la simulación sea correcta, repetir la operación indicando los mismos scripts y la autorización explícita `--aplicar`:

```powershell
npm run intervenir -- gam --script src/catalog/interventions/records/gam/6002.ts --aplicar
```

Este comando recalcula y valida el plan contra el origen, aplica los cambios **en un derivado**, verifica el expediente y las huellas, y prepara y valida la ficha corregida. Los catálogos originales permanecen intactos. Si el derivado de ese plan ya existe y es íntegro, puede recuperarse una preparación interrumpida sin duplicar la intervención. Una discrepancia del origen o del plan bloquea la aplicación.

El derivado se sitúa bajo `storage/interventions/<id-lote>/results/<sha256-del-plan>/catalog-derived.json` y su preparación bajo `results/<sha256-del-plan>/prepared/`. No es un JSON publicable: exige volver a revisar el lote y aprobar específicamente la intervención mediante:

```powershell
npm run revisar
npm run acreditar
```

Si antes existía un borrador aprobado, la preparación intervenida genera **otro borrador por huellas**. Para incluir una ficha intervenida que siga `ready`, el borrador debe contener la decisión individual `"incluir"`, con motivo y evidencia actuales. Ninguna intervención convierte un producto `review` en publicable por sí sola.

## Herramientas avanzadas y seguridad

`npm run intervenir:manual`, `intervenir:preparar` e `intervenir:validar` mantienen sus contratos explícitos de rutas y SHA para diagnóstico o mantenimiento. El flujo `intervenir` reduce ese trabajo manual, pero **no sustituye la decisión humana**. Un script TypeScript de intervención se ejecuta como código local de confianza al aplicarlo: verificar su procedencia y revisar la simulación; no es un sandbox frente a código malicioso.

La rotación automática conserva los resultados y derivados mientras la campaña siga retenida; cuando la más antigua ya puede retirarse, solo admite rutas y archivos reconocidos tras verificar las entregas por `runId`. Los scripts históricos situados en `storage/interventions/<id-lote>/scripts/` quedan protegidos por compatibilidad. Los scripts permanentes de `src/catalog/interventions/records/` están versionados en Git y nunca se retiran con una campaña. No existe un paso de limpieza manual ordinaria tras entregar.

Referencias: [Campañas](CAMPAIGNS.md), [Acreditación](CAMPAIGNS.md), [Composición de intervenciones](INTERVENTIONS.md), [Validación](VALIDATION.md).

## Contrato de composición manual

Las rutas avanzadas y el esquema de propuestas no sustituyen el circuito ordinario de campañas. Son útiles cuando existen varias correcciones de unidad acreditadas que deben aplicarse juntas.

### Scripts independientes y composición

Los scripts reutilizables viven bajo `src/catalog/interventions/records/<proveedor>/<archivo>.ts` y se versionan en Git, idealmente uno por máquina o incidencia que pueda retirarse individualmente. Cada script declara `metadata` con identificador y resumen estáticos, y `proposals` con las correcciones acreditadas. **No** deben copiarse ni registrarse para cada campaña.

Cada `ManualInterventionProposal` contiene `providerId`, `identity`, `field`, `expected`, `next`, `reason` y `evidence`. La identidad sale de `buildProductIdentity` y el valor esperado debe coincidir con **el catálogo vigente**. Se admiten título, descripciones, marca, modelo y atributos técnicos **existentes** mediante `field: "spec:<nombre exacto del atributo>"`. Los atributos admiten valores originales del tipo `SpecValue`, sin borrar atributos ni añadir nombres nuevos. Los cambios de texto usan `string | null`. Se rechazan fotografías, números de serie, referencias, URL, categorías y otros identificadores. El hecho de que una marca o un modelo existan en otra publicación no demuestra que correspondan a la unidad concreta.

Varios scripts pueden componerse en una misma simulación o aplicación; dos propuestas para el mismo campo de la misma máquina dan conflicto, aunque propongan el mismo valor. El orden no cambia el SHA del plan. El catálogo `--listar` y la consulta `--consultar` inspeccionan código estático sin ejecutarlo; el motor de aplicación carga únicamente los scripts **seleccionados**.

Las rutas antiguas `storage/interventions/<campana>/scripts/` siguen admitidas para recuperación de expedientes existentes. No crear allí scripts nuevos: el registro por campaña está retirado.

### Simular, aplicar y verificar

Desde la raíz del proyecto, sustituyendo los marcadores por rutas existentes:

```powershell
npm run intervenir:manual -- gam --script src/catalog/interventions/records/gam/6002.ts --script src/catalog/interventions/records/gam/6003.ts --origen <catalogo-catalog.json> --detalle
```

El resultado muestra el SHA del plan y el antes/después, sin modificar catálogos. Tras comprobar cada cambio y aprobarlo manualmente:

```powershell
npm run intervenir:manual -- gam --script src/catalog/interventions/records/gam/6002.ts --script src/catalog/interventions/records/gam/6003.ts --origen <catalogo-catalog.json> --campana <campana> --aplicar --plan <sha256-completo>
```

La salida es **un único** `storage/interventions/<campana>/results/<sha>/catalog-derived.json` y su `intervention-record.json`, con registro de los scripts seleccionados y cambios. El catálogo canónico y su manifest permanecen intactos. No editar manualmente el resultado.

```powershell
npm run intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <catalogo-catalog.json> --simular
npm run intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <catalogo-catalog.json>
npm run intervenir:validar -- gam --derivado <catalog-derived.json> --origen <catalogo-catalog.json> --preparacion <intervention-preparation.json>
```

El mismo procedimiento se realiza por separado en los proveedores que tengan intervenciones. Para los demás se utilizan las preparaciones canónicas originales. No se inventan intervenciones vacías para proveedores sin incidencias.

### Selección editorial de una campaña global

La preparación intervenida no se publica por el mero hecho de estar validada. El selector avanzado también admite un conjunto histórico de tres proveedores sin `--manain` para compatibilidad, pero eso **no es una campaña global completa bajo el contrato vigente**. Se puede aportar en `--gam`, `--gomariz`, `--mercaeleva` o `--manain` junto con preparaciones normales de los otros proveedores y el **mismo** `run.json` global completo, de acuerdo con `docs/CAMPAIGNS.md`.

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --manain <manain-preparation.json> --lote <run.json> --borrador <borrador.json>
```

El selector reconstruye el derivado desde los cambios acreditados y el catálogo canónico de ese lote, vuelve a validar la preparación y comprueba sus hashes. El borrador incluye cada ficha intervenida que haya quedado lista con `status: "intervention"`. **Solo tras revisión humana** admite `decision: "incluir"`, `reason` justificativa y `evidenceUrls` HTTPS que incluya la ficha vigente. También se puede excluir con una decisión documentada. Una ficha que siga en `review` o con contradicción de identidad **no puede incluirse** por este procedimiento. Las demás exclusiones siguen exigiendo `decision: "excluir"` y evidencia. Establecer `approved: true` y `approvalReason` solo después de decidir todas las entradas.

Después simular la selección con `--lote <run.json> --acreditacion <aprobada.json> --simular`; si es correcta, repetir con `--directorio-salida <directorio-nuevo>` para obtener los cuatro JSON del conjunto actual de proveedores y `selection.json`. La aprobación está vinculada a las huellas exactas de la campaña, las preparaciones y los planes intervenidos: no vale para otra ejecución.

No se recuperan imágenes de campañas anteriores. La galería siempre procede de la extracción actual y permanece inalterada durante cualquier intervención.

### Alcance actual

El sistema no infiere valores verdaderos, no verifica placas ni documentos externos y no reemplaza el contraste humano exigible **únicamente para decisiones editoriales genuinas**. Esa excepción no traslada al propietario el diagnóstico técnico de patrones ni convierte una intervención por ficha en sustituto de reparar código productivo. Si una máquina sigue publicando datos contradictorios sin fuentes concluyentes, debe permanecer pendiente; no se creará un script provisional para hacerla pasar los controles. Los documentos maestros de continuidad se mantienen conforme a su propio protocolo; esta guía operativa no los sustituye.
