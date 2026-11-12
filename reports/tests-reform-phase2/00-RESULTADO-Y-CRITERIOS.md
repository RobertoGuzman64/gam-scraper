# EQUIPZILLA — Fase 2, demolición de pruebas y dependencias históricas

## Base y alcance

Base única: `eqz-f8-1e5617.zip` (1510 ficheros). Se aplicaron eliminaciones físicas, no se trasladaron suites viejas a otra carpeta y se mantuvieron los contratos productivos y los datos de publicación. Esta fase **es un candidato**, no certifica build ni `npm test` oficiales.

### Resultado real

- **61 suites históricas eliminadas**, de ellas 59 en `src/preparation/gam/editorial/` cuya clasificación F1 fue `E/transformar`, y dos suites adicionales de cortes antiguos en el motor compartido.
- **42 módulos TS históricos retirados** al perder su último consumidor demostrable; quedan **26 implementaciones** y **9 suites específicas** en el árbol GAM editorial por dependencias productivas o garantías todavía pendientes de sustitución acreditada.
- **8 suites compartidas reescritas** con entradas controladas: no dependen de que el catálogo original contenga 983, 143, 221 o cualquier otro número de fichas.
- Añadido `src/preparation/shared/editorial/tests/editorial-contract-records.ts` como soporte único tipado de escenarios mínimos; no son registros reales ni publicaciones.
- **37 de 37 archivos de catálogos y publicaciones idénticos byte a byte** a F8. Se preserva la fuente histórica acreditada en `src/testing/fixtures/gomariz/regression-143/` porque su eliminación necesita acreditar la política de conservación.
- Las pruebas de precedencia ya no hacen SHA-256 de un conjunto de 1.347 originales ni exigen salidas literales por referencia.

### Garantías cubiertas por contratos supervivientes

Se conservan: contrato comercial y autoridad editorial; identidad, variante y URL; distinción de altura de trabajo y elevación; capacidad, energía y unidades incompatibles; no herencia de prestaciones no declaradas; incorporación de año únicamente cuando la fuente lo corrobora; determinismo y no mutación; motor común de familia; guard de imports y límites de publicación. Las pruebas nuevas no fuerzan un estado `ready` con evidencia insuficiente.

### Límites de la intervención

No se ha proclamado obsoleta una regresión individual de identidad de modelo sin demostrarlo. Se **restauraron nueve suites marcadas `investigar` en F1**, junto con sus dependencias mínimas, en vez de sacrificar sus negativos. Tampoco se han borrado las publicaciones versionadas, fixtures de originales acreditados, tablas de conocimiento de unidad ni las pruebas de campañas, contratos y manifests.

En Fase 3 será necesario revisar las suites particulares conservadas y las dependencias externas residuales: las dependencias de catálogo detectadas en las 523 suites originales no se consideran todas resueltas. La caché del runner sigue utilizando su fingerprint conservador de datos externos; cambiarlo requiere demostrar que las lecturas dinámicas nunca generan resultados obsoletos. La documentación histórica bajo `reports/` sigue disponible como evidencia de campañas anteriores, no como código activo.

### Verificaciones realmente efectuadas

- Suite editorial compartida tras retranspilación aislada con TypeScript global: **47/47**.
- Focales del runner, observabilidad, finalización y rendimiento: **32/32**.
- Guard de integridad de imports productivos: **PASS**, 0 imports locales ausentes.
- Guard de narradores editoriales: **PASS**, 0 narradores antiguos conectados.
- Guard de autoridad editorial: **PASS**, exportación sin reescrituras.
- Comparación SHA-256 de todos los archivos bajo `catalogs/`: **37/37 idénticos**.
- Guards de contrato comercial y presupuesto de tests: **no ejecutables** en este entorno sin la dependencia npm local `typescript`; no se relajaron.
- `npm ci`, `npm install`, `npm run build` y `npm test` oficiales: **no ejecutados** por la limitación conocida establecida en el plan maestro. No se han creado stubs ni alterado scripts para esquivar el bloqueo.

### Acreditación en el equipo local

```powershell
npm ci
npm run build
npm test
npm run test:guard
npm run editorial:verificar-conocimiento
```

Si hay errores reales con dependencias instaladas, deben corregirse en el candidato antes de declarar estable la poda.

### Inventarios adjuntos

`01-INVENTARIO-DE-RETIRADAS.csv`: ruta, tipo, clasificación, huella previa y garantía que sobrevive; `02-INVENTARIO-DE-MODIFICACIONES.csv`: cambios y nuevas pruebas; `03-HISTORICOS-CONSERVADOS.csv`: lo retenido justificadamente; `04-VALIDACIONES.json`: ejecución exacta y pendientes.
