/**
 * Carga, inspección y exportación de modelos con three.js.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { ModelStats } from '@alagarda/shared-types';

let loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (loader) return loader;
  loader = new GLTFLoader();
  const draco = new DRACOLoader();
  // Decodificador Draco oficial de Google (solo se descarga si el modelo usa Draco).
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

export async function loadGlb(buffer: ArrayBuffer): Promise<GLTF> {
  return getLoader().parseAsync(buffer, '');
}

const TEXTURE_KEYS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
  'alphaMap',
  'bumpMap',
  'displacementMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'transmissionMap',
  'thicknessMap',
  'specularIntensityMap',
  'specularColorMap',
  'iridescenceMap',
  'anisotropyMap',
] as const;

export function materialTextures(material: THREE.Material): { slot: string; texture: THREE.Texture }[] {
  const out: { slot: string; texture: THREE.Texture }[] = [];
  const record = material as unknown as Record<string, unknown>;
  for (const key of TEXTURE_KEYS) {
    const t = record[key];
    if (t instanceof THREE.Texture) out.push({ slot: key, texture: t });
  }
  return out;
}

export function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const set = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m && set.add(m));
    }
  });
  return [...set];
}

export function computeStats(root: THREE.Object3D, animations: THREE.AnimationClip[]): ModelStats {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  let skinnedMeshes = 0;
  const bones = new Set<THREE.Bone>();
  const textures = new Set<THREE.Texture>();

  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      meshes++;
      const geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.attributes.position;
      if (pos) {
        vertices += pos.count;
        triangles += geo.index ? geo.index.count / 3 : pos.count / 3;
      }
      const skinned = o as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh) {
        skinnedMeshes++;
        skinned.skeleton.bones.forEach((b) => bones.add(b));
      }
    }
    if ((o as THREE.Bone).isBone) bones.add(o as THREE.Bone);
  });

  const materials = collectMaterials(root);
  materials.forEach((m) => materialTextures(m).forEach(({ texture }) => textures.add(texture)));

  const box = new THREE.Box3().setFromObject(root);
  const size = box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());

  return {
    meshes,
    vertices,
    triangles: Math.round(triangles),
    materials: materials.length,
    textures: textures.size,
    skinnedMeshes,
    bones: bones.size,
    animations: animations.map((a) => ({ name: a.name || 'sin nombre', duration: a.duration, tracks: a.tracks.length })),
    bounds: { x: size.x, y: size.y, z: size.z },
  };
}

/**
 * Exporta la escena a GLB binario conservando materiales PBR, texturas,
 * esqueletos y animaciones.
 */
export async function exportGlb(root: THREE.Object3D, animations: THREE.AnimationClip[]): Promise<ArrayBuffer> {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, {
    binary: true,
    animations,
    onlyVisible: true,
    includeCustomExtensions: false,
    maxTextureSize: 8192,
  });
  if (!(result instanceof ArrayBuffer)) throw new Error('El exportador no devolvió un GLB binario.');
  return result;
}

export function downloadBuffer(buffer: ArrayBuffer | Blob, fileName: string): void {
  const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function disposeObject(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        materialTextures(m).forEach(({ texture }) => textures.add(texture));
        m.dispose();
      });
    }
  });
  textures.forEach((t) => t.dispose());
}
