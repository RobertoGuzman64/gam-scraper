# Validación y aceptación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

## Qué se valida

Distinguir **integridad de los archivos**, **calidad de las fichas** y **cobertura externa**. Son comprobaciones diferentes: aprobar una no implica aprobar las otras. Los tests del software protegen regresiones, pero tampoco sustituyen la comparación con los anuncios publicados por cada proveedor.

## Operaciones sin alterar datos originales

```powershell
npm run ayuda -- validar
npm run validar -- gam
npm run validar -- gam --etapa catalogo --origen <catalogo-catalog.json>
npm run validar -- gam --etapa preparacion --preparacion <producto-preparation.json> --origen <catalogo-catalog.json>
npm run cobertura -- --anterior <anterior-catalog.json> --actual <actual-catalog.json> --simular
```

En validación, `--etapa catalogo` revisa el catálogo publicado; `--etapa preparacion` revalida la preparación offline contra el origen y las reglas vigentes. Sin `--etapa`, se aplica el modo de publicación compatible con el flujo original, incluido su límite de antigüedad. La ayuda específica muestra los argumentos adicionales.

| Código de salida del validador | Significado                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `0`                            | Comprobación conforme para ese modo.                                                   |
| `2`                            | Existen incidencias que requieren revisión manual, incluidas diferencias de cobertura. |
| `1`                            | Error técnico, argumentos incorrectos o datos inconsistentes.                          |

El modo de simulación **no crea informes ni cambia decisiones**. La escritura del expediente usa `--salida <revision.json>` en `cobertura`, sin `--simular`, y crea el archivo de manera exclusiva. Al corregir decisiones, conservar la misma pareja de catálogos y sus hashes.

## Lista de aceptación de una extracción

- [ ] El proceso finalizó sin sustituir una publicación válida por artefactos parciales.
- [ ] Catálogo, manifest, resumen, snapshots y preparación son consistentes.
- [ ] Los identificadores de máquina son estables, sin pérdidas o fusiones indebidas.
- [ ] La paginación avanzó realmente y las cantidades y URLs se contrastaron con el portal.
- [ ] Hay muestras de maquinaria nueva y de segunda mano, categorías, galerías y fichas atípicas revisadas.
- [ ] Las ausencias y los cambios relevantes están documentados; no se interpretan automáticamente como venta o retirada.
- [ ] Las contradicciones de marca, modelo, serie, capacidades, medidas o fotografías están resueltas o excluidas editorialmente.
- [ ] Ningún dato desconocido se ha rellenado sin evidencia y el resultado conserva trazabilidad.
- [ ] La selección no genera artefactos definitivos con una revisión pendiente o con huellas incompatibles.

**Controles especialmente importantes:** solapamientos de categorías e identidades GAM; paginación y páginas repetidas en Mercaeleva; múltiples unidades semejantes y ausencia de precios en Gomariz. Un límite de páginas sirve para diagnóstico, no para acreditar cobertura completa.

## Selección editorial

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --simular
```

La simulación informa de publicables, exclusiones y cobertura sin escribir archivos. Cuando la selección detecta un conjunto que requiere control de cobertura, deben proporcionarse `--anterior`, `--catalogo` y `--revision-cobertura` de acuerdo con las reglas productivas. No improvisar el expediente ni copiar aprobaciones de otro origen. Para una salida por proveedor, el comando admite `--directorio-salida` **solo después de acreditar la revisión**.

La selección puede bloquearse **correctamente** aunque la extracción y la preparación técnica hayan terminado sin errores: el bloqueo editorial no es un fallo que deba desactivarse.

## Exportación e importación

La generación opcional de Excel o JSON para el backend tiene un control separado. Antes de exportar se requiere `companyID` real, inventario completo de la misma empresa y revisión del plan. `--simular` no escribe; `--confirmar-inventario` permite producir el artefacto, pero **no importarlo**. No interpretar un plan de altas como autorización para crear, actualizar o borrar máquinas.

La ejecución automática se trata en [Operación y despliegue](AUTOMATED_DEPLOYMENT.md); los contratos están en [Reglas de datos](SCRAPER_DATA_RULES.md).
