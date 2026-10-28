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

El objetivo de calidad es resolver todas las incidencias acreditables. Una contradicción irresuelta puede mantenerse como exclusión editorial justificada; nunca se fabrica una solución para conseguir `0 review`.

## Qué se considera terminado

- Las referencias y URLs han sido deduplicadas sin fusionar unidades distintas.
- La cobertura se ha contrastado con el portal; las ausencias y diferencias relevantes están revisadas.
- No hay contradicciones técnicas conocidas dentro de las fichas seleccionadas como publicables.
- Las decisiones de exclusión, aprobación y corrección tienen evidencias y no alteran los originales.
- Los artefactos publicados son coherentes con sus manifests y contratos.
- Los cambios en el software conservan la compatibilidad pública o identifican explícitamente la ruptura.

La ausencia de precio, año u otro dato que el portal no publique **no autoriza** a inventarlo. Un estado técnico `complete` o una ejecución de pruebas correcta **no demuestran por sí mismos** que exista cobertura externa completa.

## Fuera del alcance principal

- Importar automáticamente al backend, modificar endpoints, sincronizar precios o dar de baja productos en la base de datos.
- Asignar `categorySellID`, IDs de atributos comerciales o mantener la taxonomía del backend dentro del flujo canónico.
- Usar Excel, `create/many` o cualquier importador heredado como criterio de aceptación del catálogo JSON.
- Ejecutar scraping programado de proveedores no acreditados sin supervisión.
- Modificar documentación sin la autorización explícita indicada por `AI GUARD`.

Guías de implementación: [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md) y [Validación](VALIDATION.md).
