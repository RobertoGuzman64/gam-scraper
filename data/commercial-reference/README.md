# Referencias comerciales del backend (solo lectura)

Este directorio se añade al repositorio del **scraper** como evidencia de comparación para la siguiente campaña comercial. **No es el contrato runtime ni la taxonomía oficial de una base de datos viva** y los programas actuales no deben leerlo de manera automática. No reemplaza `data/category/categorySell-flat.json`, `data/category/categorySell-tree.json` ni `data/import/attributeCatalog.json`.

## Archivos

- `backend-taxonomy-reference.json`: representación plana, preservando campos, del seed de `CategorySell` (**116** categorías), `CategoryAttribute` (**123** atributos), `CategoryAttribute_CategorySell` (**1.837** relaciones) y `BrandLogo` (**20** logotipos). Enum `AttributeType.X` se serializa como `X`, sin cambiar los IDs. Las relaciones conservan `actived` y las categorías conservan sus metadatos de seed.
- `legacy-products/gam.json`: **927** entradas comerciales de `seedDataGAM.ts`.
- `legacy-products/gomariz.json`: **140** entradas de `seedDataGomariz.ts`.
- `legacy-products/mercaeleva.json`: **214** entradas de `seedDataMercaEleva.ts`.
- `company-ids-reference.json`: IDs **comunicados por Fernando el 30/10/2026**, no acreditados contra BD viva. Para Europa Prefabri, 184 en develop y 964 en producción; para los otros cuatro proveedores coinciden.
- `source-manifest.json`: origen exacto, hashes de fuentes y archivos, criterios de extracción.

Los tres seeds comerciales son **referencia histórica**, no verdad técnica. Se han trasladado los objetos de datos presentes en el código del backend, sin executar imports ni conectarse a BD. Los miembros `ProductCondition.X` se serializan como `X` para JSON. No contienen `metadata` por producto porque esos seeds no la incluían. Algunos textos/valores o categorías heredados pueden estar equivocados; **comparar y contrastar antes de reutilizar**. Los productos de Europa Prefabri y Manain no se incorporan a los seeds de este primer corte porque no están entre las 1.337 publicaciones técnicas acreditadas del piloto.

**Discrepancia documentada:** el scraper tiene **110** categorías en `data/category/categorySell-flat.json`; el seed de backend aportado contiene **116** (IDs adicionales 115, 116, 117, 118, 119 y 120). Se conservan ambos como evidencia; no actualizar la taxonomía runtime sin validar con la BD real y el dueño de producto.

Los `logoID`, `categorySellID` y `attributeID` de estos datos pertenecen al **snapshot del backend adjunto**, no son confirmación de sus valores desplegados. Los `companyID` por entorno tampoco están validados en la BD. No utilizar las referencias comerciales como claves de identidad. Los JSON legados contienen referencias duplicadas o reutilizadas posibles y no sustituyen las identidades de origen del scraper.

## Uso correcto en el siguiente hilo

Auditar primero el repositorio y el censo real; comparar **por proveedor y referencia inequívoca, con comprobación de colisiones**, y luego contrastar diferencias con specs y publicaciones acreditadas. Usar los seeds para detectar pérdidas de información comercial y diseños anteriores, no para copiar información sin evidencia. Las nuevas reglas deben tener pruebas y un diff global antes de aceptarse.
