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

## Acreditación y publicación individual por proveedor

El flujo individual es independiente de una campaña global de cuatro proveedores. Sirve para regenerar un JSON verificable a partir del **original canónico íntegro** y su **preparación actual**, preservando toda decisión editorial obligatoria. No sustituye `npm run acreditar` / `npm run entregar` de campaña global y no publica Manain desde su registro parcial.

La CLI de `scripts/tooling.mjs` acepta los argumentos **`--source` y `--preparation`**; para preparar también `--source` y, cuando procede, `--out`. **No usar `--origen` ni `--preparacion` al invocarla directamente.** En PowerShell, una llamada a `npm run` también puede interpretar opciones propias: usar la sintaxis documentada con `--` y comprobar el proceso invocado, o ejecutar directamente `node scripts/tooling.mjs`. No introducir variables, arrays ni rutas imaginarias. Las rutas canónicas actuales tienen la forma `catalogs/providers/<proveedor>/original/scrape-<proveedor>-catalog.json`, mientras que las preparaciones habituales se guardan bajo `storage/prepared/<proveedor>/`; la salida del preparador **es la referencia válida** para la ruta exacta, no un nombre supuesto.

**Secuencia segura del mecanismo vigente:**

1. Consultar `npm run estado`; confirmar original íntegro, publicación activa y preparación de la huella actual. Si falta la preparación en `storage/` (p. ej., una instalación recién descomprimida), ejecutar `preparar` con el original real; la presencia de un `ready` en `estado` **no acredita que el fichero temporal offline exista**.
2. Abrir la acreditación individual indicando **ambas rutas reales** y, cuando sea pertinente, usar `--proponer` para redactar **propuestas** de exclusión sustentadas por diagnósticos. `--proponer` **no asegura** completar todos los casos: si deja una contradicción sin proponer, consultar la ficha (`--consultar <referencia>`), contrastar la fuente y registrar manualmente `--decidir <referencia> excluir --motivo "..." --evidencia <URL-HTTPS>`. Repetir solo para las decisiones obligatorias. No editar el borrador JSON.
3. Ejecutar `--validar` y comprobar que todas las decisiones sean válidas; el estado seguirá **PENDIENTE** hasta `--aprobar --motivo "..."`. Esa aprobación es **humana y explícita**, se vincula a las huellas de las fuentes y no se arrastra automáticamente al siguiente corte. Una salida `Decisiones válidas: N/N` confirma completitud formal, **no prueba contraste externo ni implica aprobación**.
4. Simular entrega con `entregar:proveedor ... --dry-run`, comparar publicables, exclusiones, identidades y diferencias frente al activo. `--solo-candidata` permite generar y verificar sin activar, si se precisa. La entrega **sin modo** genera y verifica JSON, aprobación, manifiesto y, salvo `--solo-json`, ZIP/recibo y **evalúa la activación automática de la publicación individual si supera las protecciones**. No asumir que una simulación o aprobación la activan.
5. Repetir el comando con `--verificar` para comprobar la entrega existente sin activar ni desactivar. La leyenda `NO ACTIVADA (MODO SOLICITADO)` describe el **modo verificación**, no una reversión del selector. Consultar `npm run estado` para comprobar qué aprobación figura como vigente; revisar `--comparar --specs` después de actualizar todos los proveedores previstos.

Ejemplo de invocación de un solo proveedor, sustituyendo las rutas tras consultar su preparación real (el ejemplo **no** aprueba ni publica):

```powershell
node scripts/tooling.mjs acreditar:proveedor gam --source catalogs/providers/gam/original/scrape-gam-catalog.json --preparation storage/prepared/gam/scrape-gam-preparation.json --validar
```

El borrador se conserva en `storage/providers/<proveedor>/editorial/accreditation-<huella-de-fuentes>.json`. La publicación acreditada se conserva bajo `catalogs/providers/<proveedor>/publications/<id-de-publicación>/` con `<proveedor>-publishable.json` (`ImportCandidate[]`), `accreditation.json`, `manifest.json` y `active.json` como selector al nivel de `publications/`. **No derivar el nombre del directorio del SHA de aprobación por cuenta propia**: puede ser un identificador corto de publicación. Los directorios acreditados son inmutables; nunca renombrar carpetas ni recalcular SHA para forzar activación o archivado.

La protección de diferencias bloquea pérdidas de fichas, descripciones o claves técnicas sin justificación; no se puede «forzar» la publicación a través de una aprobación editorial. Si la entrega aparece como `COMPLETADA`/`ACTIVADA` pero muestra un aviso posterior de `CONSOLIDACIÓN BLOQUEADA`, **distinguir publicación de archivado**: comprobar la publicación con `--verificar` y el selector con `estado`, y tratar el fallo de consolidación en su componente responsable. No borrar históricos manualmente ni repetir aprobaciones para esconder el aviso.

**Límite conocido del tooling actual:** este circuito todavía requiere varios comandos y repetir rutas. La simplificación a un máximo de tres comandos es un **frente independiente de tooling**, sujeto a su plan maestro externo; **no se ha implementado** mediante esta documentación y no debe presumirse en las guías como funcionalidad vigente.

## Seguridad y límites

- No utilizar un lote parcial, catálogos mezclados o manifiestos alterados. Las preparaciones deben quedar vinculadas al mismo lote completo.
- Nunca incluir por defecto una ficha `review`, inventar atributos o restaurar galerías históricas.
- Las intervenciones conservan original, derivado, SHA del plan y expediente propios. Sus productos modificados requieren decisión editorial nueva.
- Los borradores operativos y recibos permanecen bajo `storage/`, fuera de Git. La **copia acreditada de la aprobación y selección** se incorpora, en cambio, a `catalogs/campaigns/<runId>/` para verificar sus JSON definitivos desde el repositorio. La rotación automática solo retira la campaña más antigua después de comprobar las garantías existentes. No hay limpieza manual ordinaria.

Las operaciones avanzadas `npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --manain <preparation.json> --lote <run.json> --borrador <acreditacion.json>` y sus opciones `--acreditacion` / `--simular` siguen disponibles para mantenimiento o diagnóstico con rutas explícitas. **No son necesarias en el recorrido ordinario.** El selector avanzado también puede admitir el conjunto heredado de tres proveedores para compatibilidad explícita; no equivale a acreditar una campaña global vigente.

Consultar [Campañas](CAMPAIGNS.md), [Intervenciones](CAMPAIGN_INTERVENTIONS.md), [Validación](VALIDATION.md) y [Reglas de datos](SCRAPER_DATA_RULES.md).
