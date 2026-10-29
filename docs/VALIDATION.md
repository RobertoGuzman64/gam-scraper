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
- [ ] Catálogo, manifest, resumen y preparación son consistentes; la preparación actual verifica huellas de **reglas técnicas**, sin exigir snapshots comerciales.
- [ ] Los identificadores de máquina son estables, sin pérdidas o fusiones indebidas.
- [ ] La paginación avanzó realmente y las cantidades y URLs se contrastaron con el portal.
- [ ] Hay muestras de maquinaria nueva y de segunda mano, categorías, galerías y fichas atípicas revisadas.
- [ ] Las ausencias y los cambios relevantes están documentados; no se interpretan automáticamente como venta o retirada.
- [ ] Las contradicciones de marca, modelo, serie, capacidades, medidas o fotografías están resueltas o excluidas editorialmente.
- [ ] Ningún dato desconocido se ha rellenado sin evidencia y el resultado conserva trazabilidad.
- [ ] La selección no genera artefactos definitivos con una revisión pendiente o con huellas incompatibles.

**Controles especialmente importantes:** solapamientos de categorías e identidades GAM; paginación y páginas repetidas en Mercaeleva; múltiples unidades semejantes y ausencia de precios en Gomariz; disponibilidad de páginas, familias originales y cobertura verificable en Manain. Un límite de páginas sirve para diagnóstico, no para acreditar cobertura completa.

## Verificación de catálogos consolidados

Para consultar sin modificar los archivos definitivos y contrastarlos con los operativos:

```powershell
npm run estado
npm run migrar:catalogos
```

`estado` comprueba el trío original conservado en `catalogs/providers/<proveedor>/original/`, la procedencia de las campañas en `catalogs/campaigns/<runId>/`, sus cuatro `publishable.json`, las huellas de aprobación y las diferencias con los originales completos disponibles en `storage/`. También señala conjuntos ausentes, dañados, en promoción pendiente o con más de dos campañas portátiles. **No repara, migra, borra ni examina el índice Git**. La ausencia de `storage/` en una copia limpia no invalida un conjunto portátil íntegro.

`migrar:catalogos` es una **simulación sin escrituras** por defecto. Solo `npm run migrar:catalogos -- --aplicar` incorpora datos verificados; no borra archivos operativos ni acredita campañas nuevas. Los parciales permanecen parciales y las campañas sin entrega verificable no se elevan a entregadas. Ante un error de integridad, una promoción pendiente o una rotación incompatible, detenerse y revisar las fuentes: no editar manifiestos, SHA ni JSON a mano.

Para considerar cerrado un cambio destinado a Git, comprobar el origen, la selección aplicable, las huellas y `estado`; después revisar `git status --short` para incluir los archivos modificados de `catalogs/` en el commit que corresponda. **Ni `npm run estado` ni `npm test` prueban que un commit contenga los datos definitivos**. La validación técnica de una publicación no garantiza por sí sola la cobertura externa del portal.

## Selección editorial

```powershell
npm run seleccionar -- --gam <gam-preparation.json> --gomariz <gomariz-preparation.json> --mercaeleva <mercaeleva-preparation.json> --manain <manain-preparation.json> --simular
```

La simulación informa de publicables, exclusiones y cobertura sin escribir archivos. Cuando la selección detecta un conjunto que requiere control de cobertura, deben proporcionarse `--anterior`, `--catalogo` y `--revision-cobertura` de acuerdo con las reglas productivas. No improvisar el expediente ni copiar aprobaciones de otro origen. Para una salida por proveedor, el comando admite `--directorio-salida` **solo después de acreditar la revisión**.

La selección puede bloquearse **correctamente** aunque la extracción y la preparación técnica hayan terminado sin errores: el bloqueo editorial no es un fallo que deba desactivarse.

## Verificación de la frontera comercial

En las preparaciones canónicas nuevas, validar que `categorySellID` permanezca en `null`, `attributes` sea `[]` y las especificaciones técnicas originales sigan en `spec`. La ausencia de asignación comercial no convierte una ficha en `review`. **La selección acreditada sigue siendo un conjunto de datos, no un request de importación al backend.**

El exportador heredado de Excel/JSON conserva sus verificaciones para preparaciones comerciales antiguas, pero rechaza las actuales. Su posible uso excepcional **no forma parte de la aceptación del scraper**. Ver [Integración](EQUIPZILLA_INTEGRATION.md).

La ejecución automática se trata en [Operación y despliegue](AUTOMATED_DEPLOYMENT.md); los contratos están en [Reglas de datos](SCRAPER_DATA_RULES.md).
