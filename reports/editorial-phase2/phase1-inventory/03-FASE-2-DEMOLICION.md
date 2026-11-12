# 03 · Fase 2 — Demolición controlada e integral (sin ejecutar en Fase 1)

## Alcance ejecutivo

No será una «Fase 2 de mejorar cuatro plantillas». Será la **sustitución global de los propietarios de reglas editoriales** y la eliminación del modelo de nuevas excepciones TypeScript por ficha. Se permite dejar transitoriamente la rama sin compilar durante la obra; se desaconseja conservar dos motores paralelos para evitar romper pruebas a corto plazo. No se debe publicar ni acreditar contenido nuevo mientras los controles de identidad, hechos y precedencia no estén restaurados.

La lista de trabajo está completamente anclada a inventarios: las **140 rutas editoriales actuales**, sus **símbolos y guardias**, **777 claves literales indexadas**, los **48 módulos externos con posibles efectos textuales** señalados en `05-FRONTERAS-FUERA-EDITORIAL.csv`, la clausura de **343 módulos** de preparación y los pruebas/diagnósticos existentes. Las 48 rutas externas son **candidatas a revisión de efecto**, no todas exigen cambio ni forman parte de los 140 módulos editoriales.

## Operación por responsabilidades (sin dejar una reforma a medias)

### Movimiento A — Inventario congelado y propiedad por regla

Para cada símbolo/condición de los 140 módulos y cada posible mutador externo, completar la clasificación: **origen, hecho, familia/subtipo, composición, saneamiento, acreditación, precedencia o puente**. Documentar los inputs, salidas, condiciones de aplicación, negativas, datos de unidad, y los consumidores del código. Los índices CSV son la cola total; no se empieza por «los ficheros fáciles». Cada regla queda asociada a un único propietario de destino y a un test o control de evidencia.

### Movimiento B — Arrancar de raíz los narradores por proveedor

Partir los resolutores de corta, general y título de GAM (`gam/editorial/{short,general,source,titles,prepared-*}`), Gomariz (`gomariz/editorial/mapping/{short-description,general-description,additional-short-description,editorial-title,prepared-source,...}`) y Mercaeleva (`mercaeleva/editorial/mapping/{descriptions,concise-description,general-description,documented-*,editorial-title,prepared-source,...}`). Extraer **todas** las composiciones de familia, magnitud, energía y contexto a capacidades compartidas. Los archivos de proveedor solo podrán construir/probar hechos y evidencias de su fuente; ningún equipo recibe prosa por pertenecer a uno de los tres proveedores.

Donde exista una descripción «de modelo» se descompone: formato narrativo compartido + hechos de modelo y variante con alcance acreditado; donde exista una corrección «de unidad» se descompone: regla de integridad compartida + prueba y valor de esa unidad. No trasladar frases completas a una tabla común con `reference` como clave de renderizado: eso sería mover, no democratizar las reglas.

### Movimiento C — Reconstruir hechos y familias sin barreras accidentales

Aprovechar `shared/editorial/domain/`, eliminar duplicación de parseos e identidades, ampliar los hechos a todas las familias **que el código actual realmente expresa**. Reinterpretar conceptos técnicos según proveedor (trabajo, plataforma, mástil, carga, peso, alcance, motor, voltaje, horas, año, serie, dimensiones, seguridad). El reconocimiento de familia no exige `/venta/`; la ruta verdadera puede seguir acreditando procedencia. Cuando una familia no tiene respaldo técnico suficiente, la resolución devuelve insuficiencia/incompatibilidad, no una descripción inventada.

### Movimiento D — Desmontar mapas de evidencia y excepciones como código narrativo

Recorrer **todas** las entradas de los ficheros de evidencias (incluidos `gam/editorial/evidence/*.ts`, `gam/editorial/source/verified*`, `gomariz/editorial/evidence/*.ts`, `mercaeleva/editorial/evidence/*.ts`, `shared/editorial/evidence/*.ts` y excepciones embebidas en `models/`). Clasificar hechos de familia, de modelo/variante, de unidad y de origen. Transferir principios y plantillas al dominio; almacenar la parte exacta como evidencia declarativa con firma/procedencia y consumidor genérico. Mantener el rechazo por identidad falsa, digest distinto, combustible incorrecto, dato modelo no aplicable o accesorio opcional.

**No equivalencia aparente:** una descripción verificada para la referencia X no pasa directamente a Y aunque el modelo coincida. Lo que sí pasa es **la regla de composición**, y las prestaciones de modelo acreditadas como comunes a la variante. La misión es que ninguna nueva ficha necesite un `if (reference === "...")` para redactar una prestación reutilizable.

### Movimiento E — Reemplazar la cadena de precedencias y toda salida tardía

Reescribir el dueño de `prepared-editorial-source.ts`, `prepared-editorial-model.ts`, `prepared-editorial-title.ts`, `prepared-editorial-completion.ts` y `verified-editorial-finalization.ts` para seleccionar capacidades comunes y evidencia especial según contrato. Retirar la dependencia funcional de GAM desde los puentes `shared`; mantener solo la interfaz pública de preparación que el resto del repo realmente consume.

**Incluir expresamente** efectos editoriales que hoy suceden en `prepare-product.ts` después de `finalizePreparedEditorial`: Hyster, tractor de arrastre, Modula, título/capacidad, limpieza de marcadores y coherencia. Si se conserva la reconciliación técnica fuera de editorial, el resultado narrativo se resolverá con una única responsabilidad, no una segunda vuelta por ficha.

**No vale** añadir `resolveReusableEditorial` otra vez al final de una cadena de `??` ni mantener una rama antigua como «temporal» sin fecha de extinción. El nuevo selector es la única vía de decisión editorial, con modos claros de conservar origen, componer, enriquecer o rechazar por insuficiencia.

### Movimiento F — Retirar código obsoleto, sin dejarlo conviviendo

Una vez migradas responsabilidades, eliminar resolutores de proveedor que solo redactan, reexports sin responsabilidad, funciones duplicadas, tablas por referencia que ya no sean evidencias y ramas muertas. Cada retirada se respalda con el grafo de consumidores (`07-GRAFO-ALCANCE-EDITORIAL.csv`), sustitución real y pruebas. Las rutas que representan **contrato público** podrán mantenerse como adaptadores de compatibilidad delgados, sin redacción duplicada.

### Movimiento G — Protección mínima de honestidad semántica

Mantener integridad de `record.url`, `sourceDigest`, evidencia de modelo/unidad, condición/variante, conflictos de datos, `ready`/`review` y el esquema comercial. No cambiar originales ni publicaciones activas. Los guards que dependan de `typescript` se ejecutarán **cuando estén disponibles las dependencias**; no declararlos verdes de antemano. El resultado intermedio puede ser rojo, pero se documenta y no se considera cerrado.

### Movimiento H — Entregar estado demolido, deuda explícita para Fases 3+

La Fase 2 termina cuando todas las filas de propiedad están **migradas, aisladas como evidencia o descartadas justificadamente** y no hay dos propietarios de una misma regla. El test/build puede ser una deuda visible de esta operación si así se ha acordado; **nunca se certifica compilación o equivalencia que no se ha probado**. Las siguientes fases se centrarán en reparar contratos/compilación, validar cobertura por cohortes y comparativa editorial, y retocar falsas negativas; **no en volver a escribir reglas particulares**.

## Orden práctico de intervención en la rama

1. Crear propietarias del dominio y la política única de campo; recablear entrada de preparación pronto, en vez de mantener dos motores.
2. Extraer reglas por **familia/concepto** (plataformas, manutención, limpieza, equipos especiales) y después por campo (título/corta/general), migrando a la vez proveedores que compartan semántica.
3. Descomponer todos los `evidence/verified-*` y remates particulares por alcance, sin añadir excepciones nuevas para restaurar snapshots.
4. Retirar las rutas de redacción que queden obsoletas y documentar cada remanente.
5. Ejecutar pruebas focales/guardias disponibles, capturar fallos abiertos y su causa sin maquillar warnings ni aceptar contaminación entre unidades.

Estas operaciones son **un único frente de Fase 2**, no una campaña abierta de enriquecimiento ficha a ficha. Si se parte en commits técnicos, no se declara completada la fase hasta cubrir el inventario entero y los 82 contratos funcionales del mapa.

## Lo que NO pertenece a la demolición

- Reactivar Manain como proveedor editorial por conveniencia; el análisis funcional de F0 lo excluye.
- Cambiar atributos, categorías, especificaciones normalizadas, contrato comercial v2 o backend.
- Publicar o reaprobar catálogos históricos.
- Forzar la igualdad exacta de descripciones en máquinas con hechos o variantes diferentes.
- Convertir números de los tests anteriores en cuotas universales, o simular mejora modificando URLs.
