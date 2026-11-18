/**
 * Visor 3D principal: iluminación, encuadre automático, wireframe,
 * esqueleto, animaciones, rejilla y captura de miniaturas.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  GizmoHelper,
  GizmoViewport,
  Grid,
  Lightformer,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';
import { useStudio, type LightingPreset } from '../store';
import { collectMaterials } from '../lib/modelLoader';

const BACKGROUNDS: Record<LightingPreset, string> = {
  estudio: '#16191e',
  exterior: '#2a3440',
  atardecer: '#2b1d1a',
  'plaza-noche': '#0a0c12',
};

/** Iluminación generada localmente (sin descargar HDRI externos). */
function Lighting({ preset }: { preset: LightingPreset }) {
  const cfg = {
    estudio: { key: '#ffffff', keyI: 2.2, fill: '#cfd8ff', fillI: 0.8, rim: '#ffffff', rimI: 1.5, amb: 0.25 },
    exterior: { key: '#fff4e0', keyI: 3.0, fill: '#9cc4ff', fillI: 1.2, rim: '#ffffff', rimI: 0.8, amb: 0.4 },
    atardecer: { key: '#ff9a52', keyI: 2.6, fill: '#5866a8', fillI: 0.9, rim: '#ffcf8a', rimI: 1.4, amb: 0.2 },
    'plaza-noche': { key: '#ffe2b0', keyI: 1.8, fill: '#3a4a7a', fillI: 0.6, rim: '#ffd27a', rimI: 2.0, amb: 0.12 },
  }[preset];

  return (
    <>
      <ambientLight intensity={cfg.amb} />
      <directionalLight position={[5, 8, 5]} intensity={cfg.keyI} color={cfg.key} castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-6, 3, -4]} intensity={cfg.fillI * 0.6} color={cfg.fill} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={cfg.keyI} color={cfg.key} position={[3, 4, 3]} scale={[6, 4, 1]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={cfg.fillI} color={cfg.fill} position={[-5, 2, -1]} scale={[4, 6, 1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={cfg.rimI} color={cfg.rim} position={[0, 3, -6]} scale={3} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={cfg.amb * 2} color="#ffffff" position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
      </Environment>
    </>
  );
}

function Model() {
  const loaded = useStudio((s) => s.loaded);
  const wireframe = useStudio((s) => s.view.wireframe);
  const skeleton = useStudio((s) => s.view.skeleton);
  const activeClip = useStudio((s) => s.activeClip);
  const playing = useStudio((s) => s.playing);
  const revision = useStudio((s) => s.revision);
  const scene = loaded?.scene ?? null;

  // Sombras
  useEffect(() => {
    scene?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }, [scene]);

  // Wireframe
  useEffect(() => {
    if (!scene) return;
    collectMaterials(scene).forEach((m) => {
      if ('wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = wireframe;
    });
  }, [scene, wireframe, revision]);

  // Esqueleto
  const helper = useMemo(() => {
    if (!scene || !skeleton) return null;
    let hasBones = false;
    scene.traverse((o) => {
      if ((o as THREE.Bone).isBone) hasBones = true;
    });
    return hasBones ? new THREE.SkeletonHelper(scene) : null;
  }, [scene, skeleton]);
  useEffect(() => () => helper?.dispose(), [helper]);

  // Animaciones
  const mixer = useMemo(() => (scene ? new THREE.AnimationMixer(scene) : null), [scene]);
  useEffect(() => {
    if (!mixer || !loaded) return;
    mixer.stopAllAction();
    const clip = loaded.animations.find((a) => a.name === activeClip);
    if (clip) {
      const action = mixer.clipAction(clip);
      action.reset().play();
      action.paused = !playing;
    }
  }, [mixer, loaded, activeClip, playing]);
  useEffect(() => () => void mixer?.stopAllAction(), [mixer]);
  useFrame((_, dt) => {
    if (mixer && playing) mixer.update(dt);
  });

  if (!scene) return null;
  return (
    <>
      <primitive object={scene} />
      {helper && <primitive object={helper} />}
    </>
  );
}

/**
 * Encuadra la cámara sobre el modelo con una vista 3/4 frontal,
 * a partir de su esfera envolvente. Se ejecuta al cambiar de modelo
 * y cuando se pide un reencuadre (tecla F o botón).
 */
function AutoFit() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const loaded = useStudio((s) => s.loaded);
  const fitRequest = useStudio((s) => s.fitRequest);

  useEffect(() => {
    if (!loaded || !controls) return;
    const box = new THREE.Box3().setFromObject(loaded.scene);
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const fov = Math.min(vfov, hfov); // en vertical (móvil) manda el ángulo horizontal
    const distance = (sphere.radius / Math.sin(fov / 2)) * 1.15;
    const dir = new THREE.Vector3(0.55, 0.35, 1).normalize();
    camera.position.copy(sphere.center).addScaledVector(dir, distance);
    camera.near = Math.max(distance / 1000, 0.001);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(sphere.center);
    controls.update();
  }, [loaded?.assetId, fitRequest, controls, camera]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Captura una miniatura del visor tras cargar un modelo que no la tiene. */
function ThumbnailCapture() {
  const { gl, scene, camera } = useThree();
  const request = useStudio((s) => s.thumbnailRequest);
  const setThumbnail = useStudio((s) => s.setThumbnail);
  const frames = useRef(0);

  useEffect(() => {
    frames.current = 0;
  }, [request]);

  useFrame(() => {
    if (!request) return;
    frames.current++;
    if (frames.current !== 20) return; // esperar a que el encuadre se estabilice
    gl.render(scene, camera);
    const src = gl.domElement;
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const s = Math.min(src.width, src.height);
    ctx.drawImage(src, (src.width - s) / 2, (src.height - s) / 2, s, s, 0, 0, size, size);
    void setThumbnail(request, c.toDataURL('image/jpeg', 0.82));
  });
  return null;
}

function ExposureSync() {
  const gl = useThree((s) => s.gl);
  const exposure = useStudio((s) => s.view.exposure);
  useEffect(() => {
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);
  return null;
}

export function Viewport() {
  const view = useStudio((s) => s.view);
  const loaded = useStudio((s) => s.loaded);
  const loading = useStudio((s) => s.loading);
  const importFiles = useStudio((s) => s.importFiles);
  const requestFit = useStudio((s) => s.requestFit);
  const dragDepth = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (e.key === 'f' || e.key === 'F') requestFit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestFit]);
  const overlayRef = useRef<HTMLDivElement>(null);

  const groundY = useMemo(() => {
    if (!loaded) return 0;
    const box = new THREE.Box3().setFromObject(loaded.scene);
    return box.isEmpty() ? 0 : box.min.y;
  }, [loaded]);
  const span = loaded ? Math.max(loaded.stats.bounds.x, loaded.stats.bounds.z, loaded.stats.bounds.y, 1) : 4;

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        overlayRef.current?.classList.remove('hidden');
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) overlayRef.current?.classList.add('hidden');
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        overlayRef.current?.classList.add('hidden');
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files);
      }}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [3, 2, 4], fov: 40, near: 0.01, far: 2000 }}
        gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <color attach="background" args={[BACKGROUNDS[view.lighting]]} />
        <ExposureSync />
        <Lighting preset={view.lighting} />
        <Suspense fallback={null}>
          <Model />
          <AutoFit />
        </Suspense>
        {view.grid && (
          <Grid
            position={[0, groundY - 0.001, 0]}
            args={[10, 10]}
            cellSize={span / 20}
            sectionSize={span / 4}
            cellColor="#2c323b"
            sectionColor="#4a525e"
            fadeDistance={span * 6}
            infiniteGrid
          />
        )}
        {loaded && <ContactShadows position={[0, groundY, 0]} scale={span * 3} blur={2.4} opacity={0.55} far={span} />}
        <OrbitControls makeDefault autoRotate={view.autoRotate} autoRotateSpeed={1.2} enableDamping />
        <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
          <GizmoViewport axisColors={['#e5484d', '#46a758', '#3e63dd']} labelColor="#fff" />
        </GizmoHelper>
        <ThumbnailCapture />
      </Canvas>

      {loaded && (
        <div className="absolute top-2 left-2 flex gap-1">
          <button
            onClick={requestFit}
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-zinc-300 backdrop-blur-sm hover:text-white"
            title="Encuadrar el modelo (F)"
          >
            Encuadrar · F
          </button>
        </div>
      )}
      {!loaded && !loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-lg border border-dashed border-white/15 bg-black/30 p-6 text-center backdrop-blur-sm">
            <p className="text-sm font-semibold text-zinc-200">Arrastra aquí un archivo .glb</p>
            <p className="mt-1 text-xs text-zinc-400">
              o usa «Importar GLB». El modelo se guarda en la biblioteca local de este navegador.
            </p>
          </div>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[var(--accent)]" />
        </div>
      )}
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-2 hidden rounded-lg border-2 border-dashed border-[var(--accent)] bg-[var(--accent)]/10"
      />
    </div>
  );
}
