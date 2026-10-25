# Protocolo operativo de campañas completas

## AI GUARD

**Protección documental.** No modificar, eliminar ni regenerar esta guía sin autorización expresa del propietario para la intervención documental concreta. Cambios de código, auditorías o correcciones puntuales no implican autorización documental.

## Alcance obligatorio

**Campaña ordinaria nueva = todos los proveedores registrados y habilitados en el scraper en ese momento.** El comando normal es `npm run extraer:todos`, **sin** `--proveedores`. El registro actual contiene GAM, Gomariz y Mercaeleva; cuando se añada otro proveedor al registro, debe entrar también en el lote ordinario sin crear una excepción manual.

`npm run extraer -- <proveedor>` y `npm run extraer:todos -- --proveedores ...` están disponibles **solo como herramientas auxiliares** para pruebas, diagnóstico, reintentos dirigidos o mantenimiento. Una ejecución parcial no acredita una campaña completa, aunque sus archivos sean válidos. Tampoco acredita cobertura completa una extracción limitada con `--paginas`.

**No publicar una campaña parcial de forma silenciosa.** Comprobar el listado de proveedores previsto y que todos figuren completados en el informe del lote. Si falla uno, resolverlo y volver a acreditar la campaña completa, o elevar una excepción explícita al propietario; no confundir una excepción documentada con una campaña global cerrada.

## Secuencia de trabajo

| Momento                         | Comando o mecanismo                                                                                                                             | Criterio para avanzar                                                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Comprobar entorno            | `npm ci` solo si falta instalar dependencias; `npm test` y `npm run build` cuando se haya modificado código o sea necesario verificarlo         | No reinstalar dependencias ni repetir una batería completa por rutina en cada campaña; registrar fallos de ejecución reales               |
| 2. Revisar lote                 | `npm run extraer:todos -- --simular`                                                                                                            | Lista de salida igual a **todos** los proveedores registrados; sin selector de subconjunto                                                |
| 3. Ejecutar campaña             | `npm run extraer:todos`                                                                                                                         | Lote secuencial finalizado; revisar `storage/runs/<id>/run.json` y logs de cada proveedor; estado `complete`, no `partial` ni `failed`    |
| 4. Localizar originales         | `storage/scraped/<proveedor>/`                                                                                                                  | Identificar catálogo `*-catalog.json` **vigente** y sus manifest/resumen por procedencia y fecha de lote; nunca inferirlo solo del nombre |
| 5. Validar catálogos            | `npm run validar -- <proveedor> --etapa catalogo --origen <catalogo-catalog.json>`                                                              | Comprobación canónica por **cada proveedor**; códigos de validación y anomalías revisados                                                 |
| 6. Comparar si existe histórico | `npm run cobertura -- --anterior <catalogo-previo.json> --actual <catalogo-vigente.json> --simular`                                             | Analizar diferencias reales, sin deducir automáticamente bajas, defectos o necesidad de intervención                                      |
| 7. Preparar fichas              | `npm run preparar -- <proveedor> --origen <catalogo-catalog.json> --simular`; después sin `--simular` cuando proceda                            | Preparación por **cada proveedor**, con reglas reales, originales intactos y salidas no sobrescritas                                      |
| 8. Validar preparaciones        | `npm run validar -- <proveedor> --etapa preparacion --preparacion <preparation.json> --origen <catalogo-catalog.json>`                          | Calidad técnica y procedencia verificadas; revisión manual de incidencias relevantes                                                      |
| 9. Revisar selección            | `npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --simular` | Exclusions y cobertura acreditadas; no saltarse el bloqueo de cohortes ni las decisiones pendientes                                       |
| 10. Emitir entrega              | Repetir selección con opciones y evidencias válidas, y `--directorio-salida <ruta-nueva>`                                                       | Entregar **únicamente** JSON autorizados y su trazabilidad, distinguiéndolos de catálogos originales o derivaciones no aprobadas          |

Los ejemplos de validación y preparación se repiten por proveedor **porque esas operaciones son individuales**; esto no convierte la campaña en una extracción por proveedor. Las rutas entre `<...>` son marcadores que deben sustituirse por los archivos reales de esa ejecución. No reutilizar arbitrariamente las preparaciones históricas ni sobrescribir salidas; usar destinos nuevos cuando ya existan archivos.

### Riesgos y decisiones entre extracción y entrega

- **Cambio normal del proveedor:** conservar lo que expone en la campaña vigente. Si una fotografía desaparece de la ficha publicada, no restaurar su URL desde campañas antiguas, ni verificar para reutilizar URLs históricas. La ausencia por sí misma **no requiere intervención**.
- **Fallo del extractor:** la fuente vigente **sí** muestra el dato, pero el scraper no lo recoge; corregir extractor/parser y añadir una prueba de comportamiento.
- **Fallo generalizable de mapeador o formateador:** corregir el módulo permanente y las pruebas pertinentes, sin parchear en masa con scripts de campaña.
- **Error textual puntual acreditado:** si realmente requiere corrección, seguir [Intervenciones manuales](INTERVENCIONES_CAMPANA.md); simular, revisar y aplicar **solo bajo orden manual explícita**. Actualmente solo se admiten `title`, `shortDescription`, `longDescription`.
- **Incidencia sin evidencia o conflicto editorial:** no inventar valores, no convertir un `review` en `ready` y no declarar una selección publicable por el mero hecho de pasar validaciones estructurales.

Las intervenciones **no forman parte del lote ordinario**, no se ejecutan automáticamente ni reintroducen imágenes antiguas. Su catálogo derivado y expediente tienen trazabilidad independiente; su validación técnica no sustituye la aprobación editorial. Nunca reutilizar automáticamente scripts de campañas pasadas.

### Particularidad editorial actual

El comando `seleccionar` actualmente exige preparaciones para **GAM, Gomariz y Mercaeleva** y mantiene comprobaciones de cohortes específicas. Si una campaña nueva no coincide con la cohorte acreditada o aparece un proveedor adicional, la selección puede bloquearse aunque `extraer:todos` haya funcionado correctamente. Es una **limitación real del selector actual**: evaluar sus reglas con datos verificados; no falsear hashes, quitar controles ni publicar una selección incompleta para forzar la entrega. La incorporación de un proveedor nuevo requiere revisar además la cobertura editorial y los contratos de salida aplicables.

La revisión de cobertura puede exigir `--anterior`, `--catalogo` y `--revision-cobertura` con archivos y huellas acordes a la cohorte. Seguir el diagnóstico real del comando y [Validación](VALIDACION.md); no inventar expedientes. Tampoco interpretar `--simular` como aprobación de publicación.

## Cierre de campaña: comprobación mínima

- Todos los proveedores registrados están presentes en un lote con estado `complete` y sin sustituciones por resultados parciales.
- Cada catálogo usado tiene manifest/resumen consistentes; cada preparación conserva su procedencia.
- Se han distinguido cambios naturales del origen, anomalías de extracción, defectos reutilizables e intervenciones puntuales.
- No existen URL históricas de imágenes reintroducidas ni datos inventados para mejorar artificialmente las fichas.
- Las diferencias y bloqueos editoriales están resueltos con evidencia o la entrega se declara **pendiente**, no completa.
- Se identifican los JSON publicables exactos, su selección, sus proveedores y las decisiones aplicadas; los artefactos de diagnóstico o intervenidos sin aprobación **no** son entregables.

## Documentación de apoyo

- [Intervenciones manuales por campaña](INTERVENCIONES_CAMPANA.md): script temporal, simulación, SHA, aplicación bajo control humano y validación derivada.
- [Validación y aceptación](VALIDACION.md): códigos de salida, revisión de cobertura y selección editorial.
- [Reglas de datos y publicación](SCRAPER_DATA_RULES.md): contratos, fidelidad a las fuentes y límites.
- [Operación y despliegue](DESPLIEGUE_AUTOMATICO.md): ejecución operativa, distinta del proceso editorial de campañas.
- [Arquitectura](ARQUITECTURA.md): registro de proveedores, interfaces y responsables de cada transformación.
