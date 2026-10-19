/* Popup biểu đồ nến cho một mã: 20 phút / 5 phút / 1 phút (hôm nay, từ Worker) và nến ngày (lịch sử).
   Dữ liệu hôm nay do cron của Worker cập nhật mỗi 20 phút trong giờ giao dịch → popup tự làm mới theo nhịp đó. */
import * as api from '../core/api';

export interface Bar { l: string; o: number; h: number; lo: number; c: number; v: number }
export interface StockModalOpts {
  sym: string; name: string; sector: string; board?: api.BoardRow;
  modal: (html: string) => void;
}
const COL = { up: '#3fcf6d', down: '#ef5350', ref: '#f5c542', ceil: '#d946ef', floor: '#22d3ee', grid: '#2a2542', txt: '#8f88b0' };
const pad = (n: number) => String(n).padStart(2, '0');
const fmtV = (v: number) => (v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : String(Math.round(v)));
const slotStart = (i: number) => { const m = i < 8 ? 540 + i * 20 : 780 + (i - 8) * 20; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };

function aggregate(c: api.CandleResp, minutes: number): Bar[] {
  const map = new Map<number, Bar>();
  for (let k = 0; k < c.t.length; k++) {
    const m = Math.floor(((c.t[k] + 7 * 3600) % 86400) / 60), b = Math.floor(m / minutes);
    const x = map.get(b);
    if (!x) map.set(b, { l: `${pad(Math.floor((b * minutes) / 60))}:${pad((b * minutes) % 60)}`, o: c.o[k], h: c.h[k], lo: c.l[k], c: c.c[k], v: c.v[k] });
    else { x.h = Math.max(x.h, c.h[k]); x.lo = Math.min(x.lo, c.l[k]); x.c = c.c[k]; x.v += c.v[k]; }
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

export function openStockChart(o: StockModalOpts): void {
  let tf: '20' | '5' | '1' | 'd' = '20';
  let bars: Bar[] = [], board = o.board, hover = -1, updated = '', msg = '', timer = 0, countdown = 0;

  o.modal(`<div class="chartwrap">
    <div class="chead"><div><h2 id="cSym">${o.sym} <small>${o.name} · ${o.sector}</small></h2></div><div class="cprice" id="cPrice">—</div></div>
    <div class="ctabs">
      <button data-tf="20" class="on">20 phút</button><button data-tf="5">5 phút</button><button data-tf="1">1 phút</button><button data-tf="d">Nến ngày</button>
      <span class="live" id="cLive"><i></i> cập nhật 20 phút/lần</span><button id="cRefresh" title="Làm mới ngay">⟳</button>
    </div>
    <div class="cbox"><canvas id="chartCanvas"></canvas><div id="cTip" class="ctip"></div></div>
    <div class="cstats" id="cStats"></div>
    <div class="row"><button id="mClose">Đóng</button></div>
  </div>`);

  const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T | null;
  const alive = () => !!$('#chartCanvas');

  async function load(): Promise<void> {
    msg = '';
    try {
      if (tf === 'd') {
        const rows = await api.fetchDaily(o.sym);
        bars = rows ? rows.slice(-90).map((r) => ({ l: r.d.slice(5), o: r.o, h: r.h, lo: r.l, c: r.c, v: r.v })) : [];
        if (!rows) msg = 'Chưa có dữ liệu nến ngày cho mã này.';
      } else if (tf === '20') {
        const r = await api.fetchSlots();
        const s = r.data?.slots[o.sym] ?? [];
        bars = s.map((x) => ({ l: slotStart(x.i), o: x.o, h: x.h, lo: x.l, c: x.c, v: x.v }));
        if (!bars.length) msg = 'Chưa có dữ liệu phiên hôm nay (ngày nghỉ hoặc trước 9:20).';
      } else {
        const r = await api.fetchCandles(o.sym);
        bars = r.data ? aggregate(r.data, tf === '5' ? 5 : 1) : [];
        if (!bars.length) msg = 'Chưa có dữ liệu phiên hôm nay (ngày nghỉ hoặc trước 9:20).';
      }
      const m = await api.fetchMarket(); const row = m.data?.board.find((b) => b.sym === o.sym); if (row) board = row;
      const d = new Date(); updated = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { msg = 'Không kết nối được máy chủ dữ liệu.'; }
    render();
  }

  function render(): void {
    if (!alive()) return;
    const last = bars[bars.length - 1]; const ref = board?.ref ?? 0;
    const price = last?.c ?? board?.last ?? 0, pct = ref ? (price / ref - 1) * 100 : 0;
    const col = !ref || Math.abs(pct) < 0.05 ? COL.ref : pct > 0 ? COL.up : COL.down;
    $('#cPrice')!.innerHTML = `<span style="color:${col}">${price ? price.toFixed(2) : '—'}</span> <small style="color:${col}">${ref ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : ''}</small>`;
    const hi = bars.length ? Math.max(...bars.map((b) => b.h)) : 0, lo = bars.length ? Math.min(...bars.map((b) => b.lo)) : 0, vol = bars.reduce((a, b) => a + b.v, 0);
    $('#cStats')!.innerHTML = [
      ['Tham chiếu', ref ? ref.toFixed(2) : '—', COL.ref], ['Trần', board ? board.ceil.toFixed(2) : '—', COL.ceil], ['Sàn', board ? board.floor.toFixed(2) : '—', COL.floor],
      ['Cao', hi ? hi.toFixed(2) : '—', '#e8e4f5'], ['Thấp', lo ? lo.toFixed(2) : '—', '#e8e4f5'], ['Khối lượng', vol ? fmtV(vol) : '—', '#e8e4f5'],
      ['NN mua', board ? fmtV(board.foreignBuy ?? 0) : '—', COL.up], ['NN bán', board ? fmtV(board.foreignSell ?? 0) : '—', COL.down],
    ].map(([k, v, c]) => `<div><span>${k}</span><b style="color:${c}">${v}</b></div>`).join('') + (updated ? `<div class="upd">Cập nhật lúc ${updated}</div>` : '');
    draw();
  }

  function draw(): void {
    const cv = $('#chartCanvas') as HTMLCanvasElement | null; if (!cv) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 760, H = 340;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px';
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    g.font = '14px VT323, monospace';
    if (!bars.length) { g.fillStyle = COL.txt; g.textAlign = 'center'; g.fillText(msg || 'Đang tải…', W / 2, H / 2); return; }
    const padL = 8, padR = 58, padT = 10, padB = 22, volH = 62, top = padT, ph = H - padT - padB - volH - 8;
    let lo = Math.min(...bars.map((b) => b.lo)), hi = Math.max(...bars.map((b) => b.h));
    const ref = board?.ref, ceil = board?.ceil, floor = board?.floor;
    if (tf !== 'd' && ref) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); if (ceil && hi >= ref + 0.55 * (ceil - ref)) hi = ceil; if (floor && lo <= ref - 0.55 * (ref - floor)) lo = floor; }
    const pd = (hi - lo) * 0.06 || hi * 0.01; lo -= pd; hi += pd;
    const y = (p: number) => top + ((hi - p) / (hi - lo)) * ph, cw = (W - padL - padR) / bars.length, x = (i: number) => padL + i * cw;
    g.lineWidth = 1; g.textAlign = 'left';
    for (let i = 0; i <= 4; i++) { const p = lo + ((hi - lo) * i) / 4, yy = Math.round(y(p)) + 0.5; g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(padL, yy); g.lineTo(W - padR, yy); g.stroke(); g.fillStyle = COL.txt; g.fillText(p.toFixed(2), W - padR + 6, yy + 4); }
    const hline = (p: number | undefined, c: string, t: string) => { if (p === undefined || p < lo || p > hi) return; const yy = Math.round(y(p)) + 0.5; g.strokeStyle = c; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(padL, yy); g.lineTo(W - padR, yy); g.stroke(); g.setLineDash([]); g.fillStyle = c; g.fillText(t, W - padR + 6, yy - 3); };
    if (tf !== 'd') { hline(ref, COL.ref, 'TC'); hline(ceil, COL.ceil, 'Trần'); hline(floor, COL.floor, 'Sàn'); }
    const vmax = Math.max(...bars.map((b) => b.v)) || 1, vtop = H - padB - volH;
    bars.forEach((b, i) => {
      const c = b.c > b.o ? COL.up : b.c < b.o ? COL.down : COL.ref, cx = x(i) + cw / 2, bw = Math.max(2, cw * 0.62);
      g.strokeStyle = c; g.fillStyle = c; g.beginPath(); g.moveTo(cx, y(b.h)); g.lineTo(cx, y(b.lo)); g.stroke();
      const yo = y(b.o), yc = y(b.c); g.fillRect(cx - bw / 2, Math.min(yo, yc), bw, Math.max(1.5, Math.abs(yo - yc)));
      g.globalAlpha = 0.5; g.fillRect(cx - bw / 2, vtop + volH - (b.v / vmax) * volH, bw, (b.v / vmax) * volH); g.globalAlpha = 1;
    });
    g.fillStyle = COL.txt; g.textAlign = 'center'; const every = Math.max(1, Math.ceil(bars.length / 10));
    bars.forEach((b, i) => { if (i % every === 0) g.fillText(b.l, x(i) + cw / 2, H - 6); });
    if (hover >= 0 && hover < bars.length) {
      const b = bars[hover], cx = x(hover) + cw / 2; g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx, top); g.lineTo(cx, H - padB); g.stroke(); g.setLineDash([]);
      const tip = $('#cTip'); if (tip) { tip.style.display = 'block'; tip.style.left = Math.min(W - 150, Math.max(4, cx + 10)) + 'px'; tip.innerHTML = `<b>${b.l}</b><br>M ${b.o.toFixed(2)} · C ${b.c.toFixed(2)}<br>Cao ${b.h.toFixed(2)} · Thấp ${b.lo.toFixed(2)}<br>KL ${fmtV(b.v)}`; }
    } else { const tip = $('#cTip'); if (tip) tip.style.display = 'none'; }
  }

  const cv = $('#chartCanvas') as HTMLCanvasElement;
  cv.addEventListener('mousemove', (e) => { const r = cv.getBoundingClientRect(), cw = (r.width - 66) / Math.max(1, bars.length); hover = Math.floor((e.clientX - r.left - 8) / cw); draw(); });
  cv.addEventListener('mouseleave', () => { hover = -1; draw(); });
  document.querySelector('.ctabs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-tf]') as HTMLElement | null; if (b) {
      tf = b.dataset.tf as typeof tf; document.querySelectorAll('.ctabs [data-tf]').forEach((x) => x.classList.toggle('on', x === b)); bars = []; msg = 'Đang tải…'; draw(); void load();
    }
    if ((e.target as HTMLElement).id === 'cRefresh') void load();
  });
  window.addEventListener('resize', draw);

  // làm mới đúng nhịp 20 phút (cron của Worker chạy :00/:20) + đếm ngược hiển thị
  const msToNext = () => { const d = new Date(), m = d.getMinutes(), next = (Math.floor(m / 20) + 1) * 20; return ((next - m) * 60 - d.getSeconds()) * 1000 + 45000; };
  const schedule = () => { timer = window.setTimeout(() => { if (!alive()) return; void load().then(schedule); }, msToNext()); };
  schedule();
  countdown = window.setInterval(() => {
    if (!alive()) { window.clearTimeout(timer); window.clearInterval(countdown); window.removeEventListener('resize', draw); return; }
    const s = Math.max(0, Math.round(msToNext() / 1000)); const el = $('#cLive'); if (el) el.innerHTML = `<i></i> cập nhật 20 phút/lần · lần tới sau ${Math.floor(s / 60)}:${pad(s % 60)}`;
  }, 1000);
  void load();
}
