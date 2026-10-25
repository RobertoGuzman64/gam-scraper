# Arquitectura

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Visión general

Aplicación CLI de Node.js y TypeScript con módulos ESM. El scraper se ejecuta como proceso local o programado; **no tiene servidor HTTP ni persistencia en el backend de Equipzilla**.

```text
scripts/              Entrada npm, ayuda y ejecución programada
src/
  cli/                Argumentos, comandos y presentación de resultados
  contracts/          Contratos de extracción y catálogo
  scraping/           Motor, registro y adaptadores de proveedores
    engine/           Procesamiento de categorías y fichas
    parsing/          Utilidades comunes de HTML y fotografías
    providers/        gam/, gomariz/, mercaeleva/
  catalog/            Identidad, normalización y validaciones de producto
    coverage/         Diferencias entre catálogos y expediente de revisión
    editorial/        Selección y exclusiones acreditadas
    import/           Mapeos y preparación para formatos de destino
  pipeline/           Orquestación de extracción, lotes, publicación,
                      preparación, validación y exportación
  infrastructure/     HTTP, navegador, archivos, bloqueos y XLSX
  shared/             Utilidades transversales como CSV
  tools/gam/          Normalización y conversión de semillas GAM

data/category/        Catálogo local de categorías del receptor
data/import/          Catálogo local de atributos del receptor
storage/              Datos de ejecución y evidencias no versionadas
```

El registro de proveedores vive en `src/scraping/registry.ts`; los contratos de datos se definen en `src/contracts/`. Las pruebas `.test.ts` están próximas a los módulos que protegen. El resultado del compilador se escribe en `dist/`, que no se versiona.

## Responsabilidades

| Capa                   | Debe hacer                                                                    | No debe hacer                                              |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `cli` y `scripts`      | Interpretar órdenes, preparar parámetros, mostrar ayuda, errores y resúmenes. | Decidir identidades o parsear HTML.                        |
| `scraping`             | Descubrir listados, obtener fichas y devolver registros de origen.            | Importar al backend o aplicar políticas de Excel.          |
| `catalog`              | Normalizar, deduplicar, contrastar evidencia y resolver reglas editoriales.   | Ejecutar peticiones de scraping o presentar UI de consola. |
| `pipeline`             | Coordinar flujos y mantener integridad de las publicaciones.                  | Repetir reglas de proveedor.                               |
| `infrastructure`       | I/O, HTTP, navegador, locks y escritura segura.                               | Inventar reglas de producto.                               |
| `contracts` y `shared` | Tipos y utilidades reutilizables.                                             | Acoplarse a CLI o a un portal particular.                  |

Dirección preferente: `cli → pipeline → scraping/catalog/infrastructure`. Los adaptadores implementan el contrato `ScraperProvider`; las excepciones de un proveedor deben permanecer en su propio módulo. No introducir capas vacías, duplicar mappers ni mover contratos públicos sin revisar consumidores.

## Procesos principales

**Extracción:** `cli` selecciona proveedor → `scraping/registry.ts` → `pipeline/scrape-run.ts` → motor y adaptador → deduplicación e integridad → `pipeline/publication/` → catálogo, CSV, preparación e informes. El adaptador de Mercaeleva puede necesitar Chrome/Chromium externo.

**Lote:** `cli/batch.ts` → `pipeline/batch/` → proveedores ejecutados secuencialmente en procesos hijos → logs individuales y resumen en `storage/runs/`. El lock es **local al sistema de archivos** y no protege ejecuciones independientes en otros hosts. El scraping individual no comparte necesariamente esa exclusión.

**Preparación offline:** `cli/prepare.ts` → `pipeline/preparation/` → lectura íntegra de catálogo canónico y comprobación de procedencia → mapeo y preparación de productos → documento nuevo con huellas de entrada y reglas. No consulta portales ni inventario.

**Auditoría y selección:** `catalog/coverage/` compara fuentes y exige revisión acreditada; `catalog/editorial/` decide productos seleccionables y exclusiones; `cli/select-publishable.ts` genera únicamente las salidas autorizadas. Las reglas de identidad y de cohorte específicas existentes siguen siendo restricciones productivas: un refactor no puede neutralizarlas.

**Exportación opcional:** `pipeline/export/` prepara altas mediante inventario externo y mapeos existentes; `infrastructure/spreadsheet/` genera XLSX cuando se solicita. También se admite salida JSON adaptada al receptor. Ningún proceso envía peticiones de importación.

## Reglas de mantenimiento

- Conservar APIs, contratos y formatos de archivo existentes; advertir antes de cambios incompatibles.
- Evitar mezcla de UI/CLI, red, filesystem y reglas de negocio.
- No duplicar reglas entre proveedores; tampoco generalizar comportamientos que solo estén acreditados para uno.
- Mantener la persistencia atómica o de creación exclusiva, la integridad de manifests y la preservación de la última publicación válida.
- Comparar resultados reales antes y después de alterar parsers, mappers, deduplicación o selección.
- Añadir un proveedor mediante `ScraperProvider`, `registry.ts` y su configuración, con pruebas específicas de paginación, identidad y calidad.

Consulta [Reglas de datos](SCRAPER_DATA_RULES.md) para los formatos y [Validación](VALIDACION.md) para los controles operativos.
