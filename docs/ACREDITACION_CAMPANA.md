# Acreditación manual de una campaña completa

## Objetivo

La acreditación editorial valida que los tres catálogos proceden del mismo lote completo y que sus preparaciones, decisiones e intervenciones son comprobables. Superar la validación técnica o tener cero incidencias `Review` **no autoriza por sí solo la publicación**. No añadir SHA fijos al código ni relajar los controles para forzar la selección.

## Recorrido ordinario sin rutas ni SHA manuales

Después de `npm run campana:extraer` y de revisar las incidencias con `npm run campana:revisar`, ejecutar:

```powershell
npm run campana:finalizar
```

El comando identifica el lote vigente por `run.json`, verifica catálogos originales y preparaciones de **GAM, Gomariz y Mercaeleva**, y genera el borrador asociado a sus huellas en:

`storage/campanas/<id-lote>/editorial/acreditacion-<sha256>.json`

El borrador contiene `version`, `runId`, `approved: false`, `approvalReason: null`, las `sources` verificadas y las decisiones `exclusions` pendientes. Si cambian las preparaciones, incluso por una intervención, **cambia el borrador**: no se reutiliza una aprobación anterior.

## Revisión y decisión humana mediante comandos

El borrador se genera con `npm run campana:finalizar`. A partir de ese momento **no se edita directamente**. Los comandos siguientes resuelven el lote y el SHA de las preparaciones automáticamente:

```powershell
npm run campana:finalizar -- --listar
npm run campana:finalizar -- --consultar gam 6682
```

La consulta muestra el proveedor, la referencia, la URL de origen, la causa del bloqueo y su decisión actual. Una persona contrasta los datos con las fuentes y registra la decisión individual, aportando un motivo específico de al menos 15 caracteres y la URL HTTPS de origen como evidencia:

```powershell
npm run campana:finalizar -- --decidir gam 6682 excluir --motivo "Identidad sin confirmar tras revisar la publicación vigente" --evidencia "<url-fuente-mostrada-por-consultar>"
```

La URL anterior es solo ilustrativa: **en una operación real se utiliza exactamente la `Fuente` mostrada por `--consultar`**, nunca una URL inventada. Se puede repetir `--evidencia <https-url>` para añadir otras pruebas. Los comandos no acreditan por sí solos que una persona haya verificado el portal: esa revisión sigue siendo imprescindible.

Las fichas `review` o con contradicciones de identidad solo admiten `excluir`. Las fichas de `intervention` que permanecen `ready` permiten `incluir` o `excluir`, siempre con motivo y evidencia. Nadie debe aprobar una inclusión sin contraste real.

```powershell
npm run campana:finalizar -- --validar
npm run campana:finalizar -- --aprobar --motivo "Aprobación humana del conjunto tras contrastar todas las decisiones"
npm run campana:finalizar -- --simular
npm run campana:finalizar
npm run campana:entregar
```

`--validar` **no escribe** y señala todos los fallos de las decisiones. Si alguna decisión está incompleta, `--aprobar` falla sin cambiar el archivo. La aprobación requiere un motivo global de al menos 15 caracteres y es explícita incluso si no existen incidencias. `--simular` no crea archivos; la finalización aprobada genera bajo `storage/campanas/<id-lote>/seleccion/<sha256>/` los JSON publicables y la selección interna, exclusivamente para uso del pipeline.

Una vez aprobada una acreditación, los comandos editoriales no permiten modificarla. Una intervención posterior genera un borrador distinto, vinculado a las nuevas preparaciones. Las operaciones de edición comprueban de nuevo la campaña y el contenido del borrador antes de sustituirlo, y nunca reescriben una selección existente.

`campana:entregar` valida la selección y genera en el Escritorio el ZIP verificado con exactamente los tres JSON fechados, sin manifests ni `selection.json`. Una entrega válida anterior se conserva cuando un nuevo intento falla.

## Seguridad y límites

- No utilizar un lote parcial, catálogos mezclados o manifiestos alterados. Las preparaciones deben quedar vinculadas al mismo lote completo.
- Nunca incluir por defecto una ficha `review`, inventar atributos o restaurar galerías históricas.
- Las intervenciones conservan original, derivado, SHA del plan y expediente propios. Sus productos modificados requieren decisión editorial nueva.
- Los borradores y aprobaciones permanecen fuera del código y de Git, bajo `storage/`. Tras entregar, `npm run campana:limpiar` simula la limpieza; `-- --aplicar` requiere que la entrega siga verificable.

Las operaciones avanzadas `npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --lote <run.json> --borrador <acreditacion.json>` y sus opciones `--acreditacion` / `--simular` siguen disponibles para mantenimiento o diagnóstico con rutas explícitas. **No son necesarias en el recorrido ordinario.**

Consultar [Campañas](CAMPANAS.md), [Intervenciones](INTERVENCIONES_CAMPANA.md), [Validación](VALIDACION.md) y [Reglas de datos](SCRAPER_DATA_RULES.md).
