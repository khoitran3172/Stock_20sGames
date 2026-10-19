import Phaser from 'phaser';
import { registerArt, charKey, CHAR_VARIANTS } from '../core/art';
import { FLOORS, type FloorDef, type RoomDef } from '../core/building';

/* Hình học tòa nhà (đơn vị: pixel gốc). Thêm tầng vào FLOORS → chiều cao tự tăng. */
export const GAME_W = 760;
const ROOM_W = 224, ROOM_H = 108, WALL = 24, CORR = 16, SLAB = 6, GAP = 8, LEFT = 8;
const STEP = ROOM_H + CORR + SLAB, ROOF = 44, STREET = 28;
const SHAFT_X = LEFT + 3 * ROOM_W + 2 * GAP + 8;
export const gameHeight = (floors: number) => ROOF + floors * STEP + STREET;
const FONT = { fontFamily: 'VT323, monospace', fontSize: '14px', color: '#ffffff' };

export interface BuildingView {
  state: () => { floors: number[]; rooms: string[]; name: string };
  onRoom: (floorId: number, roomId: string) => void;
  onFloor: (floorId: number) => void;
}
interface RoomVis { floor: number; room: RoomDef; x: number; y: number; chars: Phaser.GameObjects.Image[] }

export class OfficeScene extends Phaser.Scene {
  private view!: BuildingView;
  private rooms: RoomVis[] = [];
  private monitors: Phaser.GameObjects.Image[] = [];
  private outline!: Phaser.GameObjects.Graphics;
  private hoverKey = '';
  private selFloor = 1;
  private mood = 0;
  private walkers: { img: Phaser.GameObjects.Image; v: number }[] = [];
  private car?: Phaser.GameObjects.Container;

  constructor() { super('office'); }

  private floorY(id: number) { return ROOF + (FLOORS.length - id) * STEP; }

  create(): void {
    registerArt(this);
    this.view = this.registry.get('view') as BuildingView;
    this.rebuild();
  }

  /** Dựng lại toàn bộ cảnh (sau khi mở tầng/xây phòng). */
  rebuild(): void {
    this.children.removeAll(true); this.tweens.killAll(); this.time.removeAllEvents();
    this.rooms = []; this.monitors = []; this.walkers = []; this.car = undefined; this.hoverKey = '';
    const st = this.view.state(); const H = gameHeight(FLOORS.length);
    if (this.scale.height !== H) this.scale.resize(GAME_W, H);
    this.cameras.main.setBackgroundColor('#0f0d18');

    this.drawShell(st.name, H);
    FLOORS.forEach((f) => this.drawFloor(f, st));
    this.outline = this.add.graphics().setDepth(1000);
    this.drawOutline();
    this.placeCar(this.selFloor, false);
    this.setMood(this.mood);

    this.time.addEvent({ delay: 700, loop: true, callback: () => this.rooms.forEach((r) => r.chars.forEach((c, k) => { if (Math.random() < 0.25) this.tweens.add({ targets: c, y: c.y + (k % 2 ? 1 : -1), duration: 120, yoyo: true }); })) });
    this.time.addEvent({ delay: 3200, loop: true, callback: () => this.randomBubble() });
    this.time.addEvent({ delay: 220, loop: true, callback: () => this.walkers.forEach((w) => { w.img.setTexture(charKey(w.v, (this.time.now / 220) % 2 < 1 ? 'front' : 'frontB')); }) });
  }

  /* ---------- vỏ tòa nhà: mái, biển hiệu, phố ---------- */
  private drawShell(name: string, H: number): void {
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(0x2a2540, 1).fillRect(2, ROOF - 6, GAME_W - 4, H - ROOF - STREET + 6);          // thân tòa nhà
    g.fillStyle(0x3a3358, 1).fillRect(0, ROOF - 12, GAME_W, 8);                                  // mái đua
    g.fillStyle(0x4b4373, 1).fillRect(0, ROOF - 12, GAME_W, 2);
    g.fillStyle(0x201c36, 1).fillRect(SHAFT_X - 4, ROOF - 6, 48 + 8, H - ROOF - STREET + 6);     // trục thang máy
    g.fillStyle(0x6a6a74, 1).fillRect(0, H - STREET, GAME_W, STREET);                            // phố
    g.fillStyle(0x55555e, 1).fillRect(0, H - STREET, GAME_W, 3);
    for (let x = 10; x < GAME_W; x += 40) g.fillStyle(0xe8e8e8, 1).fillRect(x, H - 10, 22, 2);
    // cột ăng-ten + biển hiệu
    g.fillStyle(0x888899, 1).fillRect(GAME_W - 70, 6, 2, ROOF - 18).fillRect(GAME_W - 78, 14, 18, 2);
    g.fillStyle(0xef4444, 1).fillRect(GAME_W - 71, 4, 4, 4);
    const sign = this.add.text(GAME_W / 2 - 40, 8, name.toUpperCase(), { ...FONT, fontSize: '22px', color: '#f5c542', stroke: '#7a4a00', strokeThickness: 3 }).setOrigin(0.5, 0).setResolution(2).setDepth(5);
    sign.setX(LEFT + 3 * ROOM_W / 2 + GAP);
    // mái hiên cửa chính
    for (let i = 0; i < 10; i++) g.fillStyle(i % 2 ? 0xffffff : 0xc0392b, 1).fillRect(GAME_W / 2 - 80 + i * 16, H - STREET - 10, 16, 10);
    g.fillStyle(0x15121f, 1).fillRect(GAME_W / 2 - 80, H - STREET - 12, 160, 2);
  }

  /* ---------- một tầng ---------- */
  private drawFloor(f: FloorDef, st: { floors: number[]; rooms: string[] }): void {
    const y0 = this.floorY(f.id);
    const g = this.add.graphics().setDepth(1);
    // hành lang
    g.fillStyle(0x8c8a92, 1).fillRect(LEFT, y0 + ROOM_H, 3 * ROOM_W + 2 * GAP, CORR);
    g.fillStyle(0x8c2f35, 1).fillRect(LEFT, y0 + ROOM_H + 5, 3 * ROOM_W + 2 * GAP, 6);
    for (let x = LEFT + 6; x < LEFT + 3 * ROOM_W + 2 * GAP; x += 16) g.fillStyle(0xd96b72, 1).fillRect(x, y0 + ROOM_H + 7, 2, 2);
    // sàn bê tông giữa các tầng
    g.fillStyle(0x4b4373, 1).fillRect(2, y0 + ROOM_H + CORR, GAME_W - 4, SLAB).fillStyle(0x15121f, 1).fillRect(2, y0 + ROOM_H + CORR + SLAB - 1, GAME_W - 4, 1);
    // trục thang máy: cửa + biển số tầng
    g.fillStyle(0x15121f, 1).fillRect(SHAFT_X, y0 + 8, 40, ROOM_H + CORR - 8);
    g.fillStyle(0x6a6a7a, 1).fillRect(SHAFT_X + 2, y0 + 10, 36, ROOM_H + CORR - 12);
    g.fillStyle(0x3b3b4a, 1).fillRect(SHAFT_X + 19, y0 + 10, 2, ROOM_H + CORR - 12);
    const un = st.floors.includes(f.id);
    this.add.text(SHAFT_X + 20, y0 + 1, 'T' + f.id, { ...FONT, fontSize: '14px', color: un ? '#f5c542' : '#7a7a8a' }).setOrigin(0.5, 0).setResolution(2).setDepth(3);
    this.add.zone(SHAFT_X, y0, 40, ROOM_H + CORR).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.view.onFloor(f.id));

    if (!un) { this.drawLockedFloor(f, y0); return; }
    f.rooms.forEach((r, i) => {
      const x = LEFT + i * (ROOM_W + GAP);
      if (st.rooms.includes(r.id)) this.buildRoom(f, r, x, y0); else this.buildPlot(f, r, x, y0);
    });
    // người đi lại ngoài hành lang
    const n = f.id === 1 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const v = (f.id * 3 + k * 5 + 2) % CHAR_VARIANTS, wy = y0 + ROOM_H - 4;
      const img = this.add.image(LEFT + 20 + k * 300, wy, charKey(v, 'front')).setOrigin(0).setDepth(wy + 18);
      this.walkers.push({ img, v });
      this.tweens.add({ targets: img, x: 560 - k * 120, duration: 14000 + k * 5000 + f.id * 900, yoyo: true, repeat: -1, onYoyo: () => img.setFlipX(!img.flipX), onRepeat: () => img.setFlipX(!img.flipX) });
    }
  }

  private drawLockedFloor(f: FloorDef, y0: number): void {
    const w = 3 * ROOM_W + 2 * GAP;
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x1a1730, 1).fillRect(LEFT, y0, w, ROOM_H);
    g.lineStyle(2, 0x39325a, 1);
    for (let x = LEFT; x < LEFT + w; x += 28) g.lineBetween(x, y0 + ROOM_H, x + 28, y0);        // giàn giáo chéo
    for (let y = y0 + 20; y < y0 + ROOM_H; y += 28) g.lineBetween(LEFT, y, LEFT + w, y);
    g.fillStyle(0xf5c542, 1);
    for (let x = LEFT; x < LEFT + w; x += 24) g.fillRect(x, y0 + ROOM_H - 6, 12, 6);              // băng cảnh báo
    g.fillStyle(0x0f0d18, 0.9).fillRect(LEFT + w / 2 - 150, y0 + 24, 300, 56).lineStyle(2, 0xf5c542, 1).strokeRect(LEFT + w / 2 - 150, y0 + 24, 300, 56);
    this.add.text(LEFT + w / 2, y0 + 30, `TẦNG ${f.id} · ${f.name.toUpperCase()}`, { ...FONT, fontSize: '16px', color: '#f5c542' }).setOrigin(0.5, 0).setResolution(2).setDepth(5);
    this.add.text(LEFT + w / 2, y0 + 52, `Cần quy mô bậc ${f.tier} · ${f.cost.toLocaleString('vi-VN')} tr · bấm để xem điều kiện`, { ...FONT, fontSize: '13px', color: '#cfc9ea' }).setOrigin(0.5, 0).setResolution(2).setDepth(5);
    this.add.image(LEFT + 8, y0 + ROOM_H - 24, 'site').setOrigin(0).setDepth(4);
    this.add.zone(LEFT, y0, w, ROOM_H).setOrigin(0).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.view.onFloor(f.id))
      .on('pointerover', () => { this.hoverKey = 'F' + f.id; this.drawOutline(); }).on('pointerout', () => { this.hoverKey = ''; this.drawOutline(); });
  }

  /* ---------- phòng đã xây ---------- */
  private buildRoom(f: FloorDef, d: RoomDef, x: number, y: number): void {
    this.add.tileSprite(x, y + WALL, ROOM_W, ROOM_H - WALL, 'floor_' + d.floor).setOrigin(0).setDepth(2);
    this.add.tileSprite(x, y, ROOM_W, WALL, 'wall_' + d.wall.toString(16)).setOrigin(0).setDepth(3);
    this.add.rectangle(x + ROOM_W / 2 - 14, y + ROOM_H - 4, 28, 4, d.color).setOrigin(0).setDepth(4);

    const hasBoard = d.props.includes('board');
    this.add.image(x + 14, y + 4, 'window').setOrigin(0).setDepth(4);
    this.add.image(x + 44, y + 4, 'window').setOrigin(0).setDepth(4);
    if (!hasBoard) this.add.image(x + 100 + (f.id % 2) * 18, y + 5, 'pic' + ((f.id + d.id.length) % 3)).setOrigin(0).setDepth(4);

    const label = this.add.text(x + 6, y + 3, d.short, { ...FONT, fontSize: '13px' }).setDepth(60).setResolution(2);
    this.add.rectangle(x + 2, y + 2, label.width + 10, 15, 0x15121f, 0.88).setOrigin(0).setDepth(59).setStrokeStyle(1, d.color);

    const chars: Phaser.GameObjects.Image[] = [];
    const fy = y + WALL;
    let deskN = 0, plants = 0;
    d.props.forEach((p) => {
      if (p === 'rug') this.add.image(x + 56, fy + 30, 'rug_red').setOrigin(0).setDepth(5);
      else if (p === 'shelf') { this.add.image(x + ROOM_W - 30, y + 2, 'shelf').setOrigin(0).setDepth(8); this.add.image(x + ROOM_W - 50, fy - 2, 'globe').setOrigin(0).setDepth(fy + 8); }
      else if (p === 'server') this.add.image(x + ROOM_W - 24, y + 4, 'server').setOrigin(0).setDepth(y + 36);
      else if (p === 'board') this.add.image(x + 140, y + 2, 'board').setOrigin(0).setDepth(4);
      else if (p === 'cabinet') this.add.image(x + ROOM_W - 24, y + 6, 'cabinet').setOrigin(0).setDepth(y + 36);
      else if (p === 'goldcase') this.add.image(x + 110, fy + 26, 'goldcase').setOrigin(0).setDepth(fy + 50);
      else if (p === 'maquette') this.add.image(x + 108, fy + 24, 'maquette').setOrigin(0).setDepth(fy + 50);
      else if (p === 'plant') { this.add.image(plants++ % 2 === 0 ? x + 5 : x + ROOM_W - 18, y + ROOM_H - 20, 'plant').setOrigin(0).setDepth(y + ROOM_H); }
      else if (p === 'bigdesk') {
        const bx = x + 70, by = fy + 28;
        this.add.image(bx + 18, by - 24, 'chair_gold').setOrigin(0).setDepth(by - 2);
        const boss = this.add.image(bx + 20, by - 18, charKey(f.id % CHAR_VARIANTS, 'front')).setOrigin(0).setDepth(by - 1);
        this.add.image(bx + 22, by - 24, 'crown').setOrigin(0).setDepth(by);
        this.add.image(bx, by, 'bigdesk').setOrigin(0).setDepth(by + 20);
        this.monitors.push(this.add.image(bx + 36, by - 7, 'mon_idle').setOrigin(0).setDepth(by + 21)); chars.push(boss);
      } else if (p === 'desk') {
        const dxp = x + (deskN === 0 ? 34 : 118), dyp = fy + 28, v = (f.id * 5 + d.id.length * 2 + deskN) % CHAR_VARIANTS;
        this.add.image(dxp + 10, dyp + 10, deskN % 2 ? 'chair_red' : 'chair_teal').setOrigin(0).setDepth(dyp + 14);
        chars.push(this.add.image(dxp + 10, dyp + 3, charKey(v, 'back')).setOrigin(0).setDepth(dyp + 17));
        this.add.image(dxp, dyp, 'desk').setOrigin(0).setDepth(dyp + 12);
        this.monitors.push(this.add.image(dxp + 9, dyp - 9, 'mon_idle').setOrigin(0).setDepth(dyp + 13)); deskN++;
      }
    });

    this.hitZone(f.id, d.id, x, y, `${f.id}:${d.id}`);
    this.rooms.push({ floor: f.id, room: d, x, y, chars });
  }

  /* ---------- mặt bằng trống (chưa xây) ---------- */
  private buildPlot(f: FloorDef, d: RoomDef, x: number, y: number): void {
    this.add.tileSprite(x, y + WALL, ROOM_W, ROOM_H - WALL, 'floor_tile').setOrigin(0).setDepth(2).setTint(0x5c5c66);
    this.add.tileSprite(x, y, ROOM_W, WALL, 'wall_c5ccd8').setOrigin(0).setDepth(3).setTint(0x66667a);
    const g = this.add.graphics().setDepth(5);
    g.lineStyle(2, d.color, 0.8);
    for (let i = 0; i < ROOM_W - 8; i += 12) { g.lineBetween(x + 4 + i, y + WALL + 4, x + 10 + i, y + WALL + 4); g.lineBetween(x + 4 + i, y + ROOM_H - 6, x + 10 + i, y + ROOM_H - 6); }
    for (let j = 0; j < ROOM_H - WALL - 10; j += 12) { g.lineBetween(x + 4, y + WALL + 4 + j, x + 4, y + WALL + 10 + j); g.lineBetween(x + ROOM_W - 4, y + WALL + 4 + j, x + ROOM_W - 4, y + WALL + 10 + j); }
    this.add.image(x + ROOM_W - 46, y + ROOM_H - 26, 'site').setOrigin(0).setDepth(y + ROOM_H);
    this.add.text(x + ROOM_W / 2, y + WALL + 16, 'MẶT BẰNG TRỐNG', { ...FONT, fontSize: '15px', color: '#d8d4ee' }).setOrigin(0.5, 0).setResolution(2).setDepth(20);
    this.add.text(x + ROOM_W / 2, y + WALL + 34, d.name, { ...FONT, fontSize: '16px', color: d.css }).setOrigin(0.5, 0).setResolution(2).setDepth(20);
    this.add.text(x + ROOM_W / 2, y + WALL + 52, `Xây: ${d.cost.toLocaleString('vi-VN')} tr`, { ...FONT, fontSize: '14px', color: '#f5c542' }).setOrigin(0.5, 0).setResolution(2).setDepth(20);
    this.hitZone(f.id, d.id, x, y, `${f.id}:${d.id}`);
  }

  private hitZone(floorId: number, roomId: string, x: number, y: number, key: string): void {
    this.add.zone(x, y, ROOM_W, ROOM_H).setOrigin(0).setInteractive({ useHandCursor: true })
      .on('pointerover', () => { this.hoverKey = key; this.drawOutline(); })
      .on('pointerout', () => { if (this.hoverKey === key) this.hoverKey = ''; this.drawOutline(); })
      .on('pointerdown', () => this.view.onRoom(floorId, roomId));
  }

  /* ---------- chọn tầng, thang máy, viền ---------- */
  selectFloor(id: number): void { this.selFloor = id; this.drawOutline(); this.placeCar(id, true); }

  private placeCar(id: number, animate: boolean): void {
    const y = this.floorY(id) + ROOM_H + CORR - 38;
    if (!this.car) {
      const body = this.add.rectangle(0, 0, 34, 36, 0xcfd3dc).setOrigin(0).setStrokeStyle(2, 0x5a5a6a);
      const person = this.add.image(11, 18, charKey(7, 'front')).setOrigin(0);
      const lamp = this.add.rectangle(15, 3, 4, 3, 0xf5c542).setOrigin(0);
      this.car = this.add.container(SHAFT_X + 3, y, [body, person, lamp]).setDepth(50);
    } else if (animate) this.tweens.add({ targets: this.car, y, duration: 450, ease: 'Sine.easeInOut' });
    else this.car.setY(y);
  }

  private drawOutline(): void {
    const g = this.outline; if (!g) return; g.clear();
    const w = 3 * ROOM_W + 2 * GAP;
    const y0 = this.floorY(this.selFloor);
    g.lineStyle(2, 0xf5c542, 0.9).strokeRect(LEFT - 3, y0 - 3, w + 6, ROOM_H + CORR + 6);
    if (this.hoverKey) {
      if (this.hoverKey.startsWith('F')) { const fy = this.floorY(+this.hoverKey.slice(1)); g.lineStyle(2, 0xffffff, 0.6).strokeRect(LEFT - 1, fy - 1, w + 2, ROOM_H + 2); }
      else {
        const [fid, rid] = this.hoverKey.split(':'); const f = FLOORS.find((q) => q.id === +fid); if (!f) return;
        const i = f.rooms.findIndex((r) => r.id === rid); const rx = LEFT + i * (ROOM_W + GAP), ry = this.floorY(f.id);
        g.lineStyle(2, 0xffffff, 0.7).strokeRect(rx - 1, ry - 1, ROOM_W + 2, ROOM_H + 2);
      }
    }
  }

  /** mood −1..1: màn hình đỏ/xanh theo thị trường. */
  setMood(m: number): void {
    this.mood = m;
    const key = m > 0.1 ? 'mon_up' : m < -0.1 ? 'mon_down' : 'mon_idle';
    this.monitors.forEach((mon) => mon.setTexture(key));
  }
  private randomBubble(): void {
    if (Math.abs(this.mood) < 0.1) return;
    const all = this.rooms.flatMap((r) => r.chars); const c = all[Math.floor(Math.random() * all.length)]; if (!c) return;
    const t = this.add.text(c.x - 2, c.y - 12, this.mood > 0 ? '$' : '!', { ...FONT, color: this.mood > 0 ? '#3fcf6d' : '#ef5350', fontSize: '16px', backgroundColor: '#0d0b15' }).setDepth(900).setResolution(2).setPadding(2, 0, 2, 0);
    this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, duration: 1600, onComplete: () => t.destroy() });
  }
  /** Nhấp nháy một phòng khi có sự kiện. */
  pulse(roomId: string): void {
    const r = this.rooms.find((q) => q.room.id === roomId); if (!r) return;
    const flash = this.add.rectangle(r.x, r.y, ROOM_W, ROOM_H, r.room.color, 0.35).setOrigin(0).setDepth(500);
    this.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
  }
  builtRoomIds(): string[] { return this.rooms.map((r) => r.room.id); }
}
