export type RoleId = 'ctck' | 'quy' | 'canhan';

export interface Dept {
  id: string;
  name: string;        // tên đầy đủ
  short: string;       // nhãn ngắn trên cửa phòng / log
  color: number;       // màu nhấn (thẻ + thảm cửa)
  css: string;
  floor: 'herring' | 'checker' | 'carpet' | 'teal' | 'tile' | 'brick';
  wall: number;
  props: string[];
}

// Bố cục 3×2 giống ảnh tham chiếu: hàng trên (0..2), hành lang, hàng dưới (3..5).
export const CTCK_DEPTS: Dept[] = [
  { id: 'gd', name: 'Giám đốc', short: 'GIÁM ĐỐC', color: 0xf59e0b, css: '#f59e0b', floor: 'herring', wall: 0x6b4423, props: ['bigdesk', 'shelf', 'rug', 'plant'] },
  { id: 'mg', name: 'Môi giới', short: 'MÔI GIỚI', color: 0xef4444, css: '#ef4444', floor: 'checker', wall: 0xe8896c, props: ['desk', 'desk', 'plant', 'cabinet'] },
  { id: 'rr', name: 'Margin & Rủi ro', short: 'MARGIN & RỦI RO', color: 0xa855f7, css: '#a855f7', floor: 'carpet', wall: 0xf1e8c8, props: ['desk', 'desk', 'board', 'plant'] },
  { id: 'td', name: 'Tự doanh', short: 'TỰ DOANH', color: 0x3b82f6, css: '#3b82f6', floor: 'teal', wall: 0xc5ccd8, props: ['desk', 'desk', 'server', 'plant'] },
  { id: 'it', name: 'IT', short: 'IT', color: 0x22c55e, css: '#22c55e', floor: 'tile', wall: 0xe6dcc0, props: ['desk', 'desk', 'server', 'plant'] },
  { id: 'cp', name: 'Compliance', short: 'COMPLIANCE', color: 0xf97316, css: '#f97316', floor: 'brick', wall: 0xf3d9a4, props: ['desk', 'desk', 'cabinet', 'plant'] },
];

export const ROLES: { id: RoleId; name: string; blurb: string; ready: boolean }[] = [
  { id: 'ctck', name: 'Công ty chứng khoán', blurb: 'Điều hành môi giới, margin, tự doanh. Thu phí, lãi vay; giữ khách khỏi cháy tài khoản.', ready: true },
  { id: 'quy', name: 'Quỹ đầu tư', blurb: 'Quản lý NAV, dòng tiền vào ra, đua với VN-Index. (Sắp ra mắt)', ready: false },
  { id: 'canhan', name: 'Nhà đầu tư cá nhân', blurb: 'Một mình với bảng điện, tâm lý và nợ margin. (Sắp ra mắt)', ready: false },
];

export const DEPTS_BY_ROLE: Record<RoleId, Dept[]> = { ctck: CTCK_DEPTS, quy: CTCK_DEPTS, canhan: CTCK_DEPTS };
