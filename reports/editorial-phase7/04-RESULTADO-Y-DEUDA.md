# EQUIPZILLA — Fase 7: migración editorial residual

**Base:** repositorio Fase 6 (`eqz-f6-54a456.zip`) y auditoría independiente (`eqz-aud-c7d8f2.zip`). **Entrega:** repositorio completo. Sin actualización ni publicación de catálogos.

## Código migrado a reglas compartidas

1. **RE021 — Tensión de batería corroborada.** `editorial-battery-claims.ts` extrae tensión en voltios únicamente de una especificación de batería explícita y concordante entre fuente y registro preparado, junto con una afirmación no opcional de la descripción original. La regla se consume desde `editorial-source-claims.ts` y no comprueba proveedor, código de unidad ni modelo de fabricante. Rechaza otras tensiones, negaciones, opciones y URL/identidad no verificadas. Pruebas con dos fuentes de proveedores distintos.
2. **RE055 — Compresión conservadora de cortas largas.** `editorial-source-brief.ts` migra la estructura reutilizable del antiguo reequilibrado GAM. Solo actúa sobre una corta original idéntica al texto candidato, identidad y URL corroboradas, y cuando los números y términos técnicos seleccionados del texto descartado ya figuran en la general. No reemplaza evidencias de unidad ni composiciones técnicas preferentes. Se consume desde `prepared-editorial-source.ts`.
3. **Retirada de código sin consumidores:** `src/preparation/shared/editorial/mapping/verified-editorial-composition.ts` se elimina tras comprobar que no posee ningún importador. No se retiran módulos que todavía son utilizados por pruebas históricas.

Estas intervenciones **no acreditan automáticamente la equivalencia completa de RE021/RE055** con todos los supuestos originales. La comprobación de la Fase 1 exige además validar el resto de reglas y negativos. El contenido histórico firmado no se altera ni se generaliza por semejanza.

## Recuperación de integridad del repositorio

La Fase 6 omitió accidentalmente 10 ficheros de `src/catalog/coverage/` que existían en la Fase 5. Se recuperan **byte a byte** desde la Fase 5 y se documentan las diez huellas en `07-archivos-cobertura-recuperados.json`. Faltar estos archivos introducía seis errores TypeScript adicionales; al restaurarlos, el diagnóstico global vuelve a coincidir exactamente con la línea de base de la Fase 6. `capacity-presentation.ts` no se recupera: su retirada sí correspondía a una migración deliberada de la Fase 6.

## Barrido y compatibilidad observada

- **1.751 originales** ejecutados sin excepciones. Estados intactos: **1.706 preparados, 45 en revisión**.
- **9 descripciones cortas** son ahora más concisas; las generales y los títulos no cambian en esas comparaciones. El detalle de referencias consta en `08-delta-editorial-1751.json`.
- Siguen existiendo **64 cortas** y **2 generales** vacías. Esta fase no inventa datos para cubrirlas.
- Las fuentes originales y publicaciones almacenadas son idénticas a F6 en **37/37 archivos de `catalogs/`**.
- El índice de conocimiento conserva **433 evidencias textuales**, **18 títulos firmados** y **391 unidades**. No se han relajado huellas ni admitido las entradas históricas rechazadas sin corroboración.

## Exhaustividad del inventario de Fase 1

La herramienta `npm run editorial:auditar-residual` vuelve a recorrer **82 capacidades, 140 módulos y 1.509 símbolos** del inventario original, registra consumidores de código y exporta tres CSV. El resultado actual clasifica los 140 módulos así:

- 11 alcanzables desde preparación productiva.
- 78 importados solo desde pruebas históricas.
- 37 desconectados de la preparación pero con otras dependencias.
- 14 retirados respecto a Fase 1, incluido uno en esta fase.

**Estos estados son de grafo, no de equivalencia semántica.** Los 1.509 símbolos conservan `equivalencia_demostrada_por_simbolo=no_acreditada_individualmente` hasta obtener pruebas de correspondencia de reglas, decisiones y casos negativos. No se ha proclamado la migración completa de las 82 capacidades; los dos avances están individualizados en `01-82-capacidades.csv`.

## Deuda pendiente

Persisten capacidades parciales, evidencias sin equivalencia validada, 15 registros rechazados por procedencia y 20 generales históricas con firmas discordantes. Los narradores antiguos están desconectados del preparador, pero la equivalencia de todos sus símbolos todavía no está acreditada. Las 14 regresiones editoriales históricas no se han ocultado y deberán tratarse en las siguientes intervenciones; las fichas sin texto también requieren análisis de fuente.

**Conclusión:** la Fase 7 mejora reglas residuales y repara la integridad del repositorio, pero no equivale al cierre definitivo de toda la migración editorial. No deben eliminarse más módulos antiguos sin demostrar su destino semántico y la vigencia de sus pruebas.
