# EQUIPZILLA — FASE 1 · AUDITORÍA PARA LA DEMOLICIÓN EDITORIAL

**Corte del código:** `gam-scraper-develop.zip` recibido para este encargo (SHA-256: `ce405c5efcedda8883871bbce21e62ddfbef230a9981c2ee6c2c8e3a508cd796`).  
**Evidencia previa:** `eqz-f0-fe5885.zip` y `eqz-ag-d619422.zip`.  
**Entrega:** documentación + inventarios reproducibles. **Cero archivos del repositorio modificados.**

## Dictamen

**Sí: es viable construir un motor editorial reutilizable por familias, hechos y capacidades.** La estrategia de escribir código específico cada vez que entra una máquina ya no debe ser la ruta normal. Se necesita una sustitución deliberada del motor editorial existente, **no otra capa de fallbacks** ni una mera mudanza de carpetas.

**La premisa técnica que no se puede omitir:** que dos máquinas compartan modelo **no significa** que compartan año, horómetro, matrícula/serie, combustible real, mástil, accesorios, capacidad residual o estado de la unidad. Deben reutilizarse todas las **reglas generales aplicables** y las **afirmaciones acreditadas a nivel de modelo y variante**, pero un dato verificado *solo* para una unidad continúa restringido a esa unidad. Esta diferencia no legitima duplicar la redacción: la regla común debe componer con los hechos que correspondan; la evidencia exacta solo proporciona hechos válidos y restricciones.

## Hallazgos que cambian el enfoque

1. El repositorio actual **no es el mismo ZIP de código** que se usó en las auditorías anteriores. El inventario complementario describía 130 módulos productivos en `*/editorial/**` más cinco puentes externos. Ahora existen **140 módulos productivos editoriales**, con **10 rutas editoriales nuevas**. Los cinco puentes externos siguen existiendo y **no se han borrado**: simplemente quedan fuera del conjunto de 140. Véanse `01-INVENTARIO-TOTAL-EDITORIAL-140.csv` y `07-GRAFO-ALCANCE-EDITORIAL.csv`.
2. Ya hay un núcleo común (`shared/editorial/domain/`) de seis módulos. Tiene reconocimiento acotado a cuatro familias: plataforma de tijera, articulada, telescópica y carretilla elevadora. Su existencia **no equivale** a tener migradas las reglas históricas.
3. La composición común aparece **al final** de las alternativas en `prepared-editorial-source.ts` para algunos campos. En particular, para general aparece después de `record.longDescription`, y para corta detrás de varios resolutores, el origen y otras prioridades. Hay fichas en las que genera texto válido pero la preparación real selecciona otro. Un test existente lo demuestra explícitamente para Mercaeleva (`reusable-editorial-cross-provider.test.ts`).
4. El proveedor aún condiciona gran parte de la narración. `prepared-editorial-model.ts` delega en GAM y `prepared-editorial-completion.ts` reexporta GAM. `gam/editorial/prepared-completion.ts` todavía concentra una cadena de composiciones por proveedor, familia y evidencia. El motor no tiene un único propietario de la redacción.
5. Persisten barreras históricas. `gomariz/editorial/mapping/source-family.ts` solo reconoce la estructura `/venta/...`, mientras el nuevo `gomariz/editorial/mapping/domain-source.ts` admite rutas válidas adicionales. Esto crea **dos interpretaciones coexistentes**: no se ha resuelto la elegibilidad de todas las reglas antiguas.
6. Hay texto editorial oculto fuera de `editorial/`: por ejemplo `prepare-product.ts`, `gam/identity/mapping/crossed-identity-editorial.ts`, `gam/technical/reconciliation/gam-source-capacity-summary.ts`, `gam/technical/reconciliation/gam-verified-capacity-coherence.ts` y otros reconciliadores. No basta con tocar los directorios editoriales.
7. Los ficheros de evidencia literal registran un gran volumen de conocimiento y correcciones **firmadas**. El índice sintáctico enumera **777 claves de mapas evidenciales** (720 textos de clave distintos; **no** implica 777 reglas ni 720 unidades diferentes). Hay que convertir el contenido técnico reusable de esas entradas en hechos/reglas por ámbito, y separar la parte que solo acredita unidades concretas. No se debe eliminar el respaldo por hash/referencia/URL ni atribuir datos sin verificar.
8. La extracción estática detecta 173 declaraciones exportadas y 1.025 líneas con indicadores de condiciones/precedencia, más 212 módulos externos a `editorial/` que mencionan campos o funciones relacionados con textos. Estos números son **cobertura de búsqueda**, no una afirmación de que todos sean reglas de negocio diferentes.

## Qué demuestra el inventario, qué no

- **Sí:** 140/140 módulos editoriales productivos en la clausura de imports de `prepare-product.ts`; rutas, funciones expuestas, puntos de condición, propiedad funcional preliminar y destino de demolición documentados. La clausura completa de producción desde esa entrada contiene 343 módulos TS, incluidos 203 externos a `editorial/`. El catálogo exhaustivo de dependencias está adjunto.
- **Sí:** los tres originales canónicos mantienen las huellas SHA-256 de Fase 0: GAM 983, Gomariz 547 y Mercaeleva 221 (**1.751** registros totales). Las publicaciones activas antiguas no se han tocado.
- **No:** no se ha demostrado ejecución end-to-end de la nueva arquitectura, ni se ha ejecutado la suite oficial en este entorno. Falta `typescript` en dependencias instaladas y el guard de rendimiento abortó por `ERR_MODULE_NOT_FOUND` al iniciarse. No se presentará ese resultado como `PASS`.
- **No:** 777 entradas de mapa **no son** 777 reglas generalizables; tampoco se presume que todas las 377 rutas Gomariz fuera de `/venta/` sigan sin texto tras los cambios de código: la cifra 377 pertenece a la línea base anterior. Tampoco se declara automáticamente que los 212 módulos externos sean reglas editoriales.

## Decisión de Fase 1

**Preparado el perímetro para la Fase 2: demolición por sustitución de responsabilidades.** No más código narrativo por referencia. Cualquier excepción individual aceptada deberá ser **evidencia declarativa acotada**; si expresa una ley general del tipo de máquina, esa ley vive en el dominio compartido y se aplica a todos los hechos compatibles. Romper temporalmente la rama durante la reforma es aceptable; **publicar fichas falsas, perder procedencia o alterar contratos vigentes no lo es**.

## Índice del paquete

- `01-MAPA-DE-LAS-REGLAS.md`: mapa por familia, concepto, especialización, evidencias y flujos; ejemplos exactos del código.
- `02-ARQUITECTURA-DESTINO.md`: propietarios, ubicaciones propuestas, reglas de compatibilidad y frontera con proveedores.
- `03-FASE-2-DEMOLICION.md`: secuencia concreta para sustituir TODO el motor, incluidos remates escondidos.
- `04-CRITERIOS-Y-PRUEBAS.md`: criterios de cierre, matrices positiva/negativa y detección de duplicados.
- `05-TRAZABILIDAD-Y-LIMITACIONES.md`: conteos, procedencia, diferencia con auditorías y límites de ejecución.
- `01-INVENTARIO-TOTAL-EDITORIAL-140.csv`: **cada** fichero editorial productivo, decisión, destino, símbolos, huella y controles.
- `02-INVENTARIO-SIMBOLOS.csv`: declaraciones exportadas e internas que deben atribuirse a propietario; las internas incluyen utilidades/datos, no solo reglas.
- `03-GUARDIAS-Y-PRECEDENCIAS.csv`: líneas candidatas de decisión con ruta/línea y destino preliminar.
- `04-CLAVES-DE-EVIDENCIA.csv`: índice de claves literales de mapas evidenciales con origen exacto.
- `05-FRONTERAS-FUERA-EDITORIAL.csv`: 212 módulos que necesitan clasificación de frontera; incluye falsos positivos identificables.
- `06-METRICAS-INVENTARIO.json`: cifras y huellas verificables.
- `07-GRAFO-ALCANCE-EDITORIAL.csv`: imports y consumidores de los 140 módulos.
- `08-DEPENDENCIAS-DE-PREPARACION.csv`: los 343 módulos TS alcanzables por imports desde preparación.
- `09-MATRIZ-CAPACIDADES-COMPARTIDAS.csv`: catálogo operativo de capacidades, hechos mínimos, negativas y destino por ámbito.

**Advertencia operativa:** los CSV generados a partir de sintaxis constituyen una red de localización, no una prueba semántica automática de cada `if`, cada texto y cada módulo externo. La Fase 2 debe cerrar todas sus filas con una decisión rastreable; las decisiones se toman examinando el cuerpo real, no por nombre del fichero.
