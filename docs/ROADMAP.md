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

## Fase 2 · Generación mediante IA
- [ ] Conocer el hardware de desarrollo (GPU, VRAM, RAM)
- [ ] Instalar TRELLIS (WSL2 en Windows) y conectar `TrellisProvider.generate`
- [ ] Entrada por imagen y texto · cola de trabajos en segundo plano con progreso
- [ ] Importación automática del resultado en la biblioteca con procedencia «generado»

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
