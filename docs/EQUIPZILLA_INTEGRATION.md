# Integración con Equipzilla: contratos técnicos y comerciales

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Dos productos de datos y una frontera de sistema

El scraper produce y conserva **datos técnicos acreditados**. También dispone de una **proyección comercial local**, separada, que interpreta publicaciones técnicas vigentes conforme a la taxonomía y los atributos conocidos. **Ni la entrega técnica ni la exportación comercial importan productos al backend**: autorización, altas, actualizaciones, persistencia y reglas operativas del receptor siguen fuera de este repositorio.

```text
Proveedores → extracción → originales canónicos → preparación técnica (ready/review)
                                                 ↓
                            selección editorial y JSON acreditados
                                                 ↓
          proyección comercial del scraper (categorías, atributos, metadata)
                                                 ↓
                     JSON comerciales + manifiesto verificable
                                                 ↓
            integración e importación externas al scraper (backend)
```

La campaña global tiene un contrato de cuatro proveedores (GAM, Gomariz, Mercaeleva, Manain). Las publicaciones individuales acreditadas utilizadas por la exportación comercial actual corresponden a **GAM, Gomariz y Mercaeleva**; eso no convierte a Manain en una publicación completa ni sustituye la campaña global.

## Contrato técnico

- `ProductRecord` conserva origen, categorías de proveedor, referencias, imágenes, descripciones, condición y `specs`.
- La preparación técnica actual (`rulesVersion: 2`) conserva `categorySellID: null`, `attributes: []` y las especificaciones en `spec`: la falta de asignación comercial **no es una review técnica**.
- `ready/review` identifica controles técnicos y de evidencia. Las exclusiones editoriales preservan los originales, no equivalen a altas ni convierten `review` en `ready`.
- Los JSON acreditados y sus manifests demuestran selección y procedencia dentro de su contrato, no una importación consumada ni cobertura de un portal.

## Contrato de la proyección comercial local

- `src/commercial/projection/` decide la correspondencia con el snapshot de categorías y atributos; los IDs solo proceden de `data/category/categorySell-flat.json` y `data/import/attributeCatalog.json`.
- `src/commercial/projection/category-projection.ts` mantiene la política; `source-category-evidence.ts` y `gam-category-evidence.ts` aíslan las comprobaciones de procedencia. La extracción de evidencia no cambia las reglas comerciales.
- `src/commercial/export/` produce los JSON derivados y su `commercial-manifest.json`, con hashes de archivos, snapshot y referencias relevantes. La exportación consulta las publicaciones técnicas y sus originales sin modificarlos.
- `src/cli/commands/catalog/commercial-audit.ts` coordina la auditoría y `src/cli/reporting/commercial-audit.ts` presenta informes. `--verificar=RUTA` contrasta una exportación existente con las fuentes vigentes.
- `data/commercial-reference/` contiene logos y correspondencias de empresas; `companyID` solo se incluye con entorno explícito. Las categorías, opciones, valores, condición, identidad y metadata se validan, no se inventan.

```powershell
npm run auditar:comercial
npm run auditar:comercial -- --acreditacion
npm run exportar:comercial -- --salida <directorio-nuevo> --simular
npm run exportar:comercial -- --salida <directorio-nuevo> --entorno production
npm run auditar:comercial -- --verificar=<directorio-existente>
```

Los comandos de exportación definitiva crean un directorio nuevo y archivos verificables; **no envían solicitudes HTTP al backend**. La exportación comercial no modifica la selección editorial ni los originales. Una incompatibilidad en la proyección debe resolverse en el mapeador o contrato comercial, no degradando `ready/review` de la preparación canónica.

## Compatibilidad heredada y responsabilidades del receptor

`npm run exportar` es un mecanismo **legado** de Excel/JSON en `src/commercial/legacy-export/` y `src/cli/commands/legacy-export/`, con infraestructura de XLSX y referencias comerciales heredadas. Su preparación con catálogo corresponde a un contrato histórico; no es la continuación automática de `entregar` y rechaza una preparación técnica nueva que no tenga asignaciones comerciales compatibles.

El backend debe decidir identidad de sus registros, altas/actualizaciones, permisos e inventario, preservar en su caso `metadata.featured` previamente gestionado y procesar los JSON sin recrear por IA categorías o atributos que el derivado comercial ya acredita. Estas obligaciones **no quedan implementadas ni verificadas** por ejecutar los comandos de este repositorio; ver los pendientes de integración de [Comercialización](COMERCIALIZACION.md).

Ante un fallo, distinguir: defectos del dato técnico se reparan en scraping/preparación; errores de categoría, atributo o metadata emitida se reparan en proyección comercial; restricciones y errores del importador se investigan en el receptor. No introducir IDs o equivalencias por conveniencia ni considerar un JSON exportado prueba de alta en la base de datos.

Ver [Arquitectura](ARCHITECTURE.md), [Reglas de datos](SCRAPER_DATA_RULES.md), [Comercialización](COMERCIALIZACION.md) y [Validación](VALIDATION.md).
