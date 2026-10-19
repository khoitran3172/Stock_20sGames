/* Pixel art sinh bằng code (placeholder có chủ đích): mọi texture đăng ký qua registerArt().
   Khi có asset thật (CC0), chỉ cần thay các key này bằng atlas — scene không đổi. */
import Phaser from 'phaser';

type Ctx = CanvasRenderingContext2D;
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

function mk(w: number, h: number): { c: HTMLCanvasElement; x: Ctx } {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d')!; x.imageSmoothingEnabled = false;
  return { c, x };
}
const R = (x: Ctx, col: string, a: number, b: number, w: number, h: number) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
function shade(col: string, amt: number): string {
  const n = parseInt(col.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
}
function fromRows(rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  const { c, x } = mk(rows[0].length, rows.length);
  rows.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch !== '.' && pal[ch]) R(x, pal[ch], xx, yy, 1, 1); }));
  return c;
}

/* ---------- sàn 16×16 ---------- */
function floorTile(kind: string): HTMLCanvasElement {
  const { c, x } = mk(16, 16);
  if (kind === 'herring') {
    R(x, '#a8402a', 0, 0, 16, 16);
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if (((i + j) % 8) < 4 && (i % 8) < 8) R(x, ((i >> 2) + (j >> 2)) % 2 ? '#c9552f' : '#b84a2c', i, j, 1, 1);
    for (let i = 0; i < 16; i += 4) R(x, '#7e2f1e', i, (i * 2) % 16, 1, 1);
  } else if (kind === 'checker') {
    R(x, '#f4efb8', 0, 0, 16, 16); R(x, '#ebe5a0', 0, 0, 8, 8); R(x, '#ebe5a0', 8, 8, 8, 8);
    R(x, '#dcd58a', 0, 15, 16, 1); R(x, '#dcd58a', 15, 0, 1, 16);
  } else if (kind === 'carpet') {
    R(x, '#8d8794', 0, 0, 16, 16);
    [[2, 3], [9, 1], [5, 9], [12, 12], [14, 6], [1, 13]].forEach(([a, b]) => R(x, '#7b7681', a, b, 1, 1));
    [[6, 5], [11, 9], [3, 14]].forEach(([a, b]) => R(x, '#9d98a5', a, b, 1, 1));
  } else if (kind === 'teal') {
    R(x, '#a4e3d9', 0, 0, 16, 16);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { R(x, '#82cdc2', 2 + i * 8, 1 + j * 8, 4, 6); R(x, '#a4e3d9', 3 + i * 8, 2 + j * 8, 2, 4); }
    R(x, '#6fb7ac', 0, 15, 16, 1); R(x, '#6fb7ac', 15, 0, 1, 16);
  } else if (kind === 'tile') {
    R(x, '#c4c4c0', 0, 0, 16, 16); R(x, '#b6b6b2', 0, 0, 8, 8); R(x, '#b6b6b2', 8, 8, 8, 8);
    R(x, '#a2a29e', 0, 15, 16, 1); R(x, '#a2a29e', 15, 0, 1, 16);
  } else { // brick
    R(x, '#8f3b2c', 0, 0, 16, 16);
    for (let r = 0; r < 4; r++) { const off = r % 2 ? 4 : 0; R(x, '#c0583f', 0, r * 4, 16, 3); for (let k = 0; k < 4; k++) R(x, '#8f3b2c', (off + k * 8) % 16, r * 4, 1, 3); }
  }
  return c;
}

/* ---------- tường (rộng 16 × cao 24) ---------- */
function wallTile(col: number): HTMLCanvasElement {
  const { c, x } = mk(16, 24); const base = hex(col);
  R(x, base, 0, 0, 16, 18);
  R(x, shade(base, 18), 0, 0, 16, 2);
  R(x, shade(base, -22), 0, 16, 16, 2);
  R(x, shade(base, -45), 0, 18, 16, 6);       // chân tường
  R(x, shade(base, -60), 0, 18, 16, 1);
  for (let i = 0; i < 16; i += 4) R(x, shade(base, -8), i, 6, 1, 10);
  return c;
}

/* ---------- đồ nội thất ---------- */
const WOOD = '#c98a4b', WOOD_D = '#8c5a2b', WOOD_L = '#e0a86a';
function desk(): HTMLCanvasElement {
  const { c, x } = mk(32, 18);
  R(x, WOOD_D, 0, 4, 32, 12); R(x, WOOD, 0, 2, 32, 10); R(x, WOOD_L, 0, 2, 32, 2);
  R(x, WOOD_D, 1, 16, 3, 2); R(x, WOOD_D, 28, 16, 3, 2);
  R(x, '#6d4521', 6, 12, 20, 1);
  R(x, '#e8e8e8', 3, 5, 6, 4); R(x, '#cfcfcf', 3, 5, 6, 1);                 // giấy tờ
  R(x, '#3a6ea5', 22, 6, 4, 3); R(x, '#fff', 23, 7, 2, 1);                  // tách/cốc
  return c;
}
function bigDesk(): HTMLCanvasElement {
  const { c, x } = mk(52, 24);
  R(x, WOOD_D, 0, 6, 52, 16); R(x, WOOD, 0, 2, 52, 14); R(x, WOOD_L, 0, 2, 52, 2);
  R(x, WOOD_D, 2, 22, 4, 2); R(x, WOOD_D, 46, 22, 4, 2);
  R(x, '#1d3557', 20, 4, 14, 3); R(x, '#fff', 4, 6, 8, 5); R(x, '#b8860b', 38, 5, 6, 8);
  return c;
}
function monitor(screen: string): HTMLCanvasElement {
  const { c, x } = mk(14, 13);
  R(x, '#1b1b24', 0, 0, 14, 10); R(x, screen, 1, 1, 12, 8);
  R(x, shade(screen, 50), 2, 2, 4, 1); R(x, shade(screen, -40), 2, 5, 9, 1); R(x, shade(screen, -40), 2, 7, 6, 1);
  R(x, '#1b1b24', 5, 10, 4, 2); R(x, '#2a2a36', 3, 12, 8, 1);
  return c;
}
function chair(col: string): HTMLCanvasElement {
  const { c, x } = mk(12, 12);
  R(x, shade(col, -40), 1, 0, 10, 6); R(x, col, 2, 1, 8, 4);
  R(x, shade(col, -40), 5, 6, 2, 3); R(x, '#222', 2, 9, 8, 2); R(x, '#222', 1, 10, 2, 2); R(x, '#222', 9, 10, 2, 2);
  return c;
}
function plant(): HTMLCanvasElement {
  return fromRows([
    '....gg..gg..', '...gGGggGGg.', '..gGGGGGGGg.', '.gGGdGGGdGGg', '.gGGGGGGGGGg', '..gGGdGGdGg.',
    '...gGGGGGg..', '....gGGGg...', '.....gsg....', '....rrrrrr..', '....rRRRRr..', '....rRRRRr..', '.....rRRr...', '.....rrrr...',
  ], { g: '#2f8f3a', G: '#48b64f', d: '#25702e', s: '#5b3a1a', r: '#8a4b2a', R: '#b8683a' });
}
function shelf(): HTMLCanvasElement {
  const { c, x } = mk(26, 34);
  R(x, WOOD_D, 0, 0, 26, 34); R(x, '#5a3a1c', 2, 2, 22, 30);
  const cols = ['#d94f4f', '#4f8fd9', '#e0c04f', '#4fb36a', '#a460d9', '#d98f4f'];
  [0, 1, 2].forEach((row) => { R(x, WOOD, 2, 10 + row * 10, 22, 2); for (let k = 0; k < 7; k++) R(x, cols[(k + row * 2) % cols.length], 3 + k * 3, 3 + row * 10, 2, 7); });
  return c;
}
function server(): HTMLCanvasElement {
  const { c, x } = mk(16, 30);
  R(x, '#15151c', 0, 0, 16, 30); R(x, '#2a2a36', 1, 1, 14, 28);
  for (let r = 0; r < 6; r++) { R(x, '#101018', 2, 2 + r * 4.5 | 0, 12, 3); R(x, r % 2 ? '#3fcf6d' : '#4f8fff', 3, 3 + r * 4.5 | 0, 1, 1); R(x, '#f5c542', 5, 3 + r * 4.5 | 0, 1, 1); }
  return c;
}
function board(): HTMLCanvasElement {
  const { c, x } = mk(32, 20);
  R(x, WOOD_D, 0, 0, 32, 20); R(x, '#26332b', 2, 2, 28, 14); R(x, '#e8e8e8', 5, 5, 10, 1); R(x, '#e8e8e8', 5, 8, 16, 1); R(x, '#f5c542', 5, 11, 7, 1);
  R(x, '#d9d9d9', 4, 17, 6, 2);
  return c;
}
function cabinet(): HTMLCanvasElement {
  const { c, x } = mk(18, 28);
  R(x, '#6e7a8a', 0, 0, 18, 28); R(x, '#8794a6', 1, 1, 16, 12); R(x, '#8794a6', 1, 15, 16, 12);
  R(x, '#3b4350', 7, 6, 4, 2); R(x, '#3b4350', 7, 20, 4, 2);
  return c;
}
function windowTile(): HTMLCanvasElement {
  const { c, x } = mk(22, 16);
  R(x, '#e9e4dc', 0, 0, 22, 16); R(x, '#bfe3f7', 2, 2, 8, 12); R(x, '#bfe3f7', 12, 2, 8, 12);
  R(x, '#e8f6ff', 3, 3, 3, 4); R(x, '#e8f6ff', 13, 3, 3, 4);
  return c;
}
function picture(kind: number): HTMLCanvasElement {
  const { c, x } = mk(18, 14);
  R(x, WOOD_D, 0, 0, 18, 14); R(x, '#f2e6c8', 1, 1, 16, 12);
  if (kind === 0) { R(x, '#7ec8e3', 2, 2, 14, 6); R(x, '#4f9d4f', 2, 8, 14, 4); R(x, '#f5c542', 12, 3, 3, 3); }
  else if (kind === 1) { R(x, '#e8896c', 2, 2, 14, 10); R(x, '#fff', 5, 4, 8, 3); R(x, '#222', 7, 5, 1, 1); R(x, '#222', 10, 5, 1, 1); }
  else { R(x, '#2f2f3f', 2, 2, 14, 10); R(x, '#3fcf6d', 4, 8, 2, 3); R(x, '#3fcf6d', 8, 5, 2, 6); R(x, '#ef5350', 12, 3, 2, 8); }
  return c;
}
function globe(): HTMLCanvasElement {
  return fromRows(['..bbbb..', '.bGGbbb.', 'bGGbbGbb', 'bbbGGbbb', 'bbGGbbGb', '.bbbbbb.', '..bddb..', '.dddddd.'], { b: '#3d7fd0', G: '#4fb36a', d: '#5a3a1c' });
}
function crown(): HTMLCanvasElement {
  return fromRows(['y.y.y', 'yyyyy', 'yRyRy'], { y: '#ffd34d', R: '#ef5350' });
}
function goldcase(): HTMLCanvasElement {
  const { c, x } = mk(30, 22);
  R(x, WOOD_D, 0, 8, 30, 14); R(x, '#5a3a1c', 1, 9, 28, 12); R(x, '#cfe8f5', 2, 10, 26, 8);
  [[4, 14], [10, 14], [16, 14], [7, 11], [13, 11]].forEach(([a, b]) => { R(x, '#ffd34d', a, b, 6, 3); R(x, '#fff0a0', a, b, 6, 1); });
  return c;
}
function maquette(): HTMLCanvasElement {
  const { c, x } = mk(34, 24);
  R(x, WOOD_D, 0, 16, 34, 8); R(x, '#d8d2c0', 1, 14, 32, 4);
  R(x, '#e8896c', 3, 6, 8, 9); R(x, '#a8402a', 3, 4, 8, 3); R(x, '#8fb9e8', 14, 2, 7, 13); R(x, '#cfe3f7', 15, 3, 2, 3); R(x, '#f2e6c8', 23, 8, 8, 7); R(x, '#7a7a7a', 23, 6, 8, 3);
  return c;
}
function site(): HTMLCanvasElement {
  const { c, x } = mk(40, 20);
  R(x, '#b98a4b', 0, 8, 14, 12); R(x, '#8c6a32', 0, 8, 14, 2); R(x, '#d8a860', 16, 12, 12, 8); R(x, '#f97316', 31, 6, 7, 14); R(x, '#fff', 32, 10, 5, 2);
  return c;
}
function rug(w: number, h: number, a: string, b: string): HTMLCanvasElement {
  const { c, x } = mk(w, h);
  R(x, a, 0, 0, w, h); R(x, b, 3, 3, w - 6, h - 6); R(x, a, 6, 6, w - 12, h - 12); R(x, b, 10, 10, w - 20, h - 20);
  return c;
}

/* ---------- nhân vật 12×18 ---------- */
const FRONT = [
  '...HHHHHH...', '..HHHHHHHH..', '..HSSSSSSH..', '..SSeSSeSS..', '..SSSSSSSS..', '...SSSSSS...',
  '..TTTTTTTT..', '.STTTTTTTTS.', '.STTTTTTTTS.', '.SSTTTTTTSS.', '..TTTTTTTT..', '..PPPPPPPP..',
  '..PPP..PPP..', '..PPP..PPP..', '..PPP..PPP..', '..BBB..BBB..', '..BBB..BBB..', '............',
];
const FRONT_B = FRONT.map((r, i) => (i >= 12 && i <= 14 ? '.PPP....PPP.' : i >= 15 && i <= 16 ? '.BBB....BBB.' : r));
const BACK = [
  '...HHHHHH...', '..HHHHHHHH..', '..HHHHHHHH..', '..HHHHHHHH..', '..HHHHHHHH..', '...SSSSSS...',
  '..TTTTTTTT..', '.STTTTTTTTS.', '.STTTTTTTTS.', '.SSTTTTTTSS.', '..TTTTTTTT..', '..TTTTTTTT..',
  '............', '............', '............', '............', '............', '............',
];
export const SKINS = ['#f1c9a5', '#e0ac82', '#c68a5e', '#8d5a3b'];
export const HAIRS = ['#2b1d12', '#5a3a1c', '#1a1a1a', '#b5651d', '#7a7a7a', '#d9b36a'];
export const SHIRTS = ['#d94f4f', '#4f8fd9', '#4fb36a', '#a460d9', '#e0c04f', '#e8e8e8', '#e8896c', '#3fb8b8'];

export function charKey(i: number, view: 'front' | 'frontB' | 'back') { return `ch${i}_${view}`; }
export const CHAR_VARIANTS = 12;

/* ---------- đăng ký ---------- */
export function registerArt(scene: Phaser.Scene): void {
  const add = (key: string, c: HTMLCanvasElement) => { if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c); };
  ['herring', 'checker', 'carpet', 'teal', 'tile', 'brick'].forEach((k) => add('floor_' + k, floorTile(k)));
  [0x6b4423, 0xe8896c, 0xf1e8c8, 0xc5ccd8, 0xe6dcc0, 0xf3d9a4].forEach((w) => add('wall_' + w.toString(16), wallTile(w)));
  add('desk', desk()); add('bigdesk', bigDesk());
  add('mon_idle', monitor('#4a6fa5')); add('mon_up', monitor('#2c9c55')); add('mon_down', monitor('#c4423f'));
  add('chair_teal', chair('#2f8f8f')); add('chair_red', chair('#b84a4a')); add('chair_gold', chair('#c9a227'));
  add('plant', plant()); add('shelf', shelf()); add('server', server()); add('board', board()); add('cabinet', cabinet());
  add('window', windowTile()); add('pic0', picture(0)); add('pic1', picture(1)); add('pic2', picture(2));
  add('globe', globe()); add('crown', crown()); add('goldcase', goldcase()); add('maquette', maquette()); add('site', site());
  add('rug_red', rug(96, 48, '#7a2f1f', '#d9a441')); add('rug_green', rug(64, 34, '#6e7f55', '#b7c48b')); add('rug_grey', rug(64, 34, '#7b7681', '#aaa5b2'));
  for (let i = 0; i < CHAR_VARIANTS; i++) {
    const pal = { H: HAIRS[i % HAIRS.length], S: SKINS[(i * 3) % SKINS.length], T: SHIRTS[i % SHIRTS.length], P: i % 2 ? '#2f3a5a' : '#3a3a3a', B: '#1e1e1e', e: '#222' };
    add(charKey(i, 'front'), fromRows(FRONT, pal)); add(charKey(i, 'frontB'), fromRows(FRONT_B, pal)); add(charKey(i, 'back'), fromRows(BACK, pal));
  }
}
