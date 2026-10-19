import Phaser from 'phaser';
import './style.css';
import { OfficeScene, GAME_W, gameHeight, type BuildingView } from './scenes/OfficeScene';
import { ROLES, type RoleId } from './core/config';
import { FLOORS, FUTURE_FLOORS, PRODUCTS, roomById, floorOfRoom, type FloorDef, type RoomDef } from './core/building';
import {
  loadCompany, saveCompany, newCompany, tierOf, nextTier, equity, upkeepPerDay, TIER_NAMES, TIER_EQUITY, TIER_CUSTOMERS,
  floorChecks, roomChecks, allOk, unlockFloor, buildRoom, productUnlocked, productChecks, type Company, type Check,
} from './core/company';
import * as api from './core/api';

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const pad = (n: number) => String(n).padStart(2, '0');
const tm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} tr`;
const DEV = new URLSearchParams(location.search).has('dev');
const FLOOR_COLORS = ['#f59e0b', '#a855f7', '#3b82f6', '#22c55e', '#f97316', '#14b8a6', '#ec4899'];

/* ---------- trạng thái ---------- */
let co: Company = loadCompany();
const state = {
  role: null as RoleId | null,
  floor: 1,
  logs: [] as { t: string; tag: string; css: string; text: string }[],
  filter: 'all',
  slots: null as api.SlotsResp | null,
  timer: 0,
};
let game: Phaser.Game | null = null;
const office = () => game?.scene.getScene('office') as OfficeScene | undefined;
let saveTimer = 0;
function persist() {
  saveCompany(co);
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { if (state.role) void api.putSave(state.role, { company: co }).catch(() => null); }, 1500);
}

/* ---------- log ---------- */
function log(tag: string, text: string, css = '#8f88b0') {
  state.logs.unshift({ t: tm(), tag, css, text });
  if (state.logs.length > 200) state.logs.pop();
  renderLog();
}
function renderChips() {
  const items = [{ id: 'all', n: 'Tất cả' }, ...FLOORS.map((f) => ({ id: 'T' + f.id, n: 'T' + f.id })), { id: 'SYS', n: 'SYS' }];
  $('#chips').innerHTML = items.map((i) => `<button data-f="${i.id}" class="${state.filter === i.id ? 'on' : ''}">${i.n}</button>`).join('');
}
function renderLog() {
  const rows = state.logs.filter((l) => state.filter === 'all' || l.tag === state.filter);
  $('#logCount').textContent = `(${rows.length})`;
  $('#log').innerHTML = rows.map((l) => `<li><time>${l.t}</time><span class="tag" style="background:${l.css}">${l.tag}</span>${l.text}</li>`).join('');
}

/* ---------- panel công ty + thẻ tầng ---------- */
function renderCompany() {
  const t = tierOf(co), nx = nextTier(co);
  const eqv = equity(co);
  $('#coCash').textContent = money(co.cash);
  $('#coRep').textContent = String(co.rep);
  $('#coCust').textContent = String(co.customers);
  $('#coUpkeep').textContent = `${money(upkeepPerDay(co))}/ngày`;
  $('#coTier').innerHTML = `<span class="tier">Bậc ${t}</span> ${TIER_NAMES[t]}`;
  if (nx) {
    const pe = Math.min(100, (eqv / nx.needEquity) * 100), pc = Math.min(100, (co.customers / nx.needCustomers) * 100);
    $('#coNext').innerHTML = `Lên bậc ${nx.tier} (${TIER_NAMES[nx.tier]}):` +
      `<div class="mini"><span>Vốn ${money(eqv)} / ${money(nx.needEquity)}</span><div class="bar"><i style="width:${pe}%"></i></div></div>` +
      `<div class="mini"><span>Khách ${co.customers} / ${nx.needCustomers}</span><div class="bar"><i style="width:${pc}%"></i></div></div>`;
  } else $('#coNext').textContent = 'Quy mô tối đa.';
}
function renderCards() {
  const n = FLOORS.length + 1;
  ($('#cards') as HTMLElement).style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  $('#cards').innerHTML = FLOORS.map((f, i) => {
    const un = co.floors.includes(f.id), built = f.rooms.filter((r) => co.rooms.includes(r.id)).length;
    const c = FLOOR_COLORS[i % FLOOR_COLORS.length];
    return `<div class="dcard ${state.floor === f.id ? 'sel' : ''} ${un ? '' : 'locked'}" data-floor="${f.id}" style="border-top-color:${c}">
      <div class="n" style="color:${c}">Tầng ${f.id} · ${f.name}</div>
      <div class="s">${un ? `${built}/${f.rooms.length} phòng` : 'Chưa mở'}</div>
      <div class="m">${un ? f.blurb : `Bậc ${f.tier} · ${money(f.cost)}`}</div></div>`;
  }).join('') + `<div class="dcard future" title="${FUTURE_FLOORS.map((x) => `T${x.id}: ${x.name}`).join(' · ')}">
      <div class="n">Tầng ${FLOORS.length + 1}+</div><div class="s">Sắp có</div><div class="m">${FUTURE_FLOORS[0]?.name ?? ''}</div></div>`;
}
function refreshAll() { renderCompany(); renderCards(); office()?.rebuild(); persist(); }

/* ---------- thị trường theo khung 20 phút ---------- */
const slotLabel = (i: number) => {
  const m = i < 8 ? 540 + i * 20 : 780 + (i - 8) * 20, e = i === 7 ? 690 : i === 13 ? 885 : m + 20;
  const f = (v: number) => `${pad(Math.floor(v / 60))}:${pad(v % 60)}`;
  return `${f(m)}–${f(e)}`;
};
function showSlot(i: number, announce = true) {
  const s = state.slots; if (!s) return;
  const bars = s.slots['VNINDEX']; if (!bars?.length) return;
  const b = bars.find((x) => x.i === i) ?? bars[bars.length - 1];
  const open = bars[0].o, pct = (b.c / open - 1) * 100;
  $('#vnidx').innerHTML = `${b.c.toFixed(2)} <span class="${pct >= 0 ? 'up' : 'down'}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>`;
  $('#slotLabel').textContent = `${i + 1}/${s.slotsPerDay} · ${slotLabel(i)}`;
  ($('#slotBar') as HTMLElement).style.width = `${((i + 1) / s.slotsPerDay) * 100}%`;
  const slotPct = (b.c / b.o - 1) * 100;
  office()?.setMood(Math.max(-1, Math.min(1, slotPct / 0.4)));
  if (!announce) return;
  log('SYS', `Khung ${slotLabel(i)}: VN-Index ${b.c.toFixed(2)} (${slotPct >= 0 ? '+' : ''}${slotPct.toFixed(2)}%)`);
  if (Math.abs(slotPct) > 0.25 && co.rooms.length) office()?.pulse(co.rooms[Math.floor(Math.random() * co.rooms.length)]);
}
async function loadMarket() {
  $('#dataHint').textContent = 'Đang tải dữ liệu thị trường…';
  try {
    const r = await api.fetchSlots();
    if (r.status === 200 && r.data) {
      state.slots = r.data; $('#dayLabel').textContent = r.data.date;
      const n = r.data.slots['VNINDEX']?.length ?? 0;
      $('#dataHint').textContent = `Dữ liệu thật ${r.data.date} (${n} khung). Bấm “Chạy ngày” để xem diễn biến.`;
      ($('#btnPlay') as HTMLButtonElement).disabled = n === 0;
      showSlot(n - 1, false);
      log('SYS', `Đã tải ${n} khung 20 phút của ${r.data.date}`);
    } else {
      $('#dataHint').textContent = 'Chưa có dữ liệu hôm nay (ngày nghỉ hoặc trước 9:20).';
      log('SYS', 'API chưa có dữ liệu ngày này');
    }
  } catch { $('#dataHint').textContent = 'Không kết nối được máy chủ dữ liệu.'; log('SYS', 'Lỗi kết nối API', '#ef5350'); }
}
function playDay() {
  const n = state.slots?.slots['VNINDEX']?.length ?? 0; if (!n) return;
  let i = 0; window.clearInterval(state.timer);
  ($('#btnStop') as HTMLButtonElement).disabled = false; ($('#btnPlay') as HTMLButtonElement).disabled = true;
  showSlot(0);
  state.timer = window.setInterval(() => { i++; if (i >= n) { stopDay(); return; } showSlot(i); }, 2200);
}
function stopDay() {
  window.clearInterval(state.timer);
  ($('#btnStop') as HTMLButtonElement).disabled = true; ($('#btnPlay') as HTMLButtonElement).disabled = !state.slots;
}
function tickClock() {
  const d = new Date();
  $('#clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ---------- modal ---------- */
function modal(html: string) { $('#modalCard').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
const checklist = (cs: Check[]) => `<ul class="checks">${cs.map((c) => `<li class="${c.ok ? 'ok' : 'no'}">${c.ok ? '✔' : '✘'} ${c.text}</li>`).join('')}</ul>`;
const riskBar = (r: number) => '■'.repeat(r) + '□'.repeat(5 - r);

function productsOfRoom(roomId: string) {
  return PRODUCTS.filter((p) => p.room === roomId).map((p) => {
    const un = productUnlocked(co, p.id);
    return `<div class="prod ${un ? '' : 'off'}"><b>${p.name}</b> <small>${un ? 'ĐÃ MỞ' : 'chưa mở'} · ${p.data === 'real' ? 'giá thật' : 'mô phỏng'}</small>
      <div class="pm">Rủi ro ${riskBar(p.risk)} · ${p.yield}</div><div class="pd">${p.blurb}</div>${un ? '' : checklist(productChecks(co, p))}</div>`;
  }).join('');
}
function showRoom(floorId: number, roomId: string) {
  const r = roomById(roomId), f = FLOORS.find((x) => x.id === floorId); if (!r || !f) return;
  const built = co.rooms.includes(r.id);
  const head = `<h2 style="color:${r.css}">${r.name}</h2><p>Tầng ${f.id} · ${f.name}</p><p class="desc">${r.blurb}</p>`;
  const prods = productsOfRoom(r.id);
  if (built) {
    modal(`${head}<div class="kv"><span>Chi phí duy trì</span><b>${money(r.upkeep)}/ngày</b></div>
      ${prods ? `<h4>Mô hình đầu tư của phòng này</h4>${prods}` : ''}<div class="row"><button id="mClose">Đóng</button></div>`);
    return;
  }
  const cs = roomChecks(co, r), ok = allOk(cs);
  modal(`${head}<div class="kv"><span>Chi phí xây</span><b>${money(r.cost)}</b></div><div class="kv"><span>Duy trì sau khi xây</span><b>${money(r.upkeep)}/ngày</b></div>
    <h4>Điều kiện</h4>${checklist(cs)}${prods ? `<h4>Sẽ mở khóa</h4>${prods}` : ''}
    <div class="row"><button class="primary" id="mBuild" data-room="${r.id}" ${ok ? '' : 'disabled'}>Xây phòng · ${money(r.cost)}</button><button id="mClose">Đóng</button></div>`);
}
function showFloor(floorId: number) {
  const f = FLOORS.find((x) => x.id === floorId); if (!f) return;
  state.floor = f.id; renderCards(); office()?.selectFloor(f.id);
  if (co.floors.includes(f.id)) { log('T' + f.id, `Chọn tầng ${f.id}: ${f.name}`, FLOOR_COLORS[(f.id - 1) % FLOOR_COLORS.length]); return; }
  const cs = floorChecks(co, f), ok = allOk(cs);
  modal(`<h2>Tầng ${f.id} · ${f.name}</h2><p class="desc">${f.blurb}</p>
    <div class="kv"><span>Chi phí mở tầng</span><b>${money(f.cost)}</b></div>
    <h4>Điều kiện</h4>${checklist(cs)}
    <h4>Gồm các phòng</h4><ul class="plain">${f.rooms.map((r) => `<li><b style="color:${r.css}">${r.name}</b> · ${money(r.cost)} — ${r.blurb}</li>`).join('')}</ul>
    <div class="row"><button class="primary" id="mFloor" data-floor="${f.id}" ${ok ? '' : 'disabled'}>Mở tầng · ${money(f.cost)}</button><button id="mClose">Đóng</button></div>`);
}
function showCatalog() {
  const groups = FLOORS.map((f) => {
    const rows = f.rooms.map((r) => {
      const ps = PRODUCTS.filter((p) => p.room === r.id); if (!ps.length) return '';
      return `<div class="cat"><div class="ch" style="color:${r.css}">${r.name} <small>· tầng ${f.id}${co.rooms.includes(r.id) ? '' : ' · chưa xây'}</small></div>${ps.map((p) => {
        const un = productUnlocked(co, p.id);
        return `<div class="prod ${un ? '' : 'off'}"><b>${p.name}</b> <small>${un ? 'ĐÃ MỞ' : 'khóa'} · ${p.data === 'real' ? 'giá thật' : 'mô phỏng'} · rủi ro ${riskBar(p.risk)}</small><div class="pd">${p.yield} — ${p.blurb}</div></div>`;
      }).join('')}</div>`;
    }).join('');
    return rows;
  }).join('');
  modal(`<h2>Mô hình đầu tư</h2><p>Mỗi mô hình mở khóa khi xây phòng tương ứng (và đủ điều kiện). Sản phẩm “giá thật” dùng dữ liệu thị trường thật; “mô phỏng” dùng mô hình giả lập.</p>${groups}<div class="row"><button id="mClose">Đóng</button></div>`);
}

function showRolePicker() {
  modal(`<h2>Chọn vai của bạn</h2><p>Mỗi vai là một cách chơi khác nhau trên cùng thị trường thật.</p>
    <div class="roles">${ROLES.map((r) => `<div class="role ${r.ready ? '' : 'soon'}"><h4>${r.name}</h4><p>${r.blurb}</p>
      <button class="primary" data-role="${r.id}" ${r.ready ? '' : 'disabled'}>${r.ready ? 'Chơi' : 'Sắp ra mắt'}</button></div>`).join('')}</div>
    <p style="margin-top:14px">Đã có mã khôi phục? <a href="#" id="lnkRecover" style="color:var(--accent)">Khôi phục tiến trình</a></p>`);
}
function showRecover(errMsg = '') {
  modal(`<h2>Khôi phục tiến trình</h2><p>Nhập mã khôi phục 16 ký tự bạn đã lưu.</p>
    <input type="text" id="inCode" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off"><div class="err">${errMsg}</div>
    <div class="row" style="margin-top:8px"><button class="primary" id="btnDoRecover">Khôi phục</button><button id="btnBack">Quay lại</button></div>`);
}
async function chooseRole(role: RoleId) {
  closeModal();
  const r = await api.createPlayer().catch(() => null);
  api.setRole(role);
  if (r?.data?.created && r.data.recoveryCode) {
    modal(`<h2>Mã khôi phục của bạn</h2><p>Mã này chỉ hiện <b>một lần</b>. Hãy lưu lại để chơi tiếp trên thiết bị khác. Máy chủ chỉ lưu bản băm, không lưu IP.</p>
      <div class="code">${r.data.recoveryCode}</div><button class="primary" id="btnCodeOk">Đã lưu, vào game</button>`);
  } else {
    if (!r) log('SYS', 'Không tạo được người chơi trên máy chủ — chơi ngoại tuyến', '#ef5350');
    startGame(role);
  }
}

/* ---------- vào game ---------- */
function startGame(role: RoleId) {
  closeModal(); state.role = role;
  $('#roleLabel').textContent = ROLES.find((r) => r.id === role)?.name ?? '';
  renderCompany(); renderCards(); renderChips(); renderLog();
  if (!game) {
    const view: BuildingView = {
      state: () => ({ floors: co.floors, rooms: co.rooms, name: 'Chứng khoán Sàn Đỏ' }),
      onRoom: (fid, rid) => showRoom(fid, rid),
      onFloor: (fid) => showFloor(fid),
    };
    const g = new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', width: GAME_W, height: gameHeight(FLOORS.length), pixelArt: true, roundPixels: true,
      backgroundColor: '#0f0d18', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: [OfficeScene],
      callbacks: { preBoot: (gg) => { gg.registry.set('view', view); } },
    });
    game = g; (window as unknown as { __game: Phaser.Game; __co: () => Company }).__game = g;
    (window as unknown as { __co: () => Company }).__co = () => co;
  }
  log('SYS', `Bắt đầu vai: ${ROLES.find((r) => r.id === role)?.name}`);
  loadMarket();
}

/* ---------- sự kiện ---------- */
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const chip = t.closest('[data-f]') as HTMLElement | null; if (chip) { state.filter = chip.dataset.f!; renderChips(); renderLog(); return; }
  const card = t.closest('.dcard[data-floor]') as HTMLElement | null; if (card) { showFloor(+card.dataset.floor!); return; }
  const role = t.closest('[data-role]') as HTMLElement | null; if (role && !(role as HTMLButtonElement).disabled) { void chooseRole(role.dataset.role as RoleId); return; }
  if (t.id === 'mClose') { closeModal(); return; }
  if (t.id === 'mBuild') {
    const r = roomById(t.dataset.room!); if (r && buildRoom(co, r)) { const f = floorOfRoom(r.id)!; closeModal(); log('T' + f.id, `Xây phòng ${r.name} (−${money(r.cost)})`, '#3fcf6d'); refreshAll(); showRoom(f.id, r.id); }
    return;
  }
  if (t.id === 'mFloor') {
    const f = FLOORS.find((x) => x.id === +t.dataset.floor!); if (f && unlockFloor(co, f)) { closeModal(); log('T' + f.id, `Mở tầng ${f.id}: ${f.name} (−${money(f.cost)})`, '#3fcf6d'); refreshAll(); }
    return;
  }
  if (t.id === 'btnCatalog') { showCatalog(); return; }
  if (t.id === 'btnCheatCash') { co.cash += 1000; co.customers += 2; log('SYS', 'DEV: +1.000 tr, +2 khách'); refreshAll(); return; }
  if (t.id === 'lnkRecover') { e.preventDefault(); showRecover(); return; }
  if (t.id === 'btnBack') { showRolePicker(); return; }
  if (t.id === 'btnCodeOk') { startGame(api.getRole() as RoleId); return; }
  if (t.id === 'btnDoRecover') {
    const code = ($('#inCode') as HTMLInputElement).value.trim();
    void api.recoverPlayer(code).then(async (r) => {
      if (r.data?.recovered) {
        const s = await api.loadSave(); const role = (s.data?.role as RoleId | null) ?? 'ctck'; api.setRole(role);
        const saved = (s.data?.save as { company?: Company } | null)?.company; if (saved) { co = { ...newCompany(), ...saved }; saveCompany(co); }
        startGame(role);
      } else showRecover(r.data?.error ?? 'Không khôi phục được.');
    }).catch(() => showRecover('Không kết nối được máy chủ.'));
  }
});
$('#btnPlay').addEventListener('click', playDay);
$('#btnStop').addEventListener('click', stopDay);
$('#btnReset').addEventListener('click', () => { stopDay(); api.clearRole(); showRolePicker(); });
if (DEV) $('#devRow').hidden = false;

setInterval(tickClock, 1000); tickClock();
renderCompany(); renderCards(); renderChips();

(async () => {
  try { await Promise.race([document.fonts.load('14px VT323'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* dùng font dự phòng */ }
  const h = await api.health().catch(() => null);
  $('#live').classList.toggle('off', !h || h.status !== 200);
  const saved = api.getRole() as RoleId | null;
  if (saved && ROLES.some((r) => r.id === saved && r.ready)) startGame(saved); else showRolePicker();
})();

export type { FloorDef, RoomDef };
void TIER_EQUITY; void TIER_CUSTOMERS;
