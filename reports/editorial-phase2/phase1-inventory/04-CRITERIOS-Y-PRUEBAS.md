# 04 · Criterios para considerar la demolición **real**, no cosmética

## Requisitos de propiedad y reutilización (puertas de aceptación)

1. **Trazabilidad completa:** 140/140 módulos editoriales actuales y todas las rutas de frontera con mutación editorial real tienen decisión registrada. Para cada exportación y guardia identificada, existe propietario nuevo o justificación de no migración. **No** se confunde 1.025 fragmentos sintácticos con 1.025 reglas únicas.
2. **Sin narración individual TypeScript:** no hay reglas nuevas de descripción por `reference`, serie o URL concreta. El caso individual, cuando esté justificado, es un dato acreditado, una excepción negativa o un hecho de unidad; la frase proviene del compositor aplicable.
3. **Proveedores sin plantillas duplicadas:** los tres adaptadores obtienen y acreditan datos, no replican textos genéricos de tijeras, carretillas, etc. Si una familia nueva aparece en una fuente nueva con hechos compatibles se reaprovecha el mismo compositor.
4. **Un compositor real por campo:** título, corta y general tienen precedencia única y trazable; `prepared-editorial-completion.ts` no sigue llevando escondida la cadena GAM. No hay dos postprocesamientos que puedan pisarse sin política explícita.
5. **Compatibilidad por significado:** pruebas positivas para unidades distintas del mismo modelo/familia y hechos equivalentes, y pruebas negativas para potencia, altura, capacidad, variante, motor, año, serie y fuente incompatibles. La reutilización no depende de un `/venta/` falsificado.
6. **Portabilidad demostrada:** para cada regla transversal con fuentes suficientes, dos productos reales de proveedores diferentes deben activar el mismo patrón y conservar sus propios valores. **Lo relevante es el patrón/contrato, no igualdad literal de salida**.
7. **Sin contaminación de hechos:** una cifra de unidad no aparece en otra sin evidencia válida; los datos de catálogo originales y las publicaciones aprobadas mantienen su integridad.
8. **Sin caídas silenciadas:** un motor capaz de redactar pero desplazado por precedencia se marca como tal en `editorial-reuse`, no se suma a «reglas aplicadas». Un rechazo justificado se distingue de un bloqueo arbitrario.
9. **Deuda cero por duplicidad de motor:** no queda una segunda rama GAM/Gomariz/Mercaeleva que escriba lo mismo; los adaptadores públicos compatibles pueden permanecer pero sin lógica duplicada.
10. **Sin regresión accidental del contrato comercial:** se mantiene `PreparedProduct`, `ProductRecord`, estados de revisión, nombres/tipos de campos de exportación, huellas/aprobaciones y guards. Durante la demolición puede haber compilación rota si la estrategia de fase lo contempla; nunca declarar producto válido sobre datos sin comprobar.

## Matriz de pruebas obligatorias (casos, no expectativas inventadas)

| Ensayo | Positivo esperado | Negativo obligado |
|---|---|---|
| Misma familia; otro proveedor | Estructura de frase reutilizada con datos del nuevo anuncio | No utilizar datos numéricos del primer registro |
| Mismo modelo; otra unidad | Capacidad/documentación de modelo si es invariante y aplicable | No heredar horas, número de serie, accesorios o condición |
| Distinto modelo; misma familia | Regla de altura/carga/energía compartida | No heredar capacidades ni opciones del modelo vecino |
| Misma fuente; ruta distinta | Familia válida reconocida si hechos/identidad bastan | Host alterado o slug falso rechazado |
| Tijera vs articulada vs telescópica vs oruga | Claúsulas según subtipo real | No suponer alcance lateral ni tipo de cesta |
| Plataforma vs carretilla | Altura de trabajo frente a elevación de carga | Rechazar intercambio de magnitudes aunque ambas sean «m» |
| Motor y variantes | Energía solo cuando conste y sea coherente | Diésel/eléctrica/GLP opuestos y textos contradictorios |
| Prestación opcional de fabricante | Contexto documentado, sin atribución unitaria | No afirmar serie, batería, mástil o estabilidad opcionales |
| Calidad y saneamiento | Acortar manteniendo números/propiedades | No borrar afirmación técnica acreditada |
| Precedencia | Candidata aplicada según política; no se duplica | Texto válido pero bloqueado no se reporta como aplicado |
| Revisión/guardas | Los conflictos siguen imponiendo `review` | No sobreescribir con un párrafo que oculte la contradicción |
| Firma/digest | Evidencia exacta aceptada en la unidad correcta | Mutar fuente, digest, URL, condición o modelo causa rechazo |

## Pruebas ya existentes que hay que reutilizar

- `src/preparation/shared/editorial/tests/reusable-editorial-{architecture,consolidation,cross-provider}.test.ts`: demuestra el alcance de las cuatro familias actuales, situaciones de aplicación y negativos.
- `src/preparation/shared/editorial/tests/prepared-editorial-precedence.test.ts`: cadena y salidas históricas.
- `src/catalog/diagnostics/tests/editorial-reuse.test.ts` y `src/catalog/diagnostics/editorial-reuse.ts`: distinción entre texto candidato, texto aplicado y precedencia.
- Tests de descripción corta/general/título por proveedor: conservar sus **hechos acreditados**, actualizar expectativas de arquitectura cuando proceda; no usar snapshots para justificar otra capa privada.
- Tests de procedencia y evidencia `verified-*` y guard comercial/performance oficiales. La ampliación debe ser focal, no un bucle por todas las 1.751 máquinas en cada test nuevo.

## Instrumentación del cierre

Hacer dos conteos **separados**: (a) reglas/capacidades **aplicables y acreditadas** y (b) salidas **efectivamente seleccionadas**. Comparar por proveedor, familia y campo; no normalizar un warning o una generación sin uso como «cobertura». Verificar los originales inmutables con SHA-256; no utilizar snapshots de publicación vieja como si fueran la población actual.

Mantener conjunto descubrimiento (1.288) y reserva F0 (463) separadas hasta la comprobación de generalización. Las cifras y poblaciones corresponden a auditoría F0, no a una nueva ejecución de la Fase 1. La prueba de aceptación debe incluir registro nuevo/no intervenido, negativos con copia temporal y sin alterar fuente ni URL real. Toda diferencia histórica que cambie afirmaciones, estado `ready/review` o identidad se justifica.

## Umbral organizativo

Un cambio editorial futuro se acepta solo si puede describirse como «hecho con procedencia», «regla de familia/subtipo», «composición común», «calidad» o «excepción evidencial». **No existe una categoría autorizada “añadir if de referencia para rellenar ficha”**. Si hay una excepción válida repetida en varios modelos, se extrae a regla compartida antes de extenderla.
