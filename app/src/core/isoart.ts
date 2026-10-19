/* Tile nền isometric 64×32 + sprite nhỏ vẽ bằng code (đường, cỏ, xe máy, hàng rào, bầu trời). */
import Phaser from 'phaser';

export const TW = 64, TH = 32;

function mk(w: number, h: number): { c: HTMLCanvasElement; x: CanvasRenderingContext2D } {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d')!; x.imageSmoothingEnabled = false; return { c, x };
}
/** tô một hàng pixel của hình thoi 64×32 */
function diamond(x: CanvasRenderingContext2D, color: (px: number, py: number) => string | null): void {
  for (let y = 0; y < TH; y++) {
    const half = (y < TH / 2 ? y + 1 : TH - y) * 2;
    for (let px = TW / 2 - half; px < TW / 2 + half; px++) { const c = color(px, y); if (c) { x.fillStyle = c; x.fillRect(px, y, 1, 1); } }
  }
}
const rnd = (a: number, b: number) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 100;
function edge(x: CanvasRenderingContext2D, col: string): void {
  x.fillStyle = col;
  for (let y = 0; y < TH; y++) { const half = (y < TH / 2 ? y + 1 : TH - y) * 2; x.fillRect(TW / 2 - half, y, 2, 1); x.fillRect(TW / 2 + half - 2, y, 2, 1); }
}

function grass(): HTMLCanvasElement {
  const { c, x } = mk(TW, TH);
  diamond(x, (px, py) => { const r = rnd(px, py); return r < 8 ? '#86b36f' : r < 14 ? '#678f55' : '#74a15f'; });
  edge(x, '#5a7f4a'); return c;
}
function plaza(): HTMLCanvasElement {
  const { c, x } = mk(TW, TH);
  diamond(x, (px, py) => { const g = ((px >> 3) + (py >> 2)) % 2; return rnd(px, py) < 6 ? '#a9a4b8' : g ? '#bdb8cb' : '#b4afc3'; });
  edge(x, '#8e8aa0'); return c;
}
/** dir: 'a' = chạy dọc +x (xuống-phải), 'b' = +y (xuống-trái), 'x' = ngã tư */
function road(dir: 'a' | 'b' | 'x'): HTMLCanvasElement {
  const { c, x } = mk(TW, TH);
  diamond(x, (px, py) => (rnd(px, py) < 7 ? '#3a3a47' : '#454554'));
  edge(x, '#2b2b36');
  x.fillStyle = '#d9d28a';
  const cx = TW / 2, cy = TH / 2;
  if (dir === 'a') for (let i = -12; i <= 12; i += 12) for (let k = 0; k < 6; k++) x.fillRect(cx + i + k * 2 - 6, cy + (i + k * 2 - 6) / 2, 2, 1);
  else if (dir === 'b') for (let i = -12; i <= 12; i += 12) for (let k = 0; k < 6; k++) x.fillRect(cx - (i + k * 2 - 6), cy + (i + k * 2 - 6) / 2, 2, 1);
  else { x.fillStyle = '#e8e8e8'; for (let k = -2; k <= 2; k++) x.fillRect(cx + k * 3, cy - 1, 2, 3); }
  return c;
}
function lot(): HTMLCanvasElement {
  const { c, x } = mk(128, 64);
  for (let y = 0; y < 64; y++) { const half = (y < 32 ? y + 1 : 64 - y) * 2; for (let px = 64 - half; px < 64 + half; px++) { x.fillStyle = rnd(px, y) < 10 ? '#b09a6a' : '#a58f60'; x.fillRect(px, y, 1, 1); } }
  x.fillStyle = '#6d5a35'; for (let y = 0; y < 64; y++) { const half = (y < 32 ? y + 1 : 64 - y) * 2; x.fillRect(64 - half, y, 2, 1); x.fillRect(64 + half - 2, y, 2, 1); }
  // hàng rào: các cọc dọc hai cạnh trước
  x.fillStyle = '#d8a860'; for (let i = 0; i <= 8; i++) { const px = 64 - i * 7, py = 32 + i * 3.5; x.fillRect(px, py - 6, 2, 6); const qx = 64 + i * 7, qy = 32 + i * 3.5; x.fillRect(qx - 2, qy - 6, 2, 6); }
  x.fillStyle = '#c9923a'; x.fillRect(8, 35, 2, 1);
  // thùng và cọc tiêu
  x.fillStyle = '#b98a4b'; x.fillRect(86, 24, 10, 8); x.fillStyle = '#8c6a32'; x.fillRect(86, 24, 10, 2);
  x.fillStyle = '#f97316'; x.fillRect(34, 30, 5, 8); x.fillStyle = '#fff'; x.fillRect(35, 33, 3, 2);
  return c;
}
function bike(): HTMLCanvasElement {
  const { c, x } = mk(16, 12);
  x.fillStyle = '#111'; x.fillRect(2, 8, 4, 4); x.fillRect(10, 8, 4, 4);
  x.fillStyle = '#c0392b'; x.fillRect(4, 5, 9, 4); x.fillStyle = '#e8e8e8'; x.fillRect(11, 4, 3, 2);
  x.fillStyle = '#e0ac82'; x.fillRect(7, 0, 3, 3); x.fillStyle = '#d94f4f'; x.fillRect(6, 3, 5, 3);
  x.fillStyle = '#2b1d12'; x.fillRect(7, 0, 3, 1); return c;
}
function person(shirt: string): HTMLCanvasElement {
  const { c, x } = mk(6, 12);
  x.fillStyle = '#1e1e1e'; x.fillRect(1, 9, 2, 3); x.fillRect(3, 9, 2, 3);
  x.fillStyle = shirt; x.fillRect(0, 4, 6, 5); x.fillStyle = '#e0ac82'; x.fillRect(1, 0, 4, 4); x.fillStyle = '#2b1d12'; x.fillRect(1, 0, 4, 2); return c;
}
function glow(color: string): HTMLCanvasElement {
  const { c, x } = mk(128, 64);
  const g = x.createRadialGradient(64, 32, 4, 64, 32, 62); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.save(); x.translate(64, 32); x.scale(1, 0.5); x.translate(-64, -64); x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill(); x.restore();
  return c;
}

export function registerIsoArt(scene: Phaser.Scene): void {
  const add = (k: string, c: HTMLCanvasElement) => { if (!scene.textures.exists(k)) scene.textures.addCanvas(k, c); };
  add('t_grass', grass()); add('t_plaza', plaza()); add('t_road_a', road('a')); add('t_road_b', road('b')); add('t_road_x', road('x'));
  add('t_lot', lot()); add('bike', bike()); add('glow_purple', glow('rgba(217,70,239,.85)')); add('glow_cyan', glow('rgba(34,211,238,.7)')); add('glow_gold', glow('rgba(245,197,66,.8)'));
  ['#d94f4f', '#4f8fd9', '#4fb36a', '#a460d9', '#e0c04f', '#e8e8e8', '#3fb8b8'].forEach((c, i) => add('p' + i, person(c)));
}
