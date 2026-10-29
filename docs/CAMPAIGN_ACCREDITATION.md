# Acreditación manual de una campaña completa

## Objetivo

La acreditación editorial valida que los cuatro catálogos del contrato actual proceden del mismo lote completo y que sus preparaciones, decisiones e intervenciones son comprobables. Superar la validación técnica o tener cero incidencias `Review` **no autoriza por sí solo la publicación**. No añadir SHA fijos al código ni relajar los controles para forzar la selección.

## Qué acredita y qué no arregla

La acreditación **no corrige** fallos generalizables de extracción, normalización, identidad o cobertura. Antes de llegar a ella, el código productivo debe haber resuelto las incidencias técnicamente corregibles y acreditado la calidad del conjunto. La decisión humana queda para **exclusiones e inclusiones editoriales genuinas**, con evidencia y su propia autorización: ni ejecutar `acreditar` ni excluir una ficha convierte sus datos técnicos en `ready`, ni permite afirmar que el catálogo de origen tiene `0 review` si no los tiene.

Si la causa de un bloqueo está en el software, se vuelve a su módulo responsable y se rehace la preparación derivada conforme a las huellas vigentes; no se fuerza una aprobación para evitar reparar el motor. Ver [Objetivos](SCRAPER_OBJECTIVES.md) y [Validación](VALIDATION.md).


## Recorrido ordinario sin rutas ni SHA manuales

Después de `npm run extraer` y de revisar las incidencias con `npm run revisar`, ejecutar:

```powershell
npm run acreditar
```

El comando identifica el lote vigente por `run.json`, verifica catálogos originales y preparaciones de **GAM, Gomariz, Mercaeleva y Manain**, y genera el borrador asociado a sus huellas en:

`storage/campaigns/<id-lote>/editorial/accreditation-<sha256>.json`

El borrador contiene `version`, `runId`, `approved: false`, `approvalReason: null`, las `sources` verificadas y las decisiones `exclusions` pendientes. Si cambian las preparaciones, incluso por una intervención, **cambia el borrador**: no se reutiliza una aprobación anterior.

## Revisión y decisión humana mediante comandos

El borrador se genera con `npm run acreditar`. A partir de ese momento **no se edita directamente**. Los comandos siguientes resuelven el lote y el SHA de las preparaciones automáticamente:

```powershell
npm run acreditar -- --listar
npm run acreditar -- --consultar gam 6682
```

La consulta muestra el proveedor, la referencia, la URL de origen, la causa del bloqueo y su decisión actual. Una persona contrasta los datos con las fuentes y registra la decisión individual, aportando un motivo específico de al menos 15 caracteres y la URL HTTPS de origen como evidencia:

```powershell
npm run acreditar -- --decidir gam 6682 excluir --motivo "Identidad sin confirmar tras revisar la publicación vigente" --evidencia "<url-fuente-mostrada-por-consultar>"
```

La URL anterior es solo ilustrativa: **en una operación real se utiliza exactamente la `Fuente` mostrada por `--consultar`**, nunca una URL inventada. Se puede repetir `--evidencia <https-url>` para añadir otras pruebas. Los comandos no acreditan por sí solos que una persona haya verificado el portal: esa revisión sigue siendo imprescindible.

Las fichas `review` o con contradicciones de identidad solo admiten `excluir`. Las fichas de `intervention` que permanecen `ready` permiten `incluir` o `excluir`, siempre con motivo y evidencia. Nadie debe aprobar una inclusión sin contraste real.

```powershell
npm run acreditar -- --validar
npm run acreditar -- --aprobar --motivo "Aprobación humana del conjunto tras contrastar todas las decisiones"
npm run acreditar -- --simular
npm run acreditar
npm run entregar
```

`--validar` **no escribe** y señala todos los fallos de las decisiones. Si alguna decisión está incompleta, `--aprobar` falla sin cambiar el archivo. La aprobación requiere un motivo global de al menos 15 caracteres y es explícita incluso si no existen incidencias. `--simular` no crea archivos; la finalización aprobada genera bajo `storage/campaigns/<id-lote>/selection/<sha256>/` los JSON publicables y la selección interna, exclusivamente para uso del pipeline.

Al finalizar una acreditación aprobada, el sistema consolida en `catalogs/campaigns/<runId>/` el conjunto verificable: `manifest.json`, `accreditation.json`, `selection.json`, los cuatro originales canónicos con sus manifiestos y resúmenes, y los `publishable.json` de cada proveedor. Para fichas intervenidas incorpora además derivado y expediente de intervención. No es necesario entregar antes el ZIP comercial para consolidar esta selección; la entrega y su recibo siguen siendo pasos separados. Esta instantánea es **inmutable por `runId`**, y se comprueba su integridad al leerla. No editar estos archivos directamente ni sustituirlos por el resultado de una preparación nueva.

Una vez aprobada una acreditación, los comandos editoriales no permiten modificarla. Una intervención posterior genera un borrador distinto, vinculado a las nuevas preparaciones. Las operaciones de edición comprueban de nuevo la campaña y el contenido del borrador antes de sustituirlo, y nunca reescriben una selección existente.

`entregar` valida la selección y crea en el Escritorio `equipzilla-AAAA-MM-DD-<runId>.zip` con los cuatro JSON fechados, sin manifests ni `selection.json`. El `runId` evita colisiones entre entregas del mismo día, no se sobrescribe un ZIP existente y una campaña ya entregada no se entrega de nuevo. El recibo local y sus evidencias se verifican por `runId`, aunque el ZIP físico deje de estar disponible.

## Acreditación de un único proveedor

`npm run acreditar:proveedor -- <proveedor> --origen <catalog.json> --preparacion <preparation.json>` abre un borrador individual verificado, independiente de los lotes globales. La lectura previa `seleccionar:proveedor` sigue siendo de solo consulta. Están disponibles `--listar`, `--consultar <referencia>`, `--validar`, `--decidir <referencia> excluir --motivo "..." --evidencia <URL HTTPS de la ficha>` y `--aprobar --motivo "..."`. La aprobación es explícita y solo se permite cuando todas las decisiones obligatorias son válidas. No se admiten inclusiones automáticas de fichas en revisión o con conflicto de identidad.

El borrador se guarda en `storage/providers/<proveedor>/editorial/accreditation-<huella-de-fuentes>.json` y no puede reutilizarse tras variar la preparación. Toda edición vuelve a verificar la procedencia y bloquea sobrescrituras concurrentes. No se requiere `run.json` ni se altera la acreditación de la campaña global. La aprobación individual, por sí sola, no genera el JSON. Después de registrar y aprobar todas las decisiones humanas:

```powershell
npm run entregar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json> --simular
npm run entregar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json>
npm run entregar:proveedor -- gam --origen <catalog.json> --preparacion <preparation.json> --verificar
```

`entregar:proveedor` verifica nuevamente original, preparación y acreditación y aplica el selector editorial existente. Guarda en `catalogs/providers/<proveedor>/publications/<sha-aprobacion>/` un JSON de `ImportCandidate[]` (solo fichas publicables), copia exacta de la aprobación y un manifiesto con hashes y recuentos. `--simular` solo consulta y `--verificar` exige un resultado existente íntegro. No sobrescribe publicaciones modificadas, no incluye fichas descartadas ni modifica campañas globales. El inventario de `npm run estado` sigue centrado en la entrega global; esta vía se verifica explícitamente con `entregar:proveedor --verificar`. No sustituirla por `npm run entregar`, que exige cuatro proveedores.

## Seguridad y límites

- No utilizar un lote parcial, catálogos mezclados o manifiestos alterados. Las preparaciones deben quedar vinculadas al mismo lote completo.
- Nunca incluir por defecto una ficha `review`, inventar atributos o restaurar galerías históricas.
- Las intervenciones conservan original, derivado, SHA del plan y expediente propios. Sus productos modificados requieren decisión editorial nueva.
- Los borradores operativos y recibos permanecen bajo `storage/`, fuera de Git. La **copia acreditada de la aprobación y selección** se incorpora, en cambio, a `catalogs/campaigns/<runId>/` para verificar sus JSON definitivos desde el repositorio. La rotación automática solo retira la campaña más antigua después de comprobar las garantías existentes. No hay limpieza manual ordinaria.

Las operaciones avanzadas `npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --manain <preparation.json> --lote <run.json> --borrador <acreditacion.json>` y sus opciones `--acreditacion` / `--simular` siguen disponibles para mantenimiento o diagnóstico con rutas explícitas. **No son necesarias en el recorrido ordinario.** El selector avanzado también puede admitir el conjunto heredado de tres proveedores para compatibilidad explícita; no equivale a acreditar una campaña global vigente.

Consultar [Campañas](CAMPAIGNS.md), [Intervenciones](CAMPAIGN_INTERVENTIONS.md), [Validación](VALIDATION.md) y [Reglas de datos](SCRAPER_DATA_RULES.md).
