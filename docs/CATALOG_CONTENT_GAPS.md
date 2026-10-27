# Auditor de huecos de contenido del catálogo

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Finalidad y límites

`npm run huecos` es una **consulta opcional** que identifica patrones de contenido ausente entre originales canónicos de EQUIPZILLA. Agrupa fichas y muestra la cobertura de sus campos, las identidades afectadas y la evidencia original disponible para una investigación posterior. No completa campos, no recomienda automáticamente valores, no decide equivalencias técnicas y **no genera incidencias `Review`**. No forma parte del proceso de extracción, acreditación, entrega, actualización de referencia ni limpieza.

El informe es estadístico: una ausencia en un grupo no demuestra un error ni que pueda recuperarse un dato. Compartir categoría, marca o modelo declarado tampoco garantiza que las máquinas tengan la misma configuración.

## Procedencia, contratos y módulos

- **Entrada:** `data/reference/`, inspeccionada exclusivamente mediante `inspectCampaignReference` (`src/infrastructure/filesystem/campaign-reference.ts`). La consulta solo continúa si la referencia es `valid`; ante `absent`, `recoverable` o `invalid` falla sin reparar ni modificar nada.
- **Originales:** `ProductRecord` de `src/contracts/catalog.ts`, conservados en los catálogos canónicos. Incluyen proveedor, referencias, URL, categoría de origen, marca, modelo, descripciones y `specs` originales.
- **Reglas vigentes:** `loadImportCatalogSnapshot` obtiene categorías, atributos y relaciones activas. `prepareProduct` reconstruye **en memoria** el producto preparado para obtener `categorySellID`, estado y contenido normalizado.
- **Análisis:** `src/tools/catalog-content-gaps.ts` calcula agrupaciones, ausencias, evidencias y prioridades sin acceder al sistema de archivos.
- **Entrada de usuario:** `src/cli/catalog-content-gaps.ts`, registrada como `huecos` en `scripts/tooling.mjs` y `package.json`. `src/tools/tests/catalog-content-gaps.test.ts` protege sus comportamientos esenciales.

El universo son **todos los originales de la referencia**, incluidos productos excluidos de una entrega. Los estados `ready/review` y la normalización corresponden a las **reglas actuales del repositorio**, no a una preparación histórica. La referencia operativa es local, puede no existir en una instalación recién clonada y no se versiona por defecto.

## Campos observados

| Campo observado     | Comprobación                                                                                                   | Evidencia para investigar                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Atributos técnicos  | Presencia de `attributeID` entre `product.attributes[]`, solo si está activo y es aplicable a `categorySellID` | `ProductRecord.specs`, claves literales y textos originales, **sin equivalencias presumidas** |
| Descripción corta   | `product.description` no nula ni vacía tras `trim()`                                                           | `shortDescription` original y, separadamente, `longDescription` como texto relacionado        |
| Descripción general | `product.description_general` no nula ni vacía tras `trim()`                                                   | `longDescription` original y, separadamente, `shortDescription` como texto relacionado        |

Una cadena vacía o compuesta solo de espacios cuenta como ausente. En un atributo, `0` y `false` cuentan como contenido. Cuando no existe una categoría de destino válida no se comparan atributos técnicos aplicables, aunque sí se observan las descripciones. Los campos de identidad, título, referencia, serie, clasificación, precio e imágenes **no se auditan como huecos**.

## Agrupación, cobertura y prioridad

Los grupos separan siempre proveedores y categorías de destino existentes. Si no hay `categorySellID`, se usa la categoría de origen como grupo **no comparable**. El parámetro `--agrupar` permite `categoria` (predeterminado), `marca` o `modelo`, utilizando únicamente cadenas declaradas; el refinamiento por modelo mantiene la marca. No se infieren familias técnicas.

Para cada grupo y campo, el analizador cuenta máquinas aplicables, presentes y ausentes, porcentaje de cobertura y sus identidades. Distingue cobertura `completa`, `desigual` y `sistematica` (ausencia en todo el grupo). Los patrones sistemáticos también pueden ser relevantes si hay texto original relacionado: no se eliminan por tener cobertura del 0 %.

La prioridad es orientativa: primero ausencias numerosas con evidencia directa o texto relacionado repetidos; después coberturas desiguales; después patrones con especificaciones no vinculadas y, finalmente, ausencias sin evidencia observable. El orden es estable y se desempata por claves del grupo. Los filtros del TOP **no eliminan** grupos ni casos del JSON de detalle.

### Clases de evidencia por caso

- `directa_del_campo`: existe el campo original de descripción correspondiente pero el final está vacío.
- `texto_relacionado`: existe texto en el otro campo de descripción, sin equivalencia demostrada.
- `especificaciones_sin_vinculo_acreditado`: hay `specs` con contenido junto a un atributo ausente; no se ha acreditado relación con dicho atributo.
- `sin_evidencia_observable`: estas comprobaciones no encuentran evidencia en los campos observados, **no** que la web carezca de ella.
- `desconocida`: la información conservada no permite una clasificación segura.

Ni las clases de evidencia ni la frecuencia estadística crean una autorización para modificar productos. Los valores ambiguos, las configuraciones múltiples y los datos no publicados deben conservar sus defensas actuales.

## Ejecución

Desde la raíz del repositorio, con sus dependencias instaladas:

```powershell
npm run huecos
npm run huecos -- --agrupar marca --min-grupo 8 --min-ausentes 3 --top 20
npm run huecos -- --agrupar modelo --top 10
npm run huecos -- --json > huecos-consulta.json
npm run ayuda -- huecos
```

| Opción               | Significado                                         | Valor predeterminado |
| -------------------- | --------------------------------------------------- | -------------------- |
| `--agrupar categoria | marca                                               | modelo`              | Dimensión de agrupación | `categoria` |
| `--min-grupo N`      | Mínimo de máquinas del grupo para entrar en el TOP  | `8`                  |
| `--min-ausentes N`   | Mínimo de ausencias del campo para entrar en el TOP | `3`                  |
| `--top N`            | Máximo de patrones priorizados que se muestran      | `20`                 |
| `--json`             | Informe completo JSON por salida estándar           | Desactivado          |

`N` debe ser entero positivo. `--top` limita también `prioritized` en el JSON, pero **no** las colecciones completas `groups` y `cases`. El comando pasa por el despachador habitual, que puede compilar y actualizar `dist/`; el **auditor** no escribe en `data/reference/`, `storage/`, campañas, entregas ni catálogos. La redirección `>` escribe el archivo solicitado por quien ejecuta el comando; contiene datos de fichas y URLs, por lo que debe mantenerse fuera de Git y de las entregas.

## Cómo investigar un resultado

1. En el resumen, identificar proveedor, categoría, campo, frecuencia y las identidades del grupo afectado.
2. Para detalle, ejecutar con `--json`: `provenance` indica `runId`, recuentos y huellas de referencia y catálogos de importación; `universe` identifica el universo y la vista recalculada.
3. Localizar el patrón en `prioritized`, su grupo en `groups` y las identidades en `observations[].missingIdentities`.
4. Buscar esas identidades en `cases[]`. Cada caso contiene `reference`, `url`, `brand`, `model`, categoría, `status`, descripciones y `specs` originales, descripciones y `attributes` preparados y `gaps[].evidence`.
5. Comprobar el anuncio original y los contratos de atributo/categoría **antes** de valorar un cambio general en el mapper. Validar positivos, contraejemplos y diferencias completas antes/después. Si no existe una regla segura, la ausencia se conserva.

`observations[].originalSpecKeys` muestra **claves literales** frecuentes entre fichas sin atributo; no identifica semánticamente qué atributo contienen. Un resultado con pocas fichas puede estar en `groups` aunque no alcance los umbrales del TOP.

## Seguridad, mantenimiento y verificación

- Consulta solo lectura y fallo seguro ante referencia no íntegra; no crear ni reparar la referencia, ni obligar a auditar para entregar una campaña.
- Nunca crear `Review` por información opcional ausente ni completar por analogía entre máquinas.
- Preservar los contratos de `ProductRecord`, `PreparedProduct` e `ImportCatalog`. Las reglas de extracción y normalización continúan en sus módulos actuales, no aquí.
- Para modificar el auditor, verificar con pruebas dirigidas separación de proveedores/categorías, identidad única, atributos aplicables, campos vacíos, orden determinista, resultados de grupos con cobertura total o cero, y ausencia de escrituras.
- La suite global y la compilación del repositorio deben acreditarse en un entorno con dependencias instaladas; no interpretar como éxito global las ejecuciones dirigidas o fixtures antiguos.

Documentación relacionada: [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md), [Referencia operativa](OPERATIONAL_REFERENCE.md) y [README](../README.md).
