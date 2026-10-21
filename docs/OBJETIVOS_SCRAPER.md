# Objetivos funcionales y criterios de aceptación — EQUIPZILLA Scraper

**Decisión de producto (21/10/2026):** EQUIPZILLA necesita **maquinaria nueva y de segunda mano**. Ninguno de los dos estados debe quedar excluido por política del scraper. El destino estudiado es el catálogo de **productos de venta** de Equipzilla; este documento no convierte el scraper en un sistema de alquileres ni autoriza importaciones automáticas. **No se presupone que Excel sea el único formato final posible:** el backend tiene también creación múltiple mediante JSON.

**Fuentes contrastadas:** `Marketplace-Back-develop.zip` aportado el 21/10/2026 (`src/routes/product.routes.ts`, `src/controller/product.controller.ts`, `src/utils/ProductImportParser.ts`, `src/validator/product.validator.ts`, `src/service/product.service.ts`, `prisma/schema.prisma`); código de `gam-scraper-develop.zip` de este hilo; `ez-resultados-20261021-221835.zip` y validaciones de 21/10/2026. Esta revisión es de código y artefactos: **no valida la BD desplegada ni supone una importación real**. El ZIP de código del scraper es anterior a la integración local de la fase 1 de `validate`; se documenta el contrato existente sin modificar el código.

## 1. Misión y resultado que perseguimos

El scraper debe obtener de **GAM, Gomariz y Mercaeleva** un catálogo **amplio, fiel al origen, actualizado, consistente, identificable y útil para Equipzilla**, tanto de maquinaria `Nuevo` como `Segunda_Mano`. El objetivo incluye:

1. **Cobertura:** recorrer los catálogos configurados, incluidas sus páginas y categorías nuevas/usadas, y detectar pérdidas, recortes, páginas repetidas o fichas fallidas; conservar todas las unidades legítimas, incluso si no pueden importarse hoy.
2. **Datos reales:** capturar referencia, URL, marca/modelo, título, estado de uso, precio publicado, descripciones, imágenes y especificaciones técnicas **cuando el proveedor los publica**; no inferir precios, estados, medidas ni descripciones por conveniencia del importador.
3. **Normalización sin adulterar:** unificar formatos, unidades y equivalencias solo con reglas demostrables; no confundir altura de trabajo/elevación/plataforma ni modelos iguales con unidades idénticas.
4. **Encaje con Equipzilla:** mapear **ambas condiciones** y sus categorías/atributos de venta válidos; construir candidatos de importación con motivos precisos para los incompletos. La falta de un requisito del Excel **no equivale a fracaso de extracción** y no prejuzga si otra vía del backend aceptaría la ficha.
5. **Trazabilidad y continuidad:** identificar productos por proveedor/referencia, conservar fuente, históricos, diferencias, errores, avisos y evidencias, sin convertir supuestas bajas en borrados.
6. **Entrega segura:** preparar salidas fieles en CSV/JSON y una vía de alta **expresamente elegida y autorizada** contra el backend. Hoy el scraper genera Excel `.xlsx` con inventario previo; el backend también ofrece creación múltiple mediante JSON, que requiere evaluación e implementación separadas. La extracción no debe crear, actualizar, activar ni eliminar productos en producción.

**Resultado esperado:** catálogo fiel **para todos los productos encontrados** + diagnóstico accionable por referencia + subconjunto de altas técnicamente elegibles y aprobables. **No** se mide el éxito únicamente por `ready` ni se promete el 100 % de fichas importables si los proveedores omiten datos que exige el backend.

## 2. Contratos receptores confirmados en el backend

### 2.1 Vía Excel implementada en el scraper

La ruta `POST /product/import` recibe `multipart/form-data`, `file` `.xlsx` (máx. 10 MiB), `companyID` del destino y hoja **`Productos`**. La petición requiere token/autorización de compañía. Son requisitos **efectivos de esa vía**, no de todos los modelos Prisma:

| Campo Excel                                 | Exigencia actual del importador                                                                                                          |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Referencia *`, `Categoría *`, `Título *`   | No vacíos. La categoría se resuelve por **nombre exacto** a una `CategorySell` **activa** en la BD.                                      |
| `Condición *`                               | **`Nuevo` o `Segunda_Mano`**. Ambas aceptadas; `Segunda mano` no es el literal del enum.                                                 |
| `Precio *`                                  | Valor numérico, no vacío ni cero (`!row.price` en el validador). No asumir aceptación de precios no publicados ni usar un cero ficticio. |
| `Descripción *`                             | **Descripción corta obligatoria** no vacía.                                                                                              |
| `Descripción título`, `Descripción general` | Opcionales; si la general falta, `create` puede sustituirla por la corta. El backend **no exige dos descripciones distintas**.           |
| `URL 1 *` … `URL 10`                        | Al menos una URL de imagen no vacía; máximo diez por importación Excel.                                                                  |
| Columnas de atributos                       | Nombre exacto y, cuando aplica, unidad (`Nombre (unidad)`); los atributos **activos y obligatorios** de la categoría deben tener valor.  |

En esta ruta se generan **altas**, no *upserts* ni bajas. El backend puede responder **201 con fallos por fila** (`totalProcessed`, `totalCreated`, `totalFailed`, `errors`); `Product.active` parte de `false`. La comparación `POST /product/compare` **no es** el importador. `logoID: 18` queda fijado por el parser de importación y no identifica automáticamente al proveedor. Los JSON `-preparation.json` o `-changes.json` **no son entradas HTTP** para esta ruta. Para el contrato detallado, consultar [EQUIPZILLA_INTEGRATION.md](EQUIPZILLA_INTEGRATION.md).

### 2.2 Vía JSON existente en backend, todavía NO integrada

`POST /product/create/many` (`src/routes/product.routes.ts`, `src/controller/product.controller.ts`, `src/validator/product.validator.ts`) recibe cuerpo JSON con un array **`products`**, exige token y comprueba autorización de `companyID` **por cada producto**. Cada elemento utiliza el contrato de creación: `title`, `categorySellID`, `condition`, `companyID`, `description` corta, `reference`, `images`, `attributes: [{attributeID,value}]` y otros campos como `image`, `description_general`, `description_title`, `logoID`, `spec` y **`price?` opcional**. La creación exige atributos obligatorios según la categoría vinculada y al menos una imagen. La categoría se pasa por **ID** real; no por nombre Excel. `spec` puede llegar a la persistencia por esta vía.

**Diferencia material:** el validador de `create` **no exige `price`**, mientras `parseImportRow` del Excel sí lo exige. Es una **posibilidad técnica** para estudiar productos sin precio publicado, **no** una autorización automática para darlos de alta ni evidencia de que el frontend/negocio admita mostrarlos como se desea. Tampoco hay deduplicación de referencias preexistentes ni *upsert* en este camino; devuelve resultados `total/created/failed/products/errors`, con éxitos parciales, y puede disparar procesos de IA. El scraper **no produce hoy ese cuerpo ni llama al endpoint**. No enviar `-preparation.json` directamente: sus objetos y tipos no son el contrato de `create/many`.

**Decisión pendiente para el propietario/backend:** determinar qué vía usar para altas reales, si aceptar productos sin precio en negocio/frontend y cuál es el contrato de actualización/sincronización futuro. Hasta esa decisión, conservar los precios ausentes sin inventarlos y **no cambiar los requisitos del Excel para simular el de JSON**.

El backend puede admitir `Nuevo` sin que ello confirme que todas las categorías, atributos y datos estén habilitados en **la BD real de destino**: su comprobación queda pendiente antes del piloto.

## 3. Situación del scraper frente a los objetivos

| Área                   | Estado en esta versión                                                                                                                           | Límites aún por comprobar                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Obtención              | Los adaptadores GAM, Gomariz y Mercaeleva conservan la extracción de nuevas y usadas.                                                            | Comprobar cobertura real y paginación de cada proveedor.                 |
| Condición              | `catalog/import/preparation/condition.ts` y `contracts.ts` admiten `Nuevo`, `Segunda_Mano` o `null` con revisión de condiciones contradictorias. | Contrastar evidencias reales y falsos positivos en los portales.         |
| Categorías             | `catalog/import/mapping/category-mapping.ts` contempla ambas ramas y exige correspondencia inequívoca.                                           | Validar categorías activas y equivalencias contra la BD del destino.     |
| Atributos              | Mapeadores específicos por proveedor y catálogo local; se conservan atributos requeridos y unidades.                                             | Medir pérdidas recuperables por patrón y contrastar el catálogo vigente. |
| Descripciones          | `preparation/import-validation.ts` exige descripción corta para Excel; la general es opcional.                                                   | Detectar descripciones publicadas que no llegan al candidato.            |
| Precio                 | El Excel requiere precio finito positivo; las fichas sin precio no se eliminan del catálogo.                                                     | Valorar por separado el JSON `create/many` si se autoriza.               |
| Imágenes               | Se exige imagen válida y la planificación Excel limita a diez URLs por fila.                                                                     | Revisar imágenes publicadas que no se capturen.                          |
| Identidad e inventario | Identidad, protección frente a duplicados, comparación de snapshots e inventario por empresa.                                                    | Contrastar con inventario real antes de altas.                           |
| Publicación y `review` | CSV/JSON con diagnósticos y preflight de integridad.                                                                                             | Distinguir requisitos del Excel de pérdidas demostradas de origen.       |

Las cuatro fases funcionales de nueva/usada, mapeos, diagnósticos y exportación se reflejan en el código actual. Su presencia no acredita por sí sola resultados de scraping en vivo ni compatibilidad con la base de datos desplegada.

## 4. Línea base real y lectura correcta de `review`

Fotografía de los `*-preparation.json` vigentes en la raíz de cada proveedor del ZIP de resultados del **21/10/2026** (no usar `validacion-*`, `quirurgica-*` ni `.history` para esta base):

| Proveedor  |    Únicos | `ready` |  `review` | Nuevos bloqueados por regla local |
| ---------- | --------: | ------: | --------: | --------------------------------: |
| GAM        |     1.010 |     106 |       904 |                               731 |
| Gomariz    |       143 |       0 |       143 |                                 0 |
| Mercaeleva |       221 |       0 |       221 |                                17 |
| **Total**  | **1.374** | **106** | **1.268** |                           **748** |

Las **748** son referencias afectadas por la exclusión de condición en la **línea base histórica anterior a las correcciones**, **no 748 importaciones que ya puedan aprobarse**. En **729 de las 731 nuevas de GAM** consta además «Precio no disponible o inválido», y las 731 tienen incidencia de categoría por el mapeo solo de ocasión. Entre las 17 nuevas de Mercaeleva, **8** tienen incidencia de precio; algunas quedaron provisionalmente mapeadas a una **categoría de segunda mano**, lo cual también deberá corregirse. Estas incidencias se solapan.

Otros bloqueos relevantes: **387** fichas con descripción corta ausente y general presente (**31 GAM, 143 Gomariz, 213 Mercaeleva**); **930** incidencias de precio (incluyen nuevas); **99** alturas de trabajo GAM y **58** tipos de mástil entre proveedores. Son **requisitos incumplidos**, no pruebas de que todos esos valores estaban publicados y el scraper los perdió.

**Tres universos distintos, que deben medirse por separado:**

- **Cobertura de extracción:** máquinas únicas encontradas / fichas esperables según comprobación externa, sin distinguir `Nuevo`/`Segunda_Mano` para descartar resultados.
- **Calidad y recuperación:** referencias con campos publicados capturados, ausentes, contradictorios, mal interpretados o recuperados de forma demostrable; incidencias nuevas/resueltas/persistentes por referencia y condición.
- **Elegibilidad de importación:** separar claramente requisitos de **Excel** y de la eventual **vía JSON**; las fichas con faltantes permanecen disponibles para revisión, sin fingir que los dos receptores aplican iguales reglas. Ningún `ready` implica importar sin aprobación.

## 5. Requisitos de calidad que no se negocian

- **No inventar valores** (precios, estados, categoría, características, series, descripciones ni fotos). Usar ausencia explícita y diagnóstico cuando falte evidencia.
- **No clasificar por comodidad:** `Nuevo` exige señal suficientemente clara del origen; `Segunda_Mano` también; si hay conflicto entre pestañas, URL, estado técnico y ficha, queda para revisión. No inferir una condición solo porque sea necesario exportar.
- **No mezclar categorías nuevas y de ocasión:** comprobar rama, hoja, nombre, atributos asociados y unidades; equivalencia semántica exacta, no coincidencia aproximada.
- **No sacrificar unidades ni trazabilidad:** una misma máquina en varias categorías no debe duplicarse, y dos máquinas de igual modelo no deben fusionarse sin identidad demostrada.
- **No sacrificar controles del pipeline:** resultados parciales no publicables, snapshots preservados, detección de faltantes solo como señal, hashes y publicación atómica sin regresiones.
- **No confundir API y proceso de negocio:** `ready` ≠ aprobado; Excel generado ≠ importado; HTTP 201 ≠ todas las filas creadas; ficha importada ≠ publicada/activa.

## 6. Prioridad de trabajo desde este contrato

**Bloque 1 — Preservar las correcciones funcionales y contrastarlas con datos reales.**

1. Conservar `Nuevo` y `Segunda_Mano` como condiciones preparables **solo con evidencia del origen**, y `null` para condiciones desconocidas o contradictorias.
2. Validar ambas ramas de categorías con el catálogo vigente; nunca permitir nuevas en hojas de ocasión ni equivalencias aproximadas. Revisar específicamente las cohortes de GAM y Mercaeleva sin presuponer que todo será `ready`.
3. Conservar precio, imagen, descripción corta y atributos obligatorios como bloqueos separados para el **Excel**, aunque las fichas se hayan extraído correctamente.

**Bloque 2 — Aprovechar mejor los datos, por patrones recuperables.**

Analizar precios reales publicados que no llegan al candidato, descripción corta cuando exista evidencia auténtica, alturas, mástiles y demás atributos técnicos. Priorizar por **N fichas con evidencia**, no por N incidencias. El primer candidato ya identificado son **17 GAM** con altura de trabajo en la descripción (**12** con ese único bloqueo), sujeto a validación de contradicciones y pruebas negativas. Medir por referencia, proveedor, condición y campo antes/después.

**Bloque 3 — Elegir el contrato de alta y cerrar la entrega operativa.**

Comparar **Excel (`POST /product/import`) frente a JSON (`POST /product/create/many`)**, en particular precios ausentes, IDs de categoría, atributos, `spec`, imágenes y duplicados. Esta es una **decisión de producto/backend**, no un cambio implícito del scraper. Verificar frente a la **BD/entorno autorizado** categorías activas, atributos/requeridos, `companyID`, permisos, inventario por empresa, `logoID`, URLs y consecuencias de creación. Mantener la exportación Excel actual con `--dry-run` y todos sus bloqueos mientras no exista decisión; si se aprueba JSON, implementar mapper, preflight e inventario **separados y probados**, no reutilizar sin más `-preparation.json`. Después decidir **piloto expresamente autorizado** (sin actualizaciones ni borrados), comprobar errores por elemento y criterios de activación. La sincronización posterior de precios/stock **requiere contrato propio**.

## 7. Aceptación medible de una fase

Cada cambio funcional futuro debe acompañarse de estas comprobaciones, usando **la misma cohorte** cuando sea posible:

1. **Cobertura:** referencias únicas, fichas fallidas, paginación, altas/desapariciones, por proveedor **y condición**. Cero pérdidas inexplicadas frente a la base comparable.
2. **Exactitud:** campos recuperados con origen explícito; negativos/contradicciones protegidos; atributos añadidos, retirados o cambiados, precios, fotos, categorías y estados.
3. **Elegibilidad:** `ready`/`review` por `Nuevo`/`Segunda_Mano`/desconocido; motivos únicos y múltiples; elegibilidad por contrato diferenciada de ausencia de dato real. Comparar motivos reetiquetados frente a datos efectivamente mejorados.
4. **Integridad:** mismo contrato público salvo cambio aprobado; identidad, snapshots, cambios, hashes, publicación parcial y prevención de duplicados estables.
5. **Entrega:** `npm test` y `npm run build` al modificar código; comprobar el formato receptor **elegido** (Excel o eventual JSON), sus informes/resultados y los casos de ambas condiciones contra el backend **antes** de permitir una importación piloto. Señalar lo ejecutado y lo pendiente, sin afirmar una prueba real no hecha.

**Cierre del trabajo de scraper:** nuevos y usados **se capturan, identifican y preparan correctamente** para un contrato de alta elegido y verificado; no quedan patrones masivos donde se pierda información publicada e inequívoca; los demás bloqueos están explicados y el proceso de alta autorizado dispone de un camino comprobado. No se fija una tasa inventada de `ready` ni se pretende alterar el backend sin una decisión explícita.

## 8. Fuentes y límites de la documentación

- Backend y Excel: [EQUIPZILLA_INTEGRATION.md](EQUIPZILLA_INTEGRATION.md), y rutas fuente listadas al principio.
- Estructuras/salidas y restricciones locales: [SCRAPER_DATA_RULES.md](SCRAPER_DATA_RULES.md).
- Arquitectura y protocolo de aceptación: [ARQUITECTURA.md](ARQUITECTURA.md) y [VALIDACION.md](VALIDACION.md).
- Línea base: `ez-resultados-20261021-221835.zip`, ficheros `gam/scrape-gam-marzo-2026-preparation.json`, `gomariz/scrape-gomariz-preparation.json` y `mercaeleva/scrape-mercaeleva-preparation.json` en su raíz.

**Precedencia para futuros trabajos:** esta decisión de producto sobre **ambas condiciones** prevalece sobre referencias históricas que describan la maquinaria nueva como «fuera de alcance». El código actual sigue bloqueándola: documentar el objetivo **no es** haber implementado la solución. La integración en el repositorio local y las pruebas Windows corresponden al propietario.
