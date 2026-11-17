# Calidad del catálogo — reviews, evidencia y huecos

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** No cambiar originales, reglas de calidad, publicaciones ni estados para mejorar contadores. Las estadísticas de huecos son diagnósticos, no defectos confirmados. Una `review` sin evidencia suficiente sigue pendiente, sin bloquear artificialmente la publicación técnica ni justificar una inclusión comercial.

**Propietario:** resolver defectos reales de contenido y preparación, evaluar `ready`/`review`, ejecutar auditores de huecos y mejorar fichas por causas reutilizables. Los mecanismos del motor están en [Motor editorial](EDITORIAL_ENGINE.md), los datos en [Contratos](DATA_CONTRACTS.md) y la aceptación final en [Validación](VALIDATION.md).

## Propósito de cada frente: resultado primero, herramientas después

**Regla transversal de ingeniería:** cada problema del proyecto se aborda desde el **resultado funcional que falta**, no desde la herramienta que permite observarlo. Un comando, informe, auditoría, simulación, censo o test es una **medición o un medio**; no equivale a haber solucionado nada. Si el defecto es generalizable, se localiza su causa y se cambia el **código productivo existente**; después se comprueba el resultado completo. No se fabrican nuevos subsistemas de diagnóstico como respuesta por defecto ni se transfiere al operador una investigación interminable de fichas.

| Frente o síntoma                                                   | Responsabilidad productiva                                                                                                             | Prueba de cierre; qué no basta                                                                                                                                 |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extracción incompleta, errores HTTP/HTML o paginación              | Reparar adaptador, descubrimiento, navegación, reintentos o recuperación, con evidencia real de cobertura                              | Universo esperado contrastado, sin pérdidas ni fallos imputables al motor. `PASS` local o páginas leídas no prueba cobertura exterior.                         |
| Fichas ausentes o diferencias entre campañas                       | Determinar internamente si cambia la fuente o falla el descubrimiento; reparar código si falla; preservar la identidad de cada máquina | Diferencia explicada con evidencia y cobertura contrastada. Un `changes.json` no es solución ni autoriza bajas.                                                |
| `review`, valor no normalizable o atributo mal asociado            | Reparar parser, semántica, normalizador, contratos y calidad con reglas seguras, reutilizando módulos                                  | **0 reviews reales sobre el catálogo íntegro** para declararlo completamente `ready`; pruebas y validación integral. Una lista de motivos no cierra el frente. |
| Descripciones, imágenes o características incompletas              | Mejorar la extracción o preparación cuando el proveedor publique el dato; preservar ausencias genuinas                                 | Recuperación acreditada de lo disponible y conservación del origen. Un informe `huecos` o rellenar por analogía no vale.                                       |
| Referencias duplicadas, series, identidad o modelos discordantes   | Corregir errores del motor de identidad, deduplicación o lectura; distinguir publicaciones diferentes y conflictos genuinos            | Identidades estables, sin fusiones, pérdidas ni referencias inventadas; ambigüedad real conservada y sometida al control editorial.                            |
| Fallos de preparación, selección o acreditación                    | Corregir reglas, vínculo de procedencia o pipeline cuando sean defectuosos; mantener separados validación técnica y decisión humana    | Preparación verificable y selección acreditada conforme al contrato; ni un `ready` técnico ni una exclusión equivalen a autorización.                          |
| Campaña parcial, publicación rota o artefacto inconsistente        | Reparar continuidad operativa, persistencia atómica o recuperación sin sobrescribir datos válidos                                      | Originales, manifests, derivados y entregas verificables; última salida correcta protegida. Un reintento ciego no cierra el defecto.                           |
| Entrega comercial o discrepancia con el receptor                   | Cumplir el contrato de los JSON; corregir exportación del scraper si incumple; remitir las reglas de importación al receptor           | Salidas exactas, comprobadas y acreditadas; no asumir que el backend ya importó ni alterar el canónico para satisfacer un Excel legado.                        |
| Comandos repetitivos, tooling engorroso o diagnóstico insuficiente | Mejorar la **orquestación del flujo real** y la capacidad de reparación, reutilizando las piezas existentes                            | Menos pasos manuales sin pérdida de controles, con pruebas del recorrido completo; añadir otra consulta no es automatizar la solución.                         |
| Tests, build, rendimiento o regresiones                            | Corregir comportamiento y contratos productivos; tests nuevos solo para riesgos no cubiertos                                           | Tests y build correctos **y** efecto funcional comprobado. No basta aumentar el contador, silenciar fallos ni optimizar sin necesidad.                         |
| Limpieza, migración, portabilidad y Git                            | Corregir mecanismos de integridad, protección y mantenimiento cuando fallen; conservar consumidores y datos abiertos                   | Copia limpia reproducible, sin pérdidas ni residuo indebido, migración segura y Git comprobado; jamás reparar hashes manualmente como rutina.                  |
| Documentación y continuidad                                        | Reflejar comportamiento implementado, objetivo vigente, reglas y estado acreditado sin contradicciones                                 | Guías coherentes, límites y pendientes explícitos; documentar una solución no acredita haberla implementado.                                                   |

**Orden de decisión:** identificar el resultado pedido y el universo afectado → reproducir internamente con evidencia disponible → corregir la causa productiva que esté bajo control del software → verificar en regresiones relevantes y en el conjunto real → continuar mientras existan defectos corregibles del mismo frente → comunicar resultados, bloqueos reales y límites precisos. Solo cuando falte **una decisión que pertenezca al propietario** (aprobación editorial, autorización de operación destructiva o cambio de contrato) se traslada esa decisión; nunca se delega el diagnóstico técnico por comodidad.

La corrección debe respetar el **alcance realmente pedido**: una consulta, una planificación o una actualización documental no autoriza por sí sola a reextraer, alterar datos o modificar código. En un trabajo productivo autorizado, no detenerse en el análisis ni abrir frentes ajenos. Una imposibilidad externa demostrada no se convierte en un `PASS` ficticio: se preservan los datos y se informa del bloqueo exacto, después de agotar las vías técnicas seguras. Todos los proveedores se someten al mismo criterio, aplicándolo primero al objetivo vigente.

## Contrato anti-deriva: comportamiento obligatorio del asistente

Esta sección traduce la matriz de objetivos a **decisiones de ejecución**, también en conversaciones nuevas. El asistente conserva la responsabilidad técnica del problema que se le ha encargado; no puede convertir una avería en un servicio de enumeración de averías.

1. **Interpretar el encargo por el resultado, no por el último comando.** Si el propietario está resolviendo calidad, extracción, cobertura, importación, publicación o continuidad, una salida de `validar`, `estado`, `revisar` o `huecos` es evidencia **para actuar sobre ese objetivo**. Un «seguimos» continúa el trabajo productivo vigente: no abre automáticamente un frente distinto ni autoriza acciones destructivas.
2. **Distinguir petición informativa de ejecución autorizada.** Si pide una explicación, responder sin editar; si pide un plan, estructurarlo sin aplicarlo; si ha aprobado una intervención productiva, **programar dentro de ese alcance sin renegociar cada comprobación**. Respetar el protocolo vigente de intervención y aprobaciones. La documentación no autoriza operaciones fuera del encargo.
3. **Investigar por cuenta propia.** Leer contratos, código, tests, artefactos y casos representativos que estén disponibles; aprovechar herramientas existentes. No delegar inspección ficha a ficha, consultas reiteradas ni cadenas de comandos para conocer algo que el asistente pueda determinar con los materiales accesibles.
4. **Modificar la causa real.** Para defectos reproducibles bajo control del scraper, entregar **código productivo efectivo**, no solo informes, tests, utilidades nuevas, parches de JSON, filtros de salida o excepciones por ID. Elegir la capa que produce el dato incorrecto; reutilizar y corregir los mecanismos existentes antes de ampliar arquitectura.
5. **Comprobar el producto completo.** Acreditar el efecto sobre el universo real correspondiente (identidades, recuentos, integridad, procedencia, reviews, cobertura), además de regresiones relevantes y build. Mantener comparación homogénea de reglas; **no declarar terminado solo porque un test pase o un caso aislado se arregle**.
6. **Iterar en el mismo frente.** Si la validación descubre nuevos síntomas atribuibles al mismo motor, siguen dentro de la intervención: continuar corrigiendo y revalidando, sin pedir permiso para cada iteración autorizada ni cambiar a una campaña de auditorías. Diferenciar estos síntomas de un defecto independiente que sí exigiría un alcance distinto.
7. **No maquillar los objetivos.** Jamás bajar contadores excluyendo máquinas, silenciando validadores, perdiendo características, inventando valores, aceptando cruces semánticos o alterando aprobaciones. `0 review` significa **0 reviews reales en todo el catálogo**, y no sustituye integridad, cobertura ni aprobación editorial.
8. **Escalar solo un impedimento auténtico.** Una caída del portal, una contradicción de origen no resoluble con evidencia, un permiso operativo/destructivo o la falta de un archivo de código imprescindible pueden requerir al propietario. Primero agotar internamente las soluciones técnicas seguras; presentar la **única decisión mínima**, la evidencia y el trabajo productivo ya completado. No quedarse inmóvil ante una duda no bloqueante.
9. **Informar resultados, no tareas para el propietario.** Una entrega técnica identifica qué código cambió, qué defecto corrigió, qué se verificó, qué sigue pendiente y por qué; aporta ZIP de archivos completos conforme al protocolo. Solo pedir ejecuciones en Windows cuando sean necesarias para acreditar un resultado que no pueda comprobarse en el entorno disponible, y después de haber preparado la solución.
10. **No confundir escalones del proceso.** Extracción íntegra ≠ cobertura contrastada ≠ preparación sin reviews ≠ selección acreditada ≠ JSON entregado ≠ importación efectuada. Se declara exclusivamente el escalón **demostrado** y se sigue trabajando hacia la meta explícita.

**Antibucle:** cuando el mismo problema vuelve tras un diagnóstico, no repetir otra explicación o un comando equivalente. Reevaluar el diseño o la implementación que no lo resolvió y producir un cambio material. Si un intento fracasa, documentar de forma breve qué hipótesis se descartó, preservar el trabajo válido y continuar con otra solución segura. La ausencia de nuevas preguntas del propietario **no** es una razón para interrumpir una intervención ya autorizada; la ausencia de acceso imprescindible sí puede serlo y se debe identificar con precisión.

**Prueba rápida antes de responder o entregar:** «¿Qué resultado pidió? ¿Qué causa productiva he corregido? ¿Cómo acredité el resultado en todo el universo? ¿Qué garantía preservé? ¿Qué impide cerrarlo, si algo?» Si la respuesta solo contiene comandos, causas, listados o una propuesta de auditoría, **no es una intervención productiva terminada**.

## Orden de trabajo al continuar el catálogo

Cuando el propietario diga «lee la documentación y seguimos» sin definir otro frente, continuar la **mejora de fichas**. Leer primero las reglas de [Gobernanza](REPOSITORY_GOVERNANCE.md); después consultar los indicadores actuales mediante los comandos existentes de `revisar`, `huecos` y, cuando proceda, `auditar:comercial`. No abrir un nuevo frente de infraestructura, normalización, publicación o tooling porque aparezca una oportunidad secundaria.

**Elección de la siguiente intervención, en este orden:**

1. **Seguridad e integridad de las fichas:** regresiones demostradas, pérdida real de máquinas, conflicto de identidad, dato técnico incorrecto o publicación divergente. Una incidencia que impida evaluar una fuente debe quedar identificada como bloqueo, no convertirse en una review ficticia de otra población.
2. **Reviews reproducibles y corregibles:** agrupar por causa común y preferir la corrección de motor que resuelva más fichas con evidencia verificable. Una contradicción genuina de la fuente permanece pendiente de decisión humana.
3. **Gaps con evidencia directa de pérdida o recuperación:** fuente con dato disponible que no llega a preparación o publicación, o reconciliación defectuosa. Priorizar impacto compartido y gravedad semántica, no simplemente el número de avisos.
4. **Cobertura editorial y técnica mejorable:** títulos, descripciones, imágenes o atributos legítimamente disponibles aún no aprovechados. Las observaciones familiares sin evidencia individual son oportunidades de investigación, no defectos acreditados.

Dentro del mismo nivel, ordenar por **riesgo de dato incorrecto, número de fichas realmente afectadas, reutilización del arreglo y coste de regresión**. Los avisos controlados, históricos o pendientes por ausencia legítima no compiten como defectos nuevos. Nunca priorizar por facilidad para reducir un contador. No sumar avisos de distintos auditores como si fueran máquinas diferentes.

**Ciclo obligatorio:** fijar población, versión y huellas antes de intervenir → agrupar referencias y localizar la primera etapa defectuosa → corregir la responsabilidad productiva existente → ejecutar pruebas de caso/contraejemplo y los auditores correspondientes con la misma población → acreditar el delta de fichas y avisos, sin pérdida de datos ni nuevas reviews. Si las fuentes cambian, separar el efecto del código del cambio de inventario. No modificar los auditores, umbrales, reconocimientos ni publicaciones para obtener un resultado favorable.

**Criterio de parada:** cuando no quede un defecto corregible del frente acreditado, o falte evidencia/permiso imprescindible, comunicar la causa precisa y lo efectivamente verificado. No inventar una nueva fase ni crear scripts, documentos o informes para seguir ocupado. Los resultados no ejecutados se marcan expresamente como no verificados.

## Trabajo acotado de mejora de fichas

Cuando el propietario encargue la serie de huecos de catálogo acordada, trabajar **20 fichas por tanda**, alternando tandas de **descripciones** y de **especificaciones**. La tanda identifica el alcance de trabajo, **no** autoriza crear archivos con nombres de fases, un test por ficha, scripts auxiliares o documentación temporal. Cada ficha seleccionada exige identificación y fuente real; no se completan ausencias por analogía.

**Descripciones y títulos:** usar `src/preparation/shared/editorial/{domain,mapping,evidence}/` y, solo para interpretar el origen, `src/preparation/<proveedor>/editorial/`; contrastar las reglas con [Motor editorial](EDITORIAL_ENGINE.md). **Specs:** usar la reconciliación y recuperación bajo `src/preparation/shared/technical/` más los adaptadores técnicos de proveedor, respetando valor, unidad, variante y procedencia. **Clasificación/condición:** corresponde a `src/preparation/shared/classification/` y las adaptaciones por proveedor. Los diagnósticos en `src/catalog/diagnostics/` sirven para elegir casos y medir resultados; no sustituyen una corrección en el motor.

Por tanda, registrar en la respuesta las referencias efectivamente mejoradas, el antes/después verificable, la evidencia utilizada, las suites dirigidas, los rechazos por falta de evidencia y cualquier regresión; no añadir Markdown o scripts de seguimiento al repositorio. Una mejora de 20 fichas no equivale automáticamente a 20 reglas nuevas ni a completar las `review` del catálogo íntegro. La aprobación de cambiar contratos, publicaciones o inventarios protegidos sigue siendo humana.

## Dirección permanente del trabajo de calidad

**El objetivo del frente de calidad editorial es obtener el catálogo completo de cada proveedor con `0 review` reales bajo la validación técnica oficial vigente.** Mientras existan reviews, el catálogo no está cerrado como *catálogo completamente ready*, aunque la extracción haya finalizado, todas las referencias estén informadas o la mayoría de fichas supere la preparación. La acreditación y entrega editorial siguen siendo contratos distintos, con sus propias aprobaciones.

**Ante cualquier review, el trabajo prioritario del desarrollador/asistente es corregir el código productivo que la causa cuando la solución pueda generalizarse con evidencia.** Investigar fichas, recopilar logs, agrupar motivos, consultar diferencias y ejecutar auditores son medios internos de ingeniería, **no entregables ni sustitutos de una corrección**. Debe reutilizar o mejorar los módulos existentes —extractores, parsers, asociación de especificaciones, normalizadores, reglas de calidad e identidad— en vez de delegar en el propietario la investigación ficha por ficha.

- Primero buscar el patrón y el punto del motor que origina la review; corregir allí la causa reutilizable, no en JSON derivados ni mediante listas de excepciones por ID.
- Usar las fichas reales como evidencia y contraejemplos para proteger la semántica; añadir pruebas de regresión según riesgo y ejecutar la validación sobre **el catálogo completo**, no solo sobre las muestras que pasan.
- Repetir el ciclo **corrección productiva → pruebas → preparación/validación integral → revisión de reviews restantes** hasta alcanzar `0 review` verificadas, sin aumentar las incidencias existentes ni introducir regresiones.
- No hacer pasar un dato ambiguo por válido: si la fuente no permite una solución fiable, demostrar el bloqueo con evidencia y proponer el tratamiento editorial explícito. Este supuesto excepcional **no equivale a declarar `0 review`**.
- La responsabilidad del asistente es realizar el análisis necesario para programar y presentar **cambios de código efectivos y su evidencia**. No terminar una intervención de calidad entregando únicamente un inventario de problemas, una orden de terminal o una propuesta de nuevas auditorías.

La mejora es de **calidad de datos publicados y reglas que los interpretan**, no de cobertura arbitraria: la ausencia de un atributo no publicado sigue siendo opcional y no se generan valores por analogía. Las reglas y las aprobaciones existentes siguen siendo obligatorias; resolver reviews no autoriza a desactivarlas.

**Criterios de cierre por frente:** completar la incorporación técnica de un proveedor significa acreditar procedencia, identidades y publicación técnica verificable; **no** obliga a resolver todas sus incidencias editoriales. Alcanzar `0 review` en una población completa es una meta distinta de calidad del catálogo. Exportar productos comerciales exige además su acreditación individual, compatibilidad de contrato y vigencia de inventario. No relajar controles de integridad ni declarar completo el registro parcial de Manain. Ver [Publicaciones técnicas](PUBLICATIONS.md).

## Calidad y decisiones editoriales

`ready` y `review` son estados locales de preparación. En preparaciones nuevas, `review` señala incidencias **técnicas y de evidencia del origen**, no la falta de `categorySellID` o de atributos comerciales. Las preparaciones heredadas pueden contener diagnósticos comerciales y no se reinterpretan como si tuvieran las reglas actuales. No eliminar atributos fiables ni rellenar los ausentes por conveniencia.

La revisión de cobertura genera un expediente con **huellas de los dos catálogos**, referencias ausentes y cambios por campo. Las decisiones empiezan pendientes. Para cerrar incidencias hacen falta motivos específicos y evidencias, especialmente en ausencias, imágenes y descripciones. Una retirada exige prueba; una ausencia acreditada de listado no equivale a una baja comercial; `no_acreditado` mantiene el bloqueo. Las decisiones deben verificarse contra los mismos archivos a los que se refieren.

La selección editorial crea productos publicables y un resumen de exclusiones **sin reescribir el catálogo original**. Las exclusiones pueden ser necesarias para proteger la calidad, pero no convierten fichas dudosas en `ready`. La salida por proveedor es un conjunto de candidatos ya definidos por el proyecto, no un request HTTP de importación.

## Corrección del motor y procedencia de las reviews

Las reviews de preparación se resuelven prioritariamente mediante cambios reutilizables en **código productivo** —extractor, parser, correspondencia entre etiqueta y magnitud, normalizador, calidad e identidad—, no alterando el canónico para conseguir un contador favorable. Los comandos de diagnóstico son herramientas auxiliares del desarrollador, no una sustitución de ese trabajo ni una obligación de inspección producto por producto del propietario. El criterio para declarar el **catálogo completo `ready`** exige `0 review` verificadas sobre todos los productos originales evaluados.

Distinguir valor técnico válido y representable, valor publicado compuesto o no escalar, unidad inconsistente, campo posiblemente cruzado y contradicción de identidad. La solución debe conservar la especificación cruda y aplicar únicamente transformaciones que se puedan justificar con evidencia. Un formato no representable por el tipo actual exige revisar el contrato o la regla de calidad, no inventar un número. La ausencia de atributos no publicados no es un fallo. Una contradicción real sin evidencia sigue como `review` y requiere tratamiento editorial separado; la exclusión nunca simula un `ready`.

Cada corrección del motor exige pruebas según el riesgo, validación del catálogo completo y comprobación de que no se pierden fichas, identidades ni garantías de trazabilidad. Las decisiones manuales, los derivados y las entregas acreditadas conservan su independencia de los originales inmutables.

## Tratamiento productivo por clase de defecto

Un origen parcialmente leído exige mejorar el **descubrimiento/extractor**; un texto o especificación transformados erróneamente exige corregir la **asociación, el parser o el normalizador**; una identidad colisionada exige corregir el **modelo de identidad/deduplicación** sin fusionar productos; una preparación técnica que genera reviews repetibles exige corregir sus **reglas de calidad**; un conjunto incoherente exige reparar la **publicación y la verificación de integridad**. `huecos`, `estado`, `comparar` y los expedientes permiten observar esos defectos, **no resolverlos**. Las correcciones se prueban contra el universo real relevante y no sobrescriben originales publicados.

Para la responsabilidad de cada frente, la evidencia de aceptación y la diferencia entre bloqueo humano y defecto reparable, consultar [Objetivos](CATALOG_OPERATIONS.md).

## Elegir la reparación acreditable según la procedencia

Para errores de extracción hay que reparar el parser y **recapturar el canónico íntegro**; una muestra o URL individual no se promociona como nuevo original global. Para errores de preparación se reutilizan reconciliaciones técnicas, recuperación documental y el motor editorial **compartido**; los adaptadores de proveedor interpretan el origen sin narradores propios. Se preservan identidad, fuente, variante, orden y huella. La composición técnica está en `src/preparation/shared/technical/reconciliation/preparation-technical-stages.ts` y `shared/technical/recovery/documented-technical-recovery.ts`; la editorial en `shared/editorial/mapping/`. La clasificación común usa el registro `shared/classification/mapping/classification-provider.ts` y las adaptaciones de cada proveedor; no se crean IDs ni atributos por corregir una ficha.

Las evidencias por unidad/modelo no son intercambiables: el dato de un fabricante puede describir un **modelo** sin acreditar la configuración de la **unidad**. Las correcciones de textos por procedencia pueden apoyarse en evidencia firmada de `data/editorial/knowledge/` y en `src/preparation/shared/editorial/mapping/knowledge-editorial.ts`, pero **no** sustituyen la recaptura del original ni una aprobación editorial cuando el contrato la exige. Ver [Motor editorial](EDITORIAL_ENGINE.md).

Una regla corregida no modifica la publicación activa por sí sola. Ejecutar `catalogo:preparar`, preflight `catalogo:publicar -- --simular --detalle`, FINISH y verificaciones de estado; las exclusiones nuevas necesitan las decisiones acreditadas que correspondan. Si un paso posterior a la activación falla, continuar la recuperación idempotente sin editar `manifest.json`, selectores o huellas. La proyección y exportación comercial son un circuito posterior e independiente.

Los avisos tienen propósitos diferentes: `technicalSpecs` de huecos mide claves y reconciliaciones; la semántica técnica comprueba valores; la auditoría comercial distingue pendiente/controlada/heredada/introducida. Una señal estadística sin evidencia directa no autoriza agregar información ni silenciar el auditor. Para la matriz de reparación y ejemplos reales ver [Mejora acreditada del catálogo](CATALOG_QUALITY.md).

## Objeto y alcance

La arquitectura editorial permanente y la forma de mejorar reglas reutilizables están documentadas en [Motor editorial compartido](EDITORIAL_ENGINE.md); la cobertura de pruebas se define en [Arquitectura de tests](TESTING.md). Este manual trata la mejora acreditada por causa, no la restauración de narradores individuales históricos.

Esta guía explica **cómo mejorar una ficha desde su origen hasta la salida comercial**, utilizando los mecanismos que ya tiene EQUIPZILLA. Complementa el diagnóstico en [Auditor de huecos](CATALOG_QUALITY.md), las reglas en [Datos y publicación](DATA_CONTRACTS.md), las comprobaciones en [Validación](VALIDATION.md) y el circuito de [Publicación individual](PUBLICATIONS.md).

La mejora no es una transformación indiscriminada de JSON finales. Hay que encontrar **la primera etapa en que se pierde, altera o interpreta incorrectamente el dato**; corregir esa causa y demostrar la equivalencia de las fichas no afectadas. Son distintos una anomalía del origen, un defecto de software, una observación estadística, un reconocimiento acreditado y una intervención editorial que exige decisión humana.

La publicación técnica de GAM, Gomariz y Mercaeleva está separada de su proyección comercial. El registro de MANAIN no acredita por sí mismo una publicación individual/comercial completa. Nunca se importa a la base de datos desde este proceso.

**Separación de frentes:** un snapshot técnico independiente puede incorporarse con `review` y servir para medir mejoras posteriores, sin obligar a resolverlas en el hilo de extracción. Las correcciones editoriales y la elegibilidad comercial conservan su validación propia. No utilizar las señales orientativas de `huecos --tecnicas` como acreditaciones automáticas. Consultar [Publicaciones técnicas](PUBLICATIONS.md).

## Ruta de decisión: síntoma, mecanismo y prueba

| Síntoma o causa localizada                                                                | Primera capa y mecanismo existente                                                                                            | Evidencia y protección antes de actuar                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La web contiene listas, textos o campos que no llegan al original canónico                | Parser del proveedor en `src/scraping/providers/`; para GAM, `descriptions.ts` y `product.ts`                                 | HTML real del panel, negativos (menús, recomendados), identidad y extracción íntegra; una extracción parcial **no** sustituye el original global                 |
| El original da un modelo, año, capacidad o magnitud contradictorios                       | `src/preparation/<proveedor>/technical/reconciliation/` y evidencias específicas                                              | Contrastar URL, referencia, modelo, variante, fuente y huella; proteger unidad vecina, estado `review` y no sobrescritura                                        |
| Un dato técnico fiable está documentado para un modelo o unidad, pero no se aprovecha     | `src/preparation/<proveedor>/technical/evidence/` o `technical/models/`; recuperación en `shared/technical/recovery/`         | Fabricante y variante compatibles, distinción entre prestación del **modelo** y de la **unidad**, orden de ejecución y prueba sobre una fuente distinta          |
| Se pierde una clave o cambian las unidades entre original, preparación y publicación      | `shared/technical/reconciliation/preparation-technical-stages.ts`, mapeadores y pruebas de `specification-coverage.ts`        | Inspeccionar `technicalSpecs.cases[].stage`; `reconciliacion_acreditada` no equivale a pérdida; comparar claves y valores reales                                 |
| Título, resumen o descripción general presentan variantes ambiguas o contenido incompleto | `src/preparation/<proveedor>/editorial/`, resolutores de procedencia y finalización compartida                                | Texto exacto, identidad, fuente y precedencia; no equiparar modelos distintos ni inventar especificaciones para alargar texto                                    |
| La descripción verificada necesita una corrección por fuente/huella                       | Evidencia editorial del proveedor, como `data/editorial/knowledge/verified-units.json`                                        | Huella de origen y de preparado, URL/identidad, rechazo si cambia la fuente; la evidencia editorial no recaptura el original                                     |
| Fotografías o portada parecen corresponder a otra máquina                                 | `src/catalog/normalization/{gam,gomariz}/gallery.ts` y diagnósticos de presentación                                           | Verificar propiedad real de la imagen y variante; no eliminar galerías por coincidencia de nombre o número                                                       |
| Referencia externa visible compartida entre unidades                                      | `src/commercial/legacy-export/commercial-reference.ts`, `commercial/diagnostics/commercial-cross-coverage.ts`                 | Preservar `providerId`, `reference`, `sourceUrl` y unidades distintas; los guiones/espacios no autorizan deduplicar                                              |
| Categoría, alias de atributo o condición no se resuelven correctamente                    | `src/preparation/<proveedor>/classification/mapping/provider.ts` y `shared/classification/mapping/classification-provider.ts` | Reutilizar IDs, tipos, opciones y relaciones actuales; contrastar `not_observed`, rechazo, contradicción y evidencia insuficiente                                |
| La publicación es correcta, pero la proyección comercial cambia un dato                   | `src/commercial/projection/`, `validation/` y `export/`                                                                       | Comparar publicación vs. producto comercial por identidad, justificar exclusiones, conservar atributos/metadata y no corregir el original por un error comercial |
| Un auditor señala una discrepancia ya acreditada                                          | `src/commercial/diagnostics/audited-findings.ts` y `data/audit-finding-recognitions.json`                                     | Confirmar reconocimiento, etapa, identidad y huella **vigentes**; si caduca, investigar el cambio; no editar reconocimientos para silenciar la alerta            |
| Corrección excepcional que requiere decisión editorial humana                             | `src/catalog/interventions/records/<proveedor>/` y circuitos de acreditación existentes                                       | Usar únicamente campos admitidos y aprobación explícita; no sustituir reglas productivas repetibles por scripts por ID                                           |

Las rutas identifican **puntos de inspección**, no instrucciones de modificar todos esos archivos. El criterio es la causa demostrada y la responsabilidad del módulo.

## Tres recorridos distintos que no deben confundirse

### 1. Extracción y original canónico

Una mejora del parser se prueba primero con HTML real reducido y casos negativos. Después se coteja el resultado de `parseProductPage` con el original canónico vigente. Si el original está anticuado, solo se promueve una **captura completa** con cardinalidad, URLs, identidad, galerías, calidad y manifiesto comprobados. `extraer:proveedor` puede afectar a todo el proveedor; consultar `npm run ayuda -- extraer:proveedor` antes de ejecutarlo. `--url`, `--pages` o un subconjunto no son una publicación canónica íntegra. Nunca escribir el original a mano.

### 2. Preparación y evidencia acreditada

`src/preparation/prepare-product.ts` conserva la procedencia de la unidad y coordina las etapas técnicas, recuperación documentada y composición editorial. `reconcileInitialTechnicalEvidence`, `reconcileTechnicalSourceForRecovery`, `reconcileTechnicalBeforeEditorial` y `reconcileTechnicalAfterEditorial` están en `shared/technical/reconciliation/preparation-technical-stages.ts`; **su secuencia es observable**. `recoverDocumentedTechnicalSpecs` combina recuperadores específicos y recibe tanto el registro de unidad como las especificaciones recuperadas. Una nueva reconciliación no debe alterar de forma accidental esa precedencia.

Las evidencias técnicas/editoriales suelen estar limitadas por referencia, URL, identidad, características y/o huella según el mecanismo concreto. No existe un único requisito universal que autorice aplicar la misma regla a todas las fichas de un modelo. Es obligatorio comprobar qué guarda implementa **esa regla** y añadir el caso negativo correspondiente. Las prestaciones documentadas de modelo no acreditan automáticamente el mástil, altura, batería, horas o configuración física de cada ejemplar.

### 3. Activación, proyección y exportación

Una preparación correcta **no es una publicación**. Usar los circuitos oficiales y comprobar diferencias de identidad, especificaciones, textos, exclusiones y estado:

```powershell
npm run catalogo:preparar -- --proveedor gam
npm run catalogo:publicar -- --proveedor gam --simular --detalle
npm run catalogo:publicar -- --proveedor gam
npm run estado
npm run auditar:comercial -- --coherencia
npm run auditar:comercial -- --acreditacion
npm run auditar:comercial -- --revision
npm run exportar:comercial -- --simular
```

Sustituir `gam` por el proveedor **realmente afectado**. FINISH puede reutilizar exclusiones acreditadas idénticas; no inventa aprobaciones humanas. Si el preflight detecta casos distintos, corresponde la acreditación editorial explícita. Si se activa una publicación pero falla el archivado, auditoría o informe posterior, consultar el diario `storage/publication/individual-finish/` y **reanudar el mismo FINISH**, sin editar selectores ni volver a publicar ciegamente. El derivado comercial puede generarse y verificarse aparte; `--simular` no equivale a la exportación real ni a una integración en BD.

## Precedentes del código: aprender de las correcciones existentes

| Precedente de catálogo                              | Enseñanza reutilizable                                                                                                                                      | Rutas de referencia                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAM 1219**, PRAMAC: descripción con listas en web | Distinguir corrección del extractor, evidencia editorial por huella y recaptura del original; son resultados diferentes                                     | `src/scraping/providers/gam/descriptions.ts`, `data/editorial/knowledge/verified-units.json`, `src/preparation/shared/editorial/tests/editorial-signed-evidence-and-documented-titles.test.ts`                                                                                        |
| **GAM 6835 y 6858**, Yale ERP35VL                   | Dos unidades pueden compartir la referencia visible; la normalización de formato no permite fusionarlas                                                     | `src/commercial/diagnostics/commercial-cross-coverage.ts`, `src/commercial/legacy-export/tests/gam-commercial-reference.test.ts`                                                                                                                                                      |
| **GAM 6934 / Gomariz TE1772**                       | Las discrepancias de modelo/galería reconocidas mantienen su rastro y pasan a controladas solo con reconocimiento vigente                                   | `src/commercial/diagnostics/commercial-intervention-priorities.ts`, `src/commercial/diagnostics/tests/presentation-consistency.test.ts`                                                                                                                                               |
| **Mercaeleva M838-0666 y M969-4655**, JLG 450 AJ    | Recuperar información del modelo después de comprobar reconciliación e identidad de unidad; preservar variantes                                             | `src/preparation/mercaeleva/technical/evidence/documented-platform-technical-specs.ts`, `src/preparation/mercaeleva/technical/evidence/documented-source-recovery.ts`                                                                                                                 |
| **Mercaeleva M547-2372**, Toyota 6FBRE14            | Diferenciar capacidad/propulsión acreditables de altura de una unidad no verificada; preservar la fuente contradictoria                                     | `src/preparation/mercaeleva/technical/reconciliation/mercaeleva.ts`, `src/preparation/mercaeleva/technical/evidence/documented-toyota-forklift-specs.ts`                                                                                                                              |
| **GAM 2737 / 6688**, movilidad y vehículo clásico   | Consultar documentación del modelo y sus límites antes de recuperar prestaciones, sin asumir configuración particular                                       | `src/preparation/gam/technical/models/documented-mobility-and-access-specs.ts`, `src/preparation/shared/technical/recovery/documented-technical-recovery.ts`                                                                                                                          |
| **Hyster 6666/5258, Yale 2328, LGMG BA1465**        | Las generales breves pueden ser correctas si el original contiene descripciones contradictorias; mejorar solo con afirmaciones independientes y acreditadas | `src/preparation/gam/technical/reconciliation/gam-hyster-h45fts5.ts`, `src/preparation/gam/technical/reconciliation/gam-yale-gp80vx.ts`, `data/editorial/knowledge/verified-units.json`, `src/preparation/shared/editorial/tests/editorial-verified-unit-content-equivalence.test.ts` |

Son **ejemplos de mecanismos y límites**, no reglas para reutilizar sus datos técnicos en otras identidades. Comprobar siempre las pruebas y el original vigente antes de extenderlos.

## Diagnóstico y significado de los avisos

```powershell
npm run huecos -- --comparar --json
npm run huecos -- --comparar --specs --json
npm run huecos -- --comparar --titulos --json
npm run huecos -- --finales --json
npm run auditar:comercial -- --contenido-revision
npm run auditar:comercial -- --revision
npm run auditar:comercial -- --acreditacion
```

- `technicalSpecs.cases[].stage` separa `diferencia_origen_preparacion`, `reconciliacion_acreditada`, `pendiente_publicacion`, `perdida_tras_publicacion`, `normalizacion_ambigua` y `sin_evidencia_directa`. La última es **observación**, no una prestación debida.
- Las P0/P1/P2 editoriales son prioridades de investigación, no objetivos de longitud para rellenar texto. Una ficha mejorada puede conservar una señal orientativa.
- `--revision` prioriza casos **pendientes** y separa los **controlados**; no elimina los hallazgos subyacentes ni sustituye el informe de coherencia. Un reconocimiento caducado exige revisar su evidencia.
- `--coherencia`, `--acreditacion`, `--contenido-revision` y `--comparar --titulos` responden a preguntas diferentes. Comparar por proveedor, referencia y fuente real; no sumar colecciones solapadas como defectos independientes.

## Criterio de aceptación por intervención

1. **Línea base:** identificar proveedor, referencia, `sourceUrl`, publicación seleccionada, origen de la señal y etapa donde nace la divergencia. Conservar métricas y hashes antes del cambio.
2. **Regla adecuada:** reutilizar evidencia/reconciliación/normalización existente y mantener las barreras de identidad, variante, fuente y precedencia; no abrir una abstracción genérica por un caso aislado.
3. **Tests:** caso real, variante vecina, origen o huella cambiados, proveedor distinto y escenarios negativos. Reutilizar suites existentes; evitar volver a cargar el catálogo en múltiples tests costosos.
4. **Equivalencia:** comparar todas las preparaciones afectadas, las no afectadas representativas y el delta de publicación; registrar altas, bajas, estados `ready/review`, motivos, specs, descripciones, imágenes y categorías.
5. **Materialización:** ejecutar el preflight y FINISH si hay cambio de preparación; acreditar aprobación humana solo si procede y nunca suplantarla. Confirmar selector y publicación activos; verificar exportación real por identidad cuando afecte a salida comercial.
6. **Cierre demostrado:** auditor correspondiente sin defecto reproducible, ausencia de regresiones, `npm test`, `npm run build`, guard de rendimiento y `npm run estado` en el entorno disponible. Señalar expresamente lo no ejecutado; código corregido **no significa** dato publicado.

No modificar umbrales, silenciar avisos por ID, editar reconocimientos, originales, manifests o publicaciones a mano para conseguir contadores estéticos. Un reconocimiento vigente puede permanecer visible como controlado; una contradicción genuina del proveedor no autoriza inventar su solución.

## Auditor de huecos de contenido

El auditor sirve para localizar causas, no para alterar automáticamente originales o declaraciones acreditadas. Consultar las opciones de lectura en los apartados siguientes.

### Finalidad y límites

`npm run huecos` es el auditor de **descripciones y especificaciones técnicas** ya existente. Permite distinguir el contenido de las publicaciones acreditadas, el que producen las reglas de preparación actuales y las ausencias observables en sus fuentes. Sus señales ayudan a **elegir qué máquinas merecen una intervención productiva**, no constituyen por sí solas defectos verificados ni requisitos del backend.

El auditor es **de solo lectura** respecto a originales, preparaciones guardadas, decisiones, acreditaciones y publicaciones. No completa textos, no añade `spec`, no aprueba exclusiones y no activa una publicación. La mejora se implementa en los productores, mapeadores, normalizadores o mecanismos editoriales existentes y se acredita después mediante el flujo de preparación/publicación.

### Fuentes y modos de consulta

**Nuevo origen explícito:** `npm run huecos -- --tecnicas --detalle` consulta las publicaciones técnicas independientes vigentes (`technical/active.json`) e incluye `ready`, `review`, incidencias, análisis editorial y densidad/semántica. Es independiente de `--comparar`, que contrasta fuentes y preparaciones contra publicaciones individuales acreditadas. `--tecnicas` no se combina con `--comparar`, `--finales`, `--catalogo`, `--publicacion`, `--titulos` o `--specs`; `--json` permite obtener el universo completo de casos. Ver [Publicaciones técnicas](PUBLICATIONS.md).

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

### Prioridades de las descripciones

Las secciones `coverage`, `editorial`, `editorialPrepared`, `priorities` y `technicalDensity` de `--comparar --json` tienen responsabilidades distintas:

- `coverage`: por campo `description` y `description_general`, cuenta vacíos publicados, recuperados por preparación, pendientes y **pérdidas**; presenta proveedor, familia y referencias. La cola P0 no se recorta con `--top`.
- `editorial`: mide únicamente los textos finales publicados: coberturas, medianas, percentil 90, patrones, fichas y listado de generales más extensas.
- `editorialPrepared`: aplica esas métricas a la preparación actual, **sin publicar** sus cambios.
- `priorities`: ordena por gravedad la cola pendiente, las señales resueltas por preparación y las señales aparecidas; aporta referencia, origen, familia, palabras antes/después, mediana y tamaño de muestra. Los problemas técnicos de preparación se muestran **aparte** en `technical`.
- `technicalDensity`: analiza densidad y observaciones de specs de los **productos publicados**, no recuperaciones acreditadas ni una exigencia técnica universal. También aparece en el JSON de `--finales` y `--publicacion`. `technicalSpecs` y `technicalSemantics` aparecen al añadir `--specs` a `--comparar`; el diagnóstico `technicalSemantics` también se calcula para `--finales` y `--publicacion`. La comparación de **títulos** por separado usa `--comparar --titulos` y devuelve `titles`, sin sustituir `technicalSpecs`.

**Orden de intervención:** P0 = descripciones vacías; P1 = insuficiencias y extremos evidentes; P2 = desequilibrios respecto a familias comparables. Dentro de cada cohorte se revisa primero el caso más grave y con evidencia aprovechable. No se selecciona una máquina porque resulte sencillo añadirle texto; tampoco se exige eliminar todos los avisos para cerrar una intervención.

Los umbrales del analizador son **orientativos**: corta de 10–45 palabras y general de 60–800. En prioridades destacan generales inferiores a 20 palabras, generales de 2.000 o más y cortas de 100 o más. Las comparaciones relativas requieren al menos **5 muestras** de familia y no convierten una mediana en longitud obligatoria. El código también identifica textos repetidos, telegráficos, equivalentes al título o con reiteración interna.

Una ficha **mejorada** no equivale a una **carencia resuelta**: si una general aumenta de calidad pero sigue bajo el criterio orientativo, puede conservar su aviso. Si desaparece la señal de insuficiencia y aparece una diferencia familiar, informar ambos cambios. Una reducción numérica lograda con frases genéricas no es un éxito editorial.

### Diagnóstico diferenciado de especificaciones

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

### Ejecución

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

### Seguridad y componentes

- Coordinación CLI: `src/cli/commands/catalog/catalog-content-gaps.ts`; lectura de opciones: `src/cli/commands/catalog/catalog-content-gaps-options.ts`; presentación: `src/cli/reporting/catalog-content-gaps-output.ts`.
- Lectura de originales para comparaciones: `src/infrastructure/filesystem/catalog/original-catalog-sources.ts`.
- Auditor de originales: `src/catalog/diagnostics/content-gaps-source.ts` y contratos `content-gaps-types.ts`.
- Comparación editorial: `description-coverage.ts`, `editorial-quality.ts` y `description-priorities.ts`.
- Comparación técnica: `specification-coverage.ts`.
- Preparación recalculada: `src/preparation/prepare-product.ts`, que organiza las reglas de `src/preparation/` y la composición editorial en `src/preparation/shared/editorial/mapping/`. El auditor no duplica esas reglas.
- Publicaciones: `src/infrastructure/filesystem/catalog/accredited-publication.ts` y el selector vigente.

No alterar originales, JSON acreditados, manifiestos ni aprobaciones para disminuir los indicadores. No atribuir al backend obligaciones de `spec` sin revisar su contrato real. No duplicar motores de reglas, auditores o sistemas de versiones. Ver [Objetivos](CATALOG_OPERATIONS.md), [Arquitectura](ARCHITECTURE.md), [Reglas de datos](DATA_CONTRACTS.md) y [Validación](VALIDATION.md).

## Responsabilidad productiva ante reviews

La validación identifica fallos; **el trabajo de calidad no termina al encontrarlos**. En una campaña de mejora editorial, ante una preparación con cualquier ficha `review`, el siguiente trabajo del desarrollador es localizar y corregir la causa **en código productivo reutilizable** (extracción, parseo, asociación semántica, normalización, calidad o identidad), siempre que haya evidencia de una transformación segura. Los informes de auditoría, las consultas por ID y las comparaciones son instrumentación interna para esa tarea, no un proceso editorial que deba dirigir el propietario.

**Contrato de ejecución y cierre de una corrección:**

1. Reproducir las reviews con el catálogo canónico íntegro y reglas identificadas; comparar versiones solo cuando se ejecuten **ambas con el mismo criterio**. Nunca interpretar dos motores distintos como una regresión demostrada.
2. Agrupar los motivos internamente, buscar el módulo responsable y definir la transformación segura con contraejemplos; reutilizar primero el motor actual, evitando scripts por ficha y nuevos subsistemas innecesarios.
3. Editar **código que se ejecute en producción**, conservar los datos originales y mantener intactas las comprobaciones de integridad, identidad, cobertura y trazabilidad.
4. Ejecutar pruebas dirigidas por riesgo y build; preparar y validar el **catálogo entero** con las reglas nuevas; comprobar el delta real de reviews, la conservación de productos y las regresiones. Una prueba verde no acredita por sí sola `0 review`.
5. Si quedan reviews atribuibles al motor, continuar implementando correcciones generales. **No cerrar el trabajo con diagnósticos o comandos para que el propietario estudie fichas**. Una contradicción de origen irremediable exige evidencia y decisión editorial; ni se inventa un valor ni se silencia el motivo.

**Aceptación de calidad del catálogo completo:** `0 review` reales en la preparación y validación técnica oficial de **todos** sus productos, sin cambiar estados artificialmente, ignorar campos válidos por conveniencia, retirar máquinas de la muestra o relajar validadores. Si permanece alguna review legítima, el catálogo sigue pendiente de esa meta. Un subconjunto publicable aprobado y un catálogo completamente `ready` son afirmaciones distintas.

## Responsabilidad ante cualquier validación adversa

El sentido de una validación es **dirigir una reparación productiva**, no multiplicar informes. Ante `review`, pérdida de cobertura, incoherencia de manifiesto, regresión, identidad contradictoria o preparación no acreditable, delimitar internamente **qué contrato incumple** y corregir el componente responsable. Las herramientas de contraste deben responder a una hipótesis de ingeniería concreta; no iniciar rondas sucesivas de comandos al operador ni presentarlas como progreso terminado.

**No confundir señales:** `0 fallos` de extracción no significa cobertura web acreditada; `0 review` técnica no significa selección/editorial aprobada; `PASS` de tests no significa calidad de datos demostrada; una exclusión editorial no convierte una review en `ready`; un error real del portal no demuestra una regresión de parser. Cada afirmación de cierre debe indicar **universo evaluado, criterio vigente y resultado efectivo**.

Si una revisión sigue abierta después de una corrección, repetir el ciclo productivo con las causas restantes. Un bloqueo no reparable con la evidencia disponible debe quedar visible, delimitado y trazable, **no maquillado ni transferido como una investigación general al propietario**. Ver [matriz de objetivos por frente](CATALOG_QUALITY.md#propósito-de-cada-frente-resultado-primero-herramientas-después).
