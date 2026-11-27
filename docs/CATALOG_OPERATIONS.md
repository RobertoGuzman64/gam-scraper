# Producción de catálogos — del scraping a la entrega comercial

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Un catálogo íntegramente `ready` requiere justificar la ausencia de `review`, pero `0 review` no es condición para registrar un snapshot técnico fiable. La publicación técnica, la publicación individual acreditada y la exportación comercial son salidas distintas; nunca se fuerza un estado o una aprobación.

**Uso:** cuando se pide sacar o actualizar el catálogo de un proveedor, este es el recorrido de producción. Una petición explícita para evolucionar el código conserva su propio objetivo y no activa automáticamente este circuito. Los procedimientos detallados viven en [Campañas](CAMPAIGNS.md), [Publicaciones](PUBLICATIONS.md), [Calidad](CATALOG_QUALITY.md), [Exportación comercial](COMMERCIAL_EXPORT.md) y [Validación](VALIDATION.md).

## Objetivo principal

El **motor editorial compartido vigente** se describe en [Motor editorial](EDITORIAL_ENGINE.md). La migración arquitectónica de narradores detectados está cerrada en el alcance de los guards; las mejoras posteriores de redacción son evolución funcional y no justifican reabrir la arquitectura antigua ni crear tests por ficha. La protección de esas reglas se rige por [Arquitectura de tests](TESTING.md).

Conseguir un **catálogo JSON completo, coherente, verificable y reutilizable** de maquinaria nueva y de segunda mano de GAM, Gomariz, Mercaeleva y Manain. La incorporación de un proveedor al contrato no acredita por sí sola la cobertura de su portal. La calidad se mide por la fiabilidad de la identidad, las características, el contenido y la cobertura de las fuentes, no por la facilidad de importar los productos.

Prioridades, por orden:

1. **No perder máquinas ni identidades**: distinguir unidades distintas de un mismo modelo, mantener referencias y procedencia, y detectar cambios entre capturas.
2. **No inventar datos**: conservar valores desconocidos como desconocidos; contrastar marcas, modelos, series, capacidades, medidas, estado e imágenes antes de corregirlos.
3. **Mantener la trazabilidad**: conservar originales, hashes, diagnósticos, evidencias y decisiones que justifiquen cada cambio editorial.
4. **Entregar salidas fiables**: catálogos íntegros y, cuando estén acreditadas las decisiones, una selección editorial separada de publicables.
5. **Facilitar el mantenimiento**: ejecución reproducible, responsabilidades separadas, pruebas útiles, comandos claros y documentación mínima.

## Producción de catálogos: recorrido prioritario cuando se solicita una entrega

**Activación.** Si el encargo es «sacar», «actualizar», «preparar para el backend» o «avanzar con» el catálogo de un proveedor, la prioridad es **entregar el máximo de fichas correctas, acreditadas y comercializables de ese corte**, sin convertirlo en una campaña general de evolución del repositorio. Si el propietario pide mejorar normalización, arquitectura, editorial u otra parte del código, **se atiende ese encargo**: este recorrido no lo bloquea ni decide cambiar el frente por su cuenta.

**Secuencia de producción** (respetando las rutas y decisiones propias de cada modalidad):

1. **Origen y cobertura.** Precisar proveedor y corte; comprobar extracción, originales, referencias, URLs, stock, procedencia y diferencias contra el último corte acreditado. Capturar lo necesario sin perder máquinas ni sustituir una fuente válida por una extracción parcial. Una campaña completa de cuatro proveedores usa el circuito de [Campañas](CAMPAIGNS.md); una extracción de proveedor no se presenta como campaña global.
2. **Normalización y preparación.** Verificar que no se pierden especificaciones ni se inventan unidades, atributos o identidades. Preparar el universo completo disponible, medir `ready`/`review` y comparar los motivos por referencia y fuente. GAM, Gomariz y Mercaeleva disponen del circuito [individual](PUBLICATIONS.md) desde originales canónicos completos. Manain participa en el circuito individual desde su registro parcial acreditado, sin elevarlo a origen completo; la publicación técnica sigue siendo independiente.
3. **Resolver calidad antes de publicar.** Atacar primero las `review` técnicamente resolubles, las pérdidas y las contradicciones que afectan a fichas entregables; buscar patrones comunes y corregir su propietario productivo, no cada JSON ni cada referencia individual. Repetir preparación y comparación hasta agotar los casos resolubles con evidencia. Las `review` genuinamente bloqueadas se conservan con causa y decisión pendiente: no se fuerzan a `ready` ni se retrasa indefinidamente el catálogo publicable por evidencias inexistentes.
4. **Acreditar y activar publicación.** Contrastar origen, preparación, exclusiones, inventario y cambios frente a la publicación activa. Para publicaciones individuales, ejecutar el preflight y FINISH de [Publicación individual](PUBLICATIONS.md); para campañas completas, seguir [Campañas](CAMPAIGNS.md) y su aprobación humana. Una publicación técnica con `review` **no** reemplaza la publicación individual acreditada ni da acceso a la exportación comercial. Nunca editar manualmente originales, aprobaciones, manifests o JSON finales para desbloquear el paso.
5. **Proyectar y entregar el comercial.** Auditar la coherencia, las categorías, los atributos, los metadatos, la procedencia y la vigencia de stock; simular la exportación y generar/verificar los **JSON comerciales y su manifiesto** mediante [Comercialización](COMMERCIAL_EXPORT.md). La exportación actual usa publicaciones individuales acreditadas, incluido Manain cuando su publicación vigente está acreditada: una entrega de campaña de cuatro o un snapshot técnico no son automáticamente su entrada. Los productos con conflictos comerciales pendientes no se presentan como importables.
6. **Acreditar el cierre por etapas.** Informar del mismo corte: originales y cobertura contrastada, `ready`, `review` resolubles o bloqueadas, exclusiones y publicables acreditados, publicación activa, exportación comercial verificada y pendientes exactos. Confirmar pruebas, guards e integridad según [Validación](VALIDATION.md). Un resultado preparado no acredita su publicación; un JSON comercial correcto **no** acredita su importación efectiva en el backend, cuya responsabilidad se delimita en [Integración](COMMERCIAL_EXPORT.md).

**Regla de prioridad operativa.** En una solicitud de producción, las mejoras técnicas son un medio para conseguir **fichas entregables y salidas comerciales verificadas**. No posponer la entrega por refactors u optimizaciones ajenas; tampoco cerrar el encargo solo con scraping, informes, tests verdes o una selección sin publicación. Si una aprobación humana, la fuente o el receptor impiden avanzar, entregar el último estado realmente acreditado y concretar el bloqueo sin declarar completado el escalón pendiente.

## Tres conceptos diferentes

- **Catálogo canónico (`ProductRecord`)**: todas las máquinas detectadas, sin filtrar por condiciones comerciales o requisitos del backend.
- **Preparación (`ready` / `review`)**: diagnóstico técnico local del origen y sus evidencias. Las preparaciones actuales no dependen de la asignación de categorías comerciales ni de atributos del backend; sus estados tampoco sustituyen una revisión externa de cobertura.
- **Selección editorial**: fichas autorizadas para entrega y exclusiones justificadas, sin borrar las fichas excluidas del catálogo original ni modificar su estado para mejorar un contador.

El objetivo de calidad es resolver todas las incidencias acreditables. Una contradicción irresuelta puede mantenerse como exclusión editorial justificada; nunca se fabrica una solución para conseguir `0 review`. **La exclusión no transforma una ficha `review` en `ready` ni permite presentar el catálogo completo como íntegramente `ready`.**

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

Guías de implementación: [Arquitectura](ARCHITECTURE.md), [Reglas de datos](DATA_CONTRACTS.md) y [Validación](VALIDATION.md).
