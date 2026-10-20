# Estado validado y auditoría de extracciones — 20/10/2026

**Naturaleza:** informe de la muestra real del 20/10/2026, no inventario vivo ni certificación de producción. Fuente: CSV, JSON de preparación y resumen facilitados tras ejecutar el scraper, con hashes SHA-256 coincidentes. Para incidencias por referencia consultar el archivo externo `INCIDENCIAS_IMPORTACION_431.csv` de esa auditoría; **no se incluye dentro del repositorio de código**.

## Resumen ejecutivo

| Proveedor | Fichas del CSV | URL únicas | Referencias únicas | `ready` | `review` | Estado técnico informado |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| GAM | 268 | 268 | 268 | 16 | 252 | `complete` |
| Gomariz | 143 | 143 | 143 | 0 | 143 | `complete` |
| Mercaeleva | 20 | 20 | 20 | 0 | 20 | `complete`, **pero cobertura real incompleta** |
| **Total** | **431** | **431** | **431** | **16** | **415** | No apto para importación masiva |

**La ausencia de fallos de extracción registrados (`failures=0`) solo indica que se procesaron las URLs descubiertas; no garantiza que se descubrieran todas las del portal.**

## Cobertura y duplicados

- **GAM:** 7 raíces configuradas; 268 fichas únicas en el agregado. La raíz `maquinaria` solapa las categorías específicas, por lo que hubo 520 lecturas de ficha y 252 duplicidades entre rutas. No son 520 máquinas distintas.
- **Gomariz:** 143 URLs únicas; la paginación detectó productos nuevos incluso después de páginas sin novedades. Los títulos de modelos se repiten porque pueden existir **unidades distintas**.
- **Mercaeleva:** 20 fichas encontradas en la primera página; las consultas de páginas 2 y 3 no añadieron ninguna y el scraper detuvo el recorrido. El portal público mostraba **221 resultados distribuidos en 12 páginas en la comprobación del 20/10/2026**; solo se capturó aproximadamente el 9 %. Esta cifra es puntual y podrá cambiar cuando cambie el inventario del vendedor. **Bloqueante de producción P0**.

## Cobertura de campos — valores no vacíos

| Campo | GAM (268) | Gomariz (143) | Mercaeleva (20) |
| --- | ---: | ---: | ---: |
| Título / referencia / URL | 268 | 143 | 20 |
| `price` | 267 | 0 | 15 |
| `brand` | 264 | 143 | 20 |
| `model` | 265 | 134 | 20 |
| `year` | 268 | 140 | 19 |
| `location` | 266 | 0 | 0 |
| `country` | 267 | 0 | 0 |
| `horometer` | 246 | 0 | 19 |
| `serialNumber` | 262 | 0 | 0 |
| Imagen principal / `specJson` | 268 | 143 | 20 |

La presencia de texto no certifica que sea correcto. No se han verificado individualmente todas las fotografías ni cada valor técnico contra el fabricante.

## Hallazgos priorizados

### P0 — Mercaeleva: paginación y control de cobertura

La paginación programada (`?page=N`) no logró avanzar sobre los primeros 20 resultados. El sistema marcó `complete` de forma errónea **desde el punto de vista de la cobertura externa**. Es preciso inspeccionar la navegación real (estado de frontend/API), contrastar páginas inicial, intermedia y final, y bloquear la publicación si el total recuperado no concuerda con un total disponible/consistente.

### P1 — Correspondencia con la taxonomía de Equipzilla

En GAM, 165 fichas tienen una categoría sin correspondencia inequívoca; otras carecen de atributos obligatorios. Gomariz y Mercaeleva conservan una raíz genérica `venta`, que no permite mapear de manera fiable a la categoría hoja del backend. **16 registros `ready` de GAM son bicicletas/ciclomotores/motocicletas eléctricas, no maquinaria industrial**. `ready` es solo un resultado local de preparación, no autorización de negocio.

### P1 — Precio de Gomariz y atributos GAM

- Gomariz: 143/143 productos sin precio público («Ver precio»). No asignar precios ficticios ni cambiar el contrato del backend sin decisión de negocio.
- GAM: 42/268 tienen claves técnicas sospechosas (`4880`, `1930`, `1,22X0,76`, `SI`), posiblemente valores tomados como etiquetas. Reparar y cubrir con regresión.

### P2 — Imágenes y descripciones

- GAM: una imagen registrada por ficha; comprobar si la web ofrece más.
- Gomariz: galerías extensas; 128/143 fichas con más de diez URLs. El Excel admite como máximo diez; conservar el origen completo y elegir conscientemente.
- Mercaeleva: URLs de tamaño medio y miniaturas del mismo contenido; deduplicar variantes de resolución si procede.
- Gomariz y Mercaeleva repiten con frecuencia la misma descripción en `shortDescription`/`longDescription` por limitación de la fuente.

## Próxima iteración propuesta (sin tocar el backend)

1. **Paginación Mercaeleva + control de cobertura.** Reextraer contra el total externo y no declarar `complete` si hay discrepancia.
2. **Mapeo industrial Equipzilla.** Categorías hoja, atributos requeridos y actualización consciente de snapshots de catálogo.
3. **Saneamiento de campos.** Especificaciones GAM, fotos Mercaeleva, precios Gomariz como `review`, casos editoriales anómalos.
4. **Regresión y nueva auditoría end-to-end.** Ejecutar las tres compañías, comparar con las fuentes, validar hashes/snapshots y ensayar Excel en **dry-run** con IDs e inventario reales.

**Criterio de salida:** esta auditoría no se considera aceptación de producción. Antes de automatizar una importación hace falta una prueba con el importador real en entorno autorizado y un mecanismo persistente y seguro para resultados/snapshots.
