# Auditor de huecos de contenido del catálogo

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Finalidad y límites

`npm run huecos` es una **consulta opcional y estadística** sobre los originales de la última campaña entregada íntegra conservada; si no la hay, puede utilizar una referencia histórica válida de `data/reference/`, o catálogos completos suministrados explícitamente con `--catalogo`. Identifica campos ausentes repetidos, muestra a qué fichas afectan y permite inspeccionar la evidencia conservada. **No completa fichas, no asigna categorías comerciales, no genera `review` y no interviene en campañas, acreditaciones o entregas.**

Que dos máquinas compartan categoría, marca o modelo no significa que deban tener las mismas especificaciones. Una ausencia observada **no acredita obligatoriedad técnica ni error del proveedor**.

## Uso para mejorar el catálogo, no para acumular auditorías

El propósito de la consulta es descubrir **posibles oportunidades de recuperación fiable**. Si un campo existe en la fuente y se está perdiendo por el extractor o la preparación, el trabajo de ingeniería consiste en **corregir el módulo productivo, probar la causa común y volver a medir la cobertura del catálogo**; no entregar un TOP de fichas para que el operador las arregle una por una. Si la fuente no publica ese campo, la ausencia sigue siendo válida y no debe generar un valor, una review artificial ni una obligación de completitud no acreditada. Una similitud de modelo no es prueba de que el atributo corresponda a esa unidad.

`huecos` nunca resuelve ni acredita la mejora: el éxito es la **recuperación verificable de información realmente disponible**, sin contaminación de otros registros. Ver [Objetivos](SCRAPER_OBJECTIVES.md).


## Procedencia y componentes

- **Entrada:** `findCampaignBaseline` (`src/pipeline/campaign/reference/compare.ts`) busca una entrega íntegra conservada y verifica su procedencia por `runId`; si no existe, consulta `data/reference/` como compatibilidad. `--catalogo <ruta>` (repetible) utiliza `readCanonicalCatalog` y exige manifiesto y resumen verificables para cada original; no admite CSV parciales.
- **Universo:** todos los `ProductRecord` originales de la fuente elegida, también los excluidos de la entrega editorial. Se conservan `providerId`, `categoryKey`, `categoryName`, identidad, URL, descripciones y `specs`.
- **Preparación temporal:** `prepareSourceProduct` calcula en memoria el estado técnico y las descripciones preparadas. No consulta snapshots comerciales ni asigna `categorySellID` o `attributeID`.
- **Análisis:** `analyzeSourceContentGaps` (`src/catalog/diagnostics/content-gaps-source.ts`) agrupa por categoría de origen, con desglose opcional por marca o modelo, y calcula la cobertura de descripciones y claves técnicas observadas.
- **CLI:** `src/cli/commands/catalog/catalog-content-gaps.ts` presenta resumen o JSON por `stdout`. La procedencia identifica el `runId` de la entrega conservada o las rutas de los canónicos explícitos; incluye la huella de reglas técnicas (`rulesSha256`).

La consulta usa las **reglas técnicas actuales**, no una preparación guardada cuando se extrajo el catálogo. Los recuentos `ready/review` del universo expresan ese diagnóstico recalculado; no cambian los estados de una campaña.

## Campos y agrupaciones

| Campo                  | Criterio de presencia                                          | Evidencia conservada                                               |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Descripción corta      | `description` preparada no vacía tras `trim()`                 | `shortDescription` original y texto relacionado                    |
| Descripción general    | `description_general` preparada no vacía tras `trim()`         | `longDescription` original y texto relacionado                     |
| Especificación técnica | Clave normalizada de `ProductRecord.specs` con valor informado | Claves y valores originales, sin deducir equivalencias comerciales |

Una clave técnica entra en la comparación **solo si aparece informada en al menos dos fichas del mismo grupo**. Se normaliza el nombre de clave conforme a las reglas del proyecto; no se atribuye automáticamente un significado distinto ni se exige a todas las máquinas una especificación publicada en otra categoría. Para las claves observadas se calculan `applicable`, `present`, `missing` y `coveragePercent`; `applicable` es el tamaño del grupo, **no una declaración de obligatoriedad**. Los valores numéricos `0` y booleanos `false` cuentan como presentes.

La separación de grupos es siempre por **proveedor y `categoryKey` original**. `--agrupar marca` subdivide por marca declarada; `--agrupar modelo` subdivide por marca y modelo. No mezcla equivalencias de proveedores distintos ni sustituye la clasificación original por `categorySellID`.

La cobertura se clasifica como `completa`, `desigual` o `sistematica`. El TOP prioriza ausencias relevantes según frecuencia y evidencias; sus filtros no eliminan los detalles completos de `groups` ni `cases` en el JSON.

## Evidencias y límites

- `directa_del_campo`: contenido original correspondiente a una descripción que falta en la salida preparada.
- `texto_relacionado`: texto en la otra descripción; no prueba que ambos campos sean equivalentes.
- `especificaciones_sin_vinculo_acreditado`: hay otras claves técnicas, sin demostrar relación con la clave ausente.
- `sin_evidencia_observable`: no se observó evidencia suficiente **en los datos conservados**, no necesariamente en la web.
- `desconocida`: el dato disponible no permite otra clasificación segura.

El JSON mantiene nombres de compatibilidad como `categorySellID` y `prepared.attributes`, pero **sus valores son `null` y `[]` en el análisis actual**. No deben interpretarse como IDs comerciales pendientes de resolver ni como atributos obligatorios del backend. `sourceCategoryKey` identifica el grupo de origen; `original.specs` es la evidencia técnica relevante.

## Ejecución

Desde la raíz del repositorio, con una entrega íntegra conservada, una referencia histórica válida o catálogos canónicos explícitos:

```powershell
npm run huecos
npm run huecos -- --agrupar marca --min-grupo 8 --min-ausentes 3 --top 20
npm run huecos -- --agrupar modelo --top 10
npm run huecos -- --catalogo <ruta-al-catalog.json> --json
npm run huecos -- --json > huecos-consulta.json
npm run ayuda -- huecos
```

| Opción                               | Significado                               | Valor inicial                          |
| ------------------------------------ | ----------------------------------------- | -------------------------------------- |
| `--agrupar categoria\|marca\|modelo` | Agrupación; admite un único valor         | `categoria`                            |
| `--min-grupo N`                      | Tamaño mínimo para el TOP                 | `8`                                    |
| `--min-ausentes N`                   | Ausencias mínimas de un campo para el TOP | `3`                                    |
| `--top N`                            | Máximo de patrones priorizados mostrados  | `20`                                   |
| `--json`                             | Informe completo por `stdout`             | Desactivado                            |
| `--catalogo <ruta>`                  | Canónico íntegro explícito; repetible     | Entrega conservada o referencia legada |

Los argumentos numéricos requieren enteros positivos. `--top` limita `prioritized`, no las colecciones completas `groups` y `cases`. El despachador puede compilar y actualizar `dist/`, pero **el auditor no escribe en `data/reference/`, `storage/` ni en los catálogos**. Una redirección `>` sí crea el archivo indicado por el operador; debe mantenerse fuera de Git y del ZIP público.

## Lectura del resultado

1. Identificar proveedor, categoría original, clave/descripción, frecuencia y fichas afectadas.
2. Usar `--json` para consultar `provenance` (fuente, `runId` cuando existe o catálogos explícitos, y `rulesSha256`), `universe` y la vista recalculada.
3. Consultar `prioritized` para el TOP, `groups[].observations` para todas las coberturas y `cases[]` para las fichas afectadas.
4. Revisar `original.shortDescription`, `original.longDescription` y `original.specs` antes de sugerir cualquier cambio. `observations[].originalSpecKeys` contiene **claves literales relacionadas por coexistencia**, nunca equivalencias acreditadas.
5. Contrastar los anuncios vigentes y los contraejemplos antes de corregir extractores o normalizadores. Si no hay evidencia suficiente, conservar el hueco como observación.

## Seguridad y verificación

- No usar el auditor para aprobar campañas, resolver `review`, rellenar por analogía ni sustituir la revisión humana.
- Mantener separación de proveedores, identidades únicas, agrupación por categoría de origen, orden determinista y pruebas de referencia íntegra.
- Verificar campos vacíos, valores `0`/`false`, cobertura total y cero, y ausencia de escrituras al modificar el analizador.
- Ejecutar la suite completa y el build antes de integrar cambios productivos. Una consulta estadística correcta no acredita cobertura externa del proveedor.

Referencias: [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md), [Referencia operativa](OPERATIONAL_REFERENCE.md) y [README](../README.md).
