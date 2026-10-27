# Intervenciones manuales por campaña

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Las solicitudes de código, pruebas, auditoría o mantenimiento no autorizan cambios documentales implícitos.

## Cuándo utilizarlas

Una intervención es una corrección **puntual y acreditada**, decidida por una persona tras contrastar la ficha con la fuente vigente. No es un formateador general, no completa datos por intuición y **no se ejecuta automáticamente al extraer, revisar o finalizar**. Si el problema se repite en numerosas fichas, corregir el extractor, mapeador o formateador responsable.

El contrato vigente es `ManualInterventionProposal` en `src/manual-interventions/contracts.ts`. Admite estos campos, y ningún otro:

- `title`, `shortDescription`, `longDescription`, `brand` y `model`: texto o `null` cuando lo permita el contrato; `brand` y `model` requieren como nuevo valor texto no vacío.
- `spec:<clave>`: **solo** un atributo técnico ya existente en `product.specs`, con valores concretos del tipo admitido (`string`, `number`, `boolean` o array no vacío de estos). No se añaden claves ausentes ni se establece `null` como valor nuevo.

No se admiten imágenes, identidad, referencia, serie, categoría ni precios. Una foto que la fuente ya no publica no debe restaurarse desde una URL histórica. Si la fuente actual sí la muestra pero el scraper no la obtiene, se investiga y repara el extractor.

## Consultar y mantener el catálogo versionado

Desde la raíz del repositorio, sin necesidad de una campaña activa:

```powershell
npm run intervenir -- gam --listar
npm run intervenir -- gam --consultar gam-6002
npm run intervenir -- gam --consultar gam:ref:6002
```

La consulta obtiene metadatos, identidades, campos, motivos y evidencias mediante análisis **estático**; no importa ni ejecuta el script. Un archivo inválido bloquea el catálogo. Para evaluar su vigencia contra campañas completas y verificables:

```powershell
npm run intervenir -- gam --mantenimiento
```

Este comando tampoco aplica cambios ni elimina scripts. Una ausencia aislada no es suficiente para recomendar la retirada; cuando hay evidencia consecutiva y comparable propone una **revisión humana**, no un borrado automático. Tras comprobar la fuente y las campañas, se puede retirar **solo** el script afectado con `git rm -- interventions/gam/6002.ts` (ejemplo: ejecutar únicamente si realmente se decide retirar esa intervención).

## Crear y simular una intervención permanente

Tras `npm run extraer` y `npm run revisar`, identificar el problema concreto y contrastar los valores con la ficha vigente. Añadir un archivo `.ts` independiente bajo `interventions/<proveedor>/<archivo>.ts`, bajo control de Git. Debe exportar **dos declaraciones estáticas**:

- `metadata`: objeto con `id` estable y exclusivo (prefijo `<proveedor>-`) y `summary` descriptivo no vacío.
- `proposals`: array no vacío de propuestas con `providerId`, `identity`, `field`, `expected`, `next`, `reason` y `evidence`.

No duplicar en `metadata` datos ya deducibles de `proposals`. `identity` procede de `buildProductIdentity` sobre el catálogo original; `expected` debe coincidir con la fuente vigente y `next` exige evidencia actual. Se rechazan imports ejecutables, valores computados y propuestas de otro proveedor. No se deben utilizar scripts no revisados: la consulta es estática, pero **la aplicación sí evalúa TypeScript de confianza**.

Se incluyen `interventions/gam/6002.ts`, `6003.ts` y `6004.ts` como casos reales, cada uno retirable sin los demás. Para simular uno o varios scripts seleccionados:

```powershell
npm run intervenir -- gam --script interventions/gam/6002.ts
npm run intervenir -- gam --script interventions/gam/6002.ts --script interventions/gam/6003.ts
```

La comparación muestra intervenciones pendientes, corregidas en origen, ausentes, parciales o divergentes. Las corregidas en origen y las ausentes **no se reaplican**; las parciales o divergentes bloquean el conjunto. Ningún script se ejecuta por existir en Git o por figurar en el catálogo.

**Migración del flujo anterior:** `--registrar` y `npm run intervencion:conservar` han sido retirados. No copies nuevos scripts a `storage/interventions/<lote>/scripts/` ni uses `interventions/permanentes/<lote>/`. Los **scripts temporales de campañas antiguas continúan admitidos para lectura y recuperación**, y sus expedientes `version: 1` mantienen compatibilidad. No moverlos ni eliminarlos mientras una campaña pueda necesitarlos.

Al integrar esta entrega incremental mediante extracción de ZIP (que no elimina archivos preexistentes), retirar del repositorio exclusivamente los dos módulos ya redundantes, después de aplicar los archivos nuevos:

```powershell
git rm -- scripts/conservar-intervencion.mjs src/infrastructure/filesystem/intervention-script-registration.ts
```

No eliminar `storage/`, scripts históricos, expedientes, acreditaciones ni resultados de campañas abiertas. Si los dos archivos ya no existen, no es necesaria ninguna operación adicional.

## Aplicar y acreditar

Cuando la simulación sea correcta, repetir la operación indicando los mismos scripts y la autorización explícita `--aplicar`:

```powershell
npm run intervenir -- gam --script interventions/gam/6002.ts --aplicar
```

Este comando recalcula y valida el plan contra el origen, aplica los cambios **en un derivado**, verifica el expediente y las huellas, y prepara y valida la ficha corregida. Los catálogos originales permanecen intactos. Si el derivado de ese plan ya existe y es íntegro, puede recuperarse una preparación interrumpida sin duplicar la intervención. Una discrepancia del origen o del plan bloquea la aplicación.

El derivado se sitúa bajo `storage/interventions/<id-lote>/results/<sha256-del-plan>/catalog-derived.json` y su preparación bajo `results/<sha256-del-plan>/prepared/`. No es un JSON publicable: exige volver a revisar el lote y aprobar específicamente la intervención mediante:

```powershell
npm run revisar
npm run acreditar
```

Si antes existía un borrador aprobado, la preparación intervenida genera **otro borrador por huellas**. Para incluir una ficha intervenida que siga `ready`, el borrador debe contener la decisión individual `"incluir"`, con motivo y evidencia actuales. Ninguna intervención convierte un producto `review` en publicable por sí sola.

## Herramientas avanzadas y seguridad

`npm run intervenir:manual`, `intervenir:preparar` e `intervenir:validar` mantienen sus contratos explícitos de rutas y SHA para diagnóstico o mantenimiento. El flujo `intervenir` reduce ese trabajo manual, pero **no sustituye la decisión humana**. Un script TypeScript de intervención se ejecuta como código local de confianza al aplicarlo: verificar su procedencia y revisar la simulación; no es un sandbox frente a código malicioso.

La limpieza de una campaña entregada elimina únicamente resultados temporales reconocidos, tras validar el ZIP final. **Conserva los scripts temporales antiguos** si existen en `storage/interventions/<id-lote>/scripts/` para no romper la recuperación histórica. Los scripts permanentes de `interventions/` están versionados en Git y nunca son objeto de limpieza de campaña.

Referencias: [Campañas](CAMPAIGNS.md), [Acreditación](CAMPAIGN_ACCREDITATION.md), [Composición de intervenciones](INTERVENTION_COMPOSITION.md), [Validación](VALIDATION.md).
