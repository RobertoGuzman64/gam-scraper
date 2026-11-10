# Arquitectura

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

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
catalogs/providers/        Originales completos y publicaciones individuales portátiles
catalogs/campaigns/        Instantáneas acreditadas de campañas globales
storage/                   Trabajo y recuperación locales, excluidos de Git
dist/                      Compilados regenerables, excluidos de Git
```

El registro de proveedores está en `src/scraping/registry.ts` y el contrato de campaña de cuatro proveedores (GAM, Gomariz, Mercaeleva y Manain) en `src/contracts/campaign-providers.ts`. Las publicaciones individuales vigentes pueden operar para GAM, Gomariz y Mercaeleva; Manain mantiene su flujo propio y no debe darse por completo sin acreditación. La lectura de históricos de tres proveedores no cambia el contrato de campaña actual.

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

La entrada de producto es `src/preparation/prepare-product.ts`, que expone `prepareSourceProduct` y `prepareWithCatalog`. La orquestación offline reside en `src/preparation/workflow/` y el cálculo/validación de huellas en `src/infrastructure/filesystem/preparation/`. El motor separa identidad y reconciliaciones por proveedor, evidencias técnicas y composición editorial. `src/preparation/shared/editorial/mapping/prepared-editorial.ts` orquesta título, fuente, modelo y completado mediante `prepared-editorial-{title,source,model,completion}.ts`, sin alterar sus prioridades por el mero hecho de estar separados.

La composición técnica actual usa `src/preparation/shared/technical/reconciliation/preparation-technical-stages.ts`: coordina las transformaciones iniciales, la semántica de origen, la reconciliación previa/posterior a la edición y la normalización de `spec`. Las implementaciones por proveedor están en `src/preparation/{gam,mercaeleva}/technical/reconciliation/preparation-technical-stages.ts` y otros reconciliadores propios; Gomariz conserva sus reglas en `technical/reconciliation/`. La recuperación documental se coordina en `shared/technical/recovery/documented-technical-recovery.ts`, que aplica recuperadores GAM, Gomariz y Mercaeleva con **orden explícito**. Mover una regla o adelantarla puede cambiar qué evidencia prevalece: proteger precedencia, identidad y salidas antes/después.

La composición editorial distingue `prepared-editorial-source.ts`, que integra entradas específicas de `gam/editorial/prepared-source.ts`, `gomariz/editorial/mapping/prepared-source.ts` y `mercaeleva/editorial/mapping/prepared-source.ts`, y `verified-editorial-finalization.ts`, que reutiliza `verified-editorial-composition.ts` y resolutores por proveedor. El coordinador de títulos conserva su precedencia propia: no separarlo por estética. Una regla nueva debe vivir donde pertenece su evidencia; el módulo compartido coordina **cuándo** se evalúa, no inventa la regla.

La clasificación de atributos, categorías y condición pasa por `src/preparation/shared/classification/mapping/classification-provider.ts` y el contrato interno `classification-provider-types.ts`: el registro compone adaptaciones de `gam`, `gomariz`, `mercaeleva` y `manain`, definidas en sus respectivos `classification/mapping/provider.ts`. Los resolutores `attribute-mapping.ts`, `category-mapping.ts` y `src/preparation/condition.ts` consumen esa composición; conservan reglas comunes y validación de contratos. No eliminar registros explícitos de proveedores cuando sirven para validar el alcance del sistema.

Las reglas y evidencias específicas permanecen junto a cada proveedor, por ejemplo en `src/preparation/gam/`. La transformación de valores de atributos GAM está en `src/preparation/gam/classification/mapping/attribute-values.ts`, mientras `attributes.ts` conserva alias y decisiones relacionadas. Los parsers escalares de las semillas GAM comparten la utilidad interna `src/tools/gam/seed/internal/scalar.ts`. Estas utilidades **no autorizan** nuevas categorías, atributos, IDs ni valores sin evidencia.

Una preparación técnica canónica puede producir `categorySellID: null` y `attributes: []`, conservando `spec`. Las incidencias `ready/review` no se resuelven falsificando estos campos ni excluyendo productos de la muestra.

### Campañas, portabilidad, retención y limpieza

`src/cli/commands/campaign/` delega la campaña global en `src/campaign/`, incluidas sus carpetas `discovery/`, `delivery/`, `reference/` y `retention/{admission,inventory,journal,lock,recovery}.ts`. `src/campaign/finalization.ts` coordina la consolidación acreditada; `src/campaign/portable-inventory.ts` y `portable-migration.ts` inspeccionan o migran conforme a sus modos explícitos.

`src/infrastructure/filesystem/catalog/portable-campaign.ts` coordina consolidación y retirada; `portable-campaign-inspection.ts` inspecciona manifiestos, archivos y rutas. En la retención individual, `catalog-retention-cleanup.ts` utiliza `catalog-retention-references.ts` para proteger archivos aún referenciados. `src/infrastructure/filesystem/campaign/campaign-cleanup.ts` conserva el inventario y la ejecución de limpiezas; `campaign-cleanup-validation.ts` valida rutas, históricos y artefactos. Las rutas y los symlinks sospechosos deben bloquear las operaciones sensibles. La retención global se aplica por `runId`, con máximo de dos campañas protegidas según el contrato; los originales individuales tienen un ciclo de vida separado.

No ejecutar retiradas ni consolidaciones reales como parte de una auditoría documental. `npm run estado` inspecciona, y `npm run migrar:catalogos` simula por defecto. Ninguno de esos comandos equivale a aprobar una nueva publicación.

### Publicaciones individuales y acreditación

`src/cli/commands/catalog/prepare-individual.ts` delega en `src/preparation/workflow/individual-prepare.ts`; la acreditación automática limitada reside en `src/publication/automatic-individual-accreditation.ts` y FINISH en `src/publication/individual-finish.ts`. Los contratos de publicación y aceptación de diferencias se conservan en `publication-contracts.ts` y `publication-acceptance.ts`. La evidencia del trabajo original → publicado se ensambla en `src/publication/individual-work-report.ts` y se presenta mediante `src/cli/reporting/`.

Los finales y aprobaciones acreditados no se reescriben para acomodar refactors o diferencias de huella. Las exclusiones editoriales no convierten fichas `review` en `ready`. Ver [Publicación individual](INDIVIDUAL_PUBLICATION.md) y [Campañas](CAMPAIGNS.md).

### Proyección comercial y exportación legada

**El catálogo técnico acreditado y su derivado comercial son contratos distintos.** La proyección comercial actual vive en `src/commercial/projection/`, con la política en `category-projection.ts` y evidencia de origen en `source-category-evidence.ts` y `gam-category-evidence.ts`. `src/commercial/export/` prepara, acredita y verifica salidas comerciales procedentes de publicaciones técnicas y snapshots locales; `src/cli/commands/catalog/commercial-audit.ts` realiza la coordinación y `src/cli/reporting/commercial-audit.ts` presenta los informes. El comando `exportar:comercial` no importa datos al backend.

Por separado, `npm run exportar` es un exportador **heredado** para preparaciones comerciales compatibles: `src/commercial/legacy-export/`, `src/cli/commands/legacy-export/` y `src/infrastructure/filesystem/legacy-export/`. No debe aplicarse a nuevas preparaciones técnicas sin asignaciones. La importación HTTP, la persistencia de productos y los permisos operativos pertenecen al backend. Ver [Comercialización](COMERCIALIZACION.md) e [Integración](EQUIPZILLA_INTEGRATION.md).

### Auditoría de contenido

`src/cli/commands/catalog/catalog-content-gaps.ts` y `src/cli/reporting/catalog-content-gaps-output.ts` presentan datos obtenidos en `src/catalog/diagnostics/`, con originales canónicos resueltos mediante `src/infrastructure/filesystem/catalog/original-catalog-sources.ts`. La preparación recalculada usa `src/preparation/prepare-product.ts`. Las comprobaciones de contenido y `--comparar --specs` no escriben originales ni crean publicaciones. Ver [Huecos de contenido](CATALOG_CONTENT_GAPS.md).

## Cómo ampliar reglas y proveedores sin acoplar el núcleo

Una mejora técnica se inicia en el reconciliador/evidencia del proveedor y se integra en los puntos de composición existentes. Una mejora editorial se ubica en los resolutores o evidencias del proveedor, sin alterar el orden común. Una adaptación comercial de nuevo proveedor se expresa en su `classification/mapping/provider.ts`; los atributos, categorías e IDs siguen perteneciendo a los contratos vigentes.

`src/preparation/prepare-product.ts` es un **orquestador**, no el lugar para acumular casos de unidades nuevas. `shared/technical/recovery/documented-technical-recovery.ts` compone varias fuentes documentales; no debe crecer con reglas de negocio duplicadas de varios proveedores. El registro de clasificación es una composición explícita, no un sistema de plugins dinámicos. Las excepciones acreditadas por referencia y huella son legítimas cuando impiden extrapolar una especificación a otra unidad.

Las modificaciones se validan comparando los candidatos por identidad y campo, controlando la huella `rulesSha256`, el preflight, FINISH y la proyección comercial. Consultar el [manual de mejora acreditada](CATALOG_IMPROVEMENT.md) antes de añadir reglas o extender un proveedor.

## Calidad, pruebas y protección de artefactos

`npm run build` ejecuta `scripts/run-build.mjs`. `npm test` compila cuando es necesario y ejecuta `scripts/run-tests.mjs`, que descubre las suites TypeScript de `src/` y `.test.mjs` de `scripts/`. Las pruebas pueden usar caché; para una acreditación sin reutilización usar `EQUIPZILLA_TEST_CACHE=0`. Los tests deben verificar contratos reales y conservar los casos límite.

`rulesSha256` en `src/infrastructure/filesystem/preparation/preparation-inputs.ts` incorpora nombres y contenidos de módulos JS compilados. La reorganización editorial y el mapeo GAM de las fases 9/12 hicieron que la huella dejara de ser idéntica a la base anterior: **equivalencia funcional y compatibilidad de acreditación son comprobaciones diferentes**. No alterar hashes o preparaciones existentes para hacer coincidir la huella. Ver [Validación](VALIDATION.md) y [Mantenimiento](MAINTENANCE.md).

La regla general `output/` de `.gitignore` necesita mantener la excepción `!src/scraping/output/`: sin ella pueden desaparecer del paquete los módulos de salida aunque sus consumidores sigan compilando contra imports ESM. El código de esos módulos permanece en el árbol fuente; no se regenera desde `dist/`.

Cuando se detecta un defecto, repararlo donde se origina: extracción/HTML en scraping, identidad y calidad en catálogo o preparación, integridad en filesystem, responsabilidades comerciales en proyección, presentación en CLI. No introducir excepciones ficticias por ficha ni restaurar imágenes o specs sin evidencia del origen. La aceptación final distingue compilación, pruebas, calidad del catálogo, integridad de artefactos y acreditación editorial.
