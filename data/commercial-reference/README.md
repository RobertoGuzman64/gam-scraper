# Referencias para la salida comercial de EQUIPZILLA

Estas referencias permiten **construir en el scraper** el catálogo comercial propio. El backend aportado sirve para conocer IDs, tipos, relaciones y campos; **no** para copiar productos ni adaptar la calidad del catálogo a sus seeds. Esta carpeta no alimenta automáticamente el runtime. El backend y la BD no se modifican en este trabajo.

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

## Reglas para generar los JSON comerciales (pendientes de implementar)

1. **Entrada:** usar exclusivamente fichas técnicas acreditadas, con identidad de proveedor, referencia, URL, condición, specs, imágenes y procedencia. No modificar originales, publicaciones ni sus hashes.
2. **Alcance:** **excluir lotes de productos y herramientas** del JSON comercial; identificar por naturaleza real del artículo y evidencia de la ficha, no por coincidencias ingenuas de palabras. No confundir los lotes de venta con los lotes técnicos de proceso. Mantener un registro comprobable de excluidos con motivo, sin borrarlos del catálogo técnico.
3. **Categoría:** asignar `categorySellID` de `categorySell-flat.json` según familia, características y `condition` (`Nuevo` o `Segunda_Mano`); utilizar una categoría activa y hoja coherente con su rama. No asignar por proximidad ni heredar ciegamente `categorySellID` del seed antiguo. Si falta evidencia, registrar excepción.
4. **Atributos:** partir de `spec` acreditadas, consultar `attributeCatalog.json`, usar solo `attributeID` real asociado a la categoría y una sola asignación por ID. Respetar `type`, unidades, relaciones y `required`; normalizar magnitudes cuando haya equivalencia demostrable. `SELECT` y `MULTISELECT` necesitan opciones y reglas verificables: `unit_option` no siempre define un vocabulario cerrado. No inventar valores ni tratar desconocido como cero.
5. **Contenido:** componer `title`, `description_title`, `description`, `description_general`, `image`, `images`, `spec` y `metadata` a partir de datos acreditados; la forma y responsabilidad de `metadata` quedan fijadas abajo. Evitar textos genéricos, contradicciones y marketing histórico sin contrastar. `price` solo con precio acreditado; su ausencia es una excepción comercial, no motivo para falsificarlo.
6. **IDs e identidad:** conservar `providerId`, `reference`, `externalReference` y `sourceUrl` del scraper para trazabilidad. Para GAM, la referencia comercial antigua corresponde a `externalReference`, que **no es identidad única**. Resolver colisiones con identidad de origen; nunca fusionar máquinas por el nombre o la referencia visible.
7. **Logo y empresa:** resolver `logoID` solo con marca inequívoca de la lista de 20; no deducir fabricantes desconocidos de `Otras Marcas` (ID 18). `companyID` depende del proveedor y entorno y debe ser configurable. No copiar automáticamente IDs de un producto histórico.
8. **Salida y control:** crear JSON comercial **independiente** de la publicación técnica, con todas las unidades elegibles y excepciones explícitas para excluidos, no categorizados y datos pendientes. Contrastar cobertura, tipos, relaciones y diferencias antes de aprobar una exportación. No importar en backend todavía.

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

Ejemplo de formato, **no una ficha acreditada**. `tags` y `keywords` son `string[]`; `featured` es `boolean`. El **scraper comercial** genera etiquetas y palabras clave deterministas a partir de categoría, marca, modelo, condición y datos acreditados: normalizados, sin vacíos, duplicados ni afirmaciones inventadas. El **auditor comercial** comprobará su estructura, cobertura y coherencia en F3–F5.

Para **altas**, el scraper inicializa `featured: false`. Para **actualizaciones**, `featured` es una decisión operativa del backend: la futura importación deberá **preservar el valor ya guardado**, salvo cambio autorizado, aunque el JSON comercial incluya el valor inicial. La integración futura también deberá persistir `tags` y `keywords` procedentes del scraper **sin regenerarlos**. El backend actual todavía los genera por su cuenta en sus operaciones; adaptar ese comportamiento corresponde a la integración posterior, **no a este trabajo**.

`metadata` pertenece únicamente al derivado comercial: **nunca** se añade a las publicaciones técnicas acreditadas.

## Modelo de datos real

El backend define en `prisma/schema.prisma` un `Product` con `categorySellID`, `companyID`, `logoID`, `condition`, `title`, `reference`, `price`, textos, imágenes, `spec` y `metadata`. Los atributos son una relación **`ProductAttribute`** (`attributeID` y `value` persistido como `String?`), no una columna `attributes` de `Product`. Los seeds antiguos expresan atributos como `[ {"attributeID": 115, "value": "GENIE"} ]`; la futura importación deberá resolver la conversión y persistencia, sin atribuir esa responsabilidad al contrato técnico. Los tres JSON de `legacy-products/` **solo ilustran campos reales**, están abreviados y no forman un dataset histórico ni un contrato de importación.

**Verificación antes de trabajar:** 116 IDs de categoría únicos con padres existentes, 123 IDs de atributo únicos, 1.837 relaciones válidas, 20 IDs de logo únicos; ninguna categoría/atributo inventado y exclusiones justificadas. La implementación comercial, sus pruebas y cualquier adaptación del backend corresponden a fases posteriores.
