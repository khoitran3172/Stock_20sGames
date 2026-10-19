import { FLOORS, PRODUCTS, roomById, floorOfRoom, type FloorDef, type RoomDef, type Req, type ProductDef } from './building';

/** Quy mô công ty = min(bậc theo vốn, bậc theo số khách). */
export const TIER_NAMES = ['', 'Khởi nghiệp', 'Nhỏ', 'Vừa', 'Lớn', 'Tập đoàn'];
export const TIER_EQUITY = [0, 0, 2000, 10000, 50000, 200000];       // chỉ số = tier
export const TIER_CUSTOMERS = [0, 0, 8, 14, 24, 40];

export interface Company {
  cash: number; rep: number; customers: number;
  floors: number[];        // id tầng đã mở
  rooms: string[];         // id phòng đã xây
  built: Record<string, number>;   // chi phí đã đầu tư mỗi phòng/tầng (để tính tài sản)
}
export interface Check { text: string; ok: boolean }

const KEY = 's20.company.v1';
export const newCompany = (): Company => ({ cash: 1000, rep: 50, customers: 6, floors: [1], rooms: ['mg'], built: {} });

export function loadCompany(): Company {
  try { const j = localStorage.getItem(KEY); if (j) return { ...newCompany(), ...(JSON.parse(j) as Company) }; } catch { /* mặc định */ }
  return newCompany();
}
export function saveCompany(c: Company): void { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* bỏ qua */ } }

export const investedAssets = (c: Company) => Object.values(c.built).reduce((a, b) => a + b, 0);
/** Vốn chủ sở hữu quy đổi: tiền mặt + 80% giá trị đã xây (tránh việc xây làm tụt bậc). */
export const equity = (c: Company) => c.cash + 0.8 * investedAssets(c);
export function tierOf(c: Company): number {
  const e = equity(c);
  let te = 1, tc = 1;
  for (let t = 2; t <= 5; t++) { if (e >= TIER_EQUITY[t]) te = t; if (c.customers >= TIER_CUSTOMERS[t]) tc = t; }
  return Math.min(te, tc);
}
export function nextTier(c: Company): { tier: number; needEquity: number; needCustomers: number } | null {
  const t = tierOf(c); if (t >= 5) return null;
  return { tier: t + 1, needEquity: TIER_EQUITY[t + 1], needCustomers: TIER_CUSTOMERS[t + 1] };
}
export const upkeepPerDay = (c: Company) => c.rooms.reduce((a, id) => a + (roomById(id)?.upkeep ?? 0), 0);

const hasFloor = (c: Company, id: number) => c.floors.includes(id);

function reqChecks(c: Company, req: Req): Check[] {
  const out: Check[] = [];
  if (req.tier) out.push({ text: `Quy mô tối thiểu: ${TIER_NAMES[req.tier]} (bậc ${req.tier})`, ok: tierOf(c) >= req.tier });
  if (req.rep) out.push({ text: `Uy tín ≥ ${req.rep}`, ok: c.rep >= req.rep });
  if (req.customers) out.push({ text: `≥ ${req.customers} khách`, ok: c.customers >= req.customers });
  (req.rooms ?? []).forEach((id) => out.push({ text: `Có phòng “${roomById(id)?.name ?? id}”`, ok: c.rooms.includes(id) }));
  (req.products ?? []).forEach((id) => out.push({ text: `Có sản phẩm “${PRODUCTS.find((p) => p.id === id)?.name ?? id}”`, ok: productUnlocked(c, id) }));
  return out;
}

export function floorChecks(c: Company, f: FloorDef): Check[] {
  const prev = FLOORS.find((x) => x.id === f.id - 1);
  const out: Check[] = [];
  if (prev) out.push({ text: `Đã mở tầng ${prev.id} (${prev.name})`, ok: hasFloor(c, prev.id) });
  out.push({ text: `Quy mô tối thiểu: ${TIER_NAMES[f.tier]} (bậc ${f.tier})`, ok: tierOf(c) >= f.tier });
  out.push({ text: `Đủ tiền: ${f.cost.toLocaleString('vi-VN')} tr`, ok: c.cash >= f.cost });
  return out;
}
export function roomChecks(c: Company, r: RoomDef): Check[] {
  const f = floorOfRoom(r.id);
  const out: Check[] = [];
  if (f) out.push({ text: `Tầng ${f.id} đã mở`, ok: hasFloor(c, f.id) });
  out.push(...reqChecks(c, r.req));
  out.push({ text: `Đủ tiền: ${r.cost.toLocaleString('vi-VN')} tr`, ok: c.cash >= r.cost });
  return out;
}
export const allOk = (checks: Check[]) => checks.every((x) => x.ok);

export function unlockFloor(c: Company, f: FloorDef): boolean {
  if (hasFloor(c, f.id) || !allOk(floorChecks(c, f))) return false;
  c.cash -= f.cost; c.floors.push(f.id); c.built['floor' + f.id] = f.cost; return true;
}
export function buildRoom(c: Company, r: RoomDef): boolean {
  if (c.rooms.includes(r.id) || !allOk(roomChecks(c, r))) return false;
  c.cash -= r.cost; c.rooms.push(r.id); c.built[r.id] = r.cost; return true;
}
export function productUnlocked(c: Company, id: string): boolean {
  const p = PRODUCTS.find((x) => x.id === id); if (!p) return false;
  return c.rooms.includes(p.room) && allOk(reqChecks(c, p.req ?? {}));
}
export const productChecks = (c: Company, p: ProductDef): Check[] => [
  { text: `Có phòng “${roomById(p.room)?.name ?? p.room}”`, ok: c.rooms.includes(p.room) }, ...reqChecks(c, p.req ?? {}),
];
