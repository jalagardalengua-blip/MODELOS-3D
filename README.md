# ALAGARDA 3D STUDIO

Estudio de creación 3D asistido por IA para generar, editar, preparar y exportar modelos para videojuegos en **GLB (glTF 2.0)**. Diseñado para **GANADERÍA 27**, pero válido para cualquier tipo de activo: humanos, animales, vehículos, ropa, edificios, escenarios y objetos.

> **Estado: Fase 2 completada — Generación con IA.**
> Genera modelos 3D desde una imagen o una descripción con **TRELLIS.2** en las GPU gratuitas de Hugging Face, sin necesitar una tarjeta gráfica potente.
> Además: importar, ver, inspeccionar, editar y exportar GLB con validación de ida y vuelta. Consulta [docs/ROADMAP.md](docs/ROADMAP.md).

## Qué funciona hoy

| Módulo | Funciones |
|---|---|
| Visor 3D | Rotar, desplazar y hacer zoom con ratón o gestos táctiles · encuadre automático (F) · 4 iluminaciones · exposición · wireframe · esqueleto · rejilla · sombras · giro automático |
| Importación | Archivos `.glb` por botón o arrastrando al visor · validación estructural antes de aceptar · Draco y Meshopt |
| Biblioteca local | IndexedDB en el propio navegador · miniaturas automáticas · búsqueda · categorías (incluidas las taurinas) · proyecto, etiquetas y licencia · procedencia y versiones |
| Inspección | Mallas, vértices, triángulos, materiales, texturas, huesos, animaciones y dimensiones |
| Materiales | Base Color, Roughness, Metallic, Emissive y opacidad editables · mapas PBR por canal con resolución |
| Animaciones | Lista de clips con duración, reproducción y pausa |
| Exportación GLB | GLB 2.0 binario con materiales PBR, texturas, esqueletos y animaciones · **el archivo exportado se vuelve a abrir y se compara con el original** · guardado opcional como nueva versión |
| Generación IA | Imagen → 3D y texto → 3D con TRELLIS.2 (Hugging Face, gratis) · plantillas taurinas · 3 calidades · semillas para variantes · cola con progreso real · importación automática con procedencia y licencia |
| Motor local | API FastAPI · detección de hardware (GPU, VRAM, RAM) · gestor de proveedores (TRELLIS, Hunyuan3D, Tripo) · validador GLB en Python |
| Interfaz | Escritorio (5 zonas) y móvil (paneles deslizantes) |

Probado con los modelos de referencia de Khronos *Fox* (esqueleto, 3 animaciones, textura) y *DamagedHelmet* (5 mapas PBR de 2048 px): ambos se exportan conservando todos sus componentes.

## Inicio rápido

Requisitos: **Node.js 20+**, **pnpm 9+** y (para el motor local) **Python 3.10+**.

```bash
pnpm install
pnpm dev            # interfaz en http://127.0.0.1:5173
```

Motor local (necesario para generar con IA):

```bash
python -m pip install -r services/requirements.txt
cp .env.example .env      # opcional: añade HF_TOKEN para más cupo gratuito
pnpm api                  # http://127.0.0.1:8000
pnpm diagnose             # comprueba la conexión con Hugging Face
```

Guía de generación: [docs/GENERATION.md](docs/GENERATION.md).

Pruebas:

```bash
pnpm test           # frontend (Vitest)
pnpm test:api       # motor local y validador GLB (pytest)
pnpm build          # compilación de producción en apps/web/dist
```

Instrucciones completas para Windows en [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Estructura

```
apps/web/            Interfaz React + TypeScript + Three.js (React Three Fiber) + Tailwind
apps/desktop/        Aplicación de escritorio Tauri (Fase 5)
services/api/        Motor local FastAPI
services/generation/ Proveedores de IA intercambiables + detección de hardware
services/processing/ Blender, geometría, texturas, retopología, rigging, optimización (Fase 3–4)
services/export/     Empaquetado y validación GLB en Python
packages/            Tipos y esquemas compartidos
assets/              Presets y plantillas (taurinas, materiales)
storage/             Activos generados en local (excluido de git)
tests/               Frontend, backend, generación y GLB
docs/                Arquitectura, instalación, generación, estándar GLB, licencias y hoja de ruta
```

## Principios

- **Producto real, no demostración:** ninguna función simula resultados. Si un motor no está disponible, la interfaz lo dice y explica por qué.
- **Sin pagos obligatorios:** los proveedores externos están desactivados por defecto y exigen un límite de gasto.
- **Sin activos ni pesos en Git:** los modelos viven en la biblioteca local; los pesos de IA se descargan bajo demanda.
- **Cada activo registra procedencia, fecha, motor y licencia.**

## Licencia

Código bajo licencia MIT. Los pesos de IA, generadores de terceros y activos generados tienen sus propias licencias: consulta [docs/LICENSES.md](docs/LICENSES.md).
