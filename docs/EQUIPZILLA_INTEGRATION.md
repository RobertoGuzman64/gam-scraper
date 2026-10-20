# EQUIPZILLA_INTEGRATION.md

**Contrato receptor documentado · Equipzilla / importación de productos de maquinaria**  
**Fecha del análisis:** 20/10/2026.  
**Procedencia:** código fuente entregado en `Marketplace-Back-develop.zip` y, para delimitar el emisor, `ez-f4-f5bed1.zip` (scraper tras sus cuatro fases). **No se consultó una base de datos ni un entorno desplegado.** Lo descrito es comportamiento implementado en ese código, no evidencia de aceptación en producción.

## 1. Finalidad y límite exacto

Equipzilla dispone de un importador de **productos de venta** (`Product`, `CategorySell`, `CategoryAttribute`) que permite cargar maquinaria desde un **archivo Excel `.xlsx`**. El scraper obtiene fichas externas, las prepara y **puede generar un Excel de altas**; no hay en el flujo revisado un envío automático de sus JSON al backend.

Flujo real distinguido por responsabilidad:

```text
Portales GAM / Gomariz / Mercaeleva
  → ProductRecord del scraper (datos extraídos)
  → -all.csv y -preparation.json (publicación y preparación locales)
  → revisión + inventario de referencias de la compañía
  → Excel .xlsx, hoja "Productos" (solo altas seleccionadas)
  → POST /product/import con token y companyID
  → importación por filas → Product + ProductAttribute en la BD
```

**Separación contractual:** `-preparation.json`, `-summary.json`, `-changes.json` y `-snapshot-*.json` son artefactos **del scraper**, no cuerpos admitidos por `POST /product/import`. El backend no recibe `providerId`, `sourceUrl`, estado `ready/review` ni `spec` por la ruta de importación Excel.

No se auditan alquileres, leads, facturación ni otras áreas del backend. Se describen **solo** contratos de producto/venta relacionados con esta entrada.

## 2. Entrada real del backend

| Aspecto                        | Comportamiento confirmado                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ruta                           | `POST /product/import` (`src/routes/index.routes.ts` + `src/routes/product.routes.ts`)                                                                            |
| Autenticación                  | `validateTokenUsuario` y posterior comprobación `ckeckCompany(token, companyID)`; permite administrador o empleado de esa compañía, conforme al código            |
| Transporte                     | `multipart/form-data`, campo de fichero **`file`**, con `req.body.companyID` convertido a `Number`                                                                |
| Archivo                        | Extensión `.xlsx`; carga en memoria con Multer; límite **10 × 1024 × 1024 bytes**; el código no exige un MIME concreto aparte de la extensión                     |
| Hoja                           | Nombre exacto **`Productos`**                                                                                                                                     |
| Lectura                        | Librería `xlsx`; primera fila como cabeceras, datos desde fila Excel 2; celdas vacías como `null`; se descartan filas completamente vacías salvo `Estado de fila` |
| Resultado sin excepción global | HTTP **201** con `{status:201, data:{totalProcessed,totalCreated,totalFailed,errors}, message:"Product import completed"}`                                        |
| Resultado parcial              | Una fila fallida se añade a `errors`, se continúa con las siguientes y la respuesta puede seguir siendo 201                                                       |
| Publicación                    | La importación crea registros de productos; **no equivale a activarlos/publicarlos** (`Product.active` tiene `@default(false)`)                                   |

`companyID` se verifica en el controlador y en el validador; es un **ID real del backend**, no el identificador textual de proveedor usado por el scraper. La autorización depende del token del entorno destino.

### 2.1. Cabeceras de Excel reconocidas

Los asteriscos aparecen **literalmente en el nombre de la columna**. La obligatoriedad efectiva se determina por `parseImportRow`, no por el asterisco por sí mismo.

| Cabecera literal      | Valor interno de `ProductImportRow` | Tipo tras parseo | Obligatorio para crear | Regla comprobada                                                                                                                                                 |
| --------------------- | ----------------------------------- | ---------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Referencia *`        | `reference`                         | `string`         | Sí                     | Texto no vacío (`trim`)                                                                                                                                          |
| `Categoría *`         | `category`                          | `string`         | Sí                     | Debe encontrar una `CategorySell` activa por **nombre exacto**                                                                                                   |
| `Título *`            | `title`                             | `string`         | Sí                     | Texto no vacío                                                                                                                                                   |
| `Condición *`         | `condition`                         | `string`         | Sí                     | Debe ser `Nuevo` o `Segunda_Mano`                                                                                                                                |
| `Precio *`            | `price`                             | `number \| null` | Sí                     | Se convierte con `Number`; el validador comprueba `!row.price`, por tanto **0 es rechazado**, pero no hay una comprobación explícita de positividad en esta ruta |
| `Descripción título`  | `description_title`                 | `string`         | No                     | Ausente ⇒ cadena vacía                                                                                                                                           |
| `Descripción *`       | `description`                       | `string`         | Sí                     | No puede estar vacía; en el modelo representa descripción corta                                                                                                  |
| `Descripción general` | `description_general`               | `string`         | No                     | Si falta o está vacía, en `create` se reemplaza por `description`                                                                                                |
| `Estado de fila`      | —                                   | —                | No                     | Se ignora para decidir qué filas importar; no es una señal de aprobación para el backend                                                                         |
| `URL 1 *`             | primer elemento de `urls`           | `string`         | Al menos una URL       | Es el encabezado de la primera imagen; no hay verificación explícita de protocolo/descarga en la validación de importación                                       |
| `URL 2` … `URL 10`    | resto de `urls`                     | `string[]`       | No                     | Se recogen hasta **10** URLs no vacías, en orden                                                                                                                 |

Las columnas de **atributos de categoría** se reconocen adicionalmente por su cabecera exacta (véase apartado 3). Cualquier otra cabecera no vacía que no sea una columna común ni `URL <n>` entra en el diccionario de atributos leído, pero **solo los atributos realmente vinculados a la categoría** se convierten a `ProductAttribute`.

El parser devuelve por fila este contrato interno (no es un JSON de entrada de la ruta):

```ts
interface ProductImportRow {
  row: number;
  reference: string;
  category: string;
  title: string;
  condition: string;
  price: number | null;
  description_title: string;
  description: string;
  description_general: string;
  attributes: Record<string, string | number | boolean>;
  urls: string[];
}
```

**Distinción importante:** `price` puede ser `null` **en el parser**, pero el validador de esta importación no acepta precio ausente. El modelo Prisma permite `price: Float?`, una restricción diferente. Para la hoja, enviar celdas numéricas reales evita que textos de precio no interpretables terminen como `null`.

## 3. Resolución de categoría y atributos

1. `findCategorySellByName(row.category)` busca `CategorySell` con `name` igual al texto de la hoja y `active: true`. Se emplea `findFirst`, no se comprueba allí que el nombre sea único. Por tanto, el Excel **no envía** `categorySellID` y un nombre ambiguo no es una correspondencia garantizada.
2. `getAllAttributeByCategoryID(category.id)` recupera relaciones `CategoryAttribute_CategorySell` con `actived: true`, junto con la definición de cada `CategoryAttribute`.
3. Para cada atributo relacionado, la cabecera esperada es su `name`; si `type` no es `SELECT` ni `BOOLEAN` y `unit_option` tiene contenido, es **`<name> (<unit_option>)`**. Coincidencia textual: no se hace una búsqueda flexible de nombres en el backend.
4. Solo se añaden atributos presentes y no vacíos. `validateRequiredAttributes` exige valor no nulo/indefinido ni cadena en blanco para los atributos con `required: true`. No hay en este camino una validación semántica exhaustiva por tipo (`NUMBER`, `DATE`, etc.).
5. `ProductService.create` convierte cada valor aceptado a **texto** para `ProductAttribute.value`; los booleanos se guardan como `"Si"` / `"No"`, los demás mediante `String(value)`. La base de datos define `value: String?`.

Enumeraciones y estructuras relevantes del backend:

- `ProductCondition`: **`Nuevo`**, **`Segunda_Mano`**. Valor exacto, no `"Segunda mano"`.
- `AttributeType`: **`TEXT`**, **`NUMBER`**, **`DECIMAL`**, **`BOOLEAN`**, **`DATE`**, **`SELECT`**, **`MULTISELECT`**.
- `CategorySell`: `id: Int`, `name: String?`, `slug: String?`, `active: Boolean`, `parentCategoryID: Int?`; relación con `Product` y con sus atributos.
- `CategoryAttribute`: `id: Int`, `name: String`, `type: AttributeType`, `required: Boolean`, `unit_option: String`.
- `CategoryAttribute_CategorySell`: clave compuesta `(categoryID, attributeID)` y `actived: Boolean`.

El código de importación **no aplica límites ni conversiones de unidades por sí mismo**: las conversiones deben estar resueltas al generar el Excel. Los ID, nombres, unidades y relaciones **efectivos en la BD desplegada** no se han comprobado; los JSON de categorías/atributos incluidos en el scraper son fotografías locales, no consultas en vivo.

## 4. Alta y persistencia

Por cada fila válida, el importador construye un objeto para `ProductValidator.create` con:

| Propiedad de creación                                                           | Procedencia o regla                                                                          |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `title`, `reference`, `description`, `description_title`, `description_general` | Columnas Excel; `description_general` puede heredar `description`                            |
| `categorySellID`                                                                | Categoría activa encontrada por nombre en backend                                            |
| `companyID`                                                                     | Formulario de importación, validado contra el token                                          |
| `condition`                                                                     | Enum `Nuevo` o `Segunda_Mano`                                                                |
| `price`                                                                         | Número leído del Excel y validado con la condición explicada                                 |
| `image`                                                                         | Primera URL no vacía                                                                         |
| `images`                                                                        | Arreglo de hasta 10 URLs obtenidas de las columnas de imágenes                               |
| `attributes`                                                                    | `{attributeID: number, value: string \| number \| boolean}[]` con IDs de la categoría activa |
| `logoID`                                                                        | **18 fijo en `parseImportRow`**; no se deduce de la marca del proveedor                      |
| `metadata`                                                                      | Se genera internamente a partir de título, condición y nombre de categoría                   |
| `spec`                                                                          | No lo envía `parseImportRow`; queda sin la información `spec` del JSON del scraper           |

`Product` almacena, entre otros, `id` autoincremental, `createdAt`, `title`, `categorySellID?`, `companyID?`, `condition`, `price?`, `reference?`, `description?`, `description_title?`, `description_general?`, `image?`, `images?` (JSON), `spec?` (JSON), `logoID?`, `metadata?` (JSON), `active?` (default `false`). La obligatoriedad de la **importación** no debe inferirse de estos campos opcionales de Prisma.

La operación de producto y sus atributos se ejecuta en una transacción por llamada a `ProductService.create`. Después se crea un evento de producto y se disparan tareas de IA y análisis de mercado asíncronas cuando `processAI` está activado. **La importación completa no es una transacción única** y sus filas anteriores no se revierten por fallos posteriores. No se confirma aquí que esas tareas asíncronas hayan terminado ni cómo evolucionan en despliegue.

## 5. Identidad, duplicados, actualizaciones y bajas

- **Dentro de un mismo fichero:** `importProducts` rechaza referencias repetidas usando un `Set<string>` sobre `row.reference.trim()`; la comparación es **sensible a mayúsculas/minúsculas**. Una referencia registrada antes de fallar su fila también puede marcarse como duplicada en una fila posterior.
- **Contra la BD:** en el flujo revisado `parseImportRow → create → ProductService.create` **no se consulta una referencia existente antes de crear**. El modelo Prisma `Product` no define una clave única para `(companyID, reference)` ni para `reference`. No debe suponerse deduplicación por empresa ni *upsert* al importar.
- **Importación:** exclusivamente **altas**. `PUT /product/update/:id` es otra operación, no parte del Excel; tampoco hay baja automática en el importador.
- **Referencias externas:** la URL o ID del portal no reemplaza automáticamente `reference` en el modelo. No existe en esta ruta un contrato de sincronización proveedor-producto-unidad, actualización de precio o retirada de anuncios.
- **Protección externa:** el exportador del scraper exige un inventario CSV por compañía para **excluir altas con referencias ya existentes**. Es un control previo **local**, no una garantía del backend ni una fuente de datos actualizada por él.

## 6. Errores y otras operaciones que NO son importación

Errores que el importador registra por fila: `row`, `reference`, `title` y `message`. Registra `totalProcessed`, `totalCreated`, `totalFailed`. Puede existir **éxito parcial** con respuesta 201. Los fallos de formato, hoja inexistente, fichero ausente, compañía inválida u otros errores fuera del bucle recorren el manejador de errores HTTP general; **el estado HTTP concreto de cada excepción no se confirma aquí**.

Operaciones próximas pero distintas:

- `POST /product/create` y `POST /product/create/many`: otras rutas autenticadas de creación, con sus propios cuerpos JSON y validaciones. No son la entrada usada por el exportador Excel del scraper.
- `POST /product/compare`: recibe `{ products: ExternalProduct[] }`, donde cada producto tiene `{source: string, externalReference: string | null, productUrl: string, price: number | null}`. El validador solo reconoce `GAM` y `MERCA_ELEVA` en esta función, filtra referencias/URLs inválidas y genera una **comparación**; no importa productos ni es la ruta prevista para Gomariz. No debe confundirse con `/product/import`.
- `GET /product/attributes/sell/:categoryID` (autenticada) y `GET /product/categories/product`: rutas de consulta relacionadas con metadatos; su disponibilidad en código **no significa que el scraper las consuma**.

## 7. Límites verificados y cuestiones abiertas

**Confirmado en código:** entrada `.xlsx`, cabeceras/hoja, enum, selección de categoría por nombre, atributos activos/obligatorios, hasta diez imágenes, altas por filas con informe parcial, ausencia de upsert en importación y `logoID: 18` fijo.

**No confirmado en el código revisado o sin ejecución del entorno:**

- Valores efectivos en la BD destino (IDs de empresa, categorías activas, atributos asociados, existencia del logo 18), calidad del inventario de referencias y permisos reales disponibles para el operador.
- Coincidencia entre `data/category/categorySell-flat.json` y `data/import/attributeCatalog.json` del scraper y los catálogos **actuales** del despliegue.
- Disponibilidad o validez HTTP de todas las URLs de imágenes, almacenamiento remoto de imágenes y aceptación visual/publicación final.
- Una API que consuma directamente `-preparation.json` o `ProductRecord`: **no se ha identificado como parte de este flujo**.
- Sincronización automática de altas, cambios, precios o bajas entre proveedor y Equipzilla: **no consta implementada en el camino documentado**.

## 8. Trazabilidad para mantener esta referencia

**Backend:** `src/routes/index.routes.ts`, `src/routes/product.routes.ts`, `src/controller/product.controller.ts` (`importProducts`), `src/utils/decodeToken.ts` (`ckeckCompany`), `src/utils/ProductImportParser.ts`, `src/validator/product.validator.ts` (`parseImportRow`, `importProducts`, `create`), `src/service/product.service.ts` (`findCategorySellByName`, `getAllAttributeByCategoryID`, `create`, `parseAttributeValue`), `prisma/schema.prisma` (`Product`, `CategorySell`, `CategoryAttribute`, `CategoryAttribute_CategorySell`, `ProductAttribute`, enums).

**Scraper contrastado:** `src/catalog/import/{prepare,preparation-document,export-plan,xlsx}.ts`, `src/cli/export.ts`, `src/pipeline/validation/preflight.ts`, `src/pipeline/publication/publish.ts`. Las rutas sirven para localizar el origen **si el proyecto cambia**; el contenido de este archivo está redactado para entenderse sin los repositorios abiertos.

**Regla de mantenimiento:** cuando cambie el backend, revisar primero el parser, la validación y la persistencia efectivos. Actualizar este documento **manualmente** con nueva fecha/procedencia. No asumir que un cambio en Prisma basta para modificar el contrato de importación.
