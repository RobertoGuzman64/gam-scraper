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
