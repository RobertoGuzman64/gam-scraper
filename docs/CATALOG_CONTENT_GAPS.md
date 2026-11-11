# Auditor de huecos de contenido del catálogo

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** No convertir métricas exploratorias de descripciones o densidad en defectos confirmados, ni modificar datos para conseguir un informe verde. `--tecnicas` consulta un universo distinto de `--comparar --specs`.

## Finalidad y límites

`npm run huecos` es el auditor de **descripciones y especificaciones técnicas** ya existente. Permite distinguir el contenido de las publicaciones acreditadas, el que producen las reglas de preparación actuales y las ausencias observables en sus fuentes. Sus señales ayudan a **elegir qué máquinas merecen una intervención productiva**, no constituyen por sí solas defectos verificados ni requisitos del backend.

El auditor es **de solo lectura** respecto a originales, preparaciones guardadas, decisiones, acreditaciones y publicaciones. No completa textos, no añade `spec`, no aprueba exclusiones y no activa una publicación. La mejora se implementa en los productores, mapeadores, normalizadores o mecanismos editoriales existentes y se acredita después mediante el flujo de preparación/publicación.

## Fuentes y modos de consulta

**Nuevo origen explícito:** `npm run huecos -- --tecnicas --detalle` consulta las publicaciones técnicas independientes vigentes (`technical/active.json`) e incluye `ready`, `review`, incidencias, análisis editorial y densidad/semántica. Es independiente de `--comparar`, que contrasta fuentes y preparaciones contra publicaciones individuales acreditadas. `--tecnicas` no se combina con `--comparar`, `--finales`, `--catalogo`, `--publicacion`, `--titulos` o `--specs`; `--json` permite obtener el universo completo de casos. Ver [Publicaciones técnicas](TECHNICAL_PUBLICATIONS.md).

| Modo                   | Qué analiza                                                                                                                                  | Alcance / precaución                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run huecos`       | Campaña íntegra conservada o referencia histórica verificable; si faltan, comparación de publicaciones acreditadas con la preparación actual | La fuente elegida determina la población: consultar `provenance` antes de comparar cifras                       |
| `--comparar`           | Publicaciones acreditadas seleccionadas frente a preparación recalculada para sus mismas identidades                                         | Muestra vacíos recuperados, pendientes, pérdidas y prioridades editoriales; **no** publica resultados           |
| `--comparar --specs`   | Comparación de claves técnicas y semántica técnica publicada, separada del diagnóstico editorial                                             | `technicalSpecs` y `technicalSemantics` responden a criterios diferentes; ninguno inventa atributos comerciales |
| `--comparar --titulos` | Compara títulos de publicaciones acreditadas con originales y preparación recalculada; genera `titles`                                       | Requiere `--comparar`; no admite `--specs` simultáneamente                                                      |
| `--tecnicas`           | Snapshots técnicos activos, incluidas las fichas `review`, con diagnósticos, calidad editorial y densidad/semántica; no modifica su estado   | No consume `-publishable.json` ni permite las opciones de comparación de orígenes                               |
| `--finales`            | Calidad editorial, densidad y **semántica técnica** de los JSON publicados seleccionados                                                     | No calcula recuperaciones de la preparación ni comparación de claves entre etapas                               |
| `--publicacion <ruta>` | Calidad editorial y densidad técnica de uno o varios `-publishable.json` acreditados explícitos                                              | No mezclar proveedores repetidos ni confundir una publicación histórica con la vigente                          |
| `--catalogo <ruta>`    | Originales canónicos completos aportados explícitamente; aplica en memoria las reglas actuales                                               | Requiere canónico verificable; admite varias rutas, no CSV parciales                                            |

La selección de `--comparar` y `--finales` usa `discoverAccreditedPublications` y el mecanismo de **publicación vigente**, no el último directorio SHA por su fecha. El versionado, la activación y la reversión se gestionan por el flujo de publicaciones, **fuera de `huecos`**. Para comparar con una versión histórica, utilizar el modo de publicación explícita o el selector correspondiente, sin modificar el índice para una simple consulta.

La comparación vincula por **identidad de producto**, no por posición en un array. GAM y Gomariz pueden tomar el original canónico existente en `catalogs/providers/<proveedor>/original/`; cuando falte el canónico independiente de Mercaeleva, la entrada se reconstruye **solo con los campos de su publicación**, etiquetada `reconstruccion_publicada`. Esto **no** equivale a recuperar evidencia desde la web ni acredita una extracción original completa. La comparación de un proveedor distinto sin canónico exige resolver esa ausencia: no genera uno ficticio.

## Prioridades de las descripciones

Las secciones `coverage`, `editorial`, `editorialPrepared`, `priorities` y `technicalDensity` de `--comparar --json` tienen responsabilidades distintas:

- `coverage`: por campo `description` y `description_general`, cuenta vacíos publicados, recuperados por preparación, pendientes y **pérdidas**; presenta proveedor, familia y referencias. La cola P0 no se recorta con `--top`.
- `editorial`: mide únicamente los textos finales publicados: coberturas, medianas, percentil 90, patrones, fichas y listado de generales más extensas.
- `editorialPrepared`: aplica esas métricas a la preparación actual, **sin publicar** sus cambios.
- `priorities`: ordena por gravedad la cola pendiente, las señales resueltas por preparación y las señales aparecidas; aporta referencia, origen, familia, palabras antes/después, mediana y tamaño de muestra. Los problemas técnicos de preparación se muestran **aparte** en `technical`.
- `technicalDensity`: analiza densidad y observaciones de specs de los **productos publicados**, no recuperaciones acreditadas ni una exigencia técnica universal. También aparece en el JSON de `--finales` y `--publicacion`. `technicalSpecs` y `technicalSemantics` aparecen al añadir `--specs` a `--comparar`; el diagnóstico `technicalSemantics` también se calcula para `--finales` y `--publicacion`. La comparación de **títulos** por separado usa `--comparar --titulos` y devuelve `titles`, sin sustituir `technicalSpecs`.

**Orden de intervención:** P0 = descripciones vacías; P1 = insuficiencias y extremos evidentes; P2 = desequilibrios respecto a familias comparables. Dentro de cada cohorte se revisa primero el caso más grave y con evidencia aprovechable. No se selecciona una máquina porque resulte sencillo añadirle texto; tampoco se exige eliminar todos los avisos para cerrar una intervención.

Los umbrales del analizador son **orientativos**: corta de 10–45 palabras y general de 60–800. En prioridades destacan generales inferiores a 20 palabras, generales de 2.000 o más y cortas de 100 o más. Las comparaciones relativas requieren al menos **5 muestras** de familia y no convierten una mediana en longitud obligatoria. El código también identifica textos repetidos, telegráficos, equivalentes al título o con reiteración interna.

Una ficha **mejorada** no equivale a una **carencia resuelta**: si una general aumenta de calidad pero sigue bajo el criterio orientativo, puede conservar su aviso. Si desaparece la señal de insuficiencia y aparece una diferencia familiar, informar ambos cambios. Una reducción numérica lograda con frases genéricas no es un éxito editorial.

## Diagnóstico diferenciado de especificaciones

`--comparar --specs` añade `technicalSpecs`, generado por `analyzeSpecificationCoverage` (`src/catalog/diagnostics/specification-coverage.ts`). Considera claves normalizadas de `ProductRecord.specs` del original, `spec` preparado y `spec` publicado. Los valores `0` y `false` cuentan como informados; una clave renombrada no es una prestación técnica nueva.

| Estado en `technicalSpecs.cases[].stage` | Lectura correcta                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pendiente_publicacion`                  | Clave presente en preparación y ausente del final seleccionado; puede existir una mejora no activada                                   |
| `diferencia_origen_preparacion`          | Clave presente en original canónico y ausente en preparación sin reconciliación acreditada para ese campo                              |
| `reconciliacion_acreditada`              | La fuente contenía una clave no trasladada que una reconciliación verificada explica; conservar procedencia y resultado de preparación |
| `perdida_tras_publicacion`               | Clave publicada que no aparece en la preparación recalculada; revisar antes de actualizar el final                                     |
| `normalizacion_ambigua`                  | Dos entradas de la misma clave normalizada tienen representaciones diferentes; requiere contraste                                      |
| `sin_evidencia_directa`                  | Otros equipos del grupo muestran la clave, pero la máquina no la publica ni prepara; **no prueba que deba tenerla**                    |

Los patrones familiares solo se señalan con un mínimo de **5 máquinas**, **3 observaciones** y cobertura observada de al menos **60 %**. Son criterios estadísticos del auditor, no pruebas de aplicabilidad a cada unidad. El informe reconoce la procedencia `original_canonico` o `reconstruccion_publicada`; en este segundo caso no se debe atribuir una recuperación al original independiente. El informe `technicalSpecs` examina **presencia de claves** y reconocimientos de reconciliación, no certifica por sí mismo el valor de capacidades, unidades, rendimiento o variantes. El informe independiente `technicalSemantics` comprueba coherencia de valores técnicos publicados, y sus hallazgos deben contrastarse con fuente, modelo y unidad; ninguno sustituye la evidencia original.

Antes de incorporar una especificación, preferir datos de la **misma máquina** y su fuente original; después documentos de fabricante/manuales de **modelo y variante verificables**. Los equipos de una familia ayudan a identificar qué investigar, **nunca** autorizan copiar una capacidad, altura, energía, año, horas o número de serie a otra unidad. Si no hay prueba, conservar la ausencia como observación.

## Ejecución

Desde la raíz del repositorio:

```powershell
npm run huecos -- --tecnicas --detalle
npm run huecos -- --tecnicas --json
npm run huecos -- --comparar
npm run huecos -- --comparar --specs
npm run huecos -- --comparar --specs --json
npm run huecos -- --comparar --titulos --json
npm run huecos -- --finales
npm run huecos -- --comparar --top 20
npm run huecos -- --catalogo catalogs/providers/gam/original/scrape-gam-catalog.json --agrupar marca --top 20
npm run huecos -- --publicacion <ruta-a-publicacion-acreditada> --json
npm run huecos -- --help
```

| Opción                                                                 | Restricción / efecto                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `--comparar`, `--finales`, `--tecnicas`, `--catalogo`, `--publicacion` | Modos alternativos; `--catalogo` y `--publicacion` admiten repetición de su propia opción               |
| `--specs`                                                              | Solo con `--comparar`; combina diagnóstico de claves y semántica técnica                                |
| `--titulos`                                                            | Solo con `--comparar`; alternativo a `--specs`, no se mezcla con `--finales` o publicaciones explícitas |
| `--agrupar categoria\|marca\|modelo`                                   | Agrupa el diagnóstico de originales; valor inicial `categoria`                                          |
| `--min-grupo N`, `--min-ausentes N`                                    | Filtros del TOP de patrones de originales; valores iniciales `8` y `3`                                  |
| `--top N`                                                              | Máximo de entradas visibles de los listados priorizados; valor inicial `20`                             |
| `--json`                                                               | Informe estructurado completo, con procedencia y colecciones sin el recorte visual del TOP              |

Los límites numéricos deben ser enteros positivos. `--top` **no** elimina las colecciones completas de casos del JSON ni recorta la cola P0 en texto. El despachador puede compilar `dist/`; una redirección de salida a archivo la realiza el operador, no el auditor, y debe quedar fuera del ZIP aplicable al repositorio.

## Método de mejora del catálogo

El trabajo sobre descripciones y specs comparte un único ciclo técnico, **repetible por familias y proveedores**. Para la matriz completa de decisiones, evidencias, reconciliaciones, galerías, identidad y materialización, consultar el [manual de mejora acreditada](CATALOG_IMPROVEMENT.md):

1. Ejecutar el auditor sobre las publicaciones seleccionadas y la preparación actual; registrar la población, procedencia y la cola priorizada del campo correspondiente.
2. Seleccionar máquinas con carencia concreta de alto impacto, sin confundir observaciones familiares con errores técnicos acreditados.
3. Investigar la información utilizable del original, productor, preparación y fuentes fiables; documentar procedencia cuando haga falta evidencia adicional.
4. Aplicar una regla reutilizable en el productor/mapeador o una intervención editorial específica y controlada si es la opción más fiel; **no** obligar a pasar cada JSON final por una IA.
5. Comparar preparación antes/después de la población afectada; distinguir **fichas cambiadas**, **carencias efectivamente resueltas**, nuevas señales, exclusiones y contradicciones. Proteger también otras familias y proveedores.
6. Ejecutar pruebas proporcionadas al riesgo, `npm test` y `npm run build` cuando corresponda y estén disponibles. Preparar **no** significa aprobar, entregar o activar; esas acciones siguen sus controles específicos.

El método abarca también las contradicciones de títulos y la semántica técnica publicada: elegir `--comparar --titulos`, `--comparar --specs` o `--finales` según el defecto, no comparar sus contadores como si midieran lo mismo. `reconciliacion_acreditada` es una explicación de una diferencia, no un trabajo pendiente de recuperar una clave.

La mejora de descripciones busca cortas diferenciadoras y generales útiles y proporcionadas, sin relleno ni pérdida de prestaciones. La mejora de specs busca **claves y valores técnicos reales, con unidades e identidad correctas**, sin inventar atributos. Pueden alternarse ambos frentes sin duplicar el auditor ni modificar el contrato de publicación. La progresión se mide por **defectos de contenido realmente reducidos**, no por número de reglas, avisos o tests.

## Seguridad y componentes

- Coordinación CLI: `src/cli/commands/catalog/catalog-content-gaps.ts`; lectura de opciones: `src/cli/commands/catalog/catalog-content-gaps-options.ts`; presentación: `src/cli/reporting/catalog-content-gaps-output.ts`.
- Lectura de originales para comparaciones: `src/infrastructure/filesystem/catalog/original-catalog-sources.ts`.
- Auditor de originales: `src/catalog/diagnostics/content-gaps-source.ts` y contratos `content-gaps-types.ts`.
- Comparación editorial: `description-coverage.ts`, `editorial-quality.ts` y `description-priorities.ts`.
- Comparación técnica: `specification-coverage.ts`.
- Preparación recalculada: `src/preparation/prepare-product.ts`, que organiza las reglas de `src/preparation/` y la composición editorial en `src/preparation/shared/editorial/mapping/`. El auditor no duplica esas reglas.
- Publicaciones: `src/infrastructure/filesystem/catalog/accredited-publication.ts` y el selector vigente.

No alterar originales, JSON acreditados, manifiestos ni aprobaciones para disminuir los indicadores. No atribuir al backend obligaciones de `spec` sin revisar su contrato real. No duplicar motores de reglas, auditores o sistemas de versiones. Ver [Objetivos](SCRAPER_OBJECTIVES.md), [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md) y [Validación](VALIDATION.md).
