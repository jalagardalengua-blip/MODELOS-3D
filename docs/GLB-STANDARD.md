# Estándar GLB de ALAGARDA 3D STUDIO

Todos los activos se exportan como **GLB 2.0** (glTF binario, un único archivo autocontenido).

## Requisitos de un GLB válido

| Comprobación | Tipo |
|---|---|
| Cabecera `glTF`, versión de contenedor 2 | Error |
| Longitud declarada = tamaño real | Error |
| Primer chunk JSON válido · `asset.version = "2.0"` | Error |
| Referencias de nodos, mallas, materiales, texturas, imágenes y articulaciones dentro de rango | Error |
| Buffer 0 en el chunk BIN y bufferViews dentro de su buffer | Error |
| Extensiones en `extensionsRequired` soportadas por el visor | Error |
| Buffers externos (el GLB no es autocontenido) | Aviso |
| Extensiones desconocidas en `extensionsUsed` | Aviso |
| Sin mallas · mallas sin material | Aviso |

La misma lógica existe en TypeScript (`apps/web/src/lib/glbFormat.ts`) y en Python (`services/export/glb_validator.py`).

## Prueba de ida y vuelta

Al exportar, el estudio reabre el archivo y compara con el modelo original:
mallas · triángulos · materiales · texturas · huesos · animaciones.
La exportación se marca **CONSERVADO** solo si ningún recuento disminuye y el GLB es válido.

## Convenciones para videojuegos (objetivo de las Fases 3–4)

- Unidades: 1 unidad = 1 metro. Eje Y hacia arriba. Frente del personaje hacia +Z.
- Origen en la base del modelo (entre los pies / pezuñas).
- Materiales PBR metal/rugosidad: Base Color, Normal, ORM (AO + Roughness + Metallic).
- Texturas en potencias de dos (1024, 2048, 4096).
- Animaciones como clips independientes con nombres claros (`toro_embestir`, `torero_veronica`).
- Variantes por plataforma: PC (alta) y móvil (LOD y texturas comprimidas).

## Validación externa

Antes de dar por terminado un activo, ábrelo también en un segundo visor (por ejemplo, el visor glTF de Khronos o el motor del juego) y, en la Fase 3, pásalo por el validador oficial de Khronos.
