# Objetivos funcionales y criterios de aceptación — EQUIPZILLA Scraper

**Decisión de calidad técnica (23/10/2026):** el objetivo del scraper es **obtener el catálogo JSON íntegro y fiable de todas las máquinas identificadas** en GAM, Gomariz y Mercaeleva, tanto `Nuevo` como `Segunda_Mano`. La finalización exige **100 % de máquinas `ready` y 0 `review`**, con evidencia suficiente, sin exclusiones artificiales, sin datos inventados y sin ocultar contradicciones. Si aumenta el catálogo, el 100 % se aplica al nuevo universo real.

**Decisión editorial complementaria (F48, 25/10/2026):** el catálogo canónico sigue siendo íntegro y el objetivo técnico de 0 `review` no se maquilla. Para el **catálogo publicable**, se permiten exclusiones justificadas y trazables cuando un anuncio no alcanza los requisitos de calidad. En esta cohorte se excluyen de la selección las dos Hyster GAM `6682`/`6703` (serie compartida sin titularidad física acreditada) y la Linde Mercaeleva `M827-8304` (capacidad y mástil contradictorios). Se conservan las **1.369 referencias originales** y los indicadores técnicos **1.366 `ready` / 3 `review`**; la selección editorial contiene **1.366 publicables y 3 excluidas**. No se deduplican ni alteran las fichas originales. La selección está limitada por hash a esta cohorte y se invalida si cambian los datos o aparecen revisiones nuevas.

**Separación de responsabilidades:** Excel y `POST /product/create/many` son **vías de importación del backend**, no el formato canónico del scraper ni un criterio de calidad del JSON. Sus validaciones y métricas son **meramente informativas** para el equipo receptor; no deciden qué máquinas se extraen, qué atributos se conservan ni qué patrones se priorizan. El backend y su adaptación quedan fuera del alcance de este trabajo. La documentación del contrato receptor se conserva como referencia histórica/técnica en [EQUIPZILLA_INTEGRATION.md](EQUIPZILLA_INTEGRATION.md); no obliga a reabrir ni revisar su código.

## 1. Resultado que perseguimos

1. **Cobertura total:** descubrir y conservar todas las fichas legítimas y sus identidades, sin perder referencias por paginación, categorías, condición comercial, duplicados mal interpretados o requisitos de un importador.
2. **Datos fieles:** mantener referencia, URL, marca, modelo, condición, imágenes, descripciones, precio y especificaciones que el proveedor publique, con origen trazable y ausencia explícita cuando no exista información.
3. **Normalización demostrable:** recuperar y transformar atributos únicamente con reglas verificables, preservando unidades, semántica y configuraciones; no mezclar altura de trabajo/plataforma/elevación, capacidades de contextos distintos ni equipos de igual modelo.
4. **Calidad auditada:** detectar errores de extracción, mapeos incorrectos, identidad contradictoria, pérdida de atributos y valores ambiguos; identificar para cada `review` su causa real y el patrón que puede resolverla.
5. **Cierre medible:** cero identidades perdidas y ninguna recuperación no acreditada; distinguir el objetivo técnico de 100 % `ready` del cierre editorial de la selección publicable, que puede excluir anuncios sin falsificar `ready/review`. Mantener pruebas y controles de regresión.

**Importante:** alcanzar 0 `review` **no autoriza** a retirar reglas, suprimir incidencias, elegir cifras ambiguas ni fingir que una contradicción se ha resuelto. Si el proveedor no ofrece evidencia suficiente, la ficha permanece en revisión hasta encontrar una resolución legítima. Que falte un precio o atributo exigido por el backend **no demuestra**, por sí solo, un problema de calidad de la extracción.

## 2. JSON del scraper frente a exportaciones para el backend

| Salida                       | Propósito                                                                       | Relación con el objetivo                                         |
| ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `<prefijo>-catalog.json`     | Catálogo canónico con todos los `ProductRecord` y evidencia original disponible | **Fuente de verdad**; nunca filtrar por importabilidad           |
| `<prefijo>-preparation.json` | Productos preparados, campos normalizados, `ready/review` e incidencias         | **Control y mejora de calidad**; conservar todas las identidades |
| `export --format json`       | Generar candidatos adaptados a `POST /product/create/many`                      | **Herramienta del receptor**, no JSON final canónico             |
| Exportación `.xlsx`          | Altas por la vía de importación Excel                                           | **Herramienta del receptor**, sin influencia sobre calidad       |
| Selección editorial F48      | Conjunto publicable de la cohorte acreditada y exclusiones trazables           | **No altera el canónico ni los estados técnicos**               |

Los contratos receptores pueden exigir descripción corta, categoría o atributos específicos e incluso precio en Excel. Una ficha puede contener datos de origen fieles aunque no reúna esas exigencias. El audit puede informar ambos diagnósticos por separado, pero **el contador relevante para cerrar esta campaña es el de calidad del catálogo**. Si una validación actual mezcla calidad con condiciones del receptor, debe investigarse por referencia y corregirse con evidencia; este documento por sí solo **no cambia el comportamiento del código**.

## 3. Estado de referencia y comparaciones

Auditoría aportada el **23/10/2026**, corte de preparación `20261023-162700`, sobre catálogos extraídos el 22/10:

| Proveedor  |  Máquinas |   `ready` | `review` |
| ---------- | --------: | --------: | -------: |
| GAM        |     1.008 |       834 |      174 |
| Gomariz    |       143 |       139 |        4 |
| Mercaeleva |       218 |       208 |       10 |
| **Total**  | **1.369** | **1.181** |  **188** |

Ese corte es una **línea base de trabajo**, no una extracción nueva ni una certificación permanente de las webs. En la campaña anterior se pasó de 1.179/190 a 1.181/188 sin perder identidades. Una comparación contra preparaciones generadas con reglas distintas no demuestra por sí sola recuperaciones ni regresiones.

Las cifras de 20 y 21/10 que aparecen en [ESTADO_EXTRACCIONES_2026-10-20.md](ESTADO_EXTRACCIONES_2026-10-20.md) son históricas. La documentación de continuidad y la auditoría actual guardan el histórico detallado; no se traslada como tarea pendiente a cada campaña nueva.

## 4. Prioridad de trabajo

1. **Investigar los `review` reales:** cruzar ficha de origen, JSON canónico, preparación, mapeadores y diagnóstico de la regla que bloquea; separar contradicción técnica, error recuperable, clasificación sin equivalencia y requisito propio del receptor.
2. **Corregir patrones acreditados:** mejorar extracción, normalización y mapeos con casos positivos y negativos, sin inventar equivalencias ni debilitar controles.
3. **Examinar falsos `ready`:** contrastar discrepancias de identidad y atributos detectadas en fichas que ya pasan, para que el contador sea un indicador fiable.
4. **Medir en la misma cohorte:** identidades preservadas, fichas `review→ready`, regresiones `ready→review`, atributos recuperados y motivos resueltos; solo después usar una extracción nueva cuando aporte evidencia necesaria.

La compatibilidad con Excel o `create/many` **no forma parte de estas prioridades**. Solo se retoma por petición expresa del usuario y como responsabilidad separada.

## 5. Aceptación de los cambios

- Toda modificación del código debe tener evidencia reproducible, pruebas dirigidas y una comparación apropiada de las identidades y atributos afectados.
- Los bloqueos que expresan ambigüedad real no se desactivan para conseguir cifras favorables.
- Se conservan sin filtrado los JSON originales y los productos preparados, incluso mientras sigan en `review`.
- Se respetan contratos públicos, manifests, snapshots y diagnósticos; importación y despliegue no se realizan desde el scraper.
- **Cierre técnico aspiracional:** 1.369 de 1.369 en `ready`, 0 `review`, sin pérdida de cobertura ni datos fabricados. **Cierre editorial actual F48:** 1.366 publicables, 3 excluidas con justificación y 1.369 originales intactas; las 3 exclusiones no cuentan como `ready`. Se revisará la decisión si el origen cambia.

Documentación relacionada: [SCRAPER_DATA_RULES.md](SCRAPER_DATA_RULES.md) (contratos y conservación), [VALIDACION.md](VALIDACION.md) (comprobaciones), [ARQUITECTURA.md](ARQUITECTURA.md) (responsabilidades) y [EQUIPZILLA_INTEGRATION.md](EQUIPZILLA_INTEGRATION.md) (**referencia informativa del receptor**).

## Estado posterior al scraping de octubre de 2026 (F49)

La extracción nueva del 25/10/2026 obtuvo 1.365 referencias (GAM 1.004, Gomariz 143 y Mercaeleva 218), frente a 1.369 históricas. La preparación previa a F49 registró seis `review` (dos Hyster GAM, tres LGMG Gomariz y una Linde Mercaeleva). La F49 introduce una reconciliación técnica acotada para las tres SS0507E de Gomariz, basada en la ficha técnica del fabricante, y un contraste explícito de cobertura `validate --stage catalog --baseline`. Las cuatro referencias GAM ausentes requieren confirmación de origen y no se restauran por arrastre del catálogo histórico. Los contadores de la cohorte nueva deben medirse tras integrar F49; no se consideran validados por el resultado de las pruebas unitarias.


## F50 — cierre de cobertura condicionado a evidencia

La ejecución F49 en el entorno del propietario confirmó 143/143 `ready` para Gomariz, 1.002/1.004 para GAM y 217/218 para Mercaeleva. El total de la extracción del 25/10/2026 es 1.362/1.365 `ready`, tres `review`. GAM tiene cuatro referencias ausentes frente a la cohorte de 1.008 y 24 referencias cambiadas; no se ha acreditado todavía su baja ni la naturaleza de todos los cambios. La aceptación publicable de 1.362 fichas es por ahora una **previsión condicionada**, no una salida final emitida.

F50 mantiene las tres exclusiones editoriales justificadas, distingue las cuatro ausencias y 24 cambios mediante un expediente con hashes y campos, y bloquea los JSON finales de la nueva cohorte mientras no existan decisiones manuales y evidencia para cada discrepancia. Incluye un comando de generación del expediente y una exportación opcional de tres JSON publicables más su trazabilidad. La cohorte histórica F48 permanece compatible. Consultar [VALIDACION.md](VALIDACION.md) para comandos; no se toca backend, Excel ni importación.
