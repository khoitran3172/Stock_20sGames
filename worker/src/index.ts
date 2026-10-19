/* Stock20s Worker — cron 20 phút lấy giá thật VN30 → D1; API cho game + lưu tiến trình ẩn danh. */

export interface Env { DB: D1Database; ALLOWED_ORIGINS: string }

const VPS = 'https://bgapidatafeed.vps.com.vn';
const DNSE = 'https://services.entrade.com.vn/chart-api/v2/ohlcs';
const SLOTS_PER_DAY = 14;               // 09:00–11:30 → 8 slot (slot 7 ngắn), 13:00–14:45 → 6 slot
const KEEP_DAYS = 60;
// Danh sách dự phòng nếu nguồn VPS lỗi (VN30 tại 19/10/2026).
const FALLBACK_VN30 = ['ACB','BID','BSR','CTG','FPT','GAS','GVR','HDB','HPG','LPB','MBB','MCH','MSN','MWG','SAB','SHB','SSB','SSI','STB','TCB','TCX','VCB','VHM','VIB','VIC','VJC','VNM','VPB','VPL','VRE'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** fetch JSON có log trạng thái khi lỗi để debug cron (nguồn có thể chặn IP datacenter). */
async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json, text/plain, */*', ...headers } });
    if (!r.ok) { console.error('HTTP', r.status, url.slice(0, 90), (await r.text()).slice(0, 120)); return null; }
    return (await r.json()) as T;
  } catch (e) { console.error('fetch lỗi', url.slice(0, 90), String(e)); return null; }
}
const VPS_H = { Referer: 'https://banggia.vps.com.vn/', Origin: 'https://banggia.vps.com.vn' };
const MAX_SAVE_BYTES = 64 * 1024;

/* ---------- tiện ích ---------- */
const vnDate = (ms = Date.now()) => new Date(ms + 7 * 3600e3).toISOString().slice(0, 10);
const vnStartSec = (d: string) => Math.floor(Date.parse(d + 'T00:00:00Z') / 1000) - 7 * 3600;
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const ok = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Headers': 'Content-Type, X-Device-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (data: unknown, req: Request, env: Env, status = 200, cache = 0) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache ? `public, max-age=${cache}` : 'no-store', ...corsHeaders(req, env) },
  });

async function getMeta(env: Env, k: string): Promise<string | null> {
  const r = await env.DB.prepare('SELECT v FROM meta WHERE k = ?').bind(k).first<{ v: string }>();
  return r ? r.v : null;
}
const UPSERT = 'INSERT INTO meta (k, v, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = ?2, updated_at = ?3';
const setMeta = (env: Env, k: string, v: string) => env.DB.prepare(UPSERT).bind(k, v, Math.floor(Date.now() / 1000)).run();

/* ---------- ingest (cron) ---------- */
type M1 = { t: number[]; o: number[]; h: number[]; l: number[]; c: number[]; v: number[] };
type Slot = { i: number; o: number; h: number; l: number; c: number; v: number };

async function getVN30(env: Env, today: string): Promise<string[]> {
  const cached = await getMeta(env, 'vn30');
  if (cached) { const j = JSON.parse(cached) as { d: string; syms: string[] }; if (j.d === today) return j.syms; }
  const syms = await getJson<string[]>(`${VPS}/getlistckindex/VN30`, VPS_H);
  if (Array.isArray(syms) && syms.length >= 25) { await setMeta(env, 'vn30', JSON.stringify({ d: today, syms })); return syms; }
  return cached ? (JSON.parse(cached) as { syms: string[] }).syms : FALLBACK_VN30;
}

async function fetchM1(sym: string, kind: 'stock' | 'index', from: number, to: number): Promise<M1 | null> {
  const d = await getJson<M1>(`${DNSE}/${kind}?from=${from}&to=${to}&symbol=${sym}&resolution=1`);
  return d && Array.isArray(d.t) && d.t.length ? { t: d.t, o: d.o, h: d.h, l: d.l, c: d.c, v: d.v } : null;
}

function slotOf(t: number): number {
  const m = Math.floor(((t + 7 * 3600) % 86400) / 60);
  return m < 720 ? Math.floor((m - 540) / 20) : 8 + Math.floor((m - 780) / 20);
}
function toSlots(d: M1): Slot[] {
  const map = new Map<number, Slot>();
  for (let k = 0; k < d.t.length; k++) {
    const i = slotOf(d.t[k]); if (i < 0 || i >= SLOTS_PER_DAY) continue;
    const s = map.get(i);
    if (!s) map.set(i, { i, o: d.o[k], h: d.h[k], l: d.l[k], c: d.c[k], v: d.v[k] });
    else { s.h = Math.max(s.h, d.h[k]); s.l = Math.min(s.l, d.l[k]); s.c = d.c[k]; s.v += d.v[k]; }
  }
  return [...map.values()].sort((a, b) => a.i - b.i);
}

export async function ingest(env: Env): Promise<{ date: string; symbols: number; bars: number }> {
  const now = Date.now(), today = vnDate(now);
  const syms = await getVN30(env, today);
  if (!syms.length) throw new Error('không lấy được danh sách VN30');
  const from = vnStartSec(today), to = Math.floor(now / 1000) + 60;

  // 1 call: bảng giá cả rổ (tham chiếu/trần/sàn/khớp/nước ngoài)
  let board: unknown[] = [];
  const raw = await getJson<Record<string, string | number>[]>(`${VPS}/getliststockdata/${syms.join(',')}`, VPS_H);
  if (Array.isArray(raw)) {
    board = raw.map((x) => ({
      sym: x.sym, ref: +x.r, ceil: +x.c, floor: +x.f, last: +x.lastPrice, open: +x.openPrice, high: +x.highPrice, low: +x.lowPrice,
      volLots: +x.lot, foreignBuy: +x.fBVol, foreignSell: +x.fSVolume, foreignRoom: +x.fRoom,
    }));
  }

  // 1 call/mã: nến 1 phút hôm nay (rổ + chỉ số VN30 + VNINDEX) → ~33 subrequest, dưới giới hạn 50 của gói free
  const jobs: [string, 'stock' | 'index'][] = [...syms.map((s): [string, 'stock'] => [s, 'stock']), ['VN30', 'index'], ['VNINDEX', 'index']];
  const results = await Promise.all(jobs.map(([s, k]) => fetchM1(s, k, from, to)));
  const m1: Record<string, M1> = {}, slots: Record<string, Slot[]> = {}; let bars = 0;
  jobs.forEach(([s], i) => { const d = results[i]; if (d) { m1[s] = d; slots[s] = toSlots(d); bars += d.t.length; } });
  if (!bars) { console.error('không có nến nào — nguồn lỗi hoặc ngày nghỉ'); return { date: today, symbols: 0, bars: 0 }; }       // ngày nghỉ hoặc nguồn lỗi: không ghi đè dữ liệu cũ

  const ts = Math.floor(now / 1000);
  const stmts = [
    env.DB.prepare(UPSERT).bind(`m1:${today}`, JSON.stringify(m1), ts),
    env.DB.prepare(UPSERT).bind(`slots:${today}`, JSON.stringify(slots), ts),
    env.DB.prepare(UPSERT).bind('board', JSON.stringify({ date: today, board }), ts),
    env.DB.prepare("DELETE FROM meta WHERE (k LIKE 'm1:%' OR k LIKE 'slots:%') AND substr(k, instr(k, ':') + 1) < ?").bind(vnDate(now - KEEP_DAYS * 86400e3)),
  ];
  await env.DB.batch(stmts);
  return { date: today, symbols: Object.keys(m1).length, bars };
}

/* ---------- người chơi ẩn danh ---------- */
const DEVICE_RE = /^[A-Za-z0-9_-]{32,64}$/;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';           // bỏ ký tự dễ nhầm (I,L,O,0,1)
function newRecoveryCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));            // 16 ký tự × ~4.95 bit ≈ 79 bit
  const s = [...b].map((x) => ALPHABET[x % ALPHABET.length]).join('');
  return s.match(/.{4}/g)!.join('-');
}
const normCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function handlePlayer(req: Request, env: Env, path: string): Promise<Response> {
  const dev = req.headers.get('X-Device-Id') ?? '';
  const now = Math.floor(Date.now() / 1000);

  if (path === '/api/player/new' && req.method === 'POST') {
    if (!DEVICE_RE.test(dev)) return json({ error: 'device id không hợp lệ' }, req, env, 400);
    const dh = await sha256(dev);
    if (await env.DB.prepare('SELECT 1 FROM players WHERE device_hash = ?').bind(dh).first()) return json({ exists: true }, req, env);
    const code = newRecoveryCode();
    await env.DB.prepare('INSERT INTO players (device_hash, recovery_hash, save, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').bind(dh, await sha256(normCode(code)), '{}', now, now).run();
    return json({ created: true, recoveryCode: code, note: 'Mã khôi phục chỉ hiện một lần — hãy lưu lại.' }, req, env, 201);
  }
  if (path === '/api/player/recover' && req.method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as { recoveryCode?: string };
    if (!DEVICE_RE.test(dev) || !body.recoveryCode) return json({ error: 'thiếu device id hoặc mã khôi phục' }, req, env, 400);
    const rh = await sha256(normCode(body.recoveryCode));
    const row = await env.DB.prepare('SELECT device_hash FROM players WHERE recovery_hash = ?').bind(rh).first<{ device_hash: string }>();
    if (!row) return json({ error: 'mã khôi phục không đúng' }, req, env, 404);
    await env.DB.prepare('UPDATE players SET device_hash = ?, updated_at = ? WHERE recovery_hash = ?').bind(await sha256(dev), now, rh).run();
    return json({ recovered: true }, req, env);
  }
  if (path === '/api/save') {
    if (!DEVICE_RE.test(dev)) return json({ error: 'device id không hợp lệ' }, req, env, 400);
    const dh = await sha256(dev);
    if (req.method === 'GET') {
      const r = await env.DB.prepare('SELECT role, save, updated_at FROM players WHERE device_hash = ?').bind(dh).first<{ role: string | null; save: string; updated_at: number }>();
      if (!r) return json({ error: 'chưa có người chơi' }, req, env, 404);
      return json({ role: r.role, save: JSON.parse(r.save), updatedAt: r.updated_at }, req, env);
    }
    if (req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_SAVE_BYTES) return json({ error: 'save quá lớn' }, req, env, 413);
      let body: { role?: string; save?: unknown };
      try { body = JSON.parse(text); } catch { return json({ error: 'JSON không hợp lệ' }, req, env, 400); }
      const role = ['ctck', 'quy', 'canhan'].includes(body.role ?? '') ? body.role! : null;
      const res = await env.DB.prepare('UPDATE players SET role = COALESCE(?, role), save = ?, updated_at = ? WHERE device_hash = ?').bind(role, JSON.stringify(body.save ?? {}), now, dh).run();
      if (!res.meta.changes) return json({ error: 'chưa có người chơi' }, req, env, 404);
      return json({ ok: true, updatedAt: now }, req, env);
    }
  }
  return json({ error: 'not found' }, req, env, 404);
}

/* ---------- API thị trường ---------- */
async function handleMarket(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;
  if (path === '/api/health') return json({ ok: true, now: Date.now(), vnDate: vnDate() }, req, env);
  if (path === '/api/market') {
    const b = await getMeta(env, 'board');
    return b ? json(JSON.parse(b), req, env, 200, 60) : json({ error: 'chưa có dữ liệu' }, req, env, 404);
  }
  if (path === '/api/slots') {
    const d = url.searchParams.get('date') ?? vnDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return json({ error: 'date không hợp lệ' }, req, env, 400);
    const s = await getMeta(env, `slots:${d}`);
    return s ? json({ date: d, slotsPerDay: SLOTS_PER_DAY, slots: JSON.parse(s) }, req, env, 200, 60) : json({ error: 'chưa có dữ liệu ngày này' }, req, env, 404);
  }
  if (path === '/api/candles') {
    const d = url.searchParams.get('date') ?? vnDate(), sym = (url.searchParams.get('sym') ?? '').toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^[A-Z0-9]{2,10}$/.test(sym)) return json({ error: 'tham số không hợp lệ' }, req, env, 400);
    const m = await getMeta(env, `m1:${d}`);
    const all = m ? (JSON.parse(m) as Record<string, M1>) : null;
    return all && all[sym] ? json({ date: d, sym, ...all[sym] }, req, env, 200, 60) : json({ error: 'chưa có dữ liệu' }, req, env, 404);
  }
  return json({ error: 'not found' }, req, env, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, env) });
    const url = new URL(req.url);
    try {
      if (url.pathname.startsWith('/api/player') || url.pathname === '/api/save') return await handlePlayer(req, env, url.pathname);
      return await handleMarket(req, env, url);
    } catch {
      return json({ error: 'lỗi máy chủ' }, req, env, 500);
    }
  },
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(ingest(env).then((r) => console.log('ingest', JSON.stringify(r))).catch((e) => console.error('ingest lỗi', String(e))));
  },
};
