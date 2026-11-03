# Auditor de huecos de contenido del catálogo

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Finalidad y límites

`npm run huecos` es el auditor de **descripciones y especificaciones técnicas** ya existente. Permite distinguir el contenido de las publicaciones acreditadas, el que producen las reglas de preparación actuales y las ausencias observables en sus fuentes. Sus señales ayudan a **elegir qué máquinas merecen una intervención productiva**, no constituyen por sí solas defectos verificados ni requisitos del backend.

El auditor es **de solo lectura** respecto a originales, preparaciones guardadas, decisiones, acreditaciones y publicaciones. No completa textos, no añade `spec`, no aprueba exclusiones y no activa una publicación. La mejora se implementa en los productores, mapeadores, normalizadores o mecanismos editoriales existentes y se acredita después mediante el flujo de preparación/publicación.

## Fuentes y modos de consulta

| Modo                   | Qué analiza                                                                                                                                  | Alcance / precaución                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run huecos`       | Campaña íntegra conservada o referencia histórica verificable; si faltan, comparación de publicaciones acreditadas con la preparación actual | La fuente elegida determina la población: consultar `provenance` antes de comparar cifras             |
| `--comparar`           | Publicaciones acreditadas seleccionadas frente a preparación recalculada para sus mismas identidades                                         | Muestra vacíos recuperados, pendientes, pérdidas y prioridades editoriales; **no** publica resultados |
| `--comparar --specs`   | La misma comparación, con diagnóstico separado de **claves técnicas** del origen, la preparación y el final                                  | No compara valores semánticos ni acredita por sí mismo atributos obligatorios o datos recuperados     |
| `--finales`            | Solo descripciones **publicadas** de los JSON acreditados seleccionados                                                                      | No calcula recuperaciones de la preparación; salida editorial                                         |
| `--publicacion <ruta>` | Descripciones de uno o varios `-publishable.json` acreditados indicados explícitamente                                                       | No mezclar proveedores repetidos ni confundir una publicación histórica con la vigente                |
| `--catalogo <ruta>`    | Originales canónicos completos aportados explícitamente; aplica en memoria las reglas actuales                                               | Requiere canónico verificable; admite varias rutas, no CSV parciales                                  |

La selección de `--comparar` y `--finales` usa `discoverAccreditedPublications` y el mecanismo de **publicación vigente**, no el último directorio SHA por su fecha. El versionado, la activación y la reversión se gestionan por el flujo de publicaciones, **fuera de `huecos`**. Para comparar con una versión histórica, utilizar el modo de publicación explícita o el selector correspondiente, sin modificar el índice para una simple consulta.

La comparación vincula por **identidad de producto**, no por posición en un array. GAM y Gomariz pueden tomar el original canónico existente en `catalogs/providers/<proveedor>/original/`; cuando falte el canónico independiente de Mercaeleva, la entrada se reconstruye **solo con los campos de su publicación**, etiquetada `reconstruccion_publicada`. Esto **no** equivale a recuperar evidencia desde la web ni acredita una extracción original completa. La comparación de un proveedor distinto sin canónico exige resolver esa ausencia: no genera uno ficticio.

## Prioridades de las descripciones

Las secciones `coverage`, `editorial`, `editorialPrepared` y `priorities` de `--comparar --json` tienen responsabilidades distintas:

- `coverage`: por campo `description` y `description_general`, cuenta vacíos publicados, recuperados por preparación, pendientes y **pérdidas**; presenta proveedor, familia y referencias. La cola P0 no se recorta con `--top`.
- `editorial`: mide únicamente los textos finales publicados: coberturas, medianas, percentil 90, patrones, fichas y listado de generales más extensas.
- `editorialPrepared`: aplica esas métricas a la preparación actual, **sin publicar** sus cambios.
- `priorities`: ordena por gravedad la cola pendiente, las señales resueltas por preparación y las señales aparecidas; aporta referencia, origen, familia, palabras antes/después, mediana y tamaño de muestra. Los problemas técnicos de preparación se muestran **aparte** en `technical`.

**Orden de intervención:** P0 = descripciones vacías; P1 = insuficiencias y extremos evidentes; P2 = desequilibrios respecto a familias comparables. Dentro de cada cohorte se revisa primero el caso más grave y con evidencia aprovechable. No se selecciona una máquina porque resulte sencillo añadirle texto; tampoco se exige eliminar todos los avisos para cerrar una intervención.

Los umbrales del analizador son **orientativos**: corta de 10–45 palabras y general de 60–800. En prioridades destacan generales inferiores a 20 palabras, generales de 2.000 o más y cortas de 100 o más. Las comparaciones relativas requieren al menos **5 muestras** de familia y no convierten una mediana en longitud obligatoria. El código también identifica textos repetidos, telegráficos, equivalentes al título o con reiteración interna.

Una ficha **mejorada** no equivale a una **carencia resuelta**: si una general aumenta de calidad pero sigue bajo el criterio orientativo, puede conservar su aviso. Si desaparece la señal de insuficiencia y aparece una diferencia familiar, informar ambos cambios. Una reducción numérica lograda con frases genéricas no es un éxito editorial.

## Diagnóstico diferenciado de especificaciones

`--comparar --specs` añade `technicalSpecs`, generado por `analyzeSpecificationCoverage` (`src/catalog/diagnostics/specification-coverage.ts`). Considera claves normalizadas de `ProductRecord.specs` del original, `spec` preparado y `spec` publicado. Los valores `0` y `false` cuentan como informados; una clave renombrada no es una prestación técnica nueva.

| Estado en `technicalSpecs.cases[].stage` | Lectura correcta                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pendiente_publicacion`                  | Clave presente en preparación y ausente del final seleccionado; puede existir una mejora no activada                |
| `diferencia_origen_preparacion`          | Clave presente en original canónico y ausente en preparación; **no implica pérdida sin revisar reconciliaciones**   |
| `perdida_tras_publicacion`               | Clave publicada que no aparece en la preparación recalculada; revisar antes de actualizar el final                  |
| `normalizacion_ambigua`                  | Dos entradas de la misma clave normalizada tienen representaciones diferentes; requiere contraste                   |
| `sin_evidencia_directa`                  | Otros equipos del grupo muestran la clave, pero la máquina no la publica ni prepara; **no prueba que deba tenerla** |

Los patrones familiares solo se señalan con un mínimo de **5 máquinas**, **3 observaciones** y cobertura observada de al menos **60 %**. Son criterios estadísticos del auditor, no pruebas de aplicabilidad a cada unidad. El informe reconoce la procedencia `original_canonico` o `reconstruccion_publicada`; en este segundo caso no se debe atribuir una recuperación al original independiente. La comparación actual examina **presencia de claves**, no certifica exactitud de capacidades, unidades, rendimiento o variantes; esas contradicciones necesitan comprobación de valores y fuentes mediante los mecanismos de calidad ya existentes.

Antes de incorporar una especificación, preferir datos de la **misma máquina** y su fuente original; después documentos de fabricante/manuales de **modelo y variante verificables**. Los equipos de una familia ayudan a identificar qué investigar, **nunca** autorizan copiar una capacidad, altura, energía, año, horas o número de serie a otra unidad. Si no hay prueba, conservar la ausencia como observación.

## Ejecución

Desde la raíz del repositorio:

```powershell
npm run huecos -- --comparar
npm run huecos -- --comparar --specs
npm run huecos -- --comparar --specs --json
npm run huecos -- --finales
npm run huecos -- --comparar --top 20
npm run huecos -- --catalogo catalogs/providers/gam/original/scrape-gam-marzo-2026-catalog.json --agrupar marca --top 20
npm run huecos -- --publicacion <ruta-a-publicacion-acreditada> --json
npm run huecos -- --help
```

| Opción                                                   | Restricción / efecto                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `--comparar`, `--finales`, `--catalogo`, `--publicacion` | Modos alternativos; `--catalogo` y `--publicacion` admiten repetición de su propia opción  |
| `--specs`                                                | Solo con `--comparar`; no es un auditor independiente ni una opción de `--finales`         |
| `--agrupar categoria\|marca\|modelo`                     | Agrupa el diagnóstico de originales; valor inicial `categoria`                             |
| `--min-grupo N`, `--min-ausentes N`                      | Filtros del TOP de patrones de originales; valores iniciales `8` y `3`                     |
| `--top N`                                                | Máximo de entradas visibles de los listados priorizados; valor inicial `20`                |
| `--json`                                                 | Informe estructurado completo, con procedencia y colecciones sin el recorte visual del TOP |

Los límites numéricos deben ser enteros positivos. `--top` **no** elimina las colecciones completas de casos del JSON ni recorta la cola P0 en texto. El despachador puede compilar `dist/`; una redirección de salida a archivo la realiza el operador, no el auditor, y debe quedar fuera del ZIP aplicable al repositorio.

## Método de investigación y mejora del catálogo

Este es el **procedimiento operativo oficial** para los trabajos de contenido. No sustituye el contrato de datos, el auditor, la acreditación ni el mecanismo de intervenciones. El objetivo es completar con fidelidad `spec`, `description` y `description_general` en todas las fichas que dispongan de evidencia recuperable; **una ficha cambiada no se considera automáticamente terminada**. Las carencias sin fuente suficiente quedan identificadas para investigación posterior. Las exclusiones de publicación por identidad no equivalen a una mejora editorial.

### Organización del trabajo y selección de cohortes

- **Alternar intervenciones técnicas y editoriales** cuando se trabaje en una serie de mejoras: primero `spec`, después descripciones cortas o generales, y repetir. La alternancia ordena la investigación; **no** autoriza a incorporar datos sin prueba para completar una cuota.
- **Objetivo de producción acordado: al menos 20 fichas únicas con mejoras reales por intervención**, siempre que exista una cohorte acreditable. Si la fuente no respalda veinte casos, registrar el número real y la limitación; no añadir ruido, duplicados ni texto de relleno. Una misma referencia puede seguir necesitando trabajo en ciclos posteriores y no se vuelve a contabilizar como máquina distinta del historial acumulado.
- Seleccionar según **carencia concreta**, prioridad P0/P1/P2, gravedad, aplicabilidad, evidencia disponible y familia, no porque una plantilla sea fácil de ejecutar. No interpretar el número de avisos como número de errores demostrados; investigar también contradicciones de modelos, valores y unidades que el auditor de longitudes no detecta.
- Registrar la línea de base antes de cambiar el motor: comando y modo, publicación activa/identidad de la fuente, tamaño de población, incidencias por referencia y familia, duplicados y señales ya resueltas. Las estadísticas de una publicación anterior o de una preparación diferente no son el backlog actual.
- Consultar primero los JSON acreditados y originales canónicos del repositorio. Recalcular la preparación con el **mismo código y las mismas fuentes** para medir diferencias. No reextraer por rutina ni usar las publicaciones como sustituto de originales independientes.

### Evidencia y vías permitidas

1. **Recuperación productiva reutilizable.** Comprobar la ficha concreta y su fuente: anuncio original, campos técnicos, título, descripción, identificadores, variante, unidades y contexto afirmativo. Si el problema proviene de extracción, mapeo, normalización o calidad, corregir el módulo **productivo responsable** y reutilizar contratos y garantías existentes. Preferir una regla general que corrija el patrón; no mantener tablas crecientes de referencias o huellas individuales en el preparador para disimular excepciones.
2. **Investigación externa dirigida.** Cuando el origen no alcance, contrastar páginas del fabricante, ficha técnica, manual o publicación fiable con **marca, modelo y variante** verificables. Conservar la URL, el fragmento relevante y las condiciones/unidades. Una especificación de otro equipo de la familia es una pista para buscar, **no** evidencia transferible a esta máquina. Años, horómetros, series, baterías, capacidades y prestaciones opcionales requieren certeza de la unidad o configuración correcta.
3. **Intervención individual/editorial acreditada.** Cuando el defecto es particular y no existe un patrón general real, usar los contratos de [Intervenciones manuales](CAMPAIGN_INTERVENTIONS.md) y [Composición de intervenciones](INTERVENTION_COMPOSITION.md), con original intacto, derivado, expediente y aprobación de la campaña cuando proceda. No crear overrides automáticos permanentes por producto ni transformar una decisión `review` en `ready`. Las redacciones específicas que no encajen en el mecanismo actual exigen revisar primero los contratos y acordar su integración; **no se presupone que exista un almacén universal de textos personalizados**.

Antes de aceptar un dato, descartar identidades cruzadas, modelo anunciado distinto del técnico, variantes de combustible incompatibles, afirmaciones negadas/condicionales, opciones no instaladas y medidas sin unidad inequívoca. Ante conflicto de fuentes: **investigar o mantener pendiente**, nunca escoger silenciosamente el valor más favorable. Registrar por qué se descarta una candidata; no contarla como mejora.

### Criterios editoriales y técnicos de calidad

- En `spec`, recuperar **clave y valor acreditados**, preservando unidades, precisión, `0`/`false`, claves anteriores e identidad; no duplicar un dato ya existente bajo un alias ni atribuir una prestación de familia a una unidad. Resolver distinciones como horas frente a kilometraje con evidencia y reconciliadores pertinentes, no mediante sustituciones silenciosas.
- En `description`, buscar una presentación breve pero diferenciadora; en `description_general`, información útil, natural, específica del equipo y coherente con `spec`. **Ampliar, sintetizar, reducir o reescribir** cuando mejore realmente la exactitud. Eliminar muletillas, anuncios genéricos, repeticiones, fragmentos truncados y contradicciones, **sin perder hechos acreditados**.
- No convertir una frase de especificaciones en una descripción larga sin aportar sentido, ni copiar un mismo párrafo entre modelos. Los intervalos de palabras del auditor son orientativos, **no objetivos editoriales**. La pérdida de un aviso por superar 60 palabras no demuestra calidad; su persistencia tampoco niega una mejora sustantiva.
- Una ficha **mejorada** es una referencia con al menos una corrección validada. Una ficha **terminada** requiere revisar además las demás carencias razonablemente verificables de esa misma unidad. Un aviso **resuelto** es una señal que desaparece al aplicar el mismo auditor y población; si aparecen otras señales, deben contarse separadamente. Ninguno de esos indicadores sustituye al resto.

### Comparación obligatoria antes/después

1. Preparar una línea base y una candidata **desde los mismos originales canónicos**, con las mismas referencias; comprobar que las fuentes y contratos son comparables. Identificar por proveedor y referencia todo campo que cambie.
2. Exigir una **lista exacta de fichas mejoradas** y desglosar: claves `spec` incorporadas, alias/valores transformados, descripciones cortas y generales ampliadas/reducidas/reescritas, avisos cerrados, avisos aparecidos, fichas ya terminadas y trabajo pendiente. No sumar afirmaciones como si fueran máquinas distintas ni sumar entre intervenciones como si no hubiera solapamiento.
3. Comprobar el universo íntegro: ninguna alta/baja accidental, pérdida de `spec`, cambio de estado/identidad/modelo/variante, eliminación de texto útil, duplicado o variación de otro proveedor no justificada. Distinguir explícitamente los cambios intencionados de los colaterales y las diferencias de representación de pérdidas semánticas.
4. Validar casos positivos y negativos que protejan el riesgo real (fuentes alteradas, negación, opción, modelo cruzado, duplicados, unidades) aprovechando pruebas existentes. Ejecutar compilación y regresiones pertinentes; no fijar tests por fase, referencia o cifra de cohortes sin una garantía funcional nueva. Informar cualquier bloqueo de entorno o test no ejecutado, sin denominarlo PASS.
5. Concluir solo con el **resultado medido**. Las modificaciones viven en código productivo o derivados acreditados, no en el auditor. No editar JSON finales, originales, manifiestos, aprobaciones ni SHA para que el diagnóstico parezca mejor.

### Publicación y siguiente ciclo

Las intervenciones de contenido **no publican por sí mismas**. Acumular cambios en la base correcta y, cuando el propietario abra un cierre de publicación, ejecutar preparación → revisión de `review` → decisiones y aprobación humana → simulación → entrega/verificación. El final solo se considera activo cuando el selector de publicación lo confirma. Una nueva preparación invalida la aprobación ligada a la huella anterior; no trasladar exclusiones o aprobaciones por automatismo. Ver [Acreditación](CAMPAIGN_ACCREDITATION.md) y [Campañas](CAMPAIGNS.md).

Después de publicar, volver a ejecutar `npm run huecos -- --comparar --specs` sobre los **activos reales**. Que las claves pendientes de publicar pasen a cero no significa que las demás carencias editoriales o las **ausencias técnicas observacionales** estén resueltas. Priorizar la siguiente cohorte desde la nueva línea de base y mantener separados los frentes de investigación de contenido, tooling de publicación e integración comercial.

## Seguridad y componentes

- CLI: `src/cli/commands/catalog/catalog-content-gaps.ts`.
- Auditor de originales: `src/catalog/diagnostics/content-gaps-source.ts` y contratos `content-gaps-types.ts`.
- Comparación editorial: `description-coverage.ts`, `editorial-quality.ts` y `description-priorities.ts`.
- Comparación técnica: `specification-coverage.ts`.
- Preparación: `src/catalog/preparation/prepare-product.ts`, usando las reglas productivas existentes.
- Publicaciones: `src/infrastructure/filesystem/catalog/accredited-publication.ts` y el selector vigente.

No alterar originales, JSON acreditados, manifiestos ni aprobaciones para disminuir los indicadores. No atribuir al backend obligaciones de `spec` sin revisar su contrato real. No duplicar motores de reglas, auditores o sistemas de versiones. Ver [Objetivos](SCRAPER_OBJECTIVES.md), [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md) y [Validación](VALIDATION.md).
