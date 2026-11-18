export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-ES').format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

export function stripExtension(name: string): string {
  return name.replace(/\.(glb|gltf)$/i, '');
}

export function safeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_\- ]+/gu, '').trim().replace(/\s+/g, '_') || 'modelo';
}
