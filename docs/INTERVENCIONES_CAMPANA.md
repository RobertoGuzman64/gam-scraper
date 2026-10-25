# Intervenciones manuales por campaña

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Las solicitudes de código, pruebas, auditoría o mantenimiento no autorizan cambios documentales implícitos.

## Objetivo y límites

Este procedimiento sirve para **correcciones textuales puntuales y acreditadas** sobre un catálogo concreto. La ejecución es **exclusivamente manual**, bajo decisión del propietario, y jamás forma parte de `extraer`, `preparar`, `validar`, trabajos programados o selección editorial ordinaria.

La herramienta implementada admite solo los campos `title`, `shortDescription` y `longDescription`, mediante propuestas con contrato `ManualInterventionProposal` de `src/manual-interventions/contracts.ts`. **No admite imágenes (`image`, `images`), identidad, referencia, número de serie, precio, categoría, marca, modelo ni especificaciones.** Si esos datos requieren un arreglo, diagnosticar su causa y usar el módulo permanente o el flujo editorial correspondiente; no intentar eludir la lista de campos.

**Nunca reconstruir galerías con URL históricas:** si el proveedor ha dejado de exponer una foto en la extracción vigente, se acepta su ausencia. Aunque la URL anterior todavía responda, puede dejar de funcionar. La diferencia entre campañas **no es por sí misma un error** ni obliga a intervenir. Si el proveedor **sí expone** una imagen y el scraper no la recoge, examinar el extractor y las reglas reales, con evidencia de la ficha actual. Los originales conservan exactamente lo observado.

## Cuándo intervenir y cuándo corregir el software

| Diagnóstico acreditado                                                             | Decisión                                                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Error **puntual de texto** en una ficha, con dato correcto comprobado              | Preparar intervención manual aislada                                                                |
| Fallo de lectura de HTML, galería incompleta pese a que la fuente la expone        | Corregir extractor o parser; añadir prueba del comportamiento                                       |
| Regla general de transformación o asignación incorrecta                            | Corregir mapeador o formateador y su prueba                                                         |
| Desaparición de imágenes en la web del proveedor                                   | Reflejar la galería vigente; **no** reponer URL antiguas                                            |
| Producto ausente de una ejecución, contradicción de identidad o falta de evidencia | Investigar cobertura/origen y decisión editorial; **no** inventar ni intervenir para forzar `ready` |

Una corrección temporal no se promueve al núcleo porque aparezca de nuevo: solo cuando hay una regla generalizable o un defecto acreditado. Nunca se hacen cambios para satisfacer artificialmente un contrato del receptor.

## Uso semanal

1. **Extraer y comparar.** Ejecutar la campaña **completa de todos los proveedores registrados** mediante `npm run extraer:todos` (sin `--proveedores`) según [el protocolo de campañas](CAMPANAS.md); las ejecuciones individuales son solo auxiliares. Localizar el `*-catalog.json` canónico vigente con su manifest y resumen. La comparación `npm run cobertura -- --anterior <anterior-catalog.json> --actual <actual-catalog.json> --simular` sirve para diagnosticar diferencias, no para aprobar bajas ni cambios.
2. **Clasificar.** Contrastar el campo problemático con la ficha del proveedor de esta campaña. Registrar de forma breve: referencia, campo, causa, evidencia y decisión (`puntual`, `extractor`, `mapeador`, `formateador`, `sin evidencia`, o cambio legítimo). Si no hay evidencia de que deba corregirse, no crear intervención.
3. **Preparar el script a mano.** Crear `storage/interventions/<campana>/scripts/<nombre-funcional>.ts`, en una campaña con identificador alfanumérico, guiones o guiones bajos. El script TypeScript **de confianza** debe exportar `proposals` como array no vacío; cada propuesta contiene exactamente `providerId`, `identity`, `field`, `expected`, `next`, `reason` y `evidence`. `identity` debe ser exactamente la clave de `buildProductIdentity` (`proveedor:ref:...`, `proveedor:sn:...` o `proveedor:url:...` según la evidencia del producto); `expected` debe coincidir exactamente con el valor del catálogo actual; `next` debe ser el texto contrastado. Usar, si se necesita, `import type` del contrato citado. No se admiten imports de ejecución ni reexportaciones; evitar exportaciones ajenas a `proposals`.
4. **Simular y revisar.** Desde la raíz del repo ejecutar:

   ```powershell
   npm run intervenir -- gam --script storage/interventions/<campana>/scripts/<archivo>.ts --origen <archivo-catalog.json> --detalle
   ```

   La simulación es el modo predeterminado, **no escribe archivos de datos** y muestra productos afectados, cambios antes/después, SHA de origen y SHA del plan. `--detalle` permite revisar el motivo y la evidencia. Si no coincide un valor anterior, una identidad o un campo, corregir el script **sin forzar la ejecución**.
5. **Aplicar solo tras revisar y autorizar.** Copiar el **SHA-256 completo del plan** mostrado por la simulación; ejecutar deliberadamente:

   ```powershell
   npm run intervenir -- gam --script storage/interventions/<campana>/scripts/<archivo>.ts --origen <archivo-catalog.json> --campana <campana> --aplicar --plan <sha256-del-plan>
   ```

   El comando recalcula el plan sobre el origen acreditado; si ha cambiado, o la salida del mismo plan ya existe, **falla sin sobrescribirla**. Conserva intactos catálogo, manifest y resumen originales. Crea `storage/interventions/<campana>/results/<sha256-del-plan>/catalog-derived.json` e `intervention-record.json`, con procedencia y cambios. Este directorio es un **resultado derivado**, no una nueva extracción ni una publicación aprobada.
6. **Preparar y validar el derivado** usando los mismos mapeadores y formateadores productivos:

   ```powershell
   npm run intervenir:preparar -- gam --derivado <ruta-al-catalog-derived.json> --origen <archivo-catalog.json> --simular
   npm run intervenir:preparar -- gam --derivado <ruta-al-catalog-derived.json> --origen <archivo-catalog.json>
   npm run intervenir:validar -- gam --derivado <ruta-al-catalog-derived.json> --origen <archivo-catalog.json> --preparacion <ruta-a-intervention-preparation.json>
   ```

   Por defecto la preparación se escribe bajo `<directorio-del-derivado>/prepared/intervention-preparation.json`, sin sobrescribir una salida existente. La validación comprueba también origen, plan, expediente y derivado. El código **0** indica conformidad para ese modo; **2** indica registros que requieren revisión; **1** indica error técnico/integridad. **Una validación conforme no aprueba por sí sola la publicación editorial**: la selección mantiene sus controles y bloquea los derivados sin autorización específica.
7. **Cerrar la decisión.** Conservar script, expediente, SHA, fuente y resultado de la revisión en la carpeta de campaña. Solo considerar un JSON entregable si supera también las comprobaciones editoriales pertinentes; no presentar automáticamente el `catalog-derived.json` como JSON definitivo de publicación. En campañas nuevas los scripts históricos **no se ejecutan, heredan ni aplican automáticamente**.

## Ejemplo de decisión: GAM deja de mostrar fotografías

Si al comparar campañas se observa que GAM ya no publica una fotografía, **no se abre intervención** y no se rellena la galería con URL de la semana anterior. Tampoco se comprueba si la URL antigua responde: no es una fuente vigente. Si la ficha actual muestra fotos que el scraper no ha capturado, se documenta el HTML o enlace actual y se investiga el adaptador; **eso es una posible corrección de extracción**, no una intervención textual temporal.

## Registro mínimo y límites de seguridad

El expediente generado guarda campaña, fecha, proveedor, origen, SHA de origen/plan/derivado y cambios aplicados con motivo y evidencia. Para cambios que no se ejecutan, basta dejar asentada la decisión en el seguimiento habitual de campaña; no generar expedientes de modificaciones ficticias.

Los scripts se cargan y **ejecutan como código Node local de confianza**: las restricciones de imports y campos reducen riesgos de uso, **pero no constituyen un sandbox de seguridad frente a código malicioso**. Revisar los scripts antes de lanzarlos. No ejecutar código temporal de terceros sin comprobarlo. La herramienta no garantiza disponibilidad futura de URL externas ni sustituye el contraste humano con el proveedor.

Reglas relacionadas: [Campañas completas](CAMPANAS.md), [Datos y publicación](SCRAPER_DATA_RULES.md), [Validación](VALIDACION.md), [Arquitectura](ARQUITECTURA.md).
