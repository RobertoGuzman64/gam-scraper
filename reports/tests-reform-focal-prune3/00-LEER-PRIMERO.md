# EQUIPZILLA — Tercera poda focal de tests

## Qué contiene

Partiendo **exclusivamente** de `eqz-p3-9a3d62.zip`, se han retirado dos suites de comparación y descubrimiento de **publicaciones históricas completas** y dieciséis casos adicionales de once suites mixtas. Son **20 declaraciones de test** en total, todas presentes entre los 69 fallos del registro aportado. Los archivos mixtos conservan sus pruebas restantes.

Para no perder una garantía real incluida dentro de la suite de comparación, se han añadido **tres pruebas generales** en `src/catalog/diagnostics/tests/audit-closure.test.ts`: procedencia canónica completa, bloqueo de pérdidas y contradicciones, y diferencias entre cierre conforme, alcance limitado y contrato pendiente. No dependen de fotografías de catálogo, recuentos de máquinas, referencias ni SHA fijos.

No se ha modificado código productivo, catálogo, publicación, parser, preparador, motor o guard.

## Qué permanece sin tocar

Se conservan los tests de **retención técnica, publicación, procedencia, identidad y variantes, Manain, extracción portátil, preparación y contratos comerciales**; pueden fallar porque su comportamiento real necesita investigación y corrección, pero **no se eliminarán por fallar**. También permanecen algunas suites históricamente acopladas cuya garantía no se ha sustituido todavía, incluida la proyección comercial que intenta cargar un original acreditado de Gomariz no conservado. No se falsifica ni sustituye esa huella.

## Comprobaciones de esta entrega

- 3/3 pruebas focales nuevas del dominio de cierre correctas, ejecutadas con transpilación temporal fuera del repositorio.
- 24/24 pruebas de ejecución, finalización, observabilidad y UI del runner correctas.
- Análisis estático del TypeScript y de los imports locales.
- **Los guards nuevos no se han ejecutado**, según lo indicado.
- `npm test` y `npm run build` oficiales pendientes de comprobación local, no declarados verdes.

## Próxima comprobación en el entorno del usuario

```powershell
npm test
npm run build
npm run estado
git status --short
```

La batería oficial de `npm test` ejecutará los guards que incorpora el proyecto. Si no quieres ejecutarlos aún, usa el runner de tests directamente tras generar `dist` en tu equipo.

El número 49 designa únicamente las **pruebas que fallaron en el registro anterior y que no se han eliminado**. No es una cifra validada para el siguiente `npm test`.
