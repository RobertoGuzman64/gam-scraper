# Validación y aceptación de catálogos y entregas

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Un PASS de una capa nunca acredita otra: cobertura externa, integridad de snapshot técnico, calidad editorial, publicación acreditada y elegibilidad comercial se verifican por separado. Una exclusión no equivale a `ready` y una exportación no demuestra importación en el backend.

**Propietario:** criterios de aceptación y comprobaciones de extracción, normalización, preparación, publicación y exportación. Las políticas de desarrollo y diseño de suites viven en [Pruebas y guards](TESTING.md); los pasos operativos en sus documentos propietarios.

## Qué se valida

Distinguir **integridad de los archivos**, **calidad de las fichas** y **cobertura externa**. Son comprobaciones diferentes: aprobar una no implica aprobar las otras. Los tests del software protegen regresiones, pero tampoco sustituyen la comparación con los anuncios publicados por cada proveedor.

## Validación de cambios en normalización GAM

La normalización tiene puertas independientes de las publicaciones. Ejecutar sus suites del dominio, CSV y seed con las dependencias del proyecto; verificar tanto formatos válidos como casos de rechazo. Para probar el CLI usar **archivos temporales**, comparar las salidas previas después de un fallo y confirmar el código de salida no cero. `--allow-unknown` solo permite claves desconocidas: **no** corrige `specJson` inválido ni autoriza colisiones entre alias. El informe debe conservar motivo, fila y referencia, sin promocionar un atributo desconocido ni interpretar alternativas/multiplicadores como cantidades.

En cambios productivos comparar todas las máquinas originales relevantes y las preparaciones antes/después, separando deltas de `specJson` de deltas en `PreparedProduct`. Conservar catálogos, manifests, publicaciones y huellas acreditadas; un censo estable tampoco acredita `npm test` global. Véanse [Reglas de datos](DATA_CONTRACTS.md) y [Arquitectura de tests](TESTING.md).

## Validación de publicaciones técnicas independientes

`publicacion:tecnica` acepta `review` para que la incorporación del proveedor y el trabajo editorial avancen en frentes distintos. Sus garantías son **integridad, identidad, procedencia, estados/diagnósticos preservados y retención máxima de dos versiones**; no exige convertir artificialmente las incidencias en `ready`. Manain mantiene el registro `partial`, mientras Gomariz exige original `complete` y preparación vigente. Se valida con una simulación sin escrituras, activación explícita, lectura de `--ver/--listar` y `npm run estado`. `huecos --tecnicas` puede ejecutarse después, bajo demanda, para diagnosticar contenido; no forma parte de la activación. Ninguna de estas operaciones implica aprobación comercial.

El guard del contrato comercial v2 se ejecuta con `npm run contrato:comercial`, con `npm test` y antes de la exportación. Las auditorías de publicaciones individuales históricas pueden pasar con el origen acreditado por SHA mientras la **exportación comercial del inventario obsoleto debe seguir bloqueada**. En el corte de noviembre de 2026 se constataron once bajas de Gomariz por «Sin existencias» frente a la publicación comercial anterior; requieren reconciliación, no restaurar los originales por conveniencia. Consultar [Publicaciones técnicas](PUBLICATIONS.md).

## Qué debe hacer el desarrollador con un resultado de validación

Una salida `REVISIÓN`, `WARN`, una lista de motivos o un delta entre catálogos **no son una instrucción para que el propietario examine fichas**. Si el trabajo autorizado es resolver el problema, el siguiente paso es **editar y probar el motor que lo causa**. Las inspecciones por ID se realizan internamente solo para localizar la causa y construir pruebas de regresión reutilizables; no se convierten en una serie de tareas editoriales individuales.

Si después de un parche quedan reviews, no repetir el diagnóstico como si fuera una intervención independiente: continuar por el siguiente patrón corregible del **mismo alcance**. Confirmar que el recuento de productos y la calidad semántica no empeoran. Si el único resultado posible exige alterar una verdad del proveedor o una decisión humana, el bloqueo sigue visible y no se declara cumplimiento. Ver [contrato de actuación transversal](CATALOG_QUALITY.md#contrato-anti-deriva-comportamiento-obligatorio-del-asistente).

## Acreditación de una mejora: del hallazgo a la publicación y exportación

No basta con que un test del resolutor pase: comprobar **en qué etapa está** el dato. Seleccionar la publicación activa por el mecanismo oficial; comparar original canónico, preparación recalculada, publicación vigente y derivado comercial por proveedor, referencia y `sourceUrl`, no por orden ni por un identificador visible compartido. Para incidencias de extracción, validar la captura completa antes de promover el original; no activar un canónico construido con un subconjunto de URLs.

Para investigar y medir una mejora autorizada, seleccionar las consultas de desarrollo pertinentes. No son pasos de FINISH ni sustituyen las comprobaciones formales de acreditación, integridad o contrato comercial.

```powershell
npm run normalizar:auditar
npm run huecos -- --comparar --specs --json
npm run huecos -- --comparar --titulos --json
npm run huecos -- --finales --json
npm run auditar:comercial -- --coherencia
npm run auditar:comercial -- --revision
npm run auditar:comercial -- --acreditacion
```

Cuando el cambio afecte a la salida comercial, comprobar además su preflight:

```powershell
npm run exportar:comercial -- --simular
```

En `normalizar:auditar`, verificar la cobertura y procedencia de las tres etapas antes de comparar resultados. El código 1 por fuentes ausentes o incompletas impide declarar completa esa auditoría, no altera la publicación vigente. La igualdad del parser no demuestra equivalencia técnica universal; los grupos y sus fichas candidatas son oportunidades de investigación. Comparar el impacto antes/después sobre poblaciones conciliadas y comprobar valores, condiciones y procedencias, no solo contadores. Consultar [Diagnóstico de normalización técnica](CATALOG_QUALITY.md#diagnóstico-de-normalización-técnica).

Interpretar `technicalSpecs.cases[].stage`: `pendiente_publicacion` indica un cambio preparado no publicado; `perdida_tras_publicacion` exige investigar antes de activar; `diferencia_origen_preparacion` requiere una causa; `reconciliacion_acreditada` documenta una diferencia justificada; `normalizacion_ambigua` exige fuente; `sin_evidencia_directa` es orientativa. `technicalSemantics` observa el significado de valores publicados, no solo presencia de claves. Las señales comerciales **heredadas/controladas** no equivalen a las **introducidas/pendientes**.

Si cambia la preparación, ejecutar los controles formales por proveedor afectado:

```powershell
npm run catalogo:preparar -- --proveedor gam
npm run catalogo:publicar -- --proveedor gam --simular --detalle
npm run catalogo:publicar -- --proveedor gam
npm run estado
```

Comprobar la activación de la publicación, las exclusiones y el diario de FINISH. Una activación verificada con archivado posterior fallido **no** es un FINISH completo: conservar lo publicado y reanudar el mismo recorrido tras resolver el fallo. La exportación comercial real, su manifiesto y el contraste por identidad se ejecutan cuando corresponda; `--simular` no acredita archivos entregados. No modificar originales, huellas, manifiestos ni aprobaciones manualmente.

Para cerrar, proteger un caso positivo, un negativo (variante/huella/proveedor) y las fichas no afectadas. Ejecutar tests del módulo, `npm run build`, `npm test` (incluye guard) y `npm run estado` en el entorno disponible, registrando pruebas omitidas o errores de dependencias sin falsear un PASS. Una reforma del código puede cambiar `rulesSha256` aun si el JSON es equivalente. Véase el [manual de mejora acreditada](CATALOG_QUALITY.md).

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
- [ ] Para declarar el catálogo completo `ready`, su validación oficial acredita **0 reviews sobre todo el universo original**, sin excepciones maquilladas ni exclusiones presentadas como conversiones a `ready`.
- [ ] Los identificadores de máquina son estables, sin pérdidas o fusiones indebidas.
- [ ] La paginación avanzó realmente y las cantidades y URLs se contrastaron con el portal.
- [ ] Hay muestras de maquinaria nueva y de segunda mano, categorías, galerías y fichas atípicas revisadas.
- [ ] Las ausencias y los cambios relevantes están documentados; no se interpretan automáticamente como venta o retirada.
- [ ] Las contradicciones de marca, modelo, serie, capacidades, medidas o fotografías imputables al software se han corregido en el motor; las contradicciones genuinas del origen permanecen visibles y pueden tratarse editorialmente sin considerarlas `ready` ni contar una exclusión como `0 review`.
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

El exportador heredado de Excel/JSON conserva sus verificaciones para preparaciones comerciales antiguas, pero rechaza las actuales. Su posible uso excepcional **no forma parte de la aceptación del scraper**. Ver [Integración](COMMERCIAL_EXPORT.md).

La ejecución automática se trata en [Operación y despliegue](OPERATIONS_AND_MAINTENANCE.md); los contratos están en [Reglas de datos](DATA_CONTRACTS.md).
