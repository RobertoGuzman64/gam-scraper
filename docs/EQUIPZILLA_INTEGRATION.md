# Integración con Equipzilla: límites y contratos

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Propósito de esta referencia

Este documento resume **cómo se relacionan las salidas del scraper con las entradas del backend**, sin convertir la importación en objetivo de calidad del catálogo. Los detalles del receptor proceden del código de backend consultado para documentar su contrato, **no de una comprobación de la base de datos o del servicio actualmente desplegado**. Ante cambios del backend, su responsable debe reconfirmar el contrato antes de utilizar una exportación.

```text
ProductRecord (origen, íntegro)
    ↓ preparación y revisión editorial independientes
ImportCandidate / selección publicable
    ↓ exportación auxiliar autorizada
XLSX de altas o JSON adaptado al receptor
    ↓ proceso manual externo al scraper
Backend Equipzilla
```

**No son cuerpos de importación:** `<prefijo>-catalog.json`, `<prefijo>-preparation.json`, `-summary.json`, `-changes.json`, snapshots o `selection.json`. Ninguno de estos ficheros se envía automáticamente por HTTP.

## Exportación Excel

El importador documentado del backend acepta `POST /product/import`, autenticación y una compañía autorizada, mediante `multipart/form-data` con el archivo `.xlsx` en el campo `file` y `companyID` real. La hoja se llama **`Productos`**. En el contrato analizado, el tamaño permitido es de **10 MiB** y las imágenes se expresan en columnas `URL 1` a `URL 10`.

| Columna de Excel                                         | Criterio básico del receptor documentado                            |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `Referencia *`                                           | Referencia de producto no vacía.                                    |
| `Categoría *`                                            | Nombre de categoría existente y activa.                             |
| `Título *`                                               | Texto no vacío.                                                     |
| `Condición *`                                            | `Nuevo` o `Segunda_Mano`.                                           |
| `Precio *`                                               | Número presente; el receptor rechaza valores evaluados como falsos. |
| `Descripción *`                                          | Descripción corta no vacía.                                         |
| `URL 1 *`                                                | Al menos una imagen.                                                |
| `Descripción título`, `Descripción general`, otras `URL` | Datos opcionales sujetos al contrato receptor.                      |

Las columnas de atributos se resuelven frente a la categoría de destino. Las snapshots locales `data/category/` y `data/import/` ayudan al mapper, pero **no garantizan que coincidan con la base de datos del entorno elegido**.

El exportador del scraper prepara **altas**, no actualizaciones ni bajas. Exige un inventario CSV completo de la empresa con cabeceras `companyID,reference` para evitar generar altas de referencias conocidas. El inventario es una protección local: no equivale a comprobar duplicados en vivo al importar.

## Exportación JSON de receptor

`npm run exportar` admite `--formato json` para generar el formato de `POST /product/create/many` descrito por el código de destino. Es **un contrato diferente del XLSX y del catálogo canónico**; puede tratar precios ausentes de manera diferente y mantiene requisitos de validación propios. El scraper solo escribe el archivo solicitado: **no ejecuta la petición HTTP**.

## Uso responsable

Consultar los parámetros reales mediante:

```powershell
npm run ayuda -- exportar
```

Para producir una exportación se requieren datos reales: preparación íntegra, `companyID` autorizado, inventario de la misma compañía y ruta de salida. Primero utilizar `--simular`; solo tras revisar el inventario corresponde `--confirmar-inventario`. No crear inventarios ficticios ni usar `--permitir-inventario-vacio` sin acreditar que el receptor carece realmente de referencias previas.

En una importación manual, la respuesta de éxito HTTP **no demuestra** que todas las filas se hayan creado: el contrato documentado permite errores por fila. Revisar totales y errores de la operación en destino. La activación/publicación de productos en la web también es independiente de la creación.

## Límite de responsabilidad

La extracción, normalización, selección y conservación de evidencia corresponden al scraper. Autenticación, permisos, inventario vivo, reglas comerciales, importación y publicación definitiva en el backend corresponden a los responsables del receptor. **No modificar el backend para corregir el scraper sin autorización expresa.**

Para el objetivo del proyecto consultar [Objetivos](OBJETIVOS_SCRAPER.md); para las estructuras producidas consultar [Reglas de datos](SCRAPER_DATA_RULES.md).
