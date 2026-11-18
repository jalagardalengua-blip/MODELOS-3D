# Hoja de ruta

Una fase no se da por terminada porque exista el código: debe superar sus pruebas reales.

## ✅ Fase 1 · Fundación del software

- [x] Repositorio y monorepo (pnpm workspaces)
- [x] Interfaz profesional: barra superior, paneles laterales, visor central y barra inferior; versión móvil
- [x] Visor Three.js: órbita, zoom, iluminación, exposición, wireframe, esqueleto, rejilla, sombras, encuadre
- [x] Importación GLB con validación previa (Draco y Meshopt incluidos)
- [x] Biblioteca local IndexedDB con miniaturas, categorías, etiquetas, licencia, procedencia y versiones
- [x] Inspección de geometría, materiales PBR, texturas, huesos y animaciones
- [x] Edición de materiales y transformación del nodo raíz
- [x] Exportación GLB con validación de ida y vuelta
- [x] Motor local FastAPI: salud, hardware, proveedores, validación GLB
- [x] Pruebas: Vitest (validador GLB) y pytest (API, gestor de proveedores, validador)

**Pruebas superadas**
- [x] La aplicación arranca sin errores
- [x] Se importa un GLB externo (Khronos *Fox* y *DamagedHelmet*)
- [x] El visor muestra geometría, materiales y texturas
- [x] Se conservan texturas, esqueleto y animaciones al exportar
- [x] El archivo exportado vuelve a abrirse correctamente (validador web + validador Python)
- [ ] Comprobación en un segundo visor o motor → **pendiente de hacerla tú** con los GLB exportados

## ✅ Fase 2 · Generación mediante IA

Hardware de desarrollo: GeForce GTX 745 (4 GB) y 12 GB de RAM → TRELLIS no puede ejecutarse en local. Decisión: TRELLIS.2 en las GPU gratuitas de Hugging Face, con el proveedor local preparado para un equipo futuro.

- [x] Proveedor TRELLIS.2 (Space oficial de Microsoft) con lectura de la API en tiempo real
- [x] Texto → imagen de referencia (FLUX.1 schnell) → 3D
- [x] Cola de trabajos en segundo plano con progreso real (cola, ETA, pasos)
- [x] Historial persistente en `storage/generations/`
- [x] Generador en la interfaz: imagen o texto, plantillas taurinas, calidad, semilla y consentimiento de envío
- [x] Importación automática a la biblioteca con procedencia, motor, licencia y etiquetas
- [x] Diagnóstico de conexión (`pnpm diagnose`)
- [x] Pruebas: flujo completo con un Space simulado de la misma API, cola, errores de cupo, persistencia

**Pruebas superadas**
- [x] Imagen → GLB con texturas PBR importado y abierto en el visor (con Space simulado)
- [x] Texto → imagen de referencia → GLB (con Space simulado)
- [x] Sin duplicados tras recargar la página
- [ ] **Primera generación real contra Hugging Face** → pendiente en tu PC con `pnpm diagnose --imagen …` (el entorno de desarrollo de Claude no tiene acceso a Hugging Face)

## Fase 3 · Procesamiento profesional
- [ ] Integración con Blender en modo sin interfaz
- [ ] Reparación de mallas · retopología · UV · texturizado
- [ ] Optimización con glTF Transform (LOD, compresión de texturas) · validador oficial de Khronos
- [ ] Puntuaciones independientes de calidad visual, geométrica, texturas, animación, rendimiento y compatibilidad

## Fase 4 · Animación
- [ ] Rigging humano y cuadrúpedo · pesos · pruebas de deformación
- [ ] Biblioteca de clips (toro, torero, caballo) · línea temporal
- [ ] Exportación de animaciones en GLB

## Fase 5 · Producción avanzada
- [ ] Motores adicionales y proveedores externos (Tripo) con límites de gasto
- [ ] Editor avanzado (selección de partes, comparar versiones antes/después)
- [ ] Aplicación de escritorio Tauri e instalador Windows
- [ ] Extraer `packages/three-viewer` y `packages/ui` como paquetes reutilizables
