# Generación con IA

## Resumen

| Proveedor | Dónde se ejecuta | Coste | Estado por defecto | Entrada |
|---|---|---|---|---|
| **TRELLIS.2 · Hugging Face** | GPU gratuitas de Hugging Face (ZeroGPU), Space oficial `microsoft/TRELLIS.2` | 0 € (cupo diario) | **Activado** | Imagen o texto |
| TRELLIS (local) | Tu GPU | 0 € | Activado si hay GPU NVIDIA con ≥16 GB | Imagen o texto |
| Hunyuan3D | Tu GPU | 0 € | Desactivado (revisión de licencia) | — |
| Tripo | Servicio externo | Créditos de pago | Desactivado | — |

El equipo de desarrollo actual (GeForce GTX 745, 4 GB) no puede ejecutar TRELLIS en local, por lo que el proveedor principal es **TRELLIS.2 en Hugging Face**. Si en el futuro se usa un equipo con GPU compatible, el proveedor local ya está preparado.

## Cómo funciona una generación

```
Interfaz ──POST /api/generate──▶ Motor local ──▶ Cola (1 trabajo a la vez)
                                                     │
                     ┌───────────────────────────────┘
                     ▼
     [solo texto] FLUX.1 schnell: descripción → imagen de referencia
                     ▼
     TRELLIS.2: start_session → preprocess_image (quita el fondo)
                → image_to_3d (geometría + materiales) → extract_glb (texturas PBR)
                     ▼
     Validación GLB ──▶ storage/generations/<id>/ (model.glb, reference.png, job.json)
                     ▼
Interfaz (sondeo cada 1,5 s) ──▶ descarga, valida y añade a la biblioteca
                                  con procedencia, motor, licencia y etiquetas
```

- **Robustez ante cambios del Space:** al conectarse, el adaptador lee la API real del Space y envía solo los parámetros que acepta. Si Microsoft renombra o añade parámetros, el resto toma sus valores por defecto.
- **Progreso real:** posición en la cola de Hugging Face, ETA y pasos de muestreo se muestran en la pestaña **Trabajos**.
- **Errores claros:** si se agota el cupo gratuito, el trabajo falla con un mensaje que lo explica y recomienda configurar `HF_TOKEN`.
- **Historial persistente:** los trabajos y sus resultados se guardan en `storage/` y sobreviven a reinicios del motor.
- **Importación fiable:** los trabajos lanzados desde el navegador se importan aunque cierres la pestaña durante la generación; nunca se importan dos veces.

## Calidades

| Calidad | Resolución TRELLIS.2 | Texturas | Caras objetivo | Uso |
|---|---|---|---|---|
| Borrador | 512³ | 1024 px | ~150 000 | Probar ideas rápido |
| Alta | 1024³ | 2048 px | ~400 000 | Recomendado |
| Máxima | 1536³ | 4096 px | ~1 000 000 | Héroes del juego; consume más cupo |

Para videojuegos móviles, el modelo generado deberá optimizarse después (Fase 3: retopología, LOD y compresión).

## Consejos para buenas referencias

- Un único objeto o personaje **completo**, centrado y sin cortes.
- Fondo liso; el Space elimina el fondo automáticamente.
- Vista 3/4 frontal y luz uniforme, sin sombras duras.
- Animales y personas en pose neutra (de pie, patas rectas; humanos en pose A), que facilita el rigging de la Fase 4.
- En modo texto, las plantillas taurinas ya incluyen estas indicaciones; las descripciones en inglés son más precisas.

## Configuración

En `.env` (ver `.env.example`):

```
HF_TOKEN=hf_xxx                       # opcional, recomendado: más cupo diario
HF_SPACES_ENABLED=true                # false para desactivar el proveedor
TRELLIS2_SPACE=microsoft/TRELLIS.2    # se puede apuntar a un duplicado propio
T2I_SPACE=black-forest-labs/FLUX.1-schnell
```

Crear el token: huggingface.co → Settings → Access Tokens → *New token* de tipo **Read**.

## Diagnóstico

```
pnpm diagnose
python -m services.generation.external.huggingface.diagnose --imagen foto.png
python -m services.generation.external.huggingface.diagnose --texto "Spanish fighting bull, black coat"
```

Sin argumentos muestra el estado de los Spaces y su API real. Con `--imagen` o `--texto` hace una generación completa y guarda `storage/diagnostico.glb`.

## Privacidad

Con el proveedor de Hugging Face, la imagen o la descripción se envían a los servidores de Hugging Face. La interfaz exige confirmarlo antes de la primera generación. No envíes material confidencial.

## Limitaciones conocidas

- El cupo gratuito de GPU es limitado y puede haber colas en horas punta.
- TRELLIS.2 reconstruye a partir de una imagen: la calidad depende mucho de la referencia.
- La malla generada es densa y no tiene topología para animación; la Fase 3 la prepara para el juego.
