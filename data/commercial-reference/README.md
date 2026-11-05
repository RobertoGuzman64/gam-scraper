# Referencias para la salida comercial de EQUIPZILLA

Estas referencias permiten **construir en el scraper** el catálogo comercial propio. El backend aportado sirve para conocer IDs, tipos, relaciones y campos; **no** para copiar productos ni adaptar la calidad del catálogo a sus seeds. El backend y la BD no se modifican en este trabajo. El funcionamiento permanente del derivado se describe en [`../../docs/COMERCIALIZACION.md`](../../docs/COMERCIALIZACION.md).

## Fuentes únicas (no duplicar catálogos)

| Necesidad                        | Archivo vigente                               | Contenido                                                             |
| -------------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| Categorías e IDs                 | `../category/categorySell-flat.json`          | 116 categorías, `id`, `parentId`, `name`, `slug`                      |
| Árbol para consulta              | `../category/categorySell-tree.json` / `.txt` | Las mismas 116 categorías; no es otro catálogo                        |
| Atributos y reglas de asociación | `../import/attributeCatalog.json`             | 123 atributos y 1.837 relaciones `categoryID`–`attributeID`           |
| Logos comerciales                | `backend-taxonomy-reference.json`             | 20 `logoID`, marca, slug y URL del seed                               |
| Empresas por entorno             | `company-ids-reference.json`                  | Referencias de `companyID` develop/production; configurar por entorno |
| Forma de productos antiguos      | `legacy-products/*.json`                      | **Un ejemplo parcial por proveedor**, no productos para importar      |
| Procedencia                      | `source-manifest.json`                        | Rutas y hashes de los seeds de backend utilizados                     |

Los archivos `data/category` y `data/import` son recursos operativos existentes, **no documentación para recortar**. Se han incorporado a las categorías los IDs 115–120 presentes en el seed de backend. El catálogo de atributos y sus relaciones ya coincide exactamente con esos seeds y no se duplica aquí. Las nuevas categorías no tienen relaciones de atributo en el seed.

## Reglas para generar los JSON comerciales

1. **Entrada:** usar exclusivamente fichas técnicas acreditadas, con identidad de proveedor, referencia, URL, condición, specs, imágenes y procedencia. No modificar originales, publicaciones ni sus hashes.
2. **Alcance:** **excluir lotes de productos y herramientas**, además de accesorios cuyo carácter dependiente esté acreditado expresamente, del JSON comercial; identificar por naturaleza real del artículo y evidencia de la ficha, no por coincidencias ingenuas de palabras. No confundir los lotes de venta con los lotes técnicos de proceso. Mantener un registro comprobable de excluidos con motivo, sin borrarlos del catálogo técnico.
3. **Categoría:** asignar `categorySellID` de `categorySell-flat.json` según familia, características y `condition` (`Nuevo` o `Segunda_Mano`). Priorizar una categoría hoja activa; utilizar una categoría padre existente solo cuando represente correctamente la familia y la regla esté acreditada. Las categorías sin relaciones de atributos no permiten inventar asociaciones: conservar íntegramente las `spec` técnicas. No asignar por proximidad ni heredar ciegamente `categorySellID` de seeds antiguos. Si falta evidencia o condición comercial, registrar intervención pendiente.
4. **Atributos:** partir de `spec` acreditadas, consultar `attributeCatalog.json`, usar solo `attributeID` real asociado a la categoría y una sola asignación por ID. Respetar `type`, unidades y relaciones; `required` es un indicador heredado cuya obligatoriedad se revisará en el backend y **no genera incidencias** en el auditor comercial. Normalizar magnitudes cuando haya equivalencia demostrable. `SELECT` y `MULTISELECT` necesitan opciones y reglas verificables: `unit_option` no siempre define un vocabulario cerrado. No inventar valores ni tratar desconocido como cero.
5. **Contenido:** componer `title`, `description_title`, `description`, `description_general`, `image`, `images`, `spec` y `metadata` a partir de datos acreditados; la forma y responsabilidad de `metadata` quedan fijadas abajo. Evitar textos genéricos, contradicciones y marketing histórico sin contrastar. `price` solo con precio acreditado; su ausencia no genera incidencias ni justifica falsificarlo.
6. **IDs e identidad:** conservar `providerId`, `reference`, `externalReference` y `sourceUrl` del scraper para trazabilidad. Para GAM, la referencia comercial antigua corresponde a `externalReference`, que **no es identidad única**. Resolver colisiones con identidad de origen; nunca fusionar máquinas por el nombre o la referencia visible.
7. **Logo y empresa:** resolver `logoID` solo con marca inequívoca de la lista de 20; no deducir fabricantes desconocidos de `Otras Marcas` (ID 18). `companyID` depende del proveedor y entorno y debe ser configurable. No copiar automáticamente IDs de un producto histórico.
8. **Salida y control:** crear JSON comercial **independiente** de la publicación técnica, con todas las unidades elegibles, exclusiones justificadas e intervenciones reales pendientes (como categorías sin resolver o atributos incompatibles). Contrastar cobertura, tipos, relaciones y diferencias antes de aprobar una exportación. No importar en backend todavía.

## Metadata comercial: responsabilidad del scraper

Cada producto del **JSON comercial** incluye `metadata` al mismo nivel que `title`, `categorySellID` y `description_general`, con las claves existentes del backend:

```json
{
  "metadata": {
    "tags": ["maquinaria", "segunda-mano", "plataforma-articulada"],
    "keywords": ["genie", "z45-25j", "plataforma-articulada"],
    "featured": false
  }
}
```

Ejemplo de formato, **no una ficha acreditada**. `tags` y `keywords` son `string[]`; `featured` es `boolean`. El **scraper comercial** genera etiquetas y palabras clave deterministas a partir de categoría, marca, modelo, condición y datos acreditados: normalizados, sin vacíos, duplicados ni afirmaciones inventadas. El **auditor comercial** comprueba su estructura y coherencia según las reglas de intervención aprobadas.

Para **altas**, el scraper inicializa `featured: false`. Para **actualizaciones**, `featured` es una decisión operativa del backend: la futura importación deberá **preservar el valor ya guardado**, salvo cambio autorizado, aunque el JSON comercial incluya el valor inicial. La integración futura también deberá persistir `tags` y `keywords` procedentes del scraper **sin regenerarlos**. El backend actual todavía los genera por su cuenta en sus operaciones; adaptar ese comportamiento corresponde a la integración posterior, **no a este trabajo**.

`metadata` pertenece únicamente al derivado comercial: **nunca** se añade a las publicaciones técnicas acreditadas.

## Modelo de datos real

El backend define en `prisma/schema.prisma` un `Product` con `categorySellID`, `companyID`, `logoID`, `condition`, `title`, `reference`, `price`, textos, imágenes, `spec` y `metadata`. Los atributos son una relación **`ProductAttribute`** (`attributeID` y `value` persistido como `String?`), no una columna `attributes` de `Product`. Los seeds antiguos expresan atributos como `[ {"attributeID": 115, "value": "GENIE"} ]`; la futura importación deberá resolver la conversión y persistencia, sin atribuir esa responsabilidad al contrato técnico. Los tres JSON de `legacy-products/` **solo ilustran campos reales**, están abreviados y no forman un dataset histórico ni un contrato de importación.

**Verificación antes de trabajar:** 116 IDs de categoría únicos con padres existentes, 123 IDs de atributo únicos, 1.837 relaciones válidas, 20 IDs de logo únicos; ninguna categoría/atributo inventado y exclusiones justificadas. El scraper comercial ya dispone de mapeadores, exportación y auditoría propios. Los ajustes de `required`, metadata e IA del backend siguen pendientes de integración; las referencias locales no se alteran para simularlos.
