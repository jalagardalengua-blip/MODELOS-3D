# Arquitectura

ALAGARDA 3D STUDIO se divide en cuatro capas independientes. Cambiar de motor de IA no obliga a reconstruir la aplicación.

```
┌───────────────────────────────────────────────────────────────┐
│ Interfaz de creación y edición — apps/web (React, TS, Three) │
│   Funciona sola en el navegador: visor, biblioteca, GLB       │
└──────────────┬────────────────────────────────────────────────┘
               │ HTTP en 127.0.0.1 (opcional)
┌──────────────▼────────────────────────────────────────────────┐
│ Motor local — services/api (FastAPI)                          │
│   ├─ generation/   ProviderManager → TRELLIS · Hunyuan · Tripo│
│   ├─ processing/   Blender y geometría (Fase 3–4)             │
│   └─ export/       Empaquetado y validación GLB               │
└──────────────┬────────────────────────────────────────────────┘
               │
┌──────────────▼────────────────────────────────────────────────┐
│ Sistema de activos — GLB / glTF 2.0                           │
│   Biblioteca IndexedDB (web) · storage/ (motor local)         │
└───────────────────────────────────────────────────────────────┘
```

## Interfaz web (`apps/web/src`)

| Carpeta | Responsabilidad |
|---|---|
| `pages/Studio.tsx` | Distribución en 5 zonas y paneles móviles |
| `editor/` | Visor (`Viewport`), propiedades, materiales, validación |
| `library/` | Biblioteca de activos |
| `generator/` | Panel de generación (se activa en la Fase 2) |
| `settings/` | Estado del motor local, hardware y proveedores |
| `components/` | Barra superior, barra inferior y componentes de interfaz |
| `lib/glbFormat.ts` | Lector y validador GLB sin dependencias (probado con Vitest) |
| `lib/modelLoader.ts` | Carga, estadísticas y exportación con three.js |
| `lib/db.ts` | Biblioteca en IndexedDB (metadatos y binarios por separado) |
| `store.ts` | Estado global (zustand) y acciones: importar, abrir, exportar |

### Flujo de importación
1. `validateGlb` comprueba cabecera, chunks, referencias y extensiones. Un archivo inválido se rechaza con el motivo en el registro.
2. `GLTFLoader` abre el modelo y `computeStats` cuenta sus componentes.
3. Se guarda en IndexedDB: metadatos en `assets` y binario en `files`.
4. Al abrirlo por primera vez se captura una miniatura del visor.

### Flujo de exportación
1. `GLTFExporter` genera un GLB binario con materiales, texturas, esqueletos y animaciones.
2. Se valida el archivo resultante (`validateGlb`).
3. **Se vuelve a abrir** y se comparan mallas, triángulos, materiales, texturas, huesos y animaciones con el modelo del visor.
4. Se descarga y, si hubo ediciones, se guarda como nueva versión enlazada a su original.

## Motor local (`services/`)

- `api/main.py` — `create_app()` registra CORS (solo orígenes locales y Tauri) y rutas.
- `api/routes/system.py` — `/api/health`, `/api/hardware`, `/api/providers`.
- `api/routes/glb.py` — `POST /api/glb/validate`.
- `api/security/secrets.py` — lectura de claves desde `.env`; nunca se devuelven por la API.
- `generation/base_provider.py` — contrato `BaseProvider` (`check_availability`, `generate`, `status`).
- `generation/provider_manager.py` — registro de proveedores; rechaza generar con uno no disponible.
- `generation/hardware.py` — GPU NVIDIA (nvidia-smi), AMD/Intel en Windows, RAM y CPU.
- `export/glb_validator.py` — mismo validador que el frontend, en Python.
- `export/glb_exporter.py` — empaquetado GLB con alineación a 4 bytes.

### Añadir un motor nuevo
1. Crear `services/generation/<local|external>/<motor>/provider.py` con una subclase de `BaseProvider`.
2. Registrarlo en `ProviderManager.__init__`.
3. Documentar su licencia en `docs/LICENSES.md`.

## Contratos compartidos
`packages/shared-types` (TypeScript) y `packages/asset-schema` (JSON Schema) definen `AssetMeta`, `ModelStats`, `GlbValidationReport` y `ProviderStatus`. Los esquemas Pydantic de `services/api/schemas` siguen los mismos nombres de campo.
