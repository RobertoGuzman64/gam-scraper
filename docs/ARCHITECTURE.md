# Arquitectura

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Mantener las fronteras entre `scraping/`, `preparation/`, `publication/`, `infrastructure/` y `commercial/`. No hacer que el índice técnico seleccione, modifique ni autorice una publicación comercial.

## Visión general y estructura vigente

EQUIPZILLA es una CLI local en Node.js, TypeScript estricto y ESM. No ofrece API HTTP ni realiza importaciones o escrituras en el backend. La arquitectura organiza las responsabilidades por dominio, **sin `src/pipeline/` ni `src/catalog/preparation/`**:

```text
scripts/                    Entradas, runner, tooling, inspección, mantenimiento y operaciones
src/
  campaign/                Orquestación global, entrega, referencia y retención
  catalog/                 Identidad, calidad, normalización, cobertura, editorial y diagnósticos
  cli/                     Comandos, opciones y presentación de informes
  commercial/              Proyección comercial, validación, exportación y compatibilidad legada
  contracts/               Contratos compartidos de datos y proveedores
  infrastructure/          Filesystem, integridad, locks, HTTP, navegador y XLSX
  preparation/             Preparación técnica, reconciliaciones y reglas por proveedor
  publication/             Publicaciones individuales, acreditación y FINISH
  scraping/                Motor, batch, proveedores y salida de extracción
  shared/                  Utilidades transversales
  testing/                 Fixtures y builders de pruebas
  tools/                   Herramientas internas de catálogo y semillas GAM
interventions/             Scripts de intervención acreditables
catalogs/providers/        Originales completos, publicaciones individuales y snapshots técnicos portátiles
catalogs/campaigns/        Instantáneas acreditadas de campañas globales
storage/                   Trabajo y recuperación locales, excluidos de Git
dist/                      Compilados regenerables, excluidos de Git
```

El registro de proveedores está en `src/scraping/registry.ts` y el contrato de campaña de cuatro proveedores (GAM, Gomariz, Mercaeleva y Manain) en `src/contracts/campaign-providers.ts`. Las publicaciones individuales comerciales vigentes pueden operar para GAM, Gomariz y Mercaeleva; Manain mantiene su flujo parcial y no debe darse por completo sin acreditación. **En paralelo**, las publicaciones técnicas independientes admiten Gomariz y Manain, entre otros proveedores, con estados `ready/review` y procedencia explícita. La lectura de históricos de tres proveedores no cambia el contrato de campaña actual.

## Fronteras y dirección de dependencias

| Área                                          | Responsabilidad                                                               | Límite que se debe proteger                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cli/`, `scripts/`                            | Opciones, ejecución y presentación                                            | No interpretar HTML ni introducir reglas técnicas o comerciales en la UI     |
| `scraping/`                                   | Descubrimiento, extracción, deduplicación y salida de origen                  | No atribuir decisiones editoriales ni importar al backend                    |
| `catalog/`                                    | Identidad, calidad, normalización, selección y diagnósticos                   | No mezclar inspección con mutación de publicaciones                          |
| `preparation/`                                | Construcción y validación de candidatos técnicos, evidencias y `ready/review` | No exigir IDs comerciales para declarar calidad del origen                   |
| `commercial/`                                 | Proyectar categorías y atributos, acreditar y generar JSON comerciales        | No cambiar originales, finales técnicos ni reglas de importación del backend |
| `campaign/`, `publication/`                   | Orquestar campañas y publicaciones, acreditación y recuperación               | No saltarse preflight ni inventar decisiones humanas                         |
| `infrastructure/`                             | Persistencia, hashes, manifiestos, retención y seguridad de rutas             | No decidir identidad comercial o calidad editorial                           |
| `contracts/`, `shared/`, `testing/`, `tools/` | Contratos y herramientas auxiliares                                           | No trasladar reglas específicas a capas genéricas                            |

No hay una capa `pipeline` física. Los orquestadores viven junto al dominio que coordinan: `src/scraping/workflow/`, `src/scraping/batch/`, `src/preparation/workflow/`, `src/campaign/` y `src/publication/`. Tener numerosas dependencias no es por sí solo un defecto de diseño. No reorganizar carpetas, introducir capas vacías o mover reglas por estética.

## Flujos y puntos de entrada

### Extracción y salida

`src/cli/commands/extraction/scrape.ts` entra en `src/scraping/workflow/run.ts`, con adaptadores registrados en `src/scraping/registry.ts`. La extracción por lote se implementa en `src/scraping/batch/`. La escritura, los CSV y la salida estructural se concentran en `src/scraping/output/publish.ts` y `csv-serializer.ts`. La salida publicada no debe reemplazarse por un parcial o por un intento incompleto. La promoción portátil de un original individual elegible corresponde a `src/infrastructure/filesystem/catalog/portable-original.ts`.

Mercaeleva tiene separado el ciclo de navegador en `src/scraping/providers/mercaeleva/browser.ts` y las comprobaciones de paginación en `browser-pagination.ts`; Manain dispone de un circuito de navegador/censo propio. Los binarios de navegador necesarios son una dependencia del entorno, no una garantía de cobertura.

### Preparación técnica y revisión

La entrada de producto es `src/preparation/prepare-product.ts`, que expone `prepareSourceProduct` y `prepareWithCatalog`. La orquestación offline reside en `src/preparation/workflow/` y las huellas en `src/infrastructure/filesystem/preparation/`. Tras las reconciliaciones técnicas, la evidencia editorial se captura mediante `shared/editorial/mapping/source-editorial-evidence.ts` y se resuelve por el motor común `shared/editorial/mapping/prepared-editorial.ts`: `prepared-editorial-source.ts` integra fuente, conocimiento y composición de cortas/generales, `prepared-editorial-title.ts` decide título y `prepared-editorial-presentation.ts` normaliza la presentación final bajo condiciones acreditadas. Los adaptadores editoriales propios de proveedor interpretan el origen; **no existen narradores históricos individuales conectados** en el alcance de los guards. La referencia de responsabilidades y precedencias es [Motor editorial compartido](EDITORIAL_ENGINE.md).

La composición técnica actual usa `src/preparation/shared/technical/reconciliation/preparation-technical-stages.ts`: coordina las transformaciones iniciales, la semántica de origen, la reconciliación previa/posterior a la edición y la normalización de `spec`. Las implementaciones por proveedor están en `src/preparation/{gam,mercaeleva}/technical/reconciliation/preparation-technical-stages.ts` y otros reconciliadores propios; Gomariz conserva sus reglas en `technical/reconciliation/`. La recuperación documental se coordina en `shared/technical/recovery/documented-technical-recovery.ts`, que aplica recuperadores GAM, Gomariz y Mercaeleva con **orden explícito**. Mover una regla o adelantarla puede cambiar qué evidencia prevalece: proteger precedencia, identidad y salidas antes/después.

La composición editorial vigente utiliza `mapping/source-editorial-evidence.ts`, `mapping/prepared-editorial-source.ts`, `mapping/knowledge-editorial.ts` y el dominio `shared/editorial/domain/`. Las adaptaciones activas de origen residen en `gam/editorial/source/domain-source.ts`, `gomariz/editorial/mapping/domain-source.ts` y `mercaeleva/editorial/mapping/domain-source.ts`. La evidencia y los índices declarativos se conservan bajo `data/editorial/`. No reintroducir módulos de redacción por proveedor ni colocar reglas de composición en `commercial/`. Los casos firmados se verifican por identidad/procedencia y **no** se generalizan automáticamente a otras unidades.

La clasificación de atributos, categorías y condición pasa por `src/preparation/shared/classification/mapping/classification-provider.ts` y el contrato interno `classification-provider-types.ts`: el registro compone adaptaciones de `gam`, `gomariz`, `mercaeleva` y `manain`, definidas en sus respectivos `classification/mapping/provider.ts`. Los resolutores `attribute-mapping.ts`, `category-mapping.ts` y `src/preparation/condition.ts` consumen esa composición; conservan reglas comunes y validación de contratos. No eliminar registros explícitos de proveedores cuando sirven para validar el alcance del sistema.

Las reglas y evidencias específicas permanecen junto a cada proveedor, por ejemplo en `src/preparation/gam/`. La transformación de valores de atributos GAM está en `src/preparation/gam/classification/mapping/attribute-values.ts`, mientras `attributes.ts` conserva alias y decisiones relacionadas. Los parsers escalares de las semillas GAM comparten la utilidad interna `src/tools/gam/seed/internal/scalar.ts`. Estas utilidades **no autorizan** nuevas categorías, atributos, IDs ni valores sin evidencia.

Una preparación técnica canónica puede producir `categorySellID: null` y `attributes: []`, conservando `spec`. Las incidencias `ready/review` no se resuelven falsificando estos campos ni excluyendo productos de la muestra.

### Campañas, portabilidad, retención y limpieza

`src/cli/commands/campaign/` delega la campaña global en `src/campaign/`, incluidas sus carpetas `discovery/`, `delivery/`, `reference/` y `retention/{admission,inventory,journal,lock,recovery}.ts`. `src/campaign/finalization.ts` coordina la consolidación acreditada; `src/campaign/portable-inventory.ts` y `portable-migration.ts` inspeccionan o migran conforme a sus modos explícitos.

`src/infrastructure/filesystem/catalog/portable-campaign.ts` coordina consolidación y retirada; `portable-campaign-inspection.ts` inspecciona manifiestos, archivos y rutas. En la retención individual, `catalog-retention-cleanup.ts` utiliza `catalog-retention-references.ts` para proteger archivos aún referenciados. `src/infrastructure/filesystem/campaign/campaign-cleanup.ts` conserva el inventario y la ejecución de limpiezas; `campaign-cleanup-validation.ts` valida rutas, históricos y artefactos. Las rutas y los symlinks sospechosos deben bloquear las operaciones sensibles. La retención global se aplica por `runId`, con máximo de dos campañas protegidas según el contrato; los originales individuales tienen un ciclo de vida separado.

No ejecutar retiradas ni consolidaciones reales como parte de una auditoría documental. `npm run estado` inspecciona, y `npm run migrar:catalogos` simula por defecto. Ninguno de esos comandos equivale a aprobar una nueva publicación.

### Publicaciones técnicas independientes

`src/publication/technical-snapshot.ts` define y valida el corte; `src/publication/technical-publication.ts` prepara, contrasta y simula/activa; `src/cli/commands/catalog/technical-publication.ts` expone el comando, mientras `src/infrastructure/filesystem/catalog/technical-publication.ts` conserva y verifica `technical/active.json` y `technical/versions/<sha256>/{snapshot,manifest}.json`. Los originales completos se contrastan con sus preparaciones; Manain se reconstruye y valida con registro `partial`, CSV y censo. Los `review` permanecen en el snapshot y no autorizan la publicación comercial.

La versión técnica activa y la anterior son las dos protegidas en la retención. Los índices, hashes, locks y temporales son propios; el publicador técnico no toca `publications/` ni activa FINISH. `huecos --tecnicas` lee estos snapshots y es independiente del auditor comercial. Ver [Publicaciones técnicas](TECHNICAL_PUBLICATIONS.md).

### Publicaciones individuales y acreditación

`src/cli/commands/catalog/prepare-individual.ts` delega en `src/preparation/workflow/individual-prepare.ts`; la acreditación automática limitada reside en `src/publication/automatic-individual-accreditation.ts` y FINISH en `src/publication/individual-finish.ts`. Los contratos de publicación y aceptación de diferencias se conservan en `publication-contracts.ts` y `publication-acceptance.ts`. La evidencia del trabajo original → publicado se ensambla en `src/publication/individual-work-report.ts` y se presenta mediante `src/cli/reporting/`.

Los finales y aprobaciones acreditados no se reescriben para acomodar refactors o diferencias de huella. Las exclusiones editoriales no convierten fichas `review` en `ready`. Ver [Publicación individual](INDIVIDUAL_PUBLICATION.md) y [Campañas](CAMPAIGNS.md).

### Proyección comercial y exportación legada

**El catálogo técnico acreditado y su derivado comercial son contratos distintos.** La proyección comercial actual vive en `src/commercial/projection/`, con la política en `category-projection.ts` y evidencia de origen en `source-category-evidence.ts` y `gam-category-evidence.ts`. `src/commercial/export/` prepara, acredita y verifica salidas comerciales procedentes de publicaciones técnicas y snapshots locales; `src/cli/commands/catalog/commercial-audit.ts` realiza la coordinación y `src/cli/reporting/commercial-audit.ts` presenta los informes. El comando `exportar:comercial` no importa datos al backend.

Por separado, `npm run exportar` es un exportador **heredado** para preparaciones comerciales compatibles: `src/commercial/legacy-export/`, `src/cli/commands/legacy-export/` y `src/infrastructure/filesystem/legacy-export/`. No debe aplicarse a nuevas preparaciones técnicas sin asignaciones. La importación HTTP, la persistencia de productos y los permisos operativos pertenecen al backend. Ver [Comercialización](COMERCIALIZACION.md) e [Integración](EQUIPZILLA_INTEGRATION.md).

### Auditoría de contenido

`src/cli/commands/catalog/catalog-content-gaps.ts` y `src/cli/reporting/catalog-content-gaps-output.ts` presentan datos obtenidos en `src/catalog/diagnostics/`, con originales canónicos resueltos mediante `src/infrastructure/filesystem/catalog/original-catalog-sources.ts`. La preparación recalculada usa `src/preparation/prepare-product.ts`. Las comprobaciones de contenido y `--comparar --specs` no escriben originales ni crean publicaciones. Ver [Huecos de contenido](CATALOG_CONTENT_GAPS.md).

## Cómo ampliar reglas y proveedores sin acoplar el núcleo

Una mejora técnica se inicia en la interpretación/reconciliación del origen y se integra en los puntos comunes existentes. Una mejora **editorial generalizable** pertenece a `shared/editorial/domain/` o `shared/editorial/mapping/`; los adaptadores de proveedor solo interpretan señales específicas y autenticidad de la fuente, y las evidencias firmadas permanecen acotadas a su origen. No introducir narradores por proveedor, referencia ni modelo. Una adaptación comercial de nuevo proveedor se expresa en su `classification/mapping/provider.ts`; los atributos, categorías e IDs siguen perteneciendo a los contratos vigentes.

`src/preparation/prepare-product.ts` es un **orquestador**, no el lugar para acumular casos de unidades nuevas. `shared/technical/recovery/documented-technical-recovery.ts` compone varias fuentes documentales; no debe crecer con reglas de negocio duplicadas de varios proveedores. El registro de clasificación es una composición explícita, no un sistema de plugins dinámicos. Las excepciones acreditadas por referencia y huella son legítimas cuando impiden extrapolar una especificación a otra unidad.

Las modificaciones se validan comparando los candidatos por identidad y campo, controlando la huella `rulesSha256`, el preflight, FINISH y la proyección comercial. Consultar el [manual de mejora acreditada](CATALOG_IMPROVEMENT.md) antes de añadir reglas o extender un proveedor.

## Calidad, pruebas y protección de artefactos

`npm run build` ejecuta `scripts/run-build.mjs`. `npm test` ejecuta los guards oficiales definidos en `package.json` compila cuando es necesario y después ejecuta `scripts/run-tests.mjs`, que descubre las suites TypeScript de `src/` y `.test.mjs` de `scripts/`. Las pruebas pueden usar caché; para una acreditación sin reutilización usar `EQUIPZILLA_TEST_CACHE=0`. Los tests deben verificar contratos reales y conservar los casos límite. Los guards arquitectónicos editorial y de tests se ejecutan por separado; su política y las integraciones censales autorizadas se describen en [Arquitectura de tests](TEST_ARCHITECTURE.md).

`rulesSha256` en `src/infrastructure/filesystem/preparation/preparation-inputs.ts` incorpora nombres y contenidos de módulos JS compilados. Cambiar la distribución de módulos editoriales o el mapeo GAM puede alterar la huella aunque la salida sea funcionalmente equivalente: **equivalencia funcional y compatibilidad de acreditación son comprobaciones diferentes**. No alterar hashes o preparaciones existentes para hacer coincidir la huella. Ver [Validación](VALIDATION.md) y [Mantenimiento](MAINTENANCE.md).

La regla general `output/` de `.gitignore` necesita mantener la excepción `!src/scraping/output/`: sin ella pueden desaparecer del paquete los módulos de salida aunque sus consumidores sigan compilando contra imports ESM. El código de esos módulos permanece en el árbol fuente; no se regenera desde `dist/`.

Cuando se detecta un defecto, repararlo donde se origina: extracción/HTML en scraping, identidad y calidad en catálogo o preparación, integridad en filesystem, responsabilidades comerciales en proyección, presentación en CLI. No introducir excepciones ficticias por ficha ni restaurar imágenes o specs sin evidencia del origen. La aceptación final distingue compilación, pruebas, calidad del catálogo, integridad de artefactos y acreditación editorial.
