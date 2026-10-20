# Fase 7 — Protocolo de validación y aceptación previa a producción

**Actualizado el 20/10/2026 tras analizar extracciones reales de GAM, Gomariz y Mercaeleva.**

## 1. Alcance y punto de partida

La cadena existente es **extracción → CSV + JSON de preparación → revisión → exportación manual de Excel de altas**. `npm run scrape:all` permite ejecutar los tres proveedores, pero no inicia ni controla la importación a `Marketplace-Back`. El contrato del backend se mantiene intacto.

Los resultados de referencia, con cero fallos de extracción reportados, son **268 GAM, 143 Gomariz y 20 Mercaeleva**. **No son tres catálogos aceptados**: el portal de Mercaeleva mostraba 221 máquinas y el scraper solo detectó las primeras 20; además 415/431 candidatos están en `review`. Ver [estado real](ESTADO_EXTRACCIONES_2026-10-20.md).

## 2. Puerta de entrada: instalación y pruebas locales

```bash
npm ci
npm test
npm run build
```

Comprobar que **ningún test de parser con Cheerio** se omite. Los tests usan fixtures: un resultado verde no demuestra paginación real ni disponibilidad de imágenes. Verificar la instalación de Chrome/Chromium para Mercaeleva y el espacio de escritura en `storage/`.

## 3. Diagnóstico aislado y captura real

Los ejemplos cortos se usan solo para inspeccionar HTML; el límite de páginas no autoriza producción:

```bash
npm run scrape -- --provider gam --categoryKey elevacion --outPrefix prueba-gam-elevacion
npm run scrape -- --provider gomariz --maxPages 2 --outPrefix prueba-gomariz
npm run scrape -- --provider mercaeleva --maxPages 2 --outPrefix prueba-mercaeleva
```

Una vez corregidos los problemas conocidos, ejecutar **sin `--maxPages` artificial**, usando prefijos separados de cualquier ejecución productiva:

```bash
npm run scrape -- --provider gam --outPrefix validacion-gam
npm run scrape -- --provider gomariz --outPrefix validacion-gomariz
npm run scrape -- --provider mercaeleva --outPrefix validacion-mercaeleva
```

**Comprobación obligatoria de cobertura por proveedor:**

- Comparar número de resultados con contador del portal o recorrido manual reproducible.
- Verificar listados **primera, intermedia y última página** y detectar repetición involuntaria de la primera.
- Contrastar URLs y referencias reales sin confundir unidades del mismo modelo ni contar dos veces el catálogo general de GAM.
- En Gomariz, confirmar que las páginas intercaladas sin novedades no impiden detectar artículos en páginas posteriores.
- En Mercaeleva, **no aceptar la repetición de 20 resultados en páginas siguientes**; comprobar el avance de paginación real y el total anunciado vigente.

## 4. Verificación de calidad local e integridad

```bash
npm run validate:catalog -- --provider gam --outDir storage/scraped/gam --outPrefix validacion-gam
npm run validate:catalog -- --provider gomariz --outDir storage/scraped/gomariz --outPrefix validacion-gomariz
npm run validate:catalog -- --provider mercaeleva --outDir storage/scraped/mercaeleva --outPrefix validacion-mercaeleva
```

- `0` = integridad coherente, `2` = requiere revisión manual, `1` = error técnico.
- Edad máxima por defecto: 48 h (`--maxAgeHours` se puede adaptar de forma consciente).
- Confirmar `quality.status`, `quality.published`, `failures`, totales, referencias y hashes SHA-256 de **CSV + preparación**. Un informe marcado `complete` **no sustituye la comprobación externa de cobertura**.
- Conservar `-snapshot-*`, `-changes.json`, `-errors.json`, `-summary.json`, `-preparation.json` y el historial del lote. **Jamás importar `-partial-all.csv`**.
- Si una ejecución falla, verificar que el catálogo válido anterior no ha sido sobrescrito. `suspectedMissing` **no implica venta ni baja**.

## 5. Revisión funcional de datos

Tomar muestras representativas de cada categoría y comprobar contra fichas fuente: título, modelo, marca, año, serie, horómetro, precio, descripciones, URL, fotos, atributos y categoría final. Casos obligatorios de regresión:

1. **GAM:** caso del enlace de pestaña `#` anteriormente corregido y casos con claves `spec__4880`, `spec__1930`, `spec__SI` para descartar encabezados numéricos falsos.
2. **Gomariz:** varias fichas de un mismo modelo con referencias diferentes, galerías de >10 imágenes y precio vacío legítimo. Revisar posibles incoherencias editoriales (p. ej., altura de plataforma/trabajo) **sin corregir inventando**.
3. **Mercaeleva:** fichas de páginas distintas, miniaturas vs. imagen de mayor calidad, máquinas sin precio y final real de la paginación.
4. **Taxonomía:** categorías hoja Equipzilla, atributos obligatorios y unidades. El snapshot local de categorías y atributos debe contrastarse contra datos **actuales** del entorno de destino.

## 6. Importación manual: condiciones mínimas

La existencia de un `ready` no autoriza el alta. Antes de producir el `.xlsx`:

1. Obtener `companyID` autorizado para **esa** empresa y para **ese** entorno; no reciclar IDs históricos.
2. Exportar inventario completo y reciente `companyID,reference` desde el backend de destino.
3. Revisar todos los `review` y decidir, por negocio, qué fuentes/maquinaria se admiten; no suplir precios ausentes ni atributos obligatorios.
4. Ejecutar **dry-run** (ejemplo GAM; ajustar ruta de preparación al prefijo usado):

```bash
npm run export:import -- --provider gam --companyID <ID_REAL> --preparation storage/scraped/gam/validacion-gam-preparation.json --existing storage/inventory/gam.csv --out storage/import/gam-altas.xlsx --dry-run
```

5. Solo con inventario confirmado y trazabilidad, repetir con `--confirm-inventory`. Revisar `*.xlsx.report.json`, tamaños (máximo 10 MB) y hasta diez fotos por producto.
6. Hacer una **importación manual de muestra en un entorno de pruebas autorizado** con el importador ya existente. Comparar antes/después en la base de datos y panel, y actualizar el inventario antes de un segundo intento. El importador es de **altas**, no un proceso idempotente garantizado por sí mismo.
7. Recoger aprobación funcional y técnica; la automatización del scraping **no equivale** a autorización de importación.

## 7. Habilitación de ejecución programada

No habilitar cron, Programador de tareas ni Cloud Scheduler hasta: (a) cerrar el fallo P0 de cobertura de Mercaeleva o excluir expresamente ese proveedor, (b) demostrar resultados completos por fuente, (c) validar que la persistencia de snapshots y reportes funciona entre ejecuciones y (d) disponer de alertas ante salida no cero / `review`.

Para hosting en cloud y limitaciones del bloqueo `.batch.lock`, consultar [DESPLIEGUE_AUTOMATICO.md](DESPLIEGUE_AUTOMATICO.md). Para nuevas empresas, implementar adaptador + fixtures + extracción integral + revisión del mapeo, y añadirlas al runner solo tras aceptación.

## 8. Criterios para cerrar fase

- [ ] Tests completos y parsers no omitidos.
- [ ] Paginación de todas las empresas aceptadas frente al catálogo real.
- [ ] Cero fallos de fichas y evidencias de cobertura externa suficiente.
- [ ] Duplicados tratados por unidad/referencia, no por título.
- [ ] Precios, fotos, atributos y categorías contrastados con el destino.
- [ ] CSV + JSON + snapshots + historial preservados, hashes correctos.
- [ ] Bloqueos, reintentos y alertas probados en infraestructura de despliegue.
- [ ] Excel de prueba e importación manual revisados por responsables.

**Estado de esta lista a 20/10/2026: abierto; no declarar producción lista.**
