import Phaser from 'phaser';
import { registerIsoArt, TW } from '../core/isoart';
import { PLOTS, SECTOR_SPRITES, SPRITE_FILES, stockInfo } from '../core/stocks';
import { roomById } from '../core/building';

/* Thành phố isometric: lưới 6×6 ô đất (mỗi ô 2×2 tile), đường rộng 1 tile giữa các ô.
   30 ô là 30 mã VN30, một ô là trụ sở công ty, vài ô là lô mở rộng. */
const N = 19, OX = (N * TW) / 2, OY = 250;
const P = (x: number, y: number) => ({ x: OX + (x - y) * 32, y: OY + (x + y) * 16 });
const FONT = { fontFamily: 'VT323, monospace', fontSize: '16px', color: '#ffffff' };
const ZOOMS = [0.5, 0.75, 1, 1.5, 2];
const LABEL_COL: Record<string, string> = { up: '#3fcf6d', down: '#ef5350', ref: '#f5c542', ceil: '#e879f9', floor: '#22d3ee' };
const PAD_SPRITES = new Set(['bank_b', 'complex', 'steel', 'oil', 'tech', 'airport', 'rubber', 'dairy', 'mall', 'resi']);

export interface Tk { sym: string; pct: number; price: number; st: 'ceil' | 'floor' | 'up' | 'down' | 'ref' }
export interface HoverInfo { sym: string; name: string; pct: number; price: number; st: string; x: number; y: number }
export interface CityView {
  state: () => { floors: number; maxFloors: number; rooms: string[]; name: string };
  onHQ: () => void;
  onStock: (sym: string) => void;
  onLot: (room: string | null) => void;
  onHover: (info: HoverInfo | null) => void;
}
interface Bld { sym: string; sprite: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; glow?: Phaser.GameObjects.Image; baseY: number; tween?: Phaser.Tweens.Tween }

export class CityScene extends Phaser.Scene {
  private view!: CityView;
  private blds = new Map<string, Bld>();
  private tickers = new Map<string, Tk>();
  private mood = 0;
  private hour = 12;
  private zoomIdx = 2;
  private dragMoved = false;
  private rain!: Phaser.GameObjects.Graphics;
  private night!: Phaser.GameObjects.Rectangle;
  private sky!: Phaser.GameObjects.Image;
  private bikes: { img: Phaser.GameObjects.Image; axis: 'a' | 'b'; lane: number; t: number; dir: number; v: number }[] = [];
  private rainDrops: { x: number; y: number; v: number }[] = [];
  private selRing!: Phaser.GameObjects.Graphics;
  private selKey = '';

  constructor() { super('city'); }

  preload(): void {
    const base = (import.meta.env.BASE_URL as string) ?? './';
    SPRITE_FILES.forEach((k) => this.load.image(k, `${base}assets/iso/${k}.png`));
  }

  create(): void {
    registerIsoArt(this);
    this.view = this.registry.get('view') as CityView;
    this.build();
    const cam = this.cameras.main;
    const hq = this.plotCenter('HQ'); cam.centerOn(hq.x, hq.y - 40);
    this.zoomIdx = cam.width >= 1700 ? 3 : cam.width >= 950 ? 2 : cam.width >= 700 ? 1 : 0; cam.setZoom(ZOOMS[this.zoomIdx]); this.layoutOverlay();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dx = p.x - p.prevPosition.x, dy = p.y - p.prevPosition.y;
      if (Math.abs(p.x - p.downX) + Math.abs(p.y - p.downY) > 6) this.dragMoved = true;
      if (this.dragMoved) { cam.scrollX -= dx / cam.zoom; cam.scrollY -= dy / cam.zoom; }
    });
    this.input.on('pointerup', () => { this.time.delayedCall(30, () => { this.dragMoved = false; }); });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.zoomIdx = Phaser.Math.Clamp(this.zoomIdx + (dy > 0 ? -1 : 1), 0, ZOOMS.length - 1); cam.setZoom(ZOOMS[this.zoomIdx]); this.layoutOverlay();
    });
    this.scale.on('resize', () => this.layoutOverlay());
  }

  private plotCenter(key: string): { x: number; y: number } {
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (PLOTS[j][i] === key) return P(3 * i + 2, 3 * j + 2);
    return P(9, 9);
  }

  /* ---------- dựng toàn cảnh ---------- */
  private build(): void {
    const st = this.view.state();
    this.blds.clear(); this.bikes = [];
    // ground
    for (let ty = 0; ty < N; ty++) for (let tx = 0; tx < N; tx++) {
      const rx = tx % 3 === 0, ry = ty % 3 === 0;
      const key = rx && ry ? 't_road_x' : rx ? 't_road_b' : ry ? 't_road_a' : 't_grass';
      const p = P(tx, ty); this.add.image(p.x, p.y, key).setOrigin(0.5, 0).setDepth(0);
    }
    // plaza quanh HQ
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) if (PLOTS[j][i] === 'HQ') for (const dx of [1, 2]) for (const dy of [1, 2]) { const p = P(3 * i + dx, 3 * j + dy); this.add.image(p.x, p.y, 't_plaza').setOrigin(0.5, 0).setDepth(1); }

    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
      const key = PLOTS[j][i]; const c = P(3 * i + 2, 3 * j + 2);
      if (key === 'HQ') this.addHQ(c, st);
      else if (key.startsWith('lot:')) this.addLot(c, key.slice(4), st.rooms);
      else if (key === 'future') this.addLot(c, '', st.rooms);
      else this.addStock(key, c, i + j * 6);
    }
    // xe máy trên đường
    for (let k = 0; k < 8; k++) {
      const axis = k % 2 ? 'a' : 'b'; const lane = 3 * (1 + (k % 5));
      const img = this.add.image(0, 0, 'bike').setOrigin(0.5, 1).setDepth(10);
      this.bikes.push({ img, axis, lane: lane + 0.5, t: (k * 2.7) % N, dir: k % 3 === 0 ? -1 : 1, v: 1.6 + (k % 3) * 0.5 });
    }
    // sky + overlays (cố định theo màn hình)
    const sky = this.textures.exists('sky') ? this.textures.get('sky') : this.textures.addCanvas('sky', document.createElement('canvas'));
    void sky; this.sky = this.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0).setDepth(-10);
    this.night = this.add.rectangle(0, 0, 10, 10, 0x080a2c, 0).setOrigin(0).setScrollFactor(0).setDepth(9000);
    this.rain = this.add.graphics().setScrollFactor(0).setDepth(9001);
    this.selRing = this.add.graphics().setDepth(8000);
    this.layoutOverlay(); this.setHour(this.hour); this.applyTickers();
    this.cameras.main.setBounds(-200, OY - 320, N * TW + 400, N * 32 + 560 + 120);
  }

  private layoutOverlay(): void {
    const w = this.scale.width, h = this.scale.height, z = this.cameras.main.zoom || 1;
    const sw = w / z, sh = h / z, px = w / 2 - sw / 2, py = h / 2 - sh / 2;
    this.night?.setPosition(px, py).setSize(sw, sh); this.sky?.setPosition(px, py).setDisplaySize(sw, sh);
  }
  /** toạ độ màn hình → toạ độ cho đối tượng scrollFactor 0 */
  private sf(x: number, y: number): { x: number; y: number } {
    const w = this.scale.width, h = this.scale.height, z = this.cameras.main.zoom || 1;
    return { x: (x - w / 2) / z + w / 2, y: (y - h / 2) / z + h / 2 };
  }

  private spriteBase(key: string, c: { x: number; y: number }, depthBias = 0): { y: number; depth: number } {
    const y = c.y + (PAD_SPRITES.has(key) ? 32 : 22); return { y, depth: y + depthBias };
  }

  private addStock(sym: string, c: { x: number; y: number }, idx: number): void {
    const info = stockInfo(sym); if (!info) return;
    const list = SECTOR_SPRITES[info.sector]; const key = list[idx % list.length];
    const { y, depth } = this.spriteBase(key, c);
    const sprite = this.add.image(c.x, y, key).setOrigin(0.5, 1).setDepth(depth);
    const label = this.add.text(c.x, y - sprite.height - 4, sym, { ...FONT, backgroundColor: '#0b0a14', padding: { x: 4, y: 1 } }).setOrigin(0.5, 1).setDepth(9500 + depth / 1000).setResolution(2);
    this.blds.set(sym, { sym, sprite, label, baseY: y });
    sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 40, useHandCursor: true });
    sprite.on('pointerover', (p: Phaser.Input.Pointer) => this.hover(sym, p)).on('pointermove', (p: Phaser.Input.Pointer) => this.hover(sym, p))
      .on('pointerout', () => this.view.onHover(null)).on('pointerup', () => { if (!this.dragMoved) { this.select(sym, c); this.view.onStock(sym); } });
  }

  private hover(sym: string, p: Phaser.Input.Pointer): void {
    const t = this.tickers.get(sym); const info = stockInfo(sym); if (!info) return;
    this.view.onHover({ sym, name: info.name, pct: t?.pct ?? 0, price: t?.price ?? 0, st: t?.st ?? 'ref', x: (p.event as MouseEvent).clientX, y: (p.event as MouseEvent).clientY });
  }

  private addHQ(c: { x: number; y: number }, st: { floors: number; maxFloors: number; name: string }): void {
    const y = c.y + 26, depth = y;
    const glow = this.add.image(c.x, c.y + 8, 'glow_gold').setDepth(depth - 1).setAlpha(0.6);
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 1400, yoyo: true, repeat: -1 });
    const sprite = this.add.image(c.x, y, 'hq').setOrigin(0.5, 1).setDepth(depth);
    this.add.text(c.x, y - sprite.height - 4, `${st.name.toUpperCase()} · T${st.floors}/${st.maxFloors}`, { ...FONT, color: '#f5c542', backgroundColor: '#0b0a14', padding: { x: 5, y: 1 } }).setOrigin(0.5, 1).setDepth(9500 + depth / 1000).setResolution(2);
    sprite.setInteractive({ pixelPerfect: true, alphaTolerance: 40, useHandCursor: true });
    sprite.on('pointerup', () => { if (!this.dragMoved) { this.select('HQ', c); this.view.onHQ(); } });
  }

  private addLot(c: { x: number; y: number }, room: string, built: string[]): void {
    const def = room ? roomById(room) : undefined;
    if (room && built.includes(room)) {
      const key = room === 'vg' ? 'bank_b' : room === 'bd' ? 'complex' : 'resi';
      const { y, depth } = this.spriteBase(key, c);
      const s = this.add.image(c.x, y, key).setOrigin(0.5, 1).setDepth(depth);
      this.add.text(c.x, y - s.height - 4, def!.short, { ...FONT, color: def!.css, backgroundColor: '#0b0a14', padding: { x: 4, y: 1 } }).setOrigin(0.5, 1).setDepth(9500 + depth / 1000).setResolution(2);
      s.setInteractive({ pixelPerfect: true, alphaTolerance: 40, useHandCursor: true }).on('pointerup', () => { if (!this.dragMoved) this.view.onLot(room); });
      return;
    }
    const lot = this.add.image(c.x, c.y, 't_lot').setOrigin(0.5, 0.5).setDepth(c.y);
    const title = room ? `MẶT BẰNG · ${def!.short}` : 'MẶT BẰNG · SẮP CÓ';
    const sub = room ? `Xây: ${def!.cost.toLocaleString('vi-VN')} tr` : 'chưa mở';
    const t = this.add.text(c.x, c.y - 18, `${title}\n${sub}`, { ...FONT, fontSize: '13px', align: 'center', color: room ? def!.css : '#9a95b8', backgroundColor: '#0b0a14', padding: { x: 4, y: 2 } }).setOrigin(0.5, 1).setDepth(9500 + c.y / 1000).setResolution(2);
    void t;
    lot.setInteractive({ pixelPerfect: true, alphaTolerance: 30, useHandCursor: true }).on('pointerup', () => { if (!this.dragMoved) this.view.onLot(room || null); });
  }

  /* ---------- dữ liệu, mood, thời gian ---------- */
  setTickers(list: Tk[]): void { this.tickers = new Map(list.map((t) => [t.sym, t])); this.applyTickers(); }

  private applyTickers(): void {
    this.blds.forEach((b) => {
      const t = this.tickers.get(b.sym); if (!t) return;
      b.label.setText(`${b.sym} ${t.pct >= 0 ? '▲' : '▼'}${Math.abs(t.pct).toFixed(1)}%`).setColor(LABEL_COL[t.st]);
      b.sprite.setTint(t.st === 'floor' ? 0x7f93b8 : t.st === 'down' && t.pct < -3 ? 0xd8c8c8 : 0xffffff);
      b.tween?.stop(); b.sprite.y = b.baseY;
      if (b.glow) { b.glow.destroy(); b.glow = undefined; }
      if (t.st === 'ceil' || t.st === 'floor') {
        const key = t.st === 'ceil' ? 'glow_purple' : 'glow_cyan';
        b.glow = this.add.image(b.sprite.x, b.baseY - 22, key).setDepth(b.sprite.depth - 1);
        this.tweens.add({ targets: b.glow, alpha: { from: 0.9, to: 0.35 }, duration: 700, yoyo: true, repeat: -1 });
        if (t.st === 'ceil') b.tween = this.tweens.add({ targets: b.sprite, y: b.baseY - 2, duration: 450, yoyo: true, repeat: -1 });
      }
    });
  }

  setMood(m: number): void { this.mood = m; }

  setHour(h: number): void {
    this.hour = h;
    const kf: [number, string, string][] = [[0, '#070a22', '#14194a'], [5, '#0d1236', '#2a2a66'], [6.3, '#4a3a7a', '#f2a65a'], [8, '#4f9fe0', '#cfeaff'], [14, '#4a96dc', '#bfe3ff'], [17, '#5a6fc0', '#ffb070'], [18.4, '#2b2a6e', '#ff7a5b'], [19.5, '#0e1238', '#2b2760'], [24, '#070a22', '#14194a']];
    const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    let top = kf[0][1], bot = kf[0][2];
    for (let i = 0; i < kf.length - 1; i++) if (h >= kf[i][0] && h <= kf[i + 1][0]) {
      const t = (h - kf[i][0]) / (kf[i + 1][0] - kf[i][0]); const mix = (a: string, b: string) => `rgb(${hex(a).map((v, k) => Math.round(v + (hex(b)[k] - v) * t)).join(',')})`;
      top = mix(kf[i][1], kf[i + 1][1]); bot = mix(kf[i][2], kf[i + 1][2]); break;
    }
    const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    if (this.textures.exists('sky')) this.textures.remove('sky');
    this.textures.addCanvas('sky', c); this.sky?.setTexture('sky'); this.layoutOverlay();
    const n = h < 5.5 || h > 19.5 ? 1 : h < 7 ? 1 - (h - 5.5) / 1.5 : h > 18 ? (h - 18) / 1.5 : 0;
    this.night?.setFillStyle(0x080a2c, n * 0.5 + (this.mood < 0 ? -this.mood * 0.12 : 0));
  }

  private select(key: string, c: { x: number; y: number }): void {
    this.selKey = key; const g = this.selRing; g.clear();
    g.lineStyle(2, 0xf5c542, 1).beginPath().moveTo(c.x, c.y - 32).lineTo(c.x + 64, c.y).lineTo(c.x, c.y + 32).lineTo(c.x - 64, c.y).closePath().strokePath();
  }

  update(_t: number, dt: number): void {
    this.bikes.forEach((b) => {
      b.t += (b.dir * b.v * dt) / 1000; if (b.t > N) b.t -= N; if (b.t < 0) b.t += N;
      const p = b.axis === 'a' ? P(b.t, b.lane) : P(b.lane, b.t);
      const px = b.axis === 'a' ? P(b.t + b.dir, b.lane) : P(b.lane, b.t + b.dir);
      b.img.setPosition(p.x, p.y + 6).setDepth(p.y + 6).setFlipX(px.x < p.x);
    });
    this.rain.clear();
    if (this.mood < -0.3) {
      const w = this.scale.width, h = this.scale.height, want = Math.round(160 * -this.mood);
      while (this.rainDrops.length < want) this.rainDrops.push({ x: Math.random() * w, y: Math.random() * h, v: 6 + Math.random() * 6 });
      this.rain.lineStyle(1 / (this.cameras.main.zoom || 1), 0xaac8ff, 0.5);
      this.rainDrops.forEach((d) => { const a = this.sf(d.x, d.y), b = this.sf(d.x - 2, d.y + 8); this.rain.lineBetween(a.x, a.y, b.x, b.y); d.y += d.v; d.x -= 1; if (d.y > h) { d.y = -8; d.x = Math.random() * w; } });
    } else this.rainDrops.length = 0;
  }

  /** dựng lại khi công ty xây thêm (giữ nguyên vị trí camera) */
  rebuild(): void {
    const cam = this.cameras.main; const sx = cam.scrollX, sy = cam.scrollY;
    this.children.removeAll(true); this.tweens.killAll(); this.build(); cam.setScroll(sx, sy);
  }
}
