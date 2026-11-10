# Mantenimiento y continuidad del repositorio

## Alcance

Esta guía describe **la arquitectura existente**, no propone otra reorganización. Refleja la composición técnica/editorial y la clasificación por proveedor actuales, además de los mecanismos de persistencia, publicación, runner y salida consolidados. Las referencias a campañas o fases históricas no sustituyen la revisión del código vigente. Para el mapa general, ver [Arquitectura](ARCHITECTURE.md).

## Mapa de responsabilidades estabilizadas

| Zona                    | Propietario y separación                                                                                                          | Contrato que se conserva                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Semillas GAM            | `src/tools/gam/seed/internal/scalar.ts` compartido por parsers de categoría/URL                                                   | Conversión escalar y exports de los consumidores existentes                                                |
| Editorial               | `src/preparation/shared/editorial/mapping/prepared-editorial.ts`, `prepared-editorial-source.ts`, `verified-editorial-finalization.ts` y resolutores de proveedor | Precedencia entre título, fuente, modelo, general y finalización verificada |
| Técnica acreditada     | `src/preparation/shared/technical/reconciliation/preparation-technical-stages.ts` y `shared/technical/recovery/documented-technical-recovery.ts`, con reglas de proveedor | Orden de reconciliaciones, identidad, huellas y semántica técnica |
| Clasificación          | `src/preparation/shared/classification/mapping/classification-provider.ts` y `src/preparation/<proveedor>/classification/mapping/provider.ts` | Composición explícita, categorías/atributos/condición sin nuevas IDs |
| Comercial               | `src/commercial/projection/category-projection.ts` y evidencias `source-category-evidence.ts`/`gam-category-evidence.ts`          | Decisiones de categoría y restricciones de procedencia                                                     |
| Persistencia portátil   | `src/infrastructure/filesystem/catalog/portable-campaign.ts` e `portable-campaign-inspection.ts`                                  | Manifiestos, integridad, consolidación y retirada segura                                                   |
| Retención individual    | `src/infrastructure/filesystem/catalog/catalog-retention-cleanup.ts` e `catalog-retention-references.ts`                          | Protección de históricos referenciados y archivos activos                                                  |
| Limpieza global         | `src/infrastructure/filesystem/campaign/campaign-cleanup.ts` y `campaign-cleanup-validation.ts`                                   | Inventario, validación de rutas, simulación y eliminación segura                                           |
| CLI comercial           | `src/cli/commands/catalog/commercial-audit.ts` y `src/cli/reporting/commercial-audit.ts`                                          | Modos, informes y códigos de salida                                                                        |
| Navegador Mercaeleva    | `src/scraping/providers/mercaeleva/browser.ts` y `browser-pagination.ts`                                                          | Ciclo de navegador, paginación y detección de duplicados                                                   |
| Atributos GAM           | `src/preparation/gam/classification/mapping/attributes.ts` y `attribute-values.ts`                                                | Alias, conversión validada y catálogo comercial sin cambios de IDs                                         |
| Identidad GAM           | Reglas cohesionadas en `src/preparation/gam/identity/`                                                                            | No fragmentar sin una responsabilidad real                                                                 |
| Publicación estructural | `src/scraping/output/publish.ts` y `csv-serializer.ts`                                                                            | Escritura, preparación de compatibilidad, orden de columnas CSV y preservación del último resultado válido |

Las reglas de identidad GAM se mantienen cohesionadas bajo su responsabilidad propia. Un módulo extenso no necesita refactor si su responsabilidad es clara. No restaurar carpetas históricas `src/pipeline/` o `src/catalog/preparation/`, ni inventar abstracciones compartidas sin consumidores reales.

## Extender sin duplicar reglas

- Buscar primero en `technical/evidence/`, `technical/reconciliation/`, `editorial/evidence/` y `editorial/mapping/` del proveedor. Las intervenciones por unidad acreditada son válidas cuando su alcance está protegido; evitar trasladarlas a un gran `switch` central.
- Conservar los puntos de composición compartidos, sin duplicar recuperadores en un auditor ni cambiar el orden por estética. `prepare-product.ts` orquesta; no debe convertirse en una tabla de excepciones.
- Para condición, atributos y categorías, ampliar el adaptador de clasificación por proveedor si procede. La existencia de registros/whitelists explícitos no es deuda por sí sola.
- Distinguir datos de una unidad, prestaciones generales de modelo y anomalías originales. Antes de hacer crecer una regla, probar la variante vecina y el origen distinto. Consultar [Mejora acreditada del catálogo](CATALOG_IMPROVEMENT.md).

## Persistencia, recuperación y retención

- `storage/` es operativo y permanece fuera de Git. `catalogs/` contiene datos portátiles versionables y verificables; `estado` es observacional, no crea aprobaciones.
- La campaña global admite **dos posiciones retenidas** y protege la activa y la anterior conforme a sus referencias. No aplicar una limpieza basándose solo en el nombre de una carpeta.
- `portable-campaign-inspection.ts` verifica rutas y archivos antes de que `portable-campaign.ts` consolide o retire. Las carpetas o symlinks sospechosos son motivo de bloqueo, no de limpieza automática.
- `catalog-retention-references.ts` protege históricos que estén referenciados por huellas/acreditaciones; `campaign-cleanup-validation.ts` define qué rutas y artefactos pueden retirarse.
- Las operaciones `--simular` o `--dry-run` no deben producir escrituras. Para reparar fallos, usar los procedimientos de recuperación existentes, no borrar a mano manifests, históricos o diarios.

## El riesgo de `rulesSha256`

`src/infrastructure/filesystem/preparation/preparation-inputs.ts` calcula `rulesSha256` leyendo el JS compilado y sus rutas relativas. El hash es sensible incluso a redistribuir imports. Una comparación de JSON preparados idénticos **no garantiza** que sean compatibles sus huellas ni que se puedan reutilizar acreditaciones anteriores. La Fase 12 modificó la huella al extraer la conversión GAM, sin autorización para actualizar publicaciones ya acreditadas.

Ante cualquier cambio de reglas: capturar la línea base, comparar salidas, calcular la huella antes/después, ejecutar pruebas y `estado`, y gestionar cualquier nueva preparación/acreditación por los procedimientos formales. Nunca reescribir huellas ni aprobar de forma automática.

## Protección de la salida del scraper

`src/scraping/output/publish.ts` y `csv-serializer.ts` son fuentes imprescindibles para scraping, preparación, publicación y tests. `.gitignore` contiene una regla general `output/` y la excepción **`!src/scraping/output/`**; conservar ambas sin excluir esos módulos en futuras limpiezas. Las funciones `writeOutputs`, `writeGroupedOutputs` y `writeCategoriesCsv` tienen consumidores que dependen de los contratos existentes. El formato CSV exige encabezados concretos (productos que comienzan por `categoryKey,categoryName,title`, categorías con `categoryUrl`). La preparación legada de `publish.ts` incorpora el catálogo comercial que esperan los consumidores de compatibilidad.

Una pérdida de esos módulos puede causar múltiples errores `TS2307` aparentemente no relacionados. Si la compilación falla, comprobar primero que el árbol fuente contiene los archivos antes de cambiar imports o contratos.

## Validación ordinaria y de reformas

```powershell
npm ci
npm run build
$cacheAnterior = [Environment]::GetEnvironmentVariable('EQUIPZILLA_TEST_CACHE', 'Process')
try {
    $env:EQUIPZILLA_TEST_CACHE = '0'
    npm test
} finally {
    [Environment]::SetEnvironmentVariable('EQUIPZILLA_TEST_CACHE', $cacheAnterior, 'Process')
}
npm run estado
git status --short
```

Conservar los códigos de salida por separado; PowerShell puede continuar aunque falle un comando. `npm test` compila cuando corresponde y ejecuta suites TypeScript compiladas y MJS, con o sin caché. No confundir un test aislado verde, un `build` correcto o `estado` íntegro con una acreditación editorial o con cobertura externa de los portales. Ante una regresión, corregir primero el fallo concreto y comprobar contratos específicos de la zona modificada.

## Proveedores y extensión

Para incorporar un proveedor se debe revisar `src/scraping/provider.ts`, el registro `src/scraping/registry.ts`, el contrato de campaña (`src/contracts/campaign-providers.ts`) y, cuando proceda, la preparación, calidad e identidad bajo `src/preparation/` y `src/catalog/`. Sus pruebas deben cubrir extracción, paginación, identidad, duplicados, imagen principal, calidad y formatos. **No** añadirlo a una campaña, a las referencias comerciales o a la publicación acreditada por una coincidencia de nombre. Una ampliación de contrato exige revisión explícita, no una reforma implícita de documentación.

## Referencias operativas

- [Mejora acreditada del catálogo](CATALOG_IMPROVEMENT.md): mecanismos de mejora, decisiones, evidencia y materialización.
- [Reglas de datos](SCRAPER_DATA_RULES.md): huellas, originales, preparaciones y JSON acreditados.
- [Validación](VALIDATION.md): aceptación técnica, editorial y de datos.
- [Campañas](CAMPAIGNS.md): admisión, retención y recuperación de campañas.
- [Publicación individual](INDIVIDUAL_PUBLICATION.md): FINISH y acreditación automática limitada.
- [Comercialización](COMERCIALIZACION.md): proyección, auditoría y exportación.
