# EQUIPZILLA — diseño del auditor de huecos de contenido

**Estado:** Fases 3A, 3B, 3C y primera investigación guiada (Fase 4) cerradas. 27/10/2026.

**Objeto:** consulta estadística, voluntaria y estrictamente no operativa del contenido de fichas existentes. Identificar grupos de ausencias repetidas y proporcionar registros originales para una investigación humana. **No completar campos, no diagnosticar automáticamente errores ni abrir incidencias editoriales.** La investigación y eventual mejora de formateadores requiere siempre una fase autorizada y validación independiente.

## 1. Contratos contrastados y procedencia

| Contrato/módulo vigente                                                                               | Uso previsto; no modificarlo para el auditor                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/contracts/catalog.ts` → `ProductRecord`                                                          | Originales, `providerId`, `categoryKey`, `reference`, `url`, `brand`, `model`, `shortDescription`, `longDescription` y `specs` |
| `src/catalog/canonical-catalog.ts` → `CanonicalCatalog`                                               | Inventario completo `products[]`, `productCount`, identidad y validación de originales                                         |
| `src/infrastructure/filesystem/campaign-reference.ts` → `inspectCampaignReference`                    | Única puerta de lectura de la referencia canónica íntegra; exigir `status === "valid"`                                         |
| `src/catalog/import/preparation/contracts.ts` → `ImportCatalog`, `PreparedProduct`, `ImportCandidate` | Contrato del resultado preparado: `categorySellID`, `description`, `description_general`, `attributes[]` y estados             |
| `src/catalog/import/preparation/prepare-product.ts` → `prepareProduct`                                | Producir la vista **actual** de una ficha en memoria, sin persistir ni sustituir el original                                   |
| `src/infrastructure/filesystem/import-catalog-loader.ts` → `loadImportCatalogSnapshot`                | Categorías, atributos, relaciones activas y textos de metadatos que permiten huellas reproducibles                             |
| `src/catalog/identity.ts` → `buildProductIdentity`                                                    | Identidad canónica del original; no identificar fichas solo por modelo o número de fila                                        |
| `src/catalog/import/mapping/attribute-mapping.ts` → `resolveAttribute`                                | Estados de resolución **solo si aportan contexto**, nunca para crear un segundo mapeador                                       |

El producto preparado es una **vista reconstruida con reglas vigentes al ejecutar**, no la preparación histórica de la campaña de origen. La referencia de `data/reference/` contiene originales, incluidos posibles excluidos de entrega. No equivale a los JSON finales entregados ni a una selección de publicables.

La referencia solo se puede analizar cuando `inspectCampaignReference` devuelva `valid`. Estados `absent`, `recoverable` e `invalid` detienen la consulta con un diagnóstico legible: **no importar, recuperar, reparar, actualizar ni tomar el backup por iniciativa del auditor**. El repositorio puede no contener `data/reference/` en una instalación limpia; esto no es un error de la campaña.

## 2. Selección de campos: alcance cerrado de la primera versión

| Observación         | Fuente final exacta                      | Fuente de evidencia original                                                                         | Comportamiento                                                                                                            |
| ------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Atributos técnicos  | `product.attributes[]` por `attributeID` | `ProductRecord.specs`, `brand`, `model`, `title`, descripciones y estado del resolver cuando proceda | Contar presencia únicamente para `attributeID` aplicables según `categorySellID` y relaciones activas del `ImportCatalog` |
| Descripción corta   | `product.description`                    | `shortDescription` principalmente; `longDescription` como texto **relacionado pero no equivalente**  | Ausente si `null`, cadena vacía o solo espacios                                                                           |
| Descripción general | `product.description_general`            | `longDescription` principalmente; `shortDescription` como texto **relacionado pero no equivalente**  | Ausente si `null`, cadena vacía o solo espacios                                                                           |

Se usa `PreparedProduct.product`, no un conjunto propio de normalizaciones ni los requisitos del importador. Para atributos cuenta presencia si el `attributeID` está en `attributes[]` con valor no vacío (un texto de solo espacios no cuenta; `0` y `false` sí); los atributos no aplicables a la categoría **no son huecos**. Las relaciones con `actived === false` quedan fuera. `required` en el contrato del receptor **no convierte la ausencia en error**. No inspeccionar la calidad literaria de las descripciones.

**Fuera del alcance, expresamente:** `title`, `description_title`, `reference`, `providerId`, `sourceUrl`/`url`, `serialNumber`, `externalReference` (identidad/trazabilidad); `category`, `categorySellID`, `categoryKey`, `condition` (clasificación/condición); `price` (comercial); y `year`, `location`, `country`, `horometer`, `technicalSheetUrl` (no son campos independientes de contenido en `ImportCandidate`). `brand` y `model` son contexto de agrupación, no huecos. `spec`/`specs` son **evidencias**, nunca un campo que se deba rellenar. `image`/`images[]` se reserva para una decisión posterior si aporta valor: no incorporar una auditoría de galerías o URLs en esta fase. Campos HTML originales pueden mostrarse como contexto, pero no computarse como equivalencias con descripciones finales.

No proponer nuevos campos de producto ni modificar los contratos anteriores.

## 3. Universo, agrupación y comparabilidad

1. Entrada predeterminada: los tres `CanonicalCatalog` de la referencia `valid`, **todos** sus `ProductRecord`, sin filtrarlos por `ready`/`review` ni presumir que se entregaron. Preparar cada original **una vez**, mantener la pareja identidad-origen-resultado y no mutarla.
2. Núcleo de agrupación: `providerId` + `product.categorySellID` cuando esté resuelta; el identificador y el nombre de categoría provienen del catálogo real. Las categorías no se redefinen, infieren ni corrigen.
3. Refinamientos opcionales: `brand` y `model` declarados en el registro, cuando estén presentes y produzcan grupos estadísticamente útiles. Se permite eliminar espacios alrededor para agrupar cadenas idénticas; no equiparar familias, abreviaturas ni configuraciones técnicas por heurística. Un mismo modelo no asegura equipamiento idéntico.
4. Sin categoría final: **no calcular ausencia de atributos por categoría**. Sus descripciones pueden observarse aparte por proveedor y `categoryKey` original como contexto, con etiqueta explícita `sin categoría de destino / comparabilidad no acreditada`, sin mezclar este conjunto con grupos de categorías resueltas.
5. Nunca mezclar proveedores ni dos `categorySellID` distintos. La clave de `buildProductIdentity` diferencia productos; no deduplicar dos máquinas que comparten nombre o modelo. El validador canónico ya rechaza duplicados de identidad de un proveedor.

La agrupación es **aproximación para reducir búsquedas**, no prueba de que dos máquinas sean equivalentes. Los informes deben exponer tamaño de grupo y dimensión utilizada. Umbral inicial sugerido: grupos de **8 o más** fichas; permitir ajustarlo para consulta, sin convertirlo en obligación ni excluir del inventario bruto a los grupos pequeños. No abrir un algoritmo de similitud ni un clasificador de familias.

## 4. Dos ejes distintos: patrón de cobertura y evidencia original

**Eje de cobertura (estadístico, a nivel de grupo/campo):** total aplicable, número con contenido, número sin contenido, porcentaje y referencias afectadas. Distinguir `desigual` (hay presentes y ausentes), `sistemática` (el campo falta en todo el grupo) y `completa`. Solo las dos primeras pueden destacarse como señales. Un grupo con cobertura del **0 %** puede resultar relevante si aparecen evidencias originales repetidas.

**Eje de evidencia (descriptivo, por ficha ausente):**

- `directa_del_campo`: el campo original asociado está presente, pero el final equivalente está vacío (`shortDescription` → `description`; `longDescription` → `description_general`). Es una discrepancia observable, **no una regla de recuperación aprobada**.
- `texto_relacionado`: hay texto original en el **otro** tipo de descripción, sin equivalencia garantizada. Sirve para inspeccionar, no para trasladarlo.
- `especificaciones_sin_vinculo_acreditado`: existen claves/valores en `specs` junto a un atributo ausente, pero **no está demostrada** una relación con dicho atributo. Mostrar las especificaciones, no llamarlas automáticamente recuperables.
- `sin_evidencia_observable`: no existen campos originales asociados o relacionados bajo las comprobaciones explícitas de esta versión. **No significa que se haya probado que la fuente web nunca publicó el dato**.
- `desconocida`: el contrato o el contexto no permite clasificarla con seguridad. Valor por defecto preferible a inferir.

Estos ejes no son mutuamente excluyentes: una misma ficha puede estar en un grupo de cobertura desigual y tener `texto_relacionado`. **Nunca clasificar una especificación cualquiera como evidencia semántica de un atributo concreto**, ni asumir que `not_observed` implica ausencia en origen. Si se muestran `invalid`, `rejected` o `contradiction`, son los estados de la lógica actual y no avisos creados por el auditor. No crear `Review` por ausencias.

Para atributos, la primera versión solo necesita contar presencia y presentar `specs` de los afectados. Puede incluir frecuencia de **claves literales originales** dentro del grupo para orientar la inspección; esto no habilita un sistema de alias, fuzzy matching, traducción automática ni interpretación de valores. La decisión de si hay información aprovechable sigue siendo humana.

## 5. Resultado mínimo útil, sin inventar un contrato de catálogo nuevo

**Salida estándar en terminal:** procedencia, universo, fecha de análisis, reglas **actuales**, conteos por proveedor, número sin categoría, estados `ready`/`review` **recalculados** y un TOP limitado de patrones. Cada fila del TOP identificará dimensión de grupo, campo (`attributeID` y nombre vigente o `description`/`description_general`), tamaño, presentes, ausentes, porcentaje, tipo de cobertura y casos con evidencia directa/relacionada cuando proceda. No mostrar miles de productos en pantalla.

**JSON opcional regenerable por `stdout` (sin escritura propia en referencia, campañas ni `storage/`):**

- `provenance`: `manifest.runId`, recuentos y SHA de catálogos del manifiesto, huellas de los dos ficheros de catálogo de importación obtenibles con `loadImportCatalogSnapshot`, y nota obligatoria `preparación calculada con el código actual`. No inventar `gitCommit`/versión de mapeadores si no es verificable.
- `universe`: originales por proveedor, totales, preparados `ready`/`review` recalculados, sin categoría final, y aviso de que el informe **no representa los 1.341 entregados ni la selección editorial histórica**.
- `groups`: proveedor, `categorySellID` (o grupo sin categoría marcado), categoría existente, refinamiento literal utilizado, tamaño y población de identidades. Para cada campo observado: presentes, ausentes, porcentaje, patrón y claves/identidades de afectados.
- `cases`: por identidad canónica afectada: `providerId`, `reference` (puede ser `null`), `url`, `brand`, `model`, categoría original y final, `status` actual, valor original de `shortDescription` y `longDescription`, valores finales de `description` y `description_general`, `specs` originales y `attributes[]` finales, además de la clasificación prudente de evidencia del hueco. Mostrar el **original y el preparado**, nunca solo una etiqueta de «falta».

Estos son **apartados propuestos de un informe de consulta**, no tipos ni propiedades existentes de `ProductRecord`/`ImportCandidate`. En 3B definir tipos internos mínimos, estrictos y específicos para el informe; evitar registros genéricos de plugins, reglas declarativas, motor de inferencia o una segunda normalización. Mantener orden estable por claves e identidades para que dos consultas al mismo inventario y código sean comparables. Los informes pueden contener datos del inventario y URLs: no publicarlos accidentalmente.

## 6. Prioridad de investigación y criterio de parada

No listar productos «defectuosos». Priorizar **grupos**, no expedientes. Orden sencillo y explicable:

1. Destacar grupos de al menos 8 máquinas con **varias ausencias del mismo campo y evidencia directa o texto relacionado repetidos**; incluir cobertura 0 % si cumple lo anterior.
2. Después destacar cobertura desigual con **varias** máquinas ausentes, ordenando por número absoluto de afectadas; atributos sin relación de origen demostrada siguen siendo candidatos de **inspección**, no de conversión.
3. Dejar las ausencias sistemáticas sin evidencia observable en un plano secundario; no ocupar con ellas todo el TOP.
4. Desempatar de forma estable por proveedor, categoría, tipo de campo, `attributeID` si existe y clave del grupo.

Umbrales orientativos, no reglas editoriales: mínimo inicial 8 por grupo y al menos 3 afectadas por patrón destacado; TOP inicial de 20. Son preferencias de visualización ajustables, **no métricas de calidad del producto**. Una regla nueva en un mapper solo se aborda después de inspeccionar originales, acreditar equivalencia y superar pruebas de regresión por separado. Que no aparezcan patrones prioritarios también es un éxito válido.

## 7. Implementación realizada y uso (3B/3C)

**Archivos operativos:**

- `src/tools/catalog-content-gaps.ts`: análisis estadístico puro, agrupación y priorización; no conoce rutas ni escribe datos.
- `src/cli/catalog-content-gaps.ts`: valida referencia, prepara en memoria, genera un resumen o un JSON por `stdout`.
- `scripts/tooling.mjs` y `package.json`: acceso mediante comando opcional `huecos`.
- `src/tools/tests/catalog-content-gaps.test.ts`: pruebas de invariantes sintéticas y reales.

La ejecución normal requiere las dependencias instaladas y TypeScript compilable (`npm ci`). Ejemplos, desde la raíz del repositorio:

```powershell
npm run huecos
npm run huecos -- --agrupar marca --min-grupo 8 --min-ausentes 3 --top 20
npm run huecos -- --agrupar modelo --top 10
npm run huecos -- --json > huecos-consulta.json
```

Para consultar opciones: `npm run ayuda -- huecos` o `npm run huecos -- --help`. Los argumentos `--agrupar` admiten `categoria` (predeterminado), `marca`, `modelo`. Los mínimos y el TOP aceptan enteros positivos: `--min-grupo` (8), `--min-ausentes` (3), `--top` (20). Los umbrales modifican **la selección priorizada**, no el universo ni los grupos/casos detallados del JSON. `--top` limita el TOP incluso en JSON, **no** los grupos ni los casos consultables. El agrupamiento por `modelo` conserva también la dimensión literal de marca; no interpreta familias técnicas.

La ejecución del comando pasa por el `tooling.mjs` existente, que compila TypeScript antes de lanzarlo, igual que otros comandos. Eso puede actualizar la salida local `dist/` de compilación, pero **el auditor no modifica** `data/reference/`, catálogos, `storage/`, campañas, estados, entregas o intervenciones. Redirigir `stdout` a `huecos-consulta.json` crea **solo el archivo explícitamente solicitado por el usuario** en la ruta elegida; no es persistencia propia del auditor. No guardar informes con originales en carpetas publicadas ni incluirlos en entregas.

**Lectura del informe:**

- El resumen indica `runId`, tamaño del universo original, `ready`/`review` recalculados, fichas sin categoría, proveedores y TOP de patrones. `Casos` muestra identidades, no equivalencias acreditadas.
- El JSON incluye `provenance`, `universe`, `groupBy`, `groups`, `cases` y `prioritized`. Buscar una entrada en `prioritized`, usar su `providerId`, `categorySellID`, `brand` y `model` para localizarla en `groups`, y consultar las `missingIdentities` de su observación. Esas identidades enlazan con `cases`.
- En `cases`, inspeccionar `original.shortDescription`, `original.longDescription`, `original.specs` y `prepared.description`, `prepared.description_general`, `prepared.attributes`. `gaps[].evidence` indica la clase prudente de evidencia, **no un valor a rellenar**.
- `originalSpecKeys` son claves literales que aparecen entre los ausentes, sin equivalencia demostrada con ningún atributo. Para atributos la presencia de `specs` solo acredita que existen especificaciones, no que contengan el atributo faltante.
- El TOP utiliza el número de ausencias y evidencia directa/texto relacionado para orientar la investigación. Los grupos con cobertura 0 % y evidencia repetida no se eliminan. La categoría ausente queda marcada como no comparable, sin atribuirle huecos técnicos.

La referencia de entrada contiene **todos los originales**, incluidos posibles excluidos de entrega, y la vista preparada se reconstruye con **las reglas actuales**. Las cifras no deben describirse como número de fichas entregadas o incidencias que hay que subsanar. El auditor no ejecuta inferencia semántica ni actualiza formateadores; una mejora posterior requiere investigación y pruebas independientes.

**Fallo seguro:** en una instalación sin `data/reference/`, o con referencia `invalid` o `recoverable`, el auditor termina con error y no intenta crear, reparar, sustituir ni recuperar datos. Se puede seguir utilizando cualquier otro flujo de campaña normalmente. Nunca habilitar una recuperación automática desde esta herramienta.

## 8. Verificación de Fase 3C (27/10/2026)

Validación efectuada sobre la implementación procedente de 3B con un ajuste estrictamente localizado: un atributo que existe como entrada de `attributes[]` pero cuyo valor es `""` o solo espacios ahora cuenta como **ausencia de contenido**; los valores `0` y `false` mantienen presencia. No se cambió `prepareProduct`, ningún formateador, contrato público ni comando operativo de campaña.

- **TypeScript:** comprobación estricta del analizador, su CLI, pruebas y dependencias importadas: correcta (tsconfig temporal de verificación, no se incorpora al repositorio).
- **Pruebas:** 10/10 tests del auditor y 45/45 en ejecución conjunta de auditor, preparación, atributos, conjuntos de datos y lectura/portabilidad de referencia. Se comprueba separación de proveedores/categorías, campos activos, descripciones, evidencia prudente, grupos sistemáticos, cadenas vacías, identidad, orden estable e inmutabilidad.
- **Fixtures reales:** se ejecutó el análisis con los 276 registros históricos de GAM (244), Gomariz (14) y Mercaeleva (18); se verificaron originales y resultados preparados antes/después por igualdad completa del contenido observado. Los recuentos históricos son evidencia de esta validación, **no aserciones fijas ni pronósticos de campañas futuras**.
- **Comando:** ejecución directa del CLI compilado con referencia temporal íntegra construida a partir de esos mismos originales, con 276 originales, 53 grupos y 192 fichas con alguna ausencia. El resumen y el JSON fueron válidos; todas las huellas SHA-256 de los archivos de referencia permanecieron iguales; no aparecieron carpetas de transacciones.
- **Estados de referencia:** se comprobó rechazo sin escritura ante `absent`, `recoverable` e `invalid`, además de argumentos mal formados. La referencia temporal se eliminó tras la validación. No se modificó ninguna referencia operativa real.
- **Limitación del entorno:** la compilación global no se pudo certificar porque no están instalados `cheerio` y `p-limit`; los errores afectan módulos de scraping ajenos al auditor. Por tanto **no se afirma que hayan pasado** ni `npm run build` ni la suite global `npm test`. En el entorno normal, con dependencias instaladas, se deben ejecutar `npm ci`, `npm test` y `npm run build` para acreditar la instalación completa.

No se usan resultados de la referencia vigente de la campaña de 1.347 originales, que no está disponible en esta copia del repositorio. La medición de reducción del esfuerzo exploratorio en ese universo corresponde a una ejecución futura del comando contra la referencia real.

## 9. Continuidad y siguiente fase

**Cerradas:** Fase 3A (contrato y alcance), 3B (auditor opcional) y 3C (pruebas dirigidas, uso y limitaciones explícitas). Fases 0–2 y la regla validada de batería GAM permanecen sin cambios. Los candidatos antiguos de GAM no se implementan automáticamente.

**Fase 4:** primera investigación guiada concluida sobre los fixtures disponibles; los resultados, descartes y nuevas reglas acotadas se describen a continuación. Otras tandas serán opcionales y requerirán nueva solicitud. No convertir ausencias en `Review` ni imponer una etapa de auditoría en campañas.

Los documentos maestros de continuidad y el bloque AI GUARD no se modifican en esta entrega. La única excepción autorizada es este auditor de consulta opcional; no ampara nuevos servicios, dashboards, scripts paralelos ni inferencias de valores.

## 10. Fase 4 — explotación inicial del auditor (27/10/2026)

**Universo investigado:** fixtures históricos canónicos de GAM (244), Gomariz (14) y Mercaeleva (18), no la referencia vigente ni una campaña real. Se prepararon **276 originales** con el mapper actualizado a 3C y se conservaron copias de resultados completos antes de modificar reglas. El auditor permite revisar categorías y atributos con huecos, así como casos con descripción vacía y textos originales disponibles. Se contrastaron los casos con la fuente literal; un TOP estadístico no acredita por sí solo equivalencias.

### Selección y descartes

| Patrón explorado                                                                       | Evidencia disponible                                                                         | Decisión                                                                |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| GAM carretillas eléctricas: `Altura mástil replegado`, 33 ausentes entre 40            | Muchas fuentes no publican una altura única; otras presentan configuraciones múltiples       | **No convertir** por analogía con altura general ni con otra carretilla |
| GAM carretillas eléctricas: `Batería (V / Ah)`, 21 ausentes entre 40                   | La regla inequívoca de batería de las fases 1 y 2 ya funciona; persisten ausencias legítimas | **No ampliar** formatos ni reabrir la regla validada                    |
| GAM carretillas eléctricas: `Radio de giro`, 7 ausentes entre 40                       | Valores originales dobles, sin radio único de la configuración                               | **Mantener `not_observed`**                                             |
| Gomariz: 14 descripciones cortas finales vacías distribuidas entre categorías          | Hay descripción larga original, pero no equivale automáticamente a la corta                  | **No inventar resumen** ni debilitar validaciones editoriales           |
| GAM: `Tipo motor = Eléctrico` literal, con atributo `Motorización / Energía` aplicable | Cuatro originales con la misma declaración técnica; sin motorización incompatible            | **Regla acotada aprobada**                                              |
| GAM: `Tracción 4x4 = Sí`, título `4x4` y descripción que acredita ruedas               | Tres plataformas XCMG publican explícitamente tracción por ruedas, sin orugas ni camión      | **Regla acotada aprobada**                                              |

El análisis estadístico se usa para localizar campos y subconjuntos; la decisión de mapeo exige examinar `specs`, textos del propio anuncio, tipo y opciones permitidas por el catálogo. En particular, que un producto tenga otras `specs` no acredita que contengan el atributo ausente. Los patrones Gomariz pequeños no entran en el TOP por defecto de grupos de ocho: se consultaron en el detalle, sin cambiar el umbral ni el auditor.

### Cambios de producción delimitados

- `src/catalog/import/mapping/providers/gam/attributes.ts`: agrega valor `Eléctrico` solo cuando GAM publica **literalmente** `Tipo motor = Eléctrico`, el origen corresponde al dominio y ruta esperados, el destino es `Motorización / Energía` de tipo `SELECT` con opción contractual compatible, y no hay campo directo ni declaración de motorización competidora ni indicios contradictorios en título o resumen. No se añade alias global. Las categorías elegibles siguen viniendo de las relaciones activas actuales.
- `src/catalog/import/mapping/providers/gam/elevation.ts`: `Tipo de tracción = Ruedas` solo con `Tracción 4x4 = Sí`, `4x4` en el título y mención explícita de ruedas o neumáticos en el texto original, sin señales de orugas o montaje sobre camión. Las reglas previas de orugas y sobre camión y el valor directo conservan prioridad. No se infieren ruedas por la categoría, el modelo o la estadística.
- Pruebas nuevas en los dos ficheros existentes de tests GAM para positivos, falsos indicios, contradicciones, otros proveedores, orígenes falsos y prioridad del dato directo. El auditor, su CLI, la preparación, contratos, categorías, referencia y flujos de campaña **no cambian**.

### Acreditación sobre la muestra histórica

| Control                                                            |                                                  Resultado |
| ------------------------------------------------------------------ | ---------------------------------------------------------: |
| Originales preparados y comparados íntegramente                    |                                                        276 |
| Fichas con diferencia autorizada                                   |                                               6 (solo GAM) |
| Nuevos atributos válidos                                           | **7** (`Motorización / Energía`: 4; `Tipo de tracción`: 3) |
| Referencias que ganan energía                                      |                              GAM **4802, 2155, 157, 3000** |
| Referencias que ganan ruedas                                       |                                   GAM **4750, 4802, 4751** |
| Pérdida o cambio de atributos anteriores                           |                                                      **0** |
| Cambio de estados `ready/review`, `issues`, `importIssues`         |                                                      **0** |
| Diferencias en otros campos del producto preparado                 |                                                      **0** |
| Cambios en archivos originales de fixtures (SHA-256 antes/después) |                                                      **0** |
| Pruebas dirigidas y de mapeadores vecinos                          |                                        **65/65** correctas |
| TypeScript estricto (código y pruebas implicados)                  |                                                   Correcto |

La referencia operativa vigente con 1.347 originales no estaba disponible; **no se extrapolan** los siete valores de estos fixtures a otras campañas. La compilación global y `npm test` completos no se acreditan con esta ejecución; las dependencias de scraping (`cheerio`, `p-limit`) no están instaladas en este entorno de trabajo. Las pruebas y compilación efectuadas son dirigidas al alcance de los cambios. Los tests nuevos no fijan cifras históricas, solo reglas y contraejemplos.

**Continuidad:** la consulta `npm run huecos` permanece opcional y de solo lectura. Una nueva tanda puede ejecutar el auditor contra la referencia real si está válida, seleccionar unos pocos patrones con evidencia y repetir comparaciones antes/después. Las ausencias estadísticas no son errores ni nuevas obligaciones de revisión.
