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

## Revisión y decisión humana

Contrastar con los portales vigentes todos los bloqueos editoriales indicados. Cada decisión requerida conserva `providerId`, `reference`, `sourceUrl`, `status` e `issues`. No alterar esas propiedades ni `runId`, `sources` o las huellas.

- Para `review` o contradicción de identidad: establecer `decision: "excluir"`, `reason` concreto de al menos 15 caracteres y `evidenceUrls` HTTPS que incluya la URL vigente de la ficha. No convertir el registro a `ready` artificialmente.
- Para `intervention` de una ficha que permanece `ready`: decidir expresamente `"incluir"` o `"excluir"`, con el motivo y la misma exigencia de evidencia. Un cambio técnico acreditado no implica aprobación editorial automática.
- Solo cuando se haya revisado el conjunto, introducir `approvalReason` específico de al menos 15 caracteres y `approved: true`. Si falta evidencia, dejar la campaña pendiente.

Sin exclusiones, sigue siendo necesaria la revisión y aprobación global. Tras guardarla, ejecutar:

```powershell
npm run campana:finalizar -- --simular
npm run campana:finalizar
npm run campana:entregar
```

El comando de simulación no escribe resultados. La finalización aprobada genera bajo `storage/campanas/<id-lote>/seleccion/<sha256>/` los tres JSON publicables y `selection.json`, **solo para uso interno**. `campana:entregar` valida esa selección y produce en el Escritorio un ZIP comprobado con exactamente los tres JSON fechados, sin manifests ni `selection.json`. La entrega anterior del mismo día se conserva cuando el intento nuevo falla.

## Seguridad y límites

- No utilizar un lote parcial, catálogos mezclados o manifiestos alterados. Las preparaciones deben quedar vinculadas al mismo lote completo.
- Nunca incluir por defecto una ficha `review`, inventar atributos o restaurar galerías históricas.
- Las intervenciones conservan original, derivado, SHA del plan y expediente propios. Sus productos modificados requieren decisión editorial nueva.
- Los borradores y aprobaciones permanecen fuera del código y de Git, bajo `storage/`. Tras entregar, `npm run campana:limpiar` simula la limpieza; `-- --aplicar` requiere que la entrega siga verificable.

Las operaciones avanzadas `npm run seleccionar -- --gam <preparation.json> --gomariz <preparation.json> --mercaeleva <preparation.json> --lote <run.json> --borrador <acreditacion.json>` y sus opciones `--acreditacion` / `--simular` siguen disponibles para mantenimiento o diagnóstico con rutas explícitas. **No son necesarias en el recorrido ordinario.**

Consultar [Campañas](CAMPANAS.md), [Intervenciones](INTERVENCIONES_CAMPANA.md), [Validación](VALIDACION.md) y [Reglas de datos](SCRAPER_DATA_RULES.md).
