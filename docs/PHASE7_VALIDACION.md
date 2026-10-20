# Fase 7 — Validación previa a producción

## Alcance y resultado

Se revisa el flujo de extracción → CSV → preparación de productos → Excel de altas del importador existente. **No se modifica Marketplace-Back, ni se ejecuta `POST /product/import` automáticamente**. Las pruebas unitarias son locales; no certifican que las tres webs hayan sido recorridas por completo ni que las URL de fotos estén accesibles.

El script `validate:catalog` verifica que el resumen, el CSV agregado, la preparación y los cambios correspondan a una ejecución reciente, completa y sin fallos; confirma recuentos, referencias, URLs y proveedor. También comprueba las huellas SHA-256 del CSV y la preparación publicadas junto al resumen. Las ejecuciones anteriores a la fase 7, que carezcan de huellas, requieren **un nuevo scraping**, no una excepción a la validación.

Una extracción que alcance el máximo `--maxPages` sin llegar a la condición normal de parada se considera **parcial**. Sus CSV válidos anteriores se conservan y su preparación se archiva con el prefijo `-partial`; no genera un nuevo catálogo publicable. No debe emplearse `--maxPages 1` para obtener un catálogo de producción.

## Comprobación de instalación

```bash
npm ci
npm test
npm run build
```

**Todas** las pruebas HTML deben pasar con Cheerio real: si aparecen como omitidas (`skipped`), el entorno todavía no está validado para una puesta en producción. Las pruebas con ficheros HTML guardados son de regresión de selectores; no sustituyen pruebas sobre las páginas públicas actuales.

## Pruebas de extracción por proveedor

Los prefijos de prueba deben ser distintos de los usados por el programador. Utilizar `--maxPages 2` solamente para diagnosticar HTML y paginación: la ejecución acabará como parcial si encuentra productos hasta ese límite, y eso es esperado.

```bash
npm run scrape -- --provider gam --outPrefix prueba-gam --maxPages 2
npm run scrape -- --provider gomariz --outPrefix prueba-gomariz --maxPages 2
npm run scrape -- --provider mercaeleva --outPrefix prueba-mercaeleva --maxPages 2
```

Después de revisar los resultados de prueba, ejecutar cada proveedor **sin limitar artificialmente las páginas**:

```bash
npm run scrape -- --provider gam
npm run scrape -- --provider gomariz
npm run scrape -- --provider mercaeleva
```

La automatización general sigue disponible con `npm run scrape:all`. No habilitarla hasta completar la aceptación individual de los tres proveedores. Si Mercaeleva no muestra enlaces HTML, hay que disponer de Chrome o Chromium y configurar `CHROME_PATH` según el README.

## Auditoría del catálogo publicado

Usar el directorio y el prefijo que constan realmente en la configuración del adaptador. Ejemplos para los valores actuales:

```bash
npm run validate:catalog -- --provider gam --outDir storage/scraped/gam --outPrefix scrape-gam-marzo-2026
npm run validate:catalog -- --provider gomariz --outDir storage/scraped/gomariz --outPrefix scrape-gomariz
npm run validate:catalog -- --provider mercaeleva --outDir storage/scraped/mercaeleva --outPrefix scrape-mercaeleva
```

El valor predeterminado de antigüedad máxima es **48 horas**; modificarlo solamente si se acepta de manera explícita un catálogo más antiguo con `--maxAgeHours`. La salida `status: passed` significa **consistencia técnica local**, no disponibilidad ni aprobación para importar. `status: review` señala categorías, precios, atributos, imágenes o posibles bajas que deben revisarse. La CLI usa código de salida `2` para `review`, `1` para errores técnicos y `0` para `passed`.

## Aceptación manual antes de importar

1. Confirmar con negocio las URLs y el alcance del catálogo de **venta** de cada empresa. Comprobar contra la web la primera, intermedia y última página y verificar que la paginación no pierde artículos. Revisar unidades distintas con igual modelo.
2. Examinar un conjunto representativo de productos reales de cada categoría y comparar referencia, marca, modelo, año, horas, precio, fotografías, especificaciones y categoría Equipzilla. No inventar valores ausentes; las fichas sin precio deben quedar en revisión.
3. Revisar `*-summary.json`, `*-errors.json`, `*-changes.json` y `*-preparation.json`. Confirmar `failures=0`, `status=complete`, integridad y recuentos razonables; comprobar explícitamente los casos de `suspectedMissing` sin dar de baja productos.
4. Verificar en la **base de datos de destino** el `companyID`, el catálogo de categorías y atributos, y el inventario completo `companyID,reference`. No reutilizar IDs históricos sin confirmarlos.
5. Ejecutar `npm run export:import -- ... --dry-run` y revisar las incidencias. Generar el `.xlsx` únicamente con `--confirm-inventory` y un inventario reciente de la misma empresa. Examinar todas las columnas y las diez URLs máximas de imágenes.
6. En entorno de pruebas, importar **una muestra pequeña** por el endpoint existente y comprobar el resultado en la base de datos y el panel admin. Consultar referencias antes y después; verificar número de productos, categorías, fotos y atributos reales. Una importación parcial puede crear unos productos y fallar en otros.
7. Repetir la preparación con el inventario actualizado: las referencias ya creadas deben excluirse de las nuevas altas. No asumir idempotencia de la API; la protección solo funciona con el inventario completo del momento. Validar también que errores de red o una extracción parcial conservan los catálogos publicados.
8. Documentar resultados, incidencias, aprobación y persona responsable antes de activar ejecuciones programadas. La automatización no importará directamente al backend.

No se declara **validación de producción completada** hasta ejecutar las pruebas reales y el ensayo de importación en un entorno autorizado. Sin inventario real, IDs de empresa confirmados y acceso a ese entorno, el resultado es «pendiente de validación externa».

## Alta de los próximos proveedores

- Crear el adaptador según `src/scraper/providers/contracts.ts`, implementando su descubrimiento/listado, detalle y paginación.
- Registrar el identificador nuevo en `src/scraper/providers/index.ts`. No copiar el motor común ni mezclar reglas de proveedores distintos.
- Guardar casos representativos de listado/ficha en los tests de parsing, con referencia, precio, atributos, fotos y variantes de maquinarias repetidas.
- Ejecutar pruebas de scraping aislado con prefijo nuevo; inspeccionar datos y pasar la auditoría de catálogo completo.
- Confirmar el ID de empresa real y su inventario antes de generar un Excel de altas; incluirlo en la ejecución general solo tras aceptación.

## Limitaciones conocidas

- La normalización usa un snapshot de categorías/atributos del backend. Puede quedar obsoleto.
- La validación de integridad no confirma que las imágenes remotas respondan ni que las páginas del proveedor no hayan cambiado.
- Las máquinas existentes no se actualizan por el importador. Una segunda subida con un inventario antiguo puede duplicar productos.
- Las posibles desapariciones de catálogo no se convierten en bajas.
- Mercaeleva necesita comprobar su paginación dinámica en una ejecución completa y Gomariz puede no publicar precios.
