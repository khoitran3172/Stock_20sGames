const API: string = (import.meta.env.VITE_API as string | undefined) ?? 'https://stock20s.stock20s-worker.workers.dev';

export interface SlotBar { i: number; o: number; h: number; l: number; c: number; v: number }
export interface SlotsResp { date: string; slotsPerDay: number; slots: Record<string, SlotBar[]> }

const LS = {
  device: 's20.device',
  role: 's20.role',
};
const ls = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* bỏ qua */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* bỏ qua */ } },
};

export function deviceId(): string {
  let id = ls.get(LS.device);
  if (!id || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) {
    id = crypto.randomUUID().replace(/-/g, '');
    ls.set(LS.device, id);
  }
  return id;
}
export const getRole = () => ls.get(LS.role);
export const setRole = (r: string) => ls.set(LS.role, r);
export const clearRole = () => ls.del(LS.role);

async function call<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const r = await fetch(API + path, { ...init, headers: { 'X-Device-Id': deviceId(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers ?? {}) } });
  let data: T | null = null;
  try { data = (await r.json()) as T; } catch { /* không phải JSON */ }
  return { status: r.status, data };
}

export const health = () => call<{ ok: boolean; vnDate: string }>('/api/health');
export const fetchSlots = (date?: string) => call<SlotsResp>('/api/slots' + (date ? `?date=${date}` : ''));
export const createPlayer = () => call<{ created?: boolean; exists?: boolean; recoveryCode?: string }>('/api/player/new', { method: 'POST' });
export const recoverPlayer = (code: string) => call<{ recovered?: boolean; error?: string }>('/api/player/recover', { method: 'POST', body: JSON.stringify({ recoveryCode: code }) });
export const loadSave = () => call<{ role: string | null; save: unknown }>('/api/save');
export const putSave = (role: string, save: unknown) => call<{ ok: boolean }>('/api/save', { method: 'PUT', body: JSON.stringify({ role, save }) });
