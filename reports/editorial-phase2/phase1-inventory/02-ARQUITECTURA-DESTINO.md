# 02 · Arquitectura destino: propiedad única de todas las reglas

## Decisión arquitectónica

El motor editorial debe responder a **qué se sabe de la máquina** y **qué se puede afirmar**, no a «qué proveedor conoce esta frase». La regla narradora es compartida por defecto. La procedencia y la evidencia permanecen diferenciadas. **No se toleran ramas de composición editorial por referencia de producto en el código productivo**: las referencias y firmas sólo seleccionan datos/evidencias válidas, nunca una plantilla TypeScript única por ficha.

```text
ProductRecord de fuente REAL
    │
    ├── recuperación y coherencia técnica EXISTENTES
    │
    ├── adaptador GAM / Gomariz / Mercaeleva
    │       └── identidad, categoría de origen, condición, claves, URL, hechos y su procedencia
    │
    ▼
Dominio editorial COMPARTIDO
    ├── conceptos tipados semánticamente y validación de unidades
    ├── familias / subtipos comprobables
    ├── energía, dimensiones, capacidad, seguridad, año/horas de UNIDAD
    ├── hechos documentados de MODELO / VARIANTE, cuando sean aplicables
    └── negativas: contradicción, ausencia, fuente no acreditada
    │
    ├── evidencia declarativa por unidad/modelo/fuente (sin plantillas particulares)
    ▼
Composición compartida por capacidades
    ├── título (identidad/familia/atributos)
    ├── corta (hechos mínimos, admite parciales)
    └── general (cláusulas trazables y sin repetición)
    ▼
ÚNICO selector de precedencia y postprocesamiento
    ├── decisiones explícitas por campo / especialización acreditada
    ├── conserva la salida fuente cuando no hay base para reemplazarla
    ├── conserva gating issues/ready/review
    └── motivo de no aplicación para el auditor
    ▼
PreparedProduct y pipeline comercial vigentes
```

## Ubicaciones propuestas — específicas y vinculadas a rutas existentes

No se crea ninguna API pública ni `enum` con nombres imaginados en Fase 1. Son **rutas destino planificadas** para Fase 2; las firmas internas se diseñarán a partir de `ProductRecord`, `SpecsMap`, `ProductDescriptions`, `SourceEditorialEvidence`, `PreparedProduct` y contratos reales del proyecto.

| Responsable | Ubicación destino propuesta | Qué queda / qué se mueve |
|---|---|---|
| Entrada de preparación | `src/preparation/prepare-product.ts` | Mantener entrada/contratos. Dejar de redactar o reconciliar texto editorial particular aquí; limitarla a orquestar estados, datos y salida. |
| Adaptación proveedor | `src/preparation/{gam,gomariz,mercaeleva}/editorial/source/` | Usar `domain-source.ts` existentes o reubicación equivalente. Interpretar original y evidencias; no escribir prosa de familia. |
| Hechos editoriales | `src/preparation/shared/editorial/domain/facts/` | Ampliar `editorial-facts.ts`, `editorial-source-contract.ts`, `source-measurement.ts`. Separar concepto/unidad/procedencia de strings específicos de cada proveedor. |
| Reconocimiento familia | `src/preparation/shared/editorial/domain/families/` | Unificar `familyOf`, `source-family.ts` y reconocedores de `short/general/title`; familias desacopladas de slugs propios. |
| Plantillas por familia | `src/preparation/shared/editorial/domain/composition/families/` | Tijera, articulada, telescópica, oruga, mástil, manutención, limpieza, almacenaje, especiales; misma regla aplicable a cualquier fuente compatible. |
| Compositores de campo | `src/preparation/shared/editorial/domain/composition/{title,short,general}/` | Sustituir múltiples narradores por proveedor. `editorial-composition.ts` es base existente, no resolución completa. |
| Calidad semántica | `src/preparation/shared/editorial/domain/quality/` | Contradicción, deduplicación, conservación de afirmaciones y saneamiento; particularidades de formato en adaptador de origen. |
| Verificación evidencia | `src/preparation/shared/editorial/mapping/verified-editorial-provenance.ts` y `.../evidence/` | Reutilizar controles reales de digest, URL, identidad, estado y negativos; no fabricar evidencias por semejanza. |
| Datos acreditados | `data/editorial/evidence/{gam,gomariz,mercaeleva}/{source,model,unit}/` **(propuesta, no creada)** | Trasladar las declaraciones individuales de `*/editorial/evidence/` y `verified-*` a conjuntos de evidencia separados por alcance. La representación final depende de los contratos y mecanismos de carga existentes; no se presupone JSON si no encaja. |
| Despacho y precedencia | `src/preparation/shared/editorial/mapping/` | Un solo propietario de selección y finalización. Mantener/adaptar APIs de `prepared-editorial.ts`, `prepared-editorial-source.ts`, `prepared-editorial-title.ts`, `verified-editorial-finalization.ts`. |
| Auditor de capacidad | `src/catalog/diagnostics/editorial-reuse.ts` + pruebas existentes | Medir producción, aplicación, motivo de bloqueo, duplicidad y diferencia de resultado; no publicar afirmaciones falsas. |

La ruta `data/editorial/evidence/...` **no existe todavía** y no se presenta como hecho del repositorio. Es el destino de información individual *propuesto*, no un nuevo contrato impuesto. Si conservar archivos de evidencia TS declarativos es mejor por los tipos/firmas existentes, se admite **si están libres de reglas narrativas por referencia**. La propiedad semántica importa más que la extensión del archivo.

## Pertenencia por ámbito, no por proveedor

- **Familia:** el equipo es una tijera, una carretilla, una barredora; el nombre común, la estructura de frase y el concepto de medición son reutilizables.
- **Subtipo/configuración:** tijera diésel, carretilla GLP, retráctil; restricciones de tipo y atributos de variante. Se reutilizan en otras máquinas del mismo subtipo *si acreditan esa configuración*.
- **Modelo documentado:** datos del fabricante que efectivamente son invariantes para ese modelo y versión. Se hereda la afirmación con su alcance de modelo; no se promete que la unidad lleve un accesorio opcional.
- **Unidad de origen:** año, horas, serie, condición real, ubicación, cambio de horómetro, incidencia y textos con digest de fuente. Esos hechos son unitarios aunque otro anuncio declare el mismo modelo.
- **Fuente:** la posición de una clave o una ruta solo explica procedencia/significado; puede ser distinta entre proveedores. No produce una segunda regla universal.

## Cómo impedir la nueva duplicación

1. **Regla de ubicación:** cualquier función que construya una frase afirmativa aplicable a más de una máquina pertenece al dominio compartido. Un `if (providerId === ...)` sólo es legítimo en adaptador/validación de procedencia, no como único activador de una frase de familia.
2. **Datos, no ramificaciones:** una excepción histórica que describe un valor técnico demostrado se expresa como evidencia con ámbito explícito. Los resolutores de identidad exacta verifican la evidencia; no llevan párrafos completos de redacción ad hoc.
3. **Una propiedad por campo:** un solo coordinador decide qué candidato vive, qué detalle se anexa y cuándo se retiene el original. No se emiten sucesivas generales reconstruidas en GAM, compartido y `prepare-product.ts`.
4. **Compatibilidad semántica:** las claves `Altura de trabajo`, `Altura de elevación (mm)`, `Altura máxima de elevación`, `Capacidad`, `Capacidad de carga (kg)` y `Capacidad máxima de elevación` no se fusionan solo por el valor/unidad; requieren concepto por familia y fuente.
5. **Salida parcial segura:** si hay familia y altura de trabajo pero no carga/alcance, se puede redactar sólo la altura cuando la regla lo permite. Si falta el hecho obligatorio se conserva el fallback. No hay que escribir TS nuevo para salvar la ficha.
6. **Prueba cruzada:** cada nueva capacidad se prueba con un registro real del mismo dominio de otro proveedor o, si no hay fuente compatible, se documenta que aún no se pudo demostrar portabilidad; se conservan negativos de variante/identidad.
7. **Límite estrictamente editorial:** no modificar datos originales, cambios de catálogo, normalización técnica general, taxonomías comerciales, aprobación, publicación ni contrato v2 como efecto colateral del hachazo.

## Priorización de conflictos de diseño detectados

**P0 — Motor común como fallback inalcanzable:** revisar la precedencia actual, especialmente la general tras `record.longDescription`. Aplicar dominio sólo cuando la afirmación está soportada y la política de sustitución permite reemplazar, completar o conservar; no reemplazar todas las generales originales indiscriminadamente.

**P0 — Narradores privados y efectos tardíos:** separar GAM/Gomariz/Mercaeleva en hechos/plantillas/evidencia e incorporar los remates de `prepare-product.ts` al único propietario editorial.

**P0 — Evidencias unitarias mezcladas:** descomponer las entradas de mapa en hechos y cláusulas, con revisión individual de ámbito; no perder hashes o firmas ni generalizar los valores de unidad.

**P1 — Brecha de cobertura:** el núcleo actual sólo incluye cuatro familias y parte de los adaptadores omite magnitudes válidas; extender hechos y familias por orden de tipos, no de fichas.

**P1 — Diagnóstico de compatibilidad:** `analyzeEditorialReuse` ya separa candidata y salida aplicada. Aprovecharlo, pero completar el control de propiedad por campo/capacidad para identificar reglas nuevas bloqueadas, duplicadas o descartadas.
