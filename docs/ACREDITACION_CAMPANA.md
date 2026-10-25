# Acreditación manual de una campaña completa

La selección editorial de una campaña nueva no se desbloquea añadiendo hashes al código ni aceptando productos con incidencias sin decisión. El flujo nuevo exige un `run.json` de extracción global **completa**, catálogos canónicos de los tres proveedores con manifest y resumen válidos, y preparaciones validadas con manifest.

El selector histórico permanece disponible para las cohortes previamente acreditadas. La vía nueva es independiente y no restaura fotografías, no transforma galerías ni modifica datos de origen.

## Preparación

Después de extraer todos los proveedores, preparar y validar los tres catálogos, conservar las rutas exactas de sus archivos `*-preparation.json` y localizar el `storage/runs/<id>/run.json` de esa extracción. No mezclar lotes ni reutilizar una preparación antigua.

En los comandos siguientes, sustituir los cuatro marcadores por las rutas existentes. Ejecutar primero:

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --lote <run.json> --borrador <acreditacion-pendiente.json>
```

El borrador se escribe solo si la ruta no existe. Contiene el ID del lote, las huellas SHA-256 de los catálogos y preparaciones, el estado `approved: false` y las fichas cuya publicación está bloqueada por `review` o contradicción de identidad.

## Revisión humana

Abrir el borrador y revisar cada producto afectado en su fuente vigente. Cuando proceda **excluir** una ficha, completar su `decision` con `"excluir"`, una `reason` específica y `evidenceUrls` con HTTPS que incluyan la URL actual del producto. No cambiar referencias, estados, `issues`, recuentos ni hashes; esos valores se revalidan contra los originales.

Solo tras revisar todas las exclusiones y el conjunto global, establecer `approved: true` y escribir un `approvalReason` específico (mínimo 15 caracteres). Esta aprobación es manual: no la hace el scraper, ni la implica superar `npm test`.

Si una incidencia no está suficientemente acreditada, **no aprobar** la campaña. No modificar las URL de imágenes ni recuperar imágenes de campañas anteriores.

## Simulación y entrega

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --lote <run.json> --acreditacion <acreditacion-aprobada.json> --simular
```

Tras revisar el resumen, emitir los JSON en un directorio nuevo:

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --lote <run.json> --acreditacion <acreditacion-aprobada.json> --directorio-salida <directorio-nuevo>
```

La salida son `gam-publishable.json`, `gomariz-publishable.json`, `mercaeleva-publishable.json` y `selection.json`. Este último incluye la huella SHA-256 de la aprobación, el lote y las huellas de las preparaciones utilizadas.

Se rechazan lotes incompletos, catálogos no correspondientes al lote, preparaciones alteradas, exclusiones nuevas sin acreditar y aprobaciones de otras campañas. La acreditación **no** hace pasar una ficha `review` a `ready`: la excluye de la entrega hasta que se resuelva su problema.

Las preparaciones derivadas de intervenciones manuales siguen requiriendo una vía de autorización específica y no están admitidas en esta acreditación. No eludir esa barrera modificando un archivo de procedencia.

La acreditación y sus decisiones se conservan como evidencias de la campaña, **fuera del código permanente**. No copiar el borrador ni los JSON de aprobación al repositorio como reglas de negocio.
