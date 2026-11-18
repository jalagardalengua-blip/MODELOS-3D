import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateGlb, parseGlb } from '../../apps/web/src/lib/glbFormat';

const fixture = (name: string) => {
  const buf = readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};

function packGlb(json: object, bin?: Uint8Array): ArrayBuffer {
  const enc = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = Math.ceil(enc.length / 4) * 4;
  const binLen = bin ? Math.ceil(bin.length / 4) * 4 : 0;
  const total = 12 + 8 + jsonLen + (bin ? 8 + binLen : 0);
  const out = new ArrayBuffer(total);
  const v = new DataView(out);
  const u8 = new Uint8Array(out);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, total, true);
  v.setUint32(12, jsonLen, true);
  v.setUint32(16, 0x4e4f534a, true);
  u8.fill(0x20, 20, 20 + jsonLen);
  u8.set(enc, 20);
  if (bin) {
    const o = 20 + jsonLen;
    v.setUint32(o, binLen, true);
    v.setUint32(o + 4, 0x004e4942, true);
    u8.set(bin, o + 8);
  }
  return out;
}

describe('validateGlb', () => {
  it('acepta el cubo de referencia generado por el motor Python', () => {
    const r = validateGlb(fixture('cube.glb'));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.counts.meshes).toBe(1);
    expect(r.counts.materials).toBe(1);
  });

  it('rechaza archivos que no son GLB', () => {
    const r = validateGlb(new TextEncoder().encode('esto no es un glb, de verdad que no').buffer as ArrayBuffer);
    expect(r.ok).toBe(false);
  });

  it('detecta longitudes que no coinciden', () => {
    const buf = fixture('cube.glb');
    const r = validateGlb(buf.slice(0, buf.byteLength - 16));
    expect(r.ok).toBe(false);
  });

  it('detecta referencias a mallas inexistentes', () => {
    const r = validateGlb(packGlb({ asset: { version: '2.0' }, nodes: [{ mesh: 2 }], meshes: [] }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/malla inexistente/);
  });

  it('rechaza extensiones obligatorias no soportadas', () => {
    const r = validateGlb(packGlb({ asset: { version: '2.0' }, extensionsRequired: ['EXT_inventada'] }));
    expect(r.ok).toBe(false);
  });

  it('lee el chunk BIN', () => {
    const p = parseGlb(packGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }, new Uint8Array([1, 2, 3, 4])));
    expect(p.bin?.byteLength).toBe(4);
  });
});
