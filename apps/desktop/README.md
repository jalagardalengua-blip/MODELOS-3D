# Aplicación de escritorio (Fase 5)

Empaquetará `apps/web` con **Tauri** para Windows y arrancará el motor local
(`services/api`) como proceso acompañante.

Estructura prevista:

```
apps/desktop/
├── src-tauri/       # Proyecto Rust de Tauri (tauri.conf.json, main.rs)
└── capabilities/    # Permisos mínimos: sistema de archivos de la biblioteca y proceso del motor
```

El motor ya acepta los orígenes `tauri://localhost` y `http://tauri.localhost`.
