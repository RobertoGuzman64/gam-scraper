# Composición manual de intervenciones y acreditación editorial

## Decisión previa

Antes de crear scripts se debe clasificar cada incidencia usando el anuncio vigente y el diagnóstico: si falla la extracción, hay que corregir el extractor; si falla una regla reutilizable, hay que corregir el mapeador o formateador con su prueba; si el propio proveedor publica información contradictoria de una máquina concreta, se puede intervenir **solo el campo acreditado**. No se deben añadir reglas permanentes que dependan de una referencia comercial concreta. Una ficha sin evidencia suficiente permanece en revisión.

Las campañas ordinarias extraen **todos los proveedores habilitados**. Las intervenciones se ejecutan solo de forma manual y nunca forman parte de la extracción o de tareas automáticas.

## Prioridad de desarrollo sobre la composición manual

Componer scripts resuelve **casos singulares acreditados**, no patrones de producción. Si la simulación revela un defecto común de lectura, formato, asociación de atributos o validación, hay que **arreglar ese módulo en el scraper y verificar de nuevo el catálogo completo**. No sustituir la mejora del motor por un archivo `.ts` por máquina ni tratar una simulación o un derivado como prueba de que el original está completamente `ready`. La intervención editorial permanece estrictamente humana y sobre derivados, con los límites de campos del contrato. Ver [Objetivos](SCRAPER_OBJECTIVES.md).


## Scripts independientes y composición

Los scripts reutilizables viven bajo `interventions/<proveedor>/<archivo>.ts` y se versionan en Git, idealmente uno por máquina o incidencia que pueda retirarse individualmente. Cada script declara `metadata` con identificador y resumen estáticos, y `proposals` con las correcciones acreditadas. **No** deben copiarse ni registrarse para cada campaña.

Cada `ManualInterventionProposal` contiene `providerId`, `identity`, `field`, `expected`, `next`, `reason` y `evidence`. La identidad sale de `buildProductIdentity` y el valor esperado debe coincidir con **el catálogo vigente**. Se admiten título, descripciones, marca, modelo y atributos técnicos **existentes** mediante `field: "spec:<nombre exacto del atributo>"`. Los atributos admiten valores originales del tipo `SpecValue`, sin borrar atributos ni añadir nombres nuevos. Los cambios de texto usan `string | null`. Se rechazan fotografías, números de serie, referencias, URL, categorías y otros identificadores. El hecho de que una marca o un modelo existan en otra publicación no demuestra que correspondan a la unidad concreta.

Varios scripts pueden componerse en una misma simulación o aplicación; dos propuestas para el mismo campo de la misma máquina dan conflicto, aunque propongan el mismo valor. El orden no cambia el SHA del plan. El catálogo `--listar` y la consulta `--consultar` inspeccionan código estático sin ejecutarlo; el motor de aplicación carga únicamente los scripts **seleccionados**.

Las rutas antiguas `storage/interventions/<campana>/scripts/` siguen admitidas para recuperación de expedientes existentes. No crear allí scripts nuevos: el registro por campaña está retirado.

## Simular, aplicar y verificar

Desde la raíz del proyecto, sustituyendo los marcadores por rutas existentes:

```powershell
npm run intervenir:manual -- gam --script interventions/gam/6002.ts --script interventions/gam/6003.ts --origen <catalogo-catalog.json> --detalle
```

El resultado muestra el SHA del plan y el antes/después, sin modificar catálogos. Tras comprobar cada cambio y aprobarlo manualmente:

```powershell
npm run intervenir:manual -- gam --script interventions/gam/6002.ts --script interventions/gam/6003.ts --origen <catalogo-catalog.json> --campana <campana> --aplicar --plan <sha256-completo>
```

La salida es **un único** `storage/interventions/<campana>/results/<sha>/catalog-derived.json` y su `intervention-record.json`, con registro de los scripts seleccionados y cambios. El catálogo canónico y su manifest permanecen intactos. No editar manualmente el resultado.

```powershell
npm run intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <catalogo-catalog.json> --simular
npm run intervenir:preparar -- gam --derivado <catalog-derived.json> --origen <catalogo-catalog.json>
npm run intervenir:validar -- gam --derivado <catalog-derived.json> --origen <catalogo-catalog.json> --preparacion <intervention-preparation.json>
```

El mismo procedimiento se realiza por separado en los proveedores que tengan intervenciones. Para los demás se utilizan las preparaciones canónicas originales. No se inventan intervenciones vacías para proveedores sin incidencias.

## Selección editorial de una campaña global

La preparación intervenida no se publica por el mero hecho de estar validada. El selector avanzado también admite un conjunto histórico de tres proveedores sin `--manain` para compatibilidad, pero eso **no es una campaña global completa bajo el contrato vigente**. Se puede aportar en `--gam`, `--gomariz`, `--mercaeleva` o `--manain` junto con preparaciones normales de los otros proveedores y el **mismo** `run.json` global completo, de acuerdo con `docs/CAMPAIGN_ACCREDITATION.md`.

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --manain <manain-preparation.json> --lote <run.json> --borrador <borrador.json>
```

El selector reconstruye el derivado desde los cambios acreditados y el catálogo canónico de ese lote, vuelve a validar la preparación y comprueba sus hashes. El borrador incluye cada ficha intervenida que haya quedado lista con `status: "intervention"`. **Solo tras revisión humana** admite `decision: "incluir"`, `reason` justificativa y `evidenceUrls` HTTPS que incluya la ficha vigente. También se puede excluir con una decisión documentada. Una ficha que siga en `review` o con contradicción de identidad **no puede incluirse** por este procedimiento. Las demás exclusiones siguen exigiendo `decision: "excluir"` y evidencia. Establecer `approved: true` y `approvalReason` solo después de decidir todas las entradas.

Después simular la selección con `--lote <run.json> --acreditacion <aprobada.json> --simular`; si es correcta, repetir con `--directorio-salida <directorio-nuevo>` para obtener los cuatro JSON del conjunto actual de proveedores y `selection.json`. La aprobación está vinculada a las huellas exactas de la campaña, las preparaciones y los planes intervenidos: no vale para otra ejecución.

No se recuperan imágenes de campañas anteriores. La galería siempre procede de la extracción actual y permanece inalterada durante cualquier intervención.

## Alcance actual

El sistema no infiere valores verdaderos, no verifica placas ni documentos externos y no reemplaza la investigación manual. Si una máquina sigue publicando datos contradictorios sin fuentes concluyentes, debe permanecer pendiente; no se creará un script provisional para hacerla pasar los controles. Los documentos maestros de continuidad se mantienen conforme a su propio protocolo; esta guía operativa no los sustituye.
