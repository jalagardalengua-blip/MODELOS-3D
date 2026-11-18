# Generación con IA

## Sistema de proveedores

Cada motor es un adaptador (`BaseProvider`) registrado en `ProviderManager`. La interfaz solo habla con el gestor, nunca con un motor concreto.

| Proveedor | Tipo | Estado por defecto | Requisitos |
|---|---|---|---|
| TRELLIS | Local | Activado | GPU NVIDIA con CUDA y ≥16 GB de VRAM · instalación local en `TRELLIS_PATH` |
| Hunyuan3D | Local, experimental | **Desactivado** | Revisión de licencia para España/UE antes de integrarlo |
| Tripo | Externo | **Desactivado** | `TRIPO_ENABLED=true`, `TRIPO_API_KEY` y `TRIPO_MAX_CREDITS_PER_SESSION > 0` |

`GET /api/providers` devuelve, para cada uno, si está disponible y, si no, el motivo exacto (sin GPU, VRAM insuficiente, falta la ruta, falta la clave…).

## TRELLIS en local (Fase 2)

- Requiere una GPU NVIDIA con al menos 16 GB de VRAM según sus requisitos publicados.
- Su instalación está probada principalmente en Linux. En Windows, la vía prevista es **WSL2** con CUDA.
- Se instalará en su propio entorno de Python (PyTorch + CUDA), separado del motor local, y el adaptador lo lanzará como proceso independiente. Así las dependencias pesadas no contaminan la API.
- Los pesos se descargan bajo demanda y nunca se incluyen en el repositorio.

## Sin GPU compatible

Si el equipo no cumple los requisitos, las alternativas son:
1. Proveedor externo (Tripo u otro adaptador), con límite de gasto.
2. Un equipo remoto con GPU que ejecute el motor local y al que se conecte la interfaz.

## Calidad: la generación es solo el primer paso

Una malla generada puede verse bien y aun así no estar lista para un videojuego. Cada generación pasará por la cadena de control del documento maestro: revisión geométrica, retopología y UV, materiales, rigging, animación, optimización y validación GLB (Fases 3–4).
