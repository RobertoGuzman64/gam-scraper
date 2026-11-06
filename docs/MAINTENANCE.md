# Mantenimiento y continuidad del repositorio

## Alcance

Esta guía describe **la arquitectura existente**, no propone otra reorganización. Es una referencia para mantener los cambios internos consolidados en las fases 8–12 y las correcciones de salida posteriores. Las decisiones documentales de la Fase 14 no modifican código, originales, preparaciones, acreditaciones ni publicaciones. Para el mapa general, ver [Arquitectura](ARCHITECTURE.md).

## Mapa de responsabilidades estabilizadas

| Zona                    | Propietario y separación                                                                                                          | Contrato que se conserva                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Semillas GAM            | `src/tools/gam/seed/internal/scalar.ts` compartido por parsers de categoría/URL                                                   | Conversión escalar y exports de los consumidores existentes                                                |
| Editorial               | `src/preparation/shared/editorial/mapping/prepared-editorial.ts` orquesta `prepared-editorial-{title,source,model,completion}.ts` | Precedencia de títulos, descripciones, conflictos e incidencias                                            |
| Comercial               | `src/commercial/projection/category-projection.ts` y evidencias `source-category-evidence.ts`/`gam-category-evidence.ts`          | Decisiones de categoría y restricciones de procedencia                                                     |
| Persistencia portátil   | `src/infrastructure/filesystem/catalog/portable-campaign.ts` e `portable-campaign-inspection.ts`                                  | Manifiestos, integridad, consolidación y retirada segura                                                   |
| Retención individual    | `src/infrastructure/filesystem/catalog/catalog-retention-cleanup.ts` e `catalog-retention-references.ts`                          | Protección de históricos referenciados y archivos activos                                                  |
| Limpieza global         | `src/infrastructure/filesystem/campaign/campaign-cleanup.ts` y `campaign-cleanup-validation.ts`                                   | Inventario, validación de rutas, simulación y eliminación segura                                           |
| CLI comercial           | `src/cli/commands/catalog/commercial-audit.ts` y `src/cli/reporting/commercial-audit.ts`                                          | Modos, informes y códigos de salida                                                                        |
| Navegador Mercaeleva    | `src/scraping/providers/mercaeleva/browser.ts` y `browser-pagination.ts`                                                          | Ciclo de navegador, paginación y detección de duplicados                                                   |
| Atributos GAM           | `src/preparation/gam/classification/mapping/attributes.ts` y `attribute-values.ts`                                                | Alias, conversión validada y catálogo comercial sin cambios de IDs                                         |
| Identidad GAM           | Reglas cohesionadas en `src/preparation/gam/identity/`                                                                            | No fragmentar sin una responsabilidad real                                                                 |
| Publicación estructural | `src/scraping/output/publish.ts` y `csv-serializer.ts`                                                                            | Escritura, preparación de compatibilidad, orden de columnas CSV y preservación del último resultado válido |

En Fase 12 se evaluaron también reglas de identidad GAM y se conservaron cohesionadas. Un módulo extenso no necesita refactor si su responsabilidad es clara. No restaurar carpetas históricas `src/pipeline/` o `src/catalog/preparation/`, ni inventar abstracciones compartidas sin consumidores reales.

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

- [Reglas de datos](SCRAPER_DATA_RULES.md): huellas, originales, preparaciones y JSON acreditados.
- [Validación](VALIDATION.md): aceptación técnica, editorial y de datos.
- [Campañas](CAMPAIGNS.md): admisión, retención y recuperación de campañas.
- [Publicación individual](INDIVIDUAL_PUBLICATION.md): FINISH y acreditación automática limitada.
- [Comercialización](COMERCIALIZACION.md): proyección, auditoría y exportación.
