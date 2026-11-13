# Validación y aceptación

## AI GUARD

**Protección documental.** Ninguna IA puede crear, modificar, mover ni eliminar este documento sin autorización explícita del propietario para la intervención documental concreta. Solicitudes de código, pruebas, auditoría o limpieza técnica no autorizan cambios implícitos en la documentación.

**Regla de alcance.** Validar por separado cobertura de extracción, integridad del snapshot técnico, calidad editorial y elegibilidad comercial. Un `PASS` de una capa nunca acredita las otras.

## Qué se valida

Distinguir **integridad de los archivos**, **calidad de las fichas** y **cobertura externa**. Son comprobaciones diferentes: aprobar una no implica aprobar las otras. Los tests del software protegen regresiones, pero tampoco sustituyen la comparación con los anuncios publicados por cada proveedor.

## Verificación técnica tras cambios estructurales

Para cambios del motor editorial o de la arquitectura de pruebas, comprobar adicionalmente los guards **fuera de `npm test`**:

```powershell
node GUARDS/tests-editorial-architecture-guard.mjs
node GUARDS/tests-domain-tests-guard.mjs
node --test GUARDS/tests-architecture-guards.test.mjs
```

Tras la fase 27 ambos guards tenían 0 infracciones, con 19 excepciones exactas y 21 lecturas legítimas acreditadas; esto no sustituye las pruebas funcionales ni prueba `npm test` global. Véanse [Arquitectura de tests](TEST_ARCHITECTURE.md) y [Motor editorial](EDITORIAL_ENGINE.md).

Desde la raíz del proyecto, con dependencias instaladas, ejecutar:

```powershell
npm ci
npm test
npm run build
npm run estado
git status --short
```

Para acreditar una reforma estructural sobre Windows, ejecutar además una batería **sin reutilizar caché**:

```powershell
$env:EQUIPZILLA_TEST_CACHE = "0"
npm test
Remove-Item Env:EQUIPZILLA_TEST_CACHE
npm run build
npm run estado
```

`EQUIPZILLA_TEST_CACHE=0` desactiva la reutilización de resultados; la ejecución ordinaria puede informar suites y tests cacheados. Comprobar `0 fallidos` y el número de suites efectivamente ejecutadas, no solo el total. En Windows puede omitirse la prueba de enlaces simbólicos si el usuario no tiene privilegios para crearlos: es una omisión explícita, no un test aprobado ni un fallo de compilación. Ante cualquier fallo en `npm test`, limpiar la variable de entorno antes de continuar.

`npm test` **ya ejecuta la compilación** antes de lanzar `scripts/run-tests.mjs`: descubre los `.test.ts` de `src/` (que se ejecutan compilados desde `dist/`) y las suites `.test.mjs` de `scripts/`. `npm run build` por separado confirma la compilación explícita. La cantidad de pruebas puede variar al añadir o mover suites; para diagnosticar resultados, ejecutar después del build `node scripts/run-tests.mjs --concurrencia 2` o `node scripts/run-tests.mjs --medicion <informe.json>`. La medición es un informe local generado, no un archivo de catálogo.

Al renombrar archivos o carpetas, comprobar además referencias dinámicas, rutas relativas desde `import.meta.url`, scripts programados, imports dentro de **cadenas que generan TypeScript temporal** y las rutas de prioridad del runner. Un `PASS` de TypeScript no garantiza que esas rutas apunten a los fixtures esperados; las suites de integración deben ejecutarse realmente. En Git, movimientos físicos pueden aparecer como eliminaciones y archivos no rastreados hasta incorporarlos al índice, por lo que se debe inspeccionar el diff antes del commit.

**Cambios exclusivamente documentales:** comprobar enlaces, referencias de rutas y que el ZIP incremental solo contenga documentación; no reinterpretar una ejecución verde anterior como una batería ejecutada de nuevo. Documentar la referencia exacta usada y conservar byte a byte `src/`, `catalogs/`, `data/`, `interventions/`, los scripts y las huellas acreditadas.

**Equivalencia tras refactor de preparación:** comparar con las mismas entradas canónicas la salida íntegra de `prepareSourceProduct` anterior y posterior, incluyendo `product`, `issues` y `status`; verificar por separado originales, manifests, aprobaciones y publicaciones acreditadas. La equivalencia en un conjunto de fichas acredita solo ese conjunto, no cobertura web, una aprobación editorial ni la compatibilidad automática de las huellas. Si cambió `rulesSha256`, no reescribir aprobaciones anteriores: usar el ciclo de preparación/acreditación vigente.

**Huellas de preparación:** `rulesSha256` se obtiene del contenido compilado y de los nombres relativos de módulos del catálogo. Tras cambios estructurales puede variar aunque los datos publicados no hayan cambiado. Verificar la compatibilidad de preparaciones y aprobaciones existentes sin reescribir sus hashes, sin regenerar de forma encubierta `catalogs/` y sin considerar `npm run estado` una acreditación de reglas nuevas. `PASS` de tests, `PASS` de build, integridad de `catalogs/` y aceptación editorial son comprobaciones diferentes.

**Validación del ciclo individual:** ejecutar `npm run catalogo:preparar -- --simular`, `npm run catalogo:publicar -- --simular` y comprobar mediante `npm run estado` los índices de publicación existentes. La simulación no acredita nuevos casos ni activa finales. Una ejecución real de FINISH requiere fuentes y decisiones verificadas; su informe ZIP resume el trabajo original → publicado, no acredita cobertura web ni sustituye el preflight. Ver [Publicación individual](INDIVIDUAL_PUBLICATION.md).

## Validación de publicaciones técnicas independientes

`publicacion:tecnica` acepta `review` para que la incorporación del proveedor y el trabajo editorial avancen en frentes distintos. Sus garantías son **integridad, identidad, procedencia, estados/diagnósticos preservados y retención máxima de dos versiones**; no exige convertir artificialmente las incidencias en `ready`. Manain mantiene el registro `partial`, mientras Gomariz exige original `complete` y preparación vigente. Se valida con una simulación sin escrituras, activación explícita, lectura de `--ver/--listar`, `npm run estado` y `huecos --tecnicas`; ninguna de estas operaciones implica aprobación comercial.

El guard del contrato comercial v2 se ejecuta con `npm run contrato:comercial`, con `npm test` y antes de la exportación. Las auditorías de publicaciones individuales históricas pueden pasar con el origen acreditado por SHA mientras la **exportación comercial del inventario obsoleto debe seguir bloqueada**. En el corte de noviembre de 2026 se constataron once bajas de Gomariz por «Sin existencias» frente a la publicación comercial anterior; requieren reconciliación, no restaurar los originales por conveniencia. Consultar [Publicaciones técnicas](TECHNICAL_PUBLICATIONS.md).

## Responsabilidad productiva ante reviews

La validación identifica fallos; **el trabajo de calidad no termina al encontrarlos**. En una campaña de mejora editorial, ante una preparación con cualquier ficha `review`, el siguiente trabajo del desarrollador es localizar y corregir la causa **en código productivo reutilizable** (extracción, parseo, asociación semántica, normalización, calidad o identidad), siempre que haya evidencia de una transformación segura. Los informes de auditoría, las consultas por ID y las comparaciones son instrumentación interna para esa tarea, no un proceso editorial que deba dirigir el propietario.

**Contrato de ejecución y cierre de una corrección:**

1. Reproducir las reviews con el catálogo canónico íntegro y reglas identificadas; comparar versiones solo cuando se ejecuten **ambas con el mismo criterio**. Nunca interpretar dos motores distintos como una regresión demostrada.
2. Agrupar los motivos internamente, buscar el módulo responsable y definir la transformación segura con contraejemplos; reutilizar primero el motor actual, evitando scripts por ficha y nuevos subsistemas innecesarios.
3. Editar **código que se ejecute en producción**, conservar los datos originales y mantener intactas las comprobaciones de integridad, identidad, cobertura y trazabilidad.
4. Ejecutar pruebas dirigidas por riesgo y build; preparar y validar el **catálogo entero** con las reglas nuevas; comprobar el delta real de reviews, la conservación de productos y las regresiones. Una prueba verde no acredita por sí sola `0 review`.
5. Si quedan reviews atribuibles al motor, continuar implementando correcciones generales. **No cerrar el trabajo con diagnósticos o comandos para que el propietario estudie fichas**. Una contradicción de origen irremediable exige evidencia y decisión editorial; ni se inventa un valor ni se silencia el motivo.

**Aceptación de calidad del catálogo completo:** `0 review` reales en la preparación y validación técnica oficial de **todos** sus productos, sin cambiar estados artificialmente, ignorar campos válidos por conveniencia, retirar máquinas de la muestra o relajar validadores. Si permanece alguna review legítima, el catálogo sigue pendiente de esa meta. Un subconjunto publicable aprobado y un catálogo completamente `ready` son afirmaciones distintas.

## Responsabilidad ante cualquier validación adversa

El sentido de una validación es **dirigir una reparación productiva**, no multiplicar informes. Ante `review`, pérdida de cobertura, incoherencia de manifiesto, regresión, identidad contradictoria o preparación no acreditable, delimitar internamente **qué contrato incumple** y corregir el componente responsable. Las herramientas de contraste deben responder a una hipótesis de ingeniería concreta; no iniciar rondas sucesivas de comandos al operador ni presentarlas como progreso terminado.

**No confundir señales:** `0 fallos` de extracción no significa cobertura web acreditada; `0 review` técnica no significa selección/editorial aprobada; `PASS` de tests no significa calidad de datos demostrada; una exclusión editorial no convierte una review en `ready`; un error real del portal no demuestra una regresión de parser. Cada afirmación de cierre debe indicar **universo evaluado, criterio vigente y resultado efectivo**.

Si una revisión sigue abierta después de una corrección, repetir el ciclo productivo con las causas restantes. Un bloqueo no reparable con la evidencia disponible debe quedar visible, delimitado y trazable, **no maquillado ni transferido como una investigación general al propietario**. Ver [matriz de objetivos por frente](SCRAPER_OBJECTIVES.md#propósito-de-cada-frente-resultado-primero-herramientas-después).


## Qué debe hacer el desarrollador con un resultado de validación

Una salida `REVISIÓN`, `WARN`, una lista de motivos o un delta entre catálogos **no son una instrucción para que el propietario examine fichas**. Si el trabajo autorizado es resolver el problema, el siguiente paso es **editar y probar el motor que lo causa**. Las inspecciones por ID se realizan internamente solo para localizar la causa y construir pruebas de regresión reutilizables; no se convierten en una serie de tareas editoriales individuales.

Si después de un parche quedan reviews, no repetir el diagnóstico como si fuera una fase nueva: continuar por el siguiente patrón corregible del **mismo alcance**. Confirmar que el recuento de productos y la calidad semántica no empeoran. Si el único resultado posible exige alterar una verdad del proveedor o una decisión humana, el bloqueo sigue visible y no se declara cumplimiento. Ver [contrato de actuación transversal](SCRAPER_OBJECTIVES.md#contrato-anti-deriva-comportamiento-obligatorio-del-asistente).


## Acreditación de una mejora: del hallazgo a la publicación y exportación

No basta con que un test del resolutor pase: comprobar **en qué etapa está** el dato. Seleccionar la publicación activa por el mecanismo oficial; comparar original canónico, preparación recalculada, publicación vigente y derivado comercial por proveedor, referencia y `sourceUrl`, no por orden ni por un identificador visible compartido. Para incidencias de extracción, validar la captura completa antes de promover el original; no activar un canónico construido con un subconjunto de URLs.

```powershell
npm run huecos -- --comparar --specs --json
npm run huecos -- --comparar --titulos --json
npm run huecos -- --finales --json
npm run auditar:comercial -- --coherencia
npm run auditar:comercial -- --revision
npm run auditar:comercial -- --acreditacion
npm run exportar:comercial -- --simular
```

Interpretar `technicalSpecs.cases[].stage`: `pendiente_publicacion` indica un cambio preparado no publicado; `perdida_tras_publicacion` exige investigar antes de activar; `diferencia_origen_preparacion` requiere una causa; `reconciliacion_acreditada` documenta una diferencia justificada; `normalizacion_ambigua` exige fuente; `sin_evidencia_directa` es orientativa. `technicalSemantics` observa el significado de valores publicados, no solo presencia de claves. Las señales comerciales **heredadas/controladas** no equivalen a las **introducidas/pendientes**.

Si cambia la preparación, ejecutar los controles formales por proveedor afectado:

```powershell
npm run catalogo:preparar -- --proveedor gam
npm run catalogo:publicar -- --proveedor gam --simular --detalle
npm run catalogo:publicar -- --proveedor gam
npm run estado
```

Comprobar la activación de la publicación, las exclusiones y el diario de FINISH. Una activación verificada con archivado posterior fallido **no** es un FINISH completo: conservar lo publicado y reanudar el mismo recorrido tras resolver el fallo. La exportación comercial real, su manifiesto y el contraste por identidad se ejecutan cuando corresponda; `--simular` no acredita archivos entregados. No modificar originales, huellas, manifiestos ni aprobaciones manualmente.

Para cerrar, proteger un caso positivo, un negativo (variante/huella/proveedor) y las fichas no afectadas. Ejecutar tests del módulo, `npm run build`, `npm test` (incluye guard) y `npm run estado` en el entorno disponible, registrando pruebas omitidas o errores de dependencias sin falsear un PASS. Una reforma del código puede cambiar `rulesSha256` aun si el JSON es equivalente. Véase el [manual de mejora acreditada](CATALOG_IMPROVEMENT.md).

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

El exportador heredado de Excel/JSON conserva sus verificaciones para preparaciones comerciales antiguas, pero rechaza las actuales. Su posible uso excepcional **no forma parte de la aceptación del scraper**. Ver [Integración](EQUIPZILLA_INTEGRATION.md).

La ejecución automática se trata en [Operación y despliegue](AUTOMATED_DEPLOYMENT.md); los contratos están en [Reglas de datos](SCRAPER_DATA_RULES.md).
