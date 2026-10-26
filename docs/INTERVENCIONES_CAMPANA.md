# Intervenciones manuales por campaña

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Las solicitudes de código, pruebas, auditoría o mantenimiento no autorizan cambios documentales implícitos.

## Cuándo utilizarlas

Una intervención es una corrección **puntual y acreditada**, decidida por una persona tras contrastar la ficha con la fuente vigente. No es un formateador general, no completa datos por intuición y **no se ejecuta automáticamente al extraer, revisar o finalizar**. Si el problema se repite en numerosas fichas, corregir el extractor, mapeador o formateador responsable.

El contrato vigente es `ManualInterventionProposal` en `src/manual-interventions/contracts.ts`. Admite estos campos, y ningún otro:

- `title`, `shortDescription`, `longDescription`, `brand` y `model`: texto o `null` cuando lo permita el contrato; `brand` y `model` requieren como nuevo valor texto no vacío.
- `spec:<clave>`: **solo** un atributo técnico ya existente en `product.specs`, con valores concretos del tipo admitido (`string`, `number`, `boolean` o array no vacío de estos). No se añaden claves ausentes ni se establece `null` como valor nuevo.

No se admiten imágenes, identidad, referencia, serie, categoría ni precios. Una foto que la fuente ya no publica no debe restaurarse desde una URL histórica. Si la fuente actual sí la muestra pero el scraper no la obtiene, se investiga y repara el extractor.

## Preparar y registrar un script

Tras `npm run campana:extraer` y `npm run campana:revisar`, identificar proveedor, producto, campo incorrecto, valor observado y valor contrastado. Crear un archivo TypeScript de confianza que exporte `proposals` como **array no vacío** de objetos con exactamente estas propiedades:

`providerId`, `identity`, `field`, `expected`, `next`, `reason`, `evidence`.

`identity` procede de `buildProductIdentity` sobre la ficha original. `expected` debe coincidir con el valor real del catálogo; `next` es el valor acreditado. `reason` y `evidence` justifican el cambio. El script no debe incluir imports ejecutables ni reexportaciones y no debe contener propuestas ajenas al proveedor seleccionado.

Para vincularlo **solo al lote vigente** y ver una simulación detallada:

```powershell
npm run campana:intervenir -- gam --registrar <ruta-al-script.ts>
```

El comando copia el script a `storage/interventions/<id-lote>/scripts/` y muestra los cambios antes/después sin aplicarlos. Los scripts existentes no se ejecutan nunca por el mero hecho de permanecer en esa carpeta. `--registrar` no sustituye silenciosamente un archivo ya registrado con contenido diferente. Si se necesita más de un script, se pueden repetir `--registrar <archivo.ts>`.

También se puede usar `--script storage/interventions/<id-lote>/scripts/<archivo.ts>` para simular uno ya registrado. **Revisar el diff y las evidencias antes de autorizar la aplicación.**

## Aplicar y acreditar

Cuando la simulación sea correcta, repetir la operación indicando los mismos scripts y la autorización explícita `--aplicar`:

```powershell
npm run campana:intervenir -- gam --script storage/interventions/<id-lote>/scripts/<archivo.ts> --aplicar
```

Este comando recalcula y valida el plan contra el origen, aplica los cambios **en un derivado**, verifica el expediente y las huellas, y prepara y valida la ficha corregida. Los catálogos originales permanecen intactos. Si el derivado de ese plan ya existe y es íntegro, puede recuperarse una preparación interrumpida sin duplicar la intervención. Una discrepancia del origen o del plan bloquea la aplicación.

El derivado se sitúa bajo `storage/interventions/<id-lote>/results/<sha256-del-plan>/catalog-derived.json` y su preparación bajo `results/<sha256-del-plan>/prepared/`. No es un JSON publicable: exige volver a revisar el lote y aprobar específicamente la intervención mediante:

```powershell
npm run campana:revisar
npm run campana:finalizar
```

Si antes existía un borrador aprobado, la preparación intervenida genera **otro borrador por huellas**. Para incluir una ficha intervenida que siga `ready`, el borrador debe contener la decisión individual `"incluir"`, con motivo y evidencia actuales. Ninguna intervención convierte un producto `review` en publicable por sí sola.

## Herramientas avanzadas y seguridad

`npm run intervenir`, `intervenir:preparar` e `intervenir:validar` conservan sus contratos explícitos de rutas y SHA para diagnóstico o mantenimiento. El flujo `campana:intervenir` reduce ese trabajo manual, pero **no sustituye la decisión humana**. Un script TypeScript de intervención se ejecuta como código local de confianza: verificar su procedencia antes de registrarlo o aplicarlo, pues no es un sandbox frente a código malicioso.

La limpieza de una campaña entregada elimina resultados temporales solo con `npm run campana:limpiar -- --aplicar` tras verificar el ZIP final, pero **conserva los scripts** en `storage/interventions/<id-lote>/scripts/`. No se transportan ni aplican automáticamente a otras campañas.

Referencias: [Campañas](CAMPANAS.md), [Acreditación](ACREDITACION_CAMPANA.md), [Composición de intervenciones](COMPOSICION_INTERVENCIONES.md), [Validación](VALIDACION.md).
