'use strict';
/* Sàn Đỏ Sàn Xanh — prototype chế độ Phiên.
   Replay một phiên thật: nến ngày OHLCV (data/*.json) được nội suy thành 255 bước "phút"
   bằng cầu Brown có kiểm soát (chạm đúng High/Low/Close của ngày đó). */

const N = 255;            // số phút giao dịch 9:00-14:45 (bỏ nghỉ trưa)
const ATO_END = 15;       // 9:00-9:15 ATO
const CONT_END = 240;     // 14:30 bắt đầu ATC
const LUNCH_AT = 150;     // sau 11:30
const LIMIT = { HOSE: 0.07, HNX: 0.10, UPCOM: 0.15 };
const INDICES = ['VNINDEX', 'VN30', 'HNX', 'UPCOM'];
const COL = { up: '#22c55e', down: '#ef4444', ref: '#facc15', ceil: '#d946ef', floor: '#22d3ee', grid: '#1b2530', txt: '#7d8a99' };

const S = {
  meta: null, data: {}, dates: [], date: null, books: {}, order: [],
  pos: 0, playing: false, dur: 45, sel: 'HPG', tab: 'intra', feed: [], fired: new Set(), scanned: -1,
  lastPrice: {}, lastDom: 0,
  co: null, cust: [], nextId: 1, snap: null, rng: Math.random, ended: false, stat: null,
  policy: 'bal', auto: false, carryNext: null, settleMsg: [],
};

/* ---------- tiện ích ---------- */
const $ = (s) => document.querySelector(s);
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngOf(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
function tickSize(p, ex) { if (ex !== 'HOSE') return 0.1; return p < 10 ? 0.01 : p < 50 ? 0.05 : 0.1; }
function snap(x, t, mode) { const q = x / t; return (mode === 'down' ? Math.floor(q + 1e-9) : mode === 'up' ? Math.ceil(q - 1e-9) : Math.round(q)) * t; }
function clockStr(step) {
  const j = Math.min(step, N); const m = j < LUNCH_AT ? 540 + j : 780 + (j - LUNCH_AT);
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
const fmtP = (x, idx) => x == null || isNaN(x) ? '—' : x.toFixed(2);
function fmtV(v) { if (v == null || isNaN(v)) return '—'; if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K'; return String(Math.round(v)); }
const pick = (arr, seed) => arr[seed % arr.length];

/* ---------- nội suy nến ngày thành đường giá trong phiên ---------- */
function genPath(row, rng) {
  const { o, h, l, c } = row;
  const out = new Float64Array(N).fill(NaN);
  const a = ATO_END, b = CONT_END, len = b - a;
  const hFirst = rng() < 0.5;
  const t1 = 0.10 + rng() * 0.35;
  const t2 = Math.min(0.93, t1 + 0.15 + rng() * 0.3);
  const pts = [[0, o], [t1, hFirst ? h : l], [t2, hFirst ? l : h], [1, c]];
  const sig = Math.max(h - l, o * 0.002) * 0.05;
  for (let s = 0; s < 3; s++) {
    const i0 = Math.round(a + pts[s][0] * len), i1 = Math.round(a + pts[s + 1][0] * len), m = Math.max(1, i1 - i0);
    const w = [0]; for (let j = 1; j <= m; j++) w[j] = w[j - 1] + gauss(rng) * sig;
    for (let j = 0; j <= m; j++) {
      const base = pts[s][1] + (pts[s + 1][1] - pts[s][1]) * (j / m);
      out[i0 + j] = Math.min(h, Math.max(l, base + w[j] - w[m] * j / m));
    }
    out[i0] = pts[s][1]; out[i0 + m] = pts[s + 1][1];
  }
  for (let k = b + 1; k < N; k++) out[k] = c;
  return out;
}
function genVolume(total, rng) {
  const vol = new Float64Array(N);
  const ato = total * 0.08, atc = total * 0.07, mid = total - ato - atc;
  const w = []; let sum = 0;
  for (let k = ATO_END; k < CONT_END; k++) {
    const x = (k - ATO_END) / (CONT_END - ATO_END);
    const wi = (1 + 2.2 * Math.exp(-k / 12) + 1.4 * Math.exp(-(CONT_END - k) / 15)) * (0.6 + 0.8 * rng()) * (k >= LUNCH_AT ? 0.85 : 1);
    w.push(wi); sum += wi;
  }
  vol[ATO_END - 1] = ato; vol[N - 1] = atc;
  w.forEach((wi, i) => { vol[ATO_END + i] = mid * wi / sum; });
  const cum = new Float64Array(N); let acc = 0;
  for (let k = 0; k < N; k++) { acc += vol[k]; cum[k] = acc; }
  return cum;
}

/* ---------- tải dữ liệu ---------- */
async function load() {
  S.meta = await (await fetch('../data/index.json')).json();
  const syms = Object.keys(S.meta);
  await Promise.all(syms.map(async (s) => {
    const rows = await (await fetch(`../data/${s}.json`)).json();
    const idx = new Map(rows.map((r, i) => [r.d, i]));
    S.data[s] = { rows, idx };
  }));
  S.dates = S.data.VNINDEX.rows.map((r) => r.d);
  S.order = [...syms.filter((s) => !INDICES.includes(s))];
  buildNotable();
  const di = $('#dateInput'); di.min = S.dates[0]; di.max = S.dates[S.dates.length - 1];
  $('#loading').remove();
  startSession(S.dates[S.dates.indexOf(S.notable[0].d)], false);
}

function buildNotable() {
  const rows = S.data.VNINDEX.rows;
  const ch = rows.map((r, i) => ({ d: r.d, p: i ? (r.c / rows[i - 1].c - 1) * 100 : 0 })).slice(1);
  const worst = [...ch].sort((a, b) => a.p - b.p).slice(0, 8).map((x) => ({ ...x, tag: '🔻' }));
  const best = [...ch].sort((a, b) => b.p - a.p).slice(0, 8).map((x) => ({ ...x, tag: '🔺' }));
  S.notable = [...worst, ...best];
  $('#notable').innerHTML = S.notable.map((x, i) => `<option value="${x.d}">${x.tag} ${x.d} (VN-Index ${x.p > 0 ? '+' : ''}${x.p.toFixed(2)}%)</option>`).join('');
}

/* ---------- khởi tạo một phiên ---------- */
function nearestDate(d) {
  let best = S.dates[0];
  for (const x of S.dates) { if (x <= d) best = x; else break; }
  return best;
}
function startSession(date, autoplay = false, restore = false) {
  if (!S.data.VNINDEX.idx.has(date)) date = nearestDate(date);   // ngày nghỉ lễ/cuối tuần → phiên gần nhất trước đó
  S.date = date; S.books = {}; S.feed = []; S.fired = new Set(); S.scanned = -1; S.lastPrice = {};
  for (const sym of Object.keys(S.data)) {
    const { rows, idx } = S.data[sym]; const i = idx.get(date);
    if (i === undefined) continue;
    const row = rows[i]; const meta = S.meta[sym]; const isIdx = meta.type === 'index';
    const ref = i > 0 ? rows[i - 1].c : row.o;
    const rng = rngOf(hash(sym + date));
    let ceil = null, floor = null;
    if (!isIdx) {
      const t = tickSize(ref, meta.exchange), lim = LIMIT[meta.exchange];
      ceil = snap(ref * (1 + lim), t, 'down'); floor = snap(ref * (1 - lim), t, 'up');
      if (row.h > ceil + 1e-6) ceil = row.h; if (row.l < floor - 1e-6) floor = row.l;   // giá điều chỉnh
    }
    S.books[sym] = { sym, ex: meta.exchange, isIdx, row, ref, ceil, floor, path: genPath(row, rng), cum: genVolume(row.v, rng), i };
  }
  if (!S.books[S.sel]) S.sel = 'VNINDEX';
  $('#dateInput').value = date; $('#seek').value = 0;
  S.pos = 0; S.playing = autoplay; S.lastDom = 0;
  $('#modal').hidden = true;
  if (!S.co) S.co = newCompany();
  if (restore && S.snap) { S.co = clone(S.snap.co); S.cust = clone(S.snap.cust); S.nextId = S.snap.nextId; S.carryNext = S.snap.carryNext; }
  else { recruit(); S.snap = clone({ co: S.co, cust: S.cust, nextId: S.nextId, carryNext: S.carryNext }); }
  S.policy = $('#policy').value; S.auto = $('#auto').checked;
  S.stat = { fee: 0, interest: 0, bad: 0, left: 0, saves: 0, liq: 0 }; S.ended = false;
  S.rng = rngOf(hash(date + 'g' + S.co.n));
  setupPositions(S.carryNext === date);
  $('#policy').disabled = false;
  syncButtons(); renderBoard(true); renderHead(); renderCo(); renderCust(); scanTo(0);
}

/* ---------- trạng thái tại thời điểm pos ---------- */
const stepOf = () => Math.min(N - 1, Math.floor(S.pos));
function priceNow(b, k) { return k < ATO_END ? b.ref : b.path[k]; }
function volNow(b, k) { return b.cum[k]; }
function cls(b, p) {
  if (!b.isIdx) { if (b.ceil != null && p >= b.ceil - 1e-6) return 'c-ceil'; if (b.floor != null && p <= b.floor + 1e-6) return 'c-floor'; }
  if (Math.abs(p - b.ref) < 1e-6) return 'c-ref'; return p > b.ref ? 'c-up' : 'c-down';
}
function disp(b, p) { return b.isIdx ? p : snap(p, tickSize(b.ref, b.ex)); }

/* ---------- bảng điện ---------- */
function renderBoard(force) {
  const k = stepOf(); const tb = $('#board tbody'); let html = ''; let lastEx = '';
  const sorted = [...S.order].sort((a, b) => ['HOSE', 'HNX', 'UPCOM'].indexOf(S.meta[a].exchange) - ['HOSE', 'HNX', 'UPCOM'].indexOf(S.meta[b].exchange));
  for (const sym of sorted) {
    const b = S.books[sym];
    const ex = S.meta[sym].exchange;
    if (ex !== lastEx) { html += `<tr class="grp"><td colspan="8">${ex}</td></tr>`; lastEx = ex; }
    if (!b) { html += `<tr><td class="sym">${sym}</td><td colspan="7" style="color:#566">không có dữ liệu ngày này</td></tr>`; continue; }
    const p = disp(b, priceNow(b, k)); const c = cls(b, p); const d = p - b.ref; const pc = d / b.ref * 100;
    const prev = S.lastPrice[sym]; const fl = prev != null && prev !== p ? (p > prev ? ' flash-up' : ' flash-down') : '';
    S.lastPrice[sym] = p;
    html += `<tr data-sym="${sym}" class="${sym === S.sel ? 'sel' : ''}"><td class="sym ${c}">${sym}</td>` +
      `<td class="c-ref">${fmtP(b.ref)}</td><td class="c-ceil">${fmtP(b.ceil)}</td><td class="c-floor">${fmtP(b.floor)}</td>` +
      `<td class="${c}${fl}"><b>${fmtP(p)}</b></td><td class="${c}">${d > 0 ? '+' : ''}${d.toFixed(2)}</td>` +
      `<td class="${c}">${pc > 0 ? '+' : ''}${pc.toFixed(2)}%</td><td>${fmtV(volNow(b, k))}</td></tr>`;
  }
  tb.innerHTML = html;
}
function renderIndices() {
  const k = stepOf();
  $('#indices').innerHTML = INDICES.map((s) => {
    const b = S.books[s]; if (!b) return '';
    const p = priceNow(b, k); const c = cls(b, p); const d = p - b.ref;
    return `<div class="chip ${s === S.sel ? 'sel' : ''}" data-sym="${s}"><b>${s === 'VNINDEX' ? 'VN-INDEX' : s}</b>` +
      `<span class="${c}">${p.toFixed(2)} ${d >= 0 ? '▲' : '▼'} ${(d / b.ref * 100).toFixed(2)}%</span></div>`;
  }).join('');
}
function renderHead() {
  const b = S.books[S.sel]; if (!b) return; const k = stepOf(); const p = disp(b, priceNow(b, k)); const c = cls(b, p);
  let hi = -Infinity, lo = Infinity;
  for (let j = ATO_END; j <= k; j++) { hi = Math.max(hi, b.path[j]); lo = Math.min(lo, b.path[j]); }
  const d = p - b.ref;
  $('#symHead').innerHTML = `<span class="name">${b.sym}<span class="ex">${b.ex}</span></span>` +
    `<span class="px ${c}">${fmtP(p)}</span><span class="${c}">${d >= 0 ? '+' : ''}${d.toFixed(2)} (${(d / b.ref * 100).toFixed(2)}%)</span>` +
    `<span class="meta">TC ${fmtP(b.ref)}${b.isIdx ? '' : ` · Trần ${fmtP(b.ceil)} · Sàn ${fmtP(b.floor)}`} · Cao ${isFinite(hi) ? fmtP(hi) : '—'} · Thấp ${isFinite(lo) ? fmtP(lo) : '—'} · KL ${fmtV(volNow(b, k))}</span>`;
}
function renderMeta() {
  const k = stepOf();
  $('#clock').textContent = clockStr(S.pos >= N ? N : k);
  $('#phase').textContent = S.pos >= N ? 'Đã đóng cửa' : k < ATO_END ? 'ATO · khớp lệnh mở cửa' : k >= CONT_END ? 'ATC · khớp lệnh đóng cửa' : k >= LUNCH_AT ? 'Phiên chiều · khớp lệnh liên tục' : 'Phiên sáng · khớp lệnh liên tục';
  $('#seek').value = Math.min(N, Math.floor(S.pos));
}

/* ---------- biểu đồ nến ---------- */
const cv = $('#chart'); const g = cv.getContext('2d');
function fitCanvas() {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); }
  g.setTransform(d, 0, 0, d, 0, 0); return { w: r.width, h: r.height };
}
function intraBars(b, k) {
  const bars = [];
  for (let s0 = ATO_END; s0 < N; s0 += 5) {
    const s1 = Math.min(s0 + 4, N - 1); if (k < s0) { bars.push(null); continue; }
    const e = Math.min(s1, k); let h = -Infinity, l = Infinity;
    for (let j = s0; j <= e; j++) { h = Math.max(h, b.path[j]); l = Math.min(l, b.path[j]); }
    bars.push({ o: b.path[s0], c: b.path[e], h, l, v: b.cum[e] - b.cum[s0 - 1], t: clockStr(s0), s0 });
  }
  return bars;
}
function dailyBars(b, k) {
  const rows = S.data[b.sym].rows; const out = [];
  for (let i = Math.max(0, b.i - 79); i < b.i; i++) { const r = rows[i]; out.push({ o: r.o, c: r.c, h: r.h, l: r.l, v: r.v, t: r.d.slice(5) }); }
  let hi = -Infinity, lo = Infinity; for (let j = ATO_END; j <= k; j++) { hi = Math.max(hi, b.path[j]); lo = Math.min(lo, b.path[j]); }
  if (k >= ATO_END) out.push({ o: b.row.o, c: b.path[k], h: hi, l: lo, v: b.cum[k], t: b.row.d.slice(5), live: true });
  return { bars: out, slots: 80 };
}
function drawChart() {
  const { w, h } = fitCanvas(); g.clearRect(0, 0, w, h);
  const b = S.books[S.sel]; if (!b) return; const k = stepOf();
  let bars, slots;
  if (S.tab === 'intra') { bars = intraBars(b, k); slots = bars.length; } else { const d = dailyBars(b, k); bars = d.bars; slots = d.slots; }
  const padL = 6, padR = 58, padT = 8, padB = 20, volH = (h - padT - padB) * 0.2, top = padT, ph = h - padT - padB - volH - 6;
  const cw = (w - padL - padR) / slots;
  const real = bars.filter(Boolean); if (!real.length) { g.fillStyle = COL.txt; g.fillText('ATO — chờ khớp lệnh mở cửa…', padL + 12, h / 2); return; }
  let lo = Math.min(...real.map((x) => x.l)), hi = Math.max(...real.map((x) => x.h));
  if (S.tab === 'intra') {
    lo = Math.min(lo, b.ref * (b.isIdx ? 0.995 : 0.98)); hi = Math.max(hi, b.ref * (b.isIdx ? 1.005 : 1.02));
    if (!b.isIdx) { if (hi >= b.ref + 0.5 * (b.ceil - b.ref)) hi = b.ceil; if (lo <= b.ref - 0.5 * (b.ref - b.floor)) lo = b.floor; }
  }
  const pad = (hi - lo) * 0.05 || hi * 0.01; lo -= pad; hi += pad;
  const y = (p) => top + (hi - p) / (hi - lo) * ph; const x = (i) => padL + i * cw;
  g.font = '11px Segoe UI'; g.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {                                     // lưới giá
    const p = lo + (hi - lo) * i / 4, yy = Math.round(y(p)) + 0.5;
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(padL, yy); g.lineTo(w - padR, yy); g.stroke();
    g.fillStyle = COL.txt; g.textAlign = 'left'; g.fillText(p.toFixed(2), w - padR + 6, yy + 4);
  }
  const hline = (p, color, label) => { if (p == null || p < lo || p > hi) return; const yy = Math.round(y(p)) + 0.5; g.strokeStyle = color; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(padL, yy); g.lineTo(w - padR, yy); g.stroke(); g.setLineDash([]); g.fillStyle = color; g.textAlign = 'left'; g.fillText(label, w - padR + 6, yy - 3); };
  if (S.tab === 'intra') { hline(b.ref, COL.ref, 'TC'); hline(b.ceil, COL.ceil, 'Trần'); hline(b.floor, COL.floor, 'Sàn'); }
  else hline(b.ref, COL.ref, 'TC');
  const vmax = Math.max(...real.map((q) => q.v)) || 1; const vtop = h - padB - volH;
  bars.forEach((q, i) => {
    if (!q) return; const up = q.c >= q.o; const color = up ? COL.up : COL.down; const cx = x(i) + cw / 2, bw = Math.max(1, cw * 0.62);
    g.strokeStyle = color; g.fillStyle = color;
    g.beginPath(); g.moveTo(cx, y(q.h)); g.lineTo(cx, y(q.l)); g.stroke();
    const yo = y(q.o), yc = y(q.c); g.fillRect(cx - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yo - yc)));
    g.globalAlpha = 0.55; g.fillRect(cx - bw / 2, vtop + volH - q.v / vmax * volH, bw, q.v / vmax * volH); g.globalAlpha = 1;
    if (q.live) { g.strokeStyle = '#fff'; g.strokeRect(cx - bw / 2 - 1, Math.min(yo, yc) - 1, bw + 2, Math.max(1, Math.abs(yo - yc)) + 2); }
  });
  g.fillStyle = COL.txt; g.textAlign = 'center';
  const every = S.tab === 'intra' ? 6 : 10;
  bars.forEach((q, i) => { if (q && i % every === 0) g.fillText(q.t, x(i) + cw / 2, h - 5); });
  if (S.tab === 'intra') {                                           // nghỉ trưa + ATC
    const sl = (LUNCH_AT - ATO_END) / 5; g.strokeStyle = '#2a3846'; g.setLineDash([2, 4]);
    g.beginPath(); g.moveTo(x(sl), top); g.lineTo(x(sl), h - padB); g.stroke();
    const sa = (CONT_END - ATO_END) / 5; g.beginPath(); g.moveTo(x(sa), top); g.lineTo(x(sa), h - padB); g.stroke(); g.setLineDash([]);
    g.fillStyle = COL.txt; g.textAlign = 'left'; g.fillText('nghỉ trưa', x(sl) + 3, top + 10); g.fillText('ATC', x(sa) + 3, top + 10);
  }
  const lastP = disp(b, priceNow(b, k)); const yy = y(lastP);                    // nhãn giá hiện tại
  g.fillStyle = { 'c-up': COL.up, 'c-down': COL.down, 'c-ref': COL.ref, 'c-ceil': COL.ceil, 'c-floor': COL.floor }[cls(b, lastP)];
  g.fillRect(w - padR + 2, yy - 8, padR - 4, 16); g.fillStyle = '#000'; g.textAlign = 'center'; g.fillText(lastP.toFixed(2), w - padR / 2, yy + 4);
}

/* ---------- tin nóng (tông nghiêm túc + hài) ---------- */
const TXT = {
  ceil: [(s) => `${s} kéo trần, dư mua giá trần còn dài hơn hàng cà phê sáng thứ Hai`, (s) => `${s} tím lịm! Môi giới đứng dậy vỗ tay giữa phòng`, (s) => `${s} trần: nhóm Zalo đồng loạt "xin ít hàng"`],
  floor: [(s) => `${s} nằm sàn, dư bán la liệt, ai bắt dao rơi đang cầu nguyện`, (s) => `${s} lơ lịm: có người vừa đọc lại bài "Cắt lỗ là một nghệ thuật"`, (s) => `${s} sàn: margin call bắt đầu nghe thấy tiếng bước chân`],
  down5: [(s, x) => `${s} giảm ${x}%, bảng điện đỏ lòm hơn cả ảnh đại diện trước giờ thi`, (s, x) => `${s} bốc hơi ${x}%: "tôi chỉ lướt T+ thôi mà"`],
  up5: [(s, x) => `${s} tăng ${x}%, F0 hô vang "biết thế mua nhiều hơn"`, (s, x) => `${s} xanh ${x}%: ai cũng thành chuyên gia sau 15 phút`],
  idxDown: [(x) => `VN-Index −${x}%: phòng môi giới chuyển sang chế độ im lặng có chủ đích`, (x) => `VN-Index −${x}%: cà phê quanh công ty chứng khoán bỗng vắng khách`],
  idxUp: [(x) => `VN-Index +${x}%: quán cà phê đối diện công ty chứng khoán hết chỗ ngồi`, (x) => `VN-Index +${x}%: ai cũng nhận mình "đã nói từ sáng"`],
};
function pushFeed(k, text, tone) { S.feed.unshift({ k, text, tone }); S.feed.length = Math.min(S.feed.length, 9); }
function scanTo(target) {
  for (let k = S.scanned + 1; k <= target; k++) {
    gameStep(k);
    if (k < ATO_END) continue;
    for (const sym of Object.keys(S.books)) {
      const b = S.books[sym]; const p = disp(b, b.path[k]); const pc = (p / b.ref - 1) * 100; const hs = hash(sym + S.date);
      const fire = (key, fn) => { const id = sym + ':' + key; if (!S.fired.has(id)) { S.fired.add(id); fn(); } };
      if (b.isIdx) {
        if (sym !== 'VNINDEX') continue;
        for (const th of [1, 2, 3, 5]) {
          if (pc <= -th) fire('d' + th, () => pushFeed(k, pick(TXT.idxDown, hs + th)(th.toFixed(0)), 'bad'));
          if (pc >= th) fire('u' + th, () => pushFeed(k, pick(TXT.idxUp, hs + th)(th.toFixed(0)), 'good'));
        }
      } else {
        if (b.ceil != null && p >= b.ceil - 1e-6 && pc > 3) fire('ceil', () => pushFeed(k, pick(TXT.ceil, hs)(sym), 'good'));
        else if (b.floor != null && p <= b.floor + 1e-6 && pc < -3) fire('floor', () => pushFeed(k, pick(TXT.floor, hs)(sym), 'bad'));
        else if (pc >= 5) fire('up5', () => pushFeed(k, pick(TXT.up5, hs)(sym, pc.toFixed(1)), 'good'));
        else if (pc <= -5) fire('dn5', () => pushFeed(k, pick(TXT.down5, hs)(sym, Math.abs(pc).toFixed(1)), 'bad'));
      }
    }
    if (k === N - 1) {
      const b = S.books.VNINDEX; const pc = (b.path[k] / b.ref - 1) * 100;
      pushFeed(k, `Đóng cửa: VN-Index ${b.path[k].toFixed(2)} (${pc >= 0 ? '+' : ''}${pc.toFixed(2)}%), thanh khoản ${fmtV(b.cum[k])} đơn vị`, pc >= 0 ? 'good' : 'bad');
    }
  }
  S.scanned = Math.max(S.scanned, target);
}
function renderFeed() {
  $('#feed').innerHTML = S.feed.map((f) => `<li class="${f.tone}"><time>${clockStr(f.k)}</time>${f.text}</li>`).join('');
}

/* ---------- GAMEPLAY: khách hàng, margin, call margin, giải chấp ---------- */
// Tỷ lệ dư nợ = Nợ vay / Giá trị tài sản. Cảnh báo ≥ WARN, bị xử lý (giải chấp) ≥ FORCE.
const POLICY = {
  safe: { name: 'Thận trọng', lo: 0.22, hi: 0.36, rate: 0.0010 },
  bal: { name: 'Cân bằng', lo: 0.40, hi: 0.54, rate: 0.0018 },
  risky: { name: 'Liều', lo: 0.52, hi: 0.66, rate: 0.0030 },
};
const WARN = 0.62, FORCE = 0.70, FEE = 0.0015, FORCE_WAIT = 25, AUTO_WAIT = 10;   // wait tính theo bước (phút ảo)
const TYPES = {
  'F0': { lev: 0.03, pTrade: 0.02, eq: [100, 300], pool: 'any' },
  'Lướt sóng': { lev: 0, pTrade: 0.045, eq: [300, 800], pool: 'liquid' },
  'Giá trị': { lev: -0.08, pTrade: 0.003, eq: [500, 1500], pool: 'bank' },
  'Cá mập': { lev: 0.02, pTrade: 0.01, eq: [2000, 5000], pool: 'small' },
  'Zalo': { lev: 0.06, pTrade: 0.02, eq: [100, 400], pool: 'small' },
};
const NAMES = {
  'F0': ['Em Nhi F0', 'Anh Hùng F0', 'Bạn Minh F0', 'Em Khoa F0'],
  'Lướt sóng': ['Chị Mai T+', 'Bé Bin Lướt Sóng', 'Anh Tuấn Đu Đỉnh', 'Chú Hải Lướt'],
  'Giá trị': ['Chú Ba Giá Trị', 'Cô Lan Cổ Tức', 'Ông Tám Dài Hạn', 'Bà Năm Ngân Hàng'],
  'Cá mập': ['Đại Gia Quang', 'Cá Mập Hoàng', 'Anh Cả Gom Hàng', 'Chị Hạnh Tay To'],
  'Zalo': ['Bác Tư Zalo', 'Bác Sáu Margin', 'Ông Chín Bắt Đáy', 'Chú Bảy Nhóm Kín'],
};
const EXCUSES = ['đang họp, lát gọi lại', 'chuyển khoản bị lỗi', 'tiền đang nằm trong sổ tiết kiệm', 'vợ đang giữ thẻ', 'đang ở sân golf, sóng yếu'];
const SOOTHE = ['"cổ phiếu này câu chuyện còn dài"', '"đây là nhịp rũ bỏ lành mạnh thôi anh"', '"em theo dõi sát, anh cứ yên tâm"', '"cơ hội trung bình giá đó chị"'];
const clone = (o) => JSON.parse(JSON.stringify(o));
const newCompany = () => ({ cash: 1000, rep: 50, n: 0 });
const feedMsg = (k, t, tone) => pushFeed(k, t, tone);

function recruit() {
  const want = Math.min(10, 6 + Math.floor(S.co.rep / 20));
  const r = rngOf(hash('rc' + S.co.n + S.date));
  const seed = ['F0', 'F0', 'Lướt sóng', 'Giá trị', 'Cá mập', 'Zalo'];
  while (S.cust.filter((c) => c.alive).length < want) {
    const t = S.nextId <= seed.length ? seed[S.nextId - 1] : Object.keys(TYPES)[Math.floor(r() * 5)];
    const used = new Set(S.cust.map((c) => c.name));
    const nm = NAMES[t].find((n) => !used.has(n)) || NAMES[t][0] + ' ' + S.nextId;
    const [a, b] = TYPES[t].eq;
    S.cust.push({ id: 'c' + S.nextId, name: nm, type: t, eq: Math.round(a + (b - a) * r()), mood: 60, alive: true, pos: null, carry: null });
    S.nextId++;
  }
}

function setupPositions(seq) {
  const stocks = Object.keys(S.books).filter((s) => !S.books[s].isIdx);
  const pools = {
    any: stocks, liquid: stocks.filter((s) => S.books[s].ex !== 'UPCOM'),
    bank: ['VCB', 'BID', 'CTG', 'TCB', 'MBB', 'VPB'].filter((s) => S.books[s]),
    small: stocks.filter((s) => S.books[s].ex !== 'HOSE'),
  };
  const pol = POLICY[S.policy]; S.settleMsg = [];
  for (const c of S.cust) {
    c.pos = null; if (!c.alive) continue;
    const cr = c.carry; c.carry = null;
    if (cr) {
      if (seq && S.books[cr.sym]) {              // mang vị thế qua đêm (phiên liên tiếp)
        c.pos = { ...cr, sold: false, status: 'ok', forceSince: null, since: null, cdCall: 0, cdSoothe: 0, fee: 0, L0: cr.loan, carried: true };
        continue;
      }
      const net = cr.shares * cr.lastP / 1000 - cr.loan;   // không liên tiếp: tất toán theo giá đóng cửa trước
      if (net >= 0) c.eq = cr.idle + net; else { S.co.cash += net; c.eq = cr.idle; S.settleMsg.push(`${c.name}: nợ xấu ${(-net).toFixed(0)} tr (tất toán vị thế cũ)`); }
    }
    const r = rngOf(hash(c.id + S.date)), T = TYPES[c.type];
    const pool = pools[T.pool].length ? pools[T.pool] : stocks;
    const sym = pool[Math.floor(r() * pool.length)], b = S.books[sym];
    const lr = Math.max(0.05, Math.min(0.68, pol.lo + (pol.hi - pol.lo) * r() + T.lev));
    const e0 = c.eq * (0.8 + 0.2 * r()), A0 = e0 / (1 - lr), loan = A0 - e0;
    c.mood = c.mood * 0.6 + 24;
    c.pos = { sym, shares: A0 * 1000 / b.ref, loan, L0: loan, e0, idle: c.eq - e0, status: 'ok', forceSince: null, since: null, cdCall: 0, cdSoothe: 0, sold: false, fee: 0, A: A0, ratio: lr, lastP: b.ref };
  }
}

const blocked = (b, p) => !b.isIdx && b.floor != null && p <= b.floor + 1e-6;   // kẹt sàn: không bán được
function gameStep(k) {
  if (k < ATO_END || S.ended || !S.co) return;
  for (const c of S.cust) {
    const ps = c.pos; if (!c.alive || !ps || ps.sold) continue;
    const b = S.books[ps.sym]; const p = disp(b, b.path[k]);
    const A = ps.shares * p / 1000; ps.A = A; ps.ratio = ps.loan / A; ps.lastP = p;
    const st = ps.ratio >= FORCE ? 'force' : ps.ratio >= WARN ? 'warn' : 'ok';
    if (st !== ps.status) {
      const prev = ps.status; ps.status = st;
      if (st === 'ok') { feedMsg(k, `✅ ${c.name} (${b.sym}) an toàn trở lại`, 'good'); ps.since = null; ps.forceSince = null; }
      else if (prev === 'ok') { ps.since = k; }
      if (st === 'warn') { feedMsg(k, `⚠️ ${c.name} (${b.sym}) chạm ngưỡng cảnh báo ký quỹ`, 'bad'); ps.forceSince = null; }
      if (st === 'force') { ps.forceSince = k; feedMsg(k, `🚨 ${c.name} (${b.sym}) dưới ngưỡng xử lý — giải chấp trước khi hệ thống tự bán!`, 'bad'); }
    }
    const target = Math.max(0, Math.min(100, 58 + ((A - ps.loan) / ps.e0 - 1) * 100 * 2.2));
    c.mood += (target - c.mood) * 0.02;
    if (S.rng() < TYPES[c.type].pTrade) { const fee = A * 0.25 * FEE; S.stat.fee += fee; S.co.cash += fee; ps.fee += fee; }
    if (S.auto && st !== 'ok') {                                   // chế độ tự động: xử lý chậm, không biết trấn an
      if ((st === 'warn' || st === 'force') && ps.since != null && k - ps.since >= AUTO_WAIT) callMargin(c, k, true);
    }
    if (st === 'force' && ps.forceSince != null && k - ps.forceSince >= (S.auto ? AUTO_WAIT : FORCE_WAIT)) liquidate(c, k, 'auto');
  }
  if (k === N - 1) finishSession();
}

function soothe(c, k) {
  const ps = c.pos; if (!ps || ps.sold || k < ps.cdSoothe) return;
  ps.cdSoothe = k + 30; c.mood = Math.min(100, c.mood + 22);
  feedMsg(k, `📞 Trấn an ${c.name}: ${pick(SOOTHE, hash(c.id + k))}`, '');
}
function callMargin(c, k, isAuto) {
  const ps = c.pos; if (!ps || ps.sold || ps.status === 'ok' || k < ps.cdCall) return;
  ps.cdCall = k + 40;
  const pr = Math.min(0.9, Math.max(0.1, 0.2 + c.mood / 150 + (c.type === 'Cá mập' ? 0.25 : 0) - (c.type === 'Zalo' ? 0.1 : 0)));
  if (ps.idle >= 5 && S.rng() < pr) {
    const top = Math.min(ps.idle, ps.A * 0.3); ps.loan -= top; ps.idle -= top; ps.e0 += top; c.mood -= 5; S.stat.saves++;
    ps.ratio = ps.loan / ps.A;
    feedMsg(k, `💵 ${c.name} nộp thêm ${top.toFixed(0)} tr ký quỹ${isAuto ? ' (tự động)' : ''}`, 'good');
  } else {
    c.mood -= 15; feedMsg(k, `📵 ${c.name} không nộp thêm: ${pick(EXCUSES, hash(c.id + k))}`, 'bad');
  }
}
function liquidate(c, k, who) {
  const ps = c.pos; if (!ps || ps.sold) return false;
  const b = S.books[ps.sym]; const p = disp(b, b.path[Math.min(k, N - 1)]);
  if (blocked(b, p)) { if (!ps.blockMsg) { ps.blockMsg = true; feedMsg(k, `🔒 ${b.sym} nằm sàn, dư bán la liệt — lệnh bán của ${c.name} không khớp được!`, 'bad'); } return false; }
  const A = ps.shares * p / 1000, fee = A * FEE, net = A - ps.loan;
  S.stat.fee += fee; S.co.cash += fee; S.stat.liq++; ps.sold = true; ps.status = 'sold'; ps.A = A;
  if (net >= 0) c.eq = ps.idle + net; else { S.stat.bad += -net; S.co.cash += net; c.eq = ps.idle; }
  c.mood = Math.max(0, c.mood - (who === 'manual' ? 18 : 32));
  feedMsg(k, `🔨 ${who === 'manual' ? 'Bạn' : 'Hệ thống'} giải chấp ${c.name}: bán ${b.sym} @${p.toFixed(2)}${net < 0 ? `, NỢ XẤU ${(-net).toFixed(0)} tr` : ''}`, net < 0 ? 'bad' : '');
  return true;
}

function finishSession() {
  S.ended = true; S.playing = false; syncButtons();
  const pol = POLICY[S.policy]; let carried = 0;
  for (const c of S.cust) {
    const ps = c.pos; if (!c.alive || !ps) continue;
    if (!ps.sold) {
      const intr = ps.L0 * pol.rate; S.stat.interest += intr; S.co.cash += intr;
      if (ps.status === 'ok') { c.eq = ps.idle + ps.A - ps.loan; }
      else { c.carry = { sym: ps.sym, shares: ps.shares, loan: ps.loan, e0: ps.e0, idle: ps.idle, lastP: ps.lastP, A: ps.A, ratio: ps.ratio }; carried++; }
    }
  }
  for (const c of S.cust) {
    if (c.alive && !c.carry && (c.eq < 50 || c.mood < 15)) { c.alive = false; S.stat.left++; }
  }
  const st = S.stat, net = st.fee + st.interest - st.bad;
  S.co.rep = Math.max(0, Math.min(100, S.co.rep + (net > 0 ? 2 : 0) + st.saves - st.left * 4 - (st.bad > 0 ? 6 : 0)));
  S.co.n++; const nextIdx = S.dates.indexOf(S.date) + 1; S.carryNext = S.dates[nextIdx] || null;
  S.net = net; S.carried = carried; showModal();
}
function showModal() {
  const st = S.stat, f = (x) => x.toFixed(1), broke = S.co.cash < 0;
  $('#modalCard').innerHTML = `<h2>Đóng cửa ${S.date} — ${S.net >= 0 ? 'Có lãi' : 'Lỗ'}</h2>` +
    `<table><tr><td>Phí giao dịch</td><td>+${f(st.fee)} tr</td></tr><tr><td>Lãi margin</td><td>+${f(st.interest)} tr</td></tr>` +
    `<tr><td>Nợ xấu</td><td class="c-down">−${f(st.bad)} tr</td></tr><tr><td><b>Lợi nhuận ròng</b></td><td class="${S.net >= 0 ? 'c-up' : 'c-down'}">${S.net >= 0 ? '+' : ''}${f(S.net)} tr</td></tr>` +
    `<tr><td>Khách được cứu (nộp thêm ký quỹ)</td><td>${st.saves}</td></tr><tr><td>Vụ giải chấp</td><td>${st.liq}</td></tr>` +
    `<tr><td>Khách bỏ đi</td><td>${st.left}</td></tr><tr><td>Vị thế mang qua đêm</td><td>${S.carried}</td></tr>` +
    `<tr><td>Vốn công ty / Uy tín</td><td>${S.co.cash.toFixed(0)} tr / ${S.co.rep}</td></tr></table>` +
    (S.settleMsg.length ? `<p class="c-down">${S.settleMsg.join('<br>')}</p>` : '') +
    (broke ? '<p class="c-down"><b>Âm vốn!</b> Công ty bị đình chỉ — hãy bắt đầu công ty mới.</p>' : '') +
    `<div class="row">${S.carryNext && !broke ? '<button class="primary" id="mNext">Phiên kế tiếp ▶</button>' : ''}<button id="mRetry">Chơi lại phiên này ↺</button><button id="mNew">Công ty mới</button></div>`;
  $('#modal').hidden = false;
  if ($('#mNext')) $('#mNext').onclick = () => startSession(S.carryNext, true);
  $('#mRetry').onclick = () => startSession(S.date, true, true);
  $('#mNew').onclick = newGame;
}
function newGame() { S.co = newCompany(); S.cust = []; S.nextId = 1; S.snap = null; S.carryNext = null; startSession(S.date, false); }

const MOOD = (m) => m >= 70 ? '😄' : m >= 45 ? '🙂' : m >= 25 ? '😟' : '😡';
function renderCo() {
  if (!S.co) return; const st = S.stat;
  const net = st.fee + st.interest - st.bad;
  $('#co').innerHTML = `<span>💰 Vốn <b>${S.co.cash.toFixed(0)}</b> tr</span><span>⭐ Uy tín <b>${S.co.rep}</b></span><span>Phiên #${S.co.n + 1}</span>` +
    `<span>Phí <b>${st.fee.toFixed(1)}</b></span><span>Lãi vay <b>${st.interest.toFixed(1)}</b></span><span>Nợ xấu <b class="c-down">${st.bad.toFixed(1)}</b></span><span>Ròng <b class="${net >= 0 ? 'c-up' : 'c-down'}">${net >= 0 ? '+' : ''}${net.toFixed(1)}</b></span>`;
  $('#policy').disabled = S.pos > 0;
}
function renderCust() {
  const k = stepOf(), live = S.playing && !S.ended; let h = '';
  for (const c of S.cust) {
    const ps = c.pos; if (!c.alive) continue;
    if (!ps) { h += `<tr><td>${c.name}</td><td colspan="7"><small>không có vị thế</small></td></tr>`; continue; }
    const pl = ((ps.A - ps.loan) / ps.e0 - 1) * 100, ratio = ps.sold ? 0 : ps.ratio;
    const col = ps.status === 'force' ? COL.down : ps.status === 'warn' ? COL.ref : COL.up;
    const lbl = ps.sold ? 'Đã giải chấp' : ps.status === 'force' ? `GIẢI CHẤP ${Math.max(0, (S.auto ? AUTO_WAIT : FORCE_WAIT) - (k - ps.forceSince))}` : ps.status === 'warn' ? 'CẢNH BÁO' : 'Ổn';
    const open = live && !ps.sold; const needs = ps.status === 'warn' || ps.status === 'force';
    h += `<tr data-sym="${ps.sym}"><td>${c.name}<br><small>${c.type}${ps.carried ? ' · qua đêm' : ''}</small></td><td>${ps.sym}</td>` +
      `<td><span class="bar"><i style="width:${Math.min(100, ratio / 0.8 * 100)}%;background:${col}"></i><u style="left:${WARN / 0.8 * 100}%"></u><u style="left:${FORCE / 0.8 * 100}%"></u></span> ${(ratio * 100).toFixed(0)}%</td>` +
      `<td class="${pl >= 0 ? 'c-up' : 'c-down'}">${pl >= 0 ? '+' : ''}${pl.toFixed(0)}%</td><td>${MOOD(c.mood)}</td><td class="st-${ps.sold ? 'sold' : ps.status}">${lbl}</td>` +
      `<td><button data-cid="${c.id}" data-act="soothe" title="Gọi trấn an (+tâm trạng)" ${open && k >= ps.cdSoothe ? '' : 'disabled'}>📞</button> ` +
      `<button data-cid="${c.id}" data-act="call" title="Yêu cầu bổ sung ký quỹ" ${open && needs && k >= ps.cdCall ? '' : 'disabled'}>💵</button> ` +
      `<button data-cid="${c.id}" data-act="sell" title="Giải chấp ngay" ${open ? '' : 'disabled'}>🔨</button></td></tr>`;
  }
  $('#cust tbody').innerHTML = h;
}
function act(cid, a) {
  if (!S.playing || S.ended) return; const c = S.cust.find((x) => x.id === cid); if (!c) return; const k = stepOf();
  if (a === 'soothe') soothe(c, k); else if (a === 'call') callMargin(c, k, false); else if (a === 'sell') liquidate(c, k, 'manual');
  renderCust(); renderCo(); renderFeed(); renderBoard();
}

/* ---------- vòng lặp ---------- */
let lastT = 0;
function frame(t) {
  const dt = Math.max(0, Math.min(0.1, (t - lastT) / 1000)); lastT = t;
  if (S.playing && S.books.VNINDEX) {
    S.pos = Math.min(N, S.pos + dt * N / S.dur);
    scanTo(stepOf());
    if (S.pos >= N) { S.playing = false; syncButtons(); }
  }
  if (S.books.VNINDEX) {
    if (t - S.lastDom > 90 || !S.playing) { renderBoard(); renderIndices(); renderHead(); renderMeta(); renderFeed(); renderCust(); renderCo(); S.lastDom = t; }
    drawChart();
  }
  requestAnimationFrame(frame);
}
function syncButtons() { $('#btnPlay').textContent = S.playing ? '❚❚ Tạm dừng' : (S.ended ? '▶ Chơi lại' : S.pos > 0 ? '▶ Tiếp tục' : '▶ Chạy'); }

/* ---------- sự kiện giao diện ---------- */
$('#btnPlay').onclick = () => { if (S.ended) { startSession(S.date, true, true); return; } S.playing = !S.playing; syncButtons(); };
$('#btnRestart').onclick = () => startSession(S.date, true, true);
$('#btnNewCo').onclick = newGame;
$('#policy').onchange = () => startSession(S.date, false, true);
$('#auto').onchange = () => { S.auto = $('#auto').checked; };
$('#cust').addEventListener('pointerdown', (e) => { const b = e.target.closest('button[data-act]'); if (b && !b.disabled) { e.preventDefault(); act(b.dataset.cid, b.dataset.act); return; } const tr = e.target.closest('tr[data-sym]'); if (tr) { S.sel = tr.dataset.sym; renderBoard(); renderIndices(); renderHead(); } });
$('#dur').onchange = (e) => { S.dur = +e.target.value; };
$('#notable').onchange = (e) => startSession(e.target.value, false);
$('#dateInput').onchange = (e) => { if (e.target.value) startSession(nearestDate(e.target.value), false); };
$('#board').onpointerdown = (e) => { const tr = e.target.closest('tr[data-sym]'); if (tr) { S.sel = tr.dataset.sym; renderBoard(); renderIndices(); renderHead(); } };
$('#indices').onpointerdown = (e) => { const c = e.target.closest('.chip'); if (c) { S.sel = c.dataset.sym; renderBoard(); renderIndices(); renderHead(); } };
document.querySelectorAll('.tabs button').forEach((btn) => btn.onclick = () => {
  S.tab = btn.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === btn));
});
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|SELECT/.test(e.target.tagName)) { e.preventDefault(); $('#btnPlay').click(); } });

load().then(() => requestAnimationFrame(frame)).catch((e) => { $('#loading').textContent = 'Lỗi tải dữ liệu: ' + e.message + ' — hãy chạy qua máy chủ (xem README).'; });
