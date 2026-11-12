# EQUIPZILLA — Segunda poda focal de tests tras los 112 fallos

## Alcance y base

La base exclusiva es el repositorio completo `eqz-poda-bb85f6.zip`. Se han utilizado únicamente los fallos del registro `npm test` aportado después de esa entrega. Esta intervención **no ejecuta ni atiende los guards nuevos**, tal como se ha solicitado; tampoco modifica sus reglas, cuotas ni umbrales.

No es una nueva auditoría global. Es una poda física acotada a las suites y casos que continuaban fallando y estaban acoplados a referencias, narradores editoriales retirados o fotografías históricas.

## Cambios realizados

- **15 suites TypeScript eliminadas** (54 declaraciones de test), por verificar cohortes, modelos o proyecciones históricas no pertinentes como contrato permanente de dominio.
- **12 suites conservadas y simplificadas**: se retiraron **20 casos** específicos, dejando intactas las pruebas restantes de esas suites, incluidas negativas de procedencia y contradicción.
- **74 casos retirados** en total. De los 112 fallos anteriores, **43 corresponden a casos retirados**. Los otros 69 quedan relacionados en `02-FALLOS-ANTERIORES-CONSERVADOS.csv`. No son 69 fallos confirmados después de esta poda.
- **Ninguna modificación productiva, de guard, contrato, catálogo o publicación.** Los 37 archivos de `catalogs/` coinciden byte a byte con el ZIP de partida.
- La cantidad de suites TypeScript pasa de **385 a 370**. Las ocho suites MJS del tooling no cambian.

## Garantías que no se sacrifican

Se conservan los tests de publicación, retención técnica, procedencia, decisiones de acreditación, preparación, validación comercial, clasificación compartida, reconciliación de magnitudes y casos negativos. Las suites históricas eliminadas no justifican conservar un narrador antiguo solo para que pase su test.

En particular, **el error de ausencia del original acreditado de Gomariz no se ha ocultado**: su SHA debe verificarse en el almacenamiento de evidencia legítimo. No se ha cambiado a la copia operativa ni alterado el contrato de origen acreditado. Parte de la proyección comercial restante sigue requiriendo separar su fixture del inventario publicado; es una tarea pendiente.

No se han eliminado datos históricos originales ni scripts de evidencia. Los módulos antiguos que sobreviven solo por importaciones históricas requieren la siguiente intervención editorial de limpieza con evidencia de equivalencia; no se borran dentro de esta fase de tests.

## Comprobaciones ejecutadas sin guards

- Análisis sintáctico TypeScript de **1.085 archivos**: **0 errores de parseo**.
- Resolución estática de imports relativos TypeScript: **0 rutas ausentes**.
- **24/24 pruebas focales** de ejecución, terminación, observabilidad y UI del runner (sin lanzar guards).
- Comparación íntegra del árbol con el ZIP base: exactamente **15 eliminaciones y 12 modificaciones** de tests, más este informe.
- Comparación de los **37 archivos de catálogos/publicaciones**: idénticos.

**No se han ejecutado** `npm test`, `npm run build` ni ningún guard sobre este candidato. No se declara suite verde ni estabilidad funcional global. El `build` de siete segundos que aparece en el registro aportado corresponde a la versión anterior a esta intervención.

## Próxima ejecución local sin guards

En el entorno con dependencias instaladas se puede ejecutar:

```powershell
npm run build
node scripts/run-tests.mjs
npm run estado
git status --short
```

`npm test` incluye guards; no es el comando indicado mientras se haya decidido aplazar su ejecución. Si aparecen fallos reales de contrato, deben corregirse; no deben borrarse para maquillar el resultado.

`01-RETIRADAS-Y-SUSTITUCIONES.csv` documenta cada retirada; `02-FALLOS-ANTERIORES-CONSERVADOS.csv` mantiene la continuidad de los fallos pendientes; `03-RESULTADOS-Y-LIMITES.json` registra las comprobaciones y límites.
