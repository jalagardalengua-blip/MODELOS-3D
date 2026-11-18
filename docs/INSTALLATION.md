# Instalación

## 1. Requisitos

| Programa | Versión | Para qué |
|---|---|---|
| Git | cualquiera reciente | Clonar y versionar |
| Node.js | 20 o superior (recomendado 22 LTS) | Interfaz |
| pnpm | 9 o superior | Gestor de paquetes del monorepo |
| Python | 3.10 o superior | Motor local |

### Windows
1. Instala **Node.js LTS** desde nodejs.org.
2. Abre PowerShell y activa pnpm: `corepack enable` (o `npm install -g pnpm`).
3. Instala **Python 3.12** desde python.org marcando *Add python.exe to PATH*.
4. Instala **Git for Windows**.

## 2. Interfaz

```powershell
git clone https://github.com/<tu-usuario>/ALAGARDA-3D-STUDIO.git
cd ALAGARDA-3D-STUDIO
pnpm install
pnpm dev
```

Abre http://127.0.0.1:5173. La biblioteca se guarda en el navegador (IndexedDB): usa siempre el mismo navegador y la misma dirección para ver tus modelos.

## 3. Motor local (necesario para generar con IA)

```powershell
python -m venv .venv
.venv\Scripts\activate          # en Linux/macOS: source .venv/bin/activate
python -m pip install -r services/requirements.txt
copy .env.example .env          # en Linux/macOS: cp .env.example .env
pnpm api
```

La interfaz mostrará «Motor local» en verde. En la pestaña **Motor** verás la GPU, la VRAM, la RAM y el estado de cada proveedor.

### Cuenta gratuita de Hugging Face (recomendado)
1. Crea una cuenta en huggingface.co.
2. Settings → Access Tokens → *New token* → tipo **Read**.
3. Abre `.env` y pon `HF_TOKEN=hf_…` (este archivo nunca se sube a GitHub).
4. Reinicia el motor y comprueba la conexión:

```powershell
pnpm diagnose
python -m services.generation.external.huggingface.diagnose --imagen C:\ruta\a\foto.png
```

El segundo comando hace una generación real y guarda `storage\diagnostico.glb`.

## 4. Pruebas

```powershell
pnpm test        # Vitest
pnpm test:api    # pytest
pnpm build       # compilación
```

## 5. Publicar la interfaz en GitHub Pages (opcional)

`pnpm build` genera `apps/web/dist` con rutas relativas, lista para GitHub Pages. Desde una página publicada, el navegador puede conectarse al motor local en `http://127.0.0.1:8000` si añades el origen de Pages a `ALAGARDA_CORS_ORIGINS`. GitHub Pages no ejecuta modelos de IA: solo aloja la interfaz.
