/* Giao diện Trụ sở: tháp nhiều tầng bên trái, chi tiết tầng (các phòng đang làm gì) bên phải. */
import { FLOORS, FUTURE_FLOORS, PRODUCTS, type FloorDef, type RoomDef } from '../core/building';
import { type Company, tierOf, roomChecks, floorChecks, allOk, upkeepPerDay, equity, productUnlocked, TIER_NAMES } from '../core/company';

const ICON: Record<string, string> = {
  mg: '🧑‍💼', ks: '🎧', mr: '💳', gd: '👑', rr: '🛡️', cp: '⚖️', td: '📈', tp: '📜', rs: '🔬', vg: '🪙', bd: '🏗️', bh: '☂️', it: '💻', mk: '📣', ib: '🏦',
};
const FLOOR_ICON = ['🏢', '🧠', '💹', '🧭', '🚀'];
const FLOOR_COLORS = ['#f59e0b', '#a855f7', '#3b82f6', '#22c55e', '#f97316', '#14b8a6', '#ec4899'];

/** Việc các phòng đang làm (xoay vòng trên giao diện). */
export const ACTIVITIES: Record<string, string[]> = {
  mg: ['Nhận lệnh mua VCB của khách F0', 'Gọi tư vấn nhóm khách lướt sóng', 'Mở tài khoản cho 2 khách mới', 'Xử lý lệnh ATO 9:00', 'Khách hỏi “sao hôm nay đỏ thế?”'],
  ks: ['Gọi trấn an khách đang lỗ', 'Gửi bản tin cuối ngày', 'Giải đáp thắc mắc phí giao dịch', 'Mời khách dự hội thảo'],
  mr: ['Duyệt hạn mức margin cho khách mới', 'Gửi cảnh báo tỷ lệ ký quỹ', 'Tính lãi vay cuối ngày', 'Ứng trước tiền bán T+2'],
  gd: ['Họp giao ban đầu ngày', 'Duyệt kế hoạch mở rộng', 'Xem báo cáo lãi lỗ', 'Tiếp đối tác'],
  rr: ['Theo dõi 3 tài khoản sát ngưỡng giải chấp', 'Chuẩn bị lệnh giải chấp', 'Rà soát danh mục tập trung', 'Cập nhật hạn mức theo mã'],
  cp: ['Rà soát giao dịch bất thường', 'Chuẩn bị hồ sơ cho đoàn thanh tra', 'Cập nhật quy định mới', 'Kiểm tra tư vấn của môi giới'],
  td: ['Mua gom cổ phiếu ngân hàng', 'Chốt lời vị thế lướt sóng', 'Theo dõi dòng tiền khối ngoại', 'Cân nhắc phái sinh VN30F'],
  tp: ['Thẩm định trái phiếu doanh nghiệp', 'Tái cơ cấu danh mục quỹ', 'Theo dõi lịch trả lãi', 'Làm việc với đối tác phát hành'],
  rs: ['Viết báo cáo cổ phiếu ngành thép', 'Cập nhật mô hình định giá', 'Họp phân tích vĩ mô', 'Chuẩn bị khuyến nghị tuần'],
  vg: ['Cập nhật giá vàng thế giới', 'Nhập lô vàng miếng mới', 'Tiếp khách mua vàng tích trữ', 'Kiểm kê két sắt'],
  bd: ['Thẩm định sổ đỏ thế chấp', 'Khảo sát dự án mới', 'Làm việc với chủ đầu tư', 'Kiểm tra tiến độ pháp lý'],
  bh: ['Tư vấn gói bảo hiểm nhân thọ', 'Xử lý hồ sơ bồi thường', 'Tuyển đại lý mới', 'Chốt hợp đồng bảo hiểm năm đầu'],
  it: ['Giám sát hệ thống giờ cao điểm', 'Vá lỗi ứng dụng giao dịch', 'Tăng dung lượng máy chủ', 'Kiểm thử đặt lệnh nhanh'],
  mk: ['Chạy chiến dịch “mở tài khoản miễn phí”', 'Đăng bài lên nhóm Zalo', 'Phân tích tỷ lệ chuyển đổi', 'Thiết kế banner khuyến mãi'],
  ib: ['Đàm phán bảo lãnh phát hành', 'Định giá đợt IPO', 'Họp với nhà đầu tư tổ chức', 'Chuẩn bị bản cáo bạch'],
};
export const roomIcon = (id: string) => ICON[id] ?? '🏢';

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} tr`;
const riskBar = (r: number) => '■'.repeat(r) + '□'.repeat(5 - r);

function tower(co: Company, sel: number): string {
  const floors = [...FLOORS].reverse();
  return `<div class="tower"><div class="roof">${co.rooms.length ? '' : ''}<span>★ SÀN ĐỎ ★</span></div>` + floors.map((f, k) => {
    const un = co.floors.includes(f.id), built = f.rooms.filter((r) => co.rooms.includes(r.id)).length, c = FLOOR_COLORS[(f.id - 1) % FLOOR_COLORS.length];
    return `<div class="fl ${un ? '' : 'locked'} ${sel === f.id ? 'sel' : ''}" data-hqsel="${f.id}" style="--c:${c}">
      <div class="wins">${Array.from({ length: 12 }, (_, i) => `<i style="animation-delay:${((i * 7 + k * 3) % 11) / 4}s"></i>`).join('')}</div>
      <div class="fi">${FLOOR_ICON[(f.id - 1) % FLOOR_ICON.length]}</div>
      <div class="ft"><b>Tầng ${f.id}</b><span>${f.name}</span><small>${un ? `${built}/${f.rooms.length} phòng` : `🔒 bậc ${f.tier} · ${money(f.cost)}`}</small></div></div>`;
  }).join('') + FUTURE_FLOORS.slice(0, 1).map((x) => `<div class="fl future"><div class="ft"><b>Tầng ${x.id}+</b><span>${x.name}</span><small>sắp có</small></div></div>`).join('') + `<div class="door">🚪 Sảnh</div></div>`;
}

function roomCard(co: Company, f: FloorDef, r: RoomDef): string {
  const built = co.rooms.includes(r.id), icon = ICON[r.id] ?? '🏢';
  const prods = PRODUCTS.filter((p) => p.room === r.id);
  const prodHtml = prods.length ? `<div class="rprods">${prods.map((p) => { const un = productUnlocked(co, p.id);
    return `<span class="pchip ${un ? 'on' : ''}" title="${p.blurb} · ${p.yield}">${un ? '✔' : '🔒'} ${p.name} <em>${riskBar(p.risk)}</em></span>`; }).join('')}</div>` : '';
  if (built) {
    const acts = ACTIVITIES[r.id] ?? ['Đang làm việc'];
    return `<div class="rc built" style="--c:${r.css}"><div class="rh"><span class="ri">${icon}</span><div><b>${r.name}</b><small>ĐÃ XÂY · ${money(r.upkeep)}/ngày</small></div></div>
      <p>${r.blurb}</p><div class="act" data-room="${r.id}"><span class="walker">🚶</span><span class="atxt">${acts[0]}</span></div>${prodHtml}</div>`;
  }
  const cs = roomChecks(co, r), ok = allOk(cs), bad = cs.filter((c) => !c.ok);
  return `<div class="rc plot" style="--c:${r.css}"><div class="rh"><span class="ri">${icon}</span><div><b>${r.name}</b><small>ĐẤT TRỐNG · xây ${money(r.cost)}</small></div></div>
    <p>${r.blurb}</p>${prodHtml}
    ${ok ? '' : `<ul class="need">${bad.map((c) => `<li>✘ ${c.text}</li>`).join('')}</ul>`}
    <button class="primary" data-buildroom="${r.id}" ${ok ? '' : 'disabled'}>＋ Xây phòng · ${money(r.cost)}</button></div>`;
}

function detail(co: Company, f: FloorDef): string {
  const c = FLOOR_COLORS[(f.id - 1) % FLOOR_COLORS.length], un = co.floors.includes(f.id);
  const head = `<div class="fh" style="--c:${c}"><span class="fbig">${FLOOR_ICON[(f.id - 1) % FLOOR_ICON.length]}</span><div><h3>Tầng ${f.id} · ${f.name}</h3><p>${f.blurb}</p></div></div>`;
  if (!un) {
    const cs = floorChecks(co, f), ok = allOk(cs);
    return `${head}<div class="lockbox"><h4>🔒 Tầng này chưa mở</h4><ul class="checks">${cs.map((x) => `<li class="${x.ok ? 'ok' : 'no'}">${x.ok ? '✔' : '✘'} ${x.text}</li>`).join('')}</ul>
      <button class="primary" data-unlockfloor="${f.id}" ${ok ? '' : 'disabled'}>Mở tầng · ${money(f.cost)}</button></div>
      <h4>Sẽ có các phòng</h4><div class="rooms">${f.rooms.map((r) => `<div class="rc ghost" style="--c:${r.css}"><div class="rh"><span class="ri">${ICON[r.id] ?? '🏢'}</span><div><b>${r.name}</b><small>${money(r.cost)}</small></div></div><p>${r.blurb}</p></div>`).join('')}</div>`;
  }
  return `${head}<div class="rooms">${f.rooms.map((r) => roomCard(co, f, r)).join('')}</div>`;
}

export function hqHtml(co: Company, sel: number): string {
  const f = FLOORS.find((x) => x.id === sel) ?? FLOORS[0], t = tierOf(co);
  return `<div class="hq"><div class="hqtop"><h2>Trụ sở Chứng khoán Sàn Đỏ</h2>
    <div class="hqkpi"><span>Quy mô <b>Bậc ${t} · ${TIER_NAMES[t]}</b></span><span>Vốn <b>${money(co.cash)}</b></span><span>Tài sản <b>${money(equity(co))}</b></span><span>Chi phí <b>${money(upkeepPerDay(co))}/ngày</b></span><span>Khách <b>${co.customers}</b></span></div></div>
    <div class="hqbody">${tower(co, f.id)}<div class="fdetail">${detail(co, f)}</div></div>
    <div class="row"><button id="mClose">Đóng</button></div></div>`;
}

/** xoay vòng câu “đang làm gì” của các phòng đã xây; tự dừng khi popup đóng. */
export function startTicker(): void {
  let n = 0; const id = window.setInterval(() => {
    const els = document.querySelectorAll<HTMLElement>('.act[data-room]'); if (!els.length) { window.clearInterval(id); return; }
    n++; els.forEach((el, k) => { const list = ACTIVITIES[el.dataset.room!] ?? []; if (!list.length) return; const t = el.querySelector('.atxt'); if (t) t.textContent = list[(n + k) % list.length]; });
  }, 2200);
}
export const sameFloor = (f: FloorDef, id: number) => f.id === id;
