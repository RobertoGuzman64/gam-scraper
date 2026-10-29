# Acreditación manual de una campaña completa

## Objetivo

La acreditación editorial valida que los cuatro catálogos del contrato actual proceden del mismo lote completo y que sus preparaciones, decisiones e intervenciones son comprobables. Superar la validación técnica o tener cero incidencias `Review` **no autoriza por sí solo la publicación**. No añadir SHA fijos al código ni relajar los controles para forzar la selección.

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

## Seguridad y límites

- No utilizar un lote parcial, catálogos mezclados o manifiestos alterados. Las preparaciones deben quedar vinculadas al mismo lote completo.
- Nunca incluir por defecto una ficha `review`, inventar atributos o restaurar galerías históricas.
- Las intervenciones conservan original, derivado, SHA del plan y expediente propios. Sus productos modificados requieren decisión editorial nueva.
- Los borradores operativos y recibos permanecen bajo `storage/`, fuera de Git. La **copia acreditada de la aprobación y selección** se incorpora, en cambio, a `catalogs/campaigns/<runId>/` para verificar sus JSON definitivos desde el repositorio. La rotación automática solo retira la campaña más antigua después de comprobar las garantías existentes. No hay limpieza manual ordinaria.

Las operaciones avanzadas `npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --manain <preparation.json> --lote <run.json> --borrador <acreditacion.json>` y sus opciones `--acreditacion` / `--simular` siguen disponibles para mantenimiento o diagnóstico con rutas explícitas. **No son necesarias en el recorrido ordinario.** El selector avanzado también puede admitir el conjunto heredado de tres proveedores para compatibilidad explícita; no equivale a acreditar una campaña global vigente.

Consultar [Campañas](CAMPAIGNS.md), [Intervenciones](CAMPAIGN_INTERVENTIONS.md), [Validación](VALIDATION.md) y [Reglas de datos](SCRAPER_DATA_RULES.md).
