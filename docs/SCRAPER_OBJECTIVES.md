# Objetivos y criterios de aceptación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Objetivo principal

Conseguir un **catálogo JSON completo, coherente, verificable y reutilizable** de maquinaria nueva y de segunda mano de GAM, Gomariz, Mercaeleva y Manain. La incorporación de un proveedor al contrato no acredita por sí sola la cobertura de su portal. La calidad se mide por la fiabilidad de la identidad, las características, el contenido y la cobertura de las fuentes, no por la facilidad de importar los productos.

Prioridades, por orden:

1. **No perder máquinas ni identidades**: distinguir unidades distintas de un mismo modelo, mantener referencias y procedencia, y detectar cambios entre capturas.
2. **No inventar datos**: conservar valores desconocidos como desconocidos; contrastar marcas, modelos, series, capacidades, medidas, estado e imágenes antes de corregirlos.
3. **Mantener la trazabilidad**: conservar originales, hashes, diagnósticos, evidencias y decisiones que justifiquen cada cambio editorial.
4. **Entregar salidas fiables**: catálogos íntegros y, cuando estén acreditadas las decisiones, una selección editorial separada de publicables.
5. **Facilitar el mantenimiento**: ejecución reproducible, responsabilidades separadas, pruebas útiles, comandos claros y documentación mínima.

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
2. **Distinguir petición informativa de ejecución autorizada.** Si pide una explicación, responder sin editar; si pide un plan, estructurarlo sin aplicarlo; si ha aprobado una intervención productiva, **programar dentro de ese alcance sin renegociar cada comprobación**. Respetar el protocolo de fases y aprobaciones ya vigente. La documentación no autoriza operaciones fuera del encargo.
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


## Tres conceptos diferentes

- **Catálogo canónico (`ProductRecord`)**: todas las máquinas detectadas, sin filtrar por condiciones comerciales o requisitos del backend.
- **Preparación (`ready` / `review`)**: diagnóstico técnico local del origen y sus evidencias. Las preparaciones actuales no dependen de la asignación de categorías comerciales ni de atributos del backend; sus estados tampoco sustituyen una revisión externa de cobertura.
- **Selección editorial**: fichas autorizadas para entrega y exclusiones justificadas, sin borrar las fichas excluidas del catálogo original ni modificar su estado para mejorar un contador.

El objetivo de calidad es resolver todas las incidencias acreditables. Una contradicción irresuelta puede mantenerse como exclusión editorial justificada; nunca se fabrica una solución para conseguir `0 review`. **La exclusión no transforma una ficha `review` en `ready` ni permite presentar el catálogo completo como íntegramente `ready`.**

## Dirección permanente del trabajo de calidad

**El objetivo operativo es obtener el catálogo completo de cada proveedor con `0 review` reales bajo la validación técnica oficial vigente.** Mientras existan reviews, el catálogo no está cerrado como *catálogo completamente ready*, aunque la extracción haya finalizado, todas las referencias estén informadas o la mayoría de fichas supere la preparación. La acreditación y entrega editorial siguen siendo contratos distintos, con sus propias aprobaciones.

**Ante cualquier review, el trabajo prioritario del desarrollador/asistente es corregir el código productivo que la causa cuando la solución pueda generalizarse con evidencia.** Investigar fichas, recopilar logs, agrupar motivos, consultar diferencias y ejecutar auditores son medios internos de ingeniería, **no entregables ni sustitutos de una corrección**. Debe reutilizar o mejorar los módulos existentes —extractores, parsers, asociación de especificaciones, normalizadores, reglas de calidad e identidad— en vez de delegar en el propietario la investigación ficha por ficha.

- Primero buscar el patrón y el punto del motor que origina la review; corregir allí la causa reutilizable, no en JSON derivados ni mediante listas de excepciones por ID.
- Usar las fichas reales como evidencia y contraejemplos para proteger la semántica; añadir pruebas de regresión según riesgo y ejecutar la validación sobre **el catálogo completo**, no solo sobre las muestras que pasan.
- Repetir el ciclo **corrección productiva → pruebas → preparación/validación integral → revisión de reviews restantes** hasta alcanzar `0 review` verificadas, sin aumentar las incidencias existentes ni introducir regresiones.
- No hacer pasar un dato ambiguo por válido: si la fuente no permite una solución fiable, demostrar el bloqueo con evidencia y proponer el tratamiento editorial explícito. Este supuesto excepcional **no equivale a declarar `0 review`**.
- La responsabilidad del asistente es realizar el análisis necesario para programar y presentar **cambios de código efectivos y su evidencia**. No terminar una intervención de calidad entregando únicamente un inventario de problemas, una orden de terminal o una propuesta de nuevas auditorías.

La mejora es de **calidad de datos publicados y reglas que los interpretan**, no de cobertura arbitraria: la ausencia de un atributo no publicado sigue siendo opcional y no se generan valores por analogía. Las reglas y las aprobaciones existentes siguen siendo obligatorias; resolver reviews no autoriza a desactivarlas.

## Qué se considera terminado

- Las referencias y URLs han sido deduplicadas sin fusionar unidades distintas.
- La cobertura se ha contrastado con el portal; las ausencias y diferencias relevantes están revisadas.
- No hay contradicciones técnicas conocidas dentro de las fichas seleccionadas como publicables.
- Las decisiones de exclusión, aprobación y corrección tienen evidencias y no alteran los originales.
- Los artefactos publicados son coherentes con sus manifests y contratos.
- Si se declara un proveedor **completamente `ready`**, la validación técnica oficial del **universo completo** acredita `0 review` y conserva todas las fichas; una selección con exclusiones no satisface esa afirmación.
- Los cambios en el software conservan la compatibilidad pública o identifican explícitamente la ruptura.

La ausencia de precio, año u otro dato que el portal no publique **no autoriza** a inventarlo. Un estado técnico `complete` o una ejecución de pruebas correcta **no demuestran por sí mismos** que exista cobertura externa completa.

## Fuera del alcance principal

- Importar automáticamente al backend, modificar endpoints, sincronizar precios o dar de baja productos en la base de datos.
- Asignar `categorySellID`, IDs de atributos comerciales o mantener la taxonomía del backend dentro del flujo canónico.
- Usar Excel, `create/many` o cualquier importador heredado como criterio de aceptación del catálogo JSON.
- Ejecutar scraping programado de proveedores no acreditados sin supervisión.
- Modificar documentación sin la autorización explícita indicada por `AI GUARD`.

Guías de implementación: [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md) y [Validación](VALIDATION.md).
