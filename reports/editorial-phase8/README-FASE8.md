# EQUIPZILLA — Fase 8: cobertura editorial y reutilización verificable

**Base:** Fase 7 (`eqz-f7-16e5af.zip`). **Alcance:** cerrar huecos de presentación cuando existen hechos suficientes, mantener la autoridad editorial en preparación y comprobar la reutilización de reglas en máquinas equivalentes. Se entrega el repositorio completo sin alterar las fuentes ni las publicaciones.

## Resultado del barrido reproducido

| Indicador | Fase 7 | Fase 8 |
| --- | ---: | ---: |
| Originales examinados | 1.751 | 1.751 |
| Excepciones de ejecución | 0 | 0 |
| Fichas preparadas | 1.706 | 1.695 |
| Fichas en revisión | 45 | 56 |
| Descripciones cortas vacías | 64 | 11 |
| Descripciones generales vacías | 2 | 2 |
| Fichas preparadas con al menos una descripción vacía | 53 | 0 |

Se modifican textos editoriales de **56 unidades** (54 Gomariz, 2 Mercaeleva): 39 cambian corta y general; 17 solo la corta. **Ningún título** cambia en el barrido. Once unidades anteriormente preparadas pasan a revisión porque no cuentan con evidencia editorial suficiente para completar al menos una descripción. No se genera texto artificial para salvar el estado de preparación.

El detalle exhaustivo está en `01-cobertura-comprobada.json`, `02-fichas-en-revision-por-cobertura.json` y `03-delta-editorial-1751.json`.

## Implementación

1. `editorial-families.ts` identifica en las primeras declaraciones de una fuente verificada familias como tijeras, articuladas, manipuladores, grupos electrógenos y mástiles verticales. La clasificación derivada de la descripción solo se utiliza si falta una corta original y no existe otra familia ya identificada. No se atribuyen características por parecido de fabricante o modelo.
2. `prepared-editorial-source.ts` combina este reconocimiento con el compositor compartido ya existente; preserva los textos individuales firmados y las prioridades declarativas.
3. `editorial-technical-brief.ts` construye una corta sin atribuir familia si la identidad y la URL están validadas y al menos dos medidas técnicas concuerdan entre origen y preparación. Solo usa conceptos explícitos de peso, longitud, anchura y potencia, con límites razonables, y descarta las cantidades discordantes.
4. `editorial-identity-summary.ts` permite extraer la primera frase completa de una **general firmada de la misma unidad**; no se convierte esa frase en regla de modelo ni se hereda a otras unidades.
5. `prepare-product.ts` impone el invariante de calidad: un producto no queda en estado `ready` si no tiene corta y general. Los huecos no resolubles aparecen como motivos de revisión concretos.
6. `editorial-phase8-coverage.test.ts` incorpora pruebas con productos reales, repeticiones de modelo y un supuesto de nueva unidad equivalente; protege identidades, URL, medidas contradictorias y evidencias individuales.

## Lo que no se ha completado

- **11 cortas y 2 generales** siguen vacías. Afectan a 12 unidades, todas en revisión. No se ha relajado la prueba de identidad para fichas con URL no verificable, modelo insuficiente o especificaciones contradictorias.
- Las **14 regresiones históricas editoriales** preexistentes siguen pendientes. No se retiran ni alteran sus expectativas para obtener una batería aparentemente verde.
- La auditoría de las **82 capacidades históricas** sigue abierta donde falta equivalencia semántica por regla o símbolo. La Fase 8 no demuestra el cierre total de la migración de Fase 1.
- La compilación y la batería npm completas requieren instalar las dependencias declaradas del repositorio. Los resultados comprobados de la sesión se desglosan en `04-COMPROBACIONES.md`.

**Decisión arquitectónica:** para futuras unidades del mismo fabricante/modelo se reutiliza la clasificación y composición respaldadas por hechos; una descripción firmada de una unidad no se transfiere a otra ni se inventan atributos a partir de su nombre.
