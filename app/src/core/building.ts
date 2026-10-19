/* Tòa nhà CTCK: tầng → phòng → mô hình đầu tư. Toàn bộ là DỮ LIỆU: thêm tầng/phòng/sản phẩm chỉ cần thêm một dòng.
   Đơn vị tiền: triệu đồng (tr). Cân bằng số liệu sẽ chỉnh ở M1. */

export type FloorKind = 'herring' | 'checker' | 'carpet' | 'teal' | 'tile' | 'brick';
export type ProductKind = 'loan' | 'equity' | 'bond' | 'fund' | 'gold' | 'realestate' | 'insurance' | 'ib' | 'deriv';

export interface Req { tier?: number; rep?: number; customers?: number; rooms?: string[]; products?: string[] }

export interface RoomDef {
  id: string; name: string; short: string; color: number; css: string;
  floor: FloorKind; wall: number; props: string[];
  cost: number;            // chi phí xây (tr)
  upkeep: number;          // chi phí duy trì / ngày (tr)
  req: Req;                // điều kiện ngoài tiền
  blurb: string;           // vai trò trong game
  start?: boolean;         // có sẵn từ đầu
}
export interface FloorDef { id: number; name: string; tier: number; cost: number; blurb: string; rooms: RoomDef[] }

export interface ProductDef {
  id: string; name: string; room: string; kind: ProductKind;
  risk: 1 | 2 | 3 | 4 | 5; yield: string; data: 'real' | 'sim';
  req?: Req; blurb: string;
}

const C = { red: 0xef4444, purple: 0xa855f7, blue: 0x3b82f6, green: 0x22c55e, orange: 0xf97316, amber: 0xf59e0b, teal: 0x14b8a6, pink: 0xec4899, cyan: 0x06b6d4 };
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');
const room = (r: Omit<RoomDef, 'css'>): RoomDef => ({ ...r, css: css(r.color) });

export const FLOORS: FloorDef[] = [
  {
    id: 1, name: 'Sảnh giao dịch', tier: 1, cost: 0, blurb: 'Mặt tiền: nơi khách đến mở tài khoản, đặt lệnh, vay margin.',
    rooms: [
      room({ id: 'mg', name: 'Môi giới', short: 'MÔI GIỚI', color: C.red, floor: 'checker', wall: 0xe8896c, props: ['desk', 'desk', 'plant', 'cabinet'], cost: 0, upkeep: 4, req: {}, start: true,
        blurb: 'Nhận khách, đặt lệnh, thu phí giao dịch. Mỗi bàn thêm 1 môi giới = thêm khách.' }),
      room({ id: 'ks', name: 'Chăm sóc khách hàng', short: 'CHĂM SÓC KH', color: C.pink, floor: 'carpet', wall: 0xf1e8c8, props: ['desk', 'desk', 'rug', 'plant'], cost: 300, upkeep: 3, req: { tier: 1 },
        blurb: 'Trấn an khách, giảm tỷ lệ khách bỏ đi, tăng uy tín.' }),
      room({ id: 'mr', name: 'Quầy Margin', short: 'QUẦY MARGIN', color: C.purple, floor: 'carpet', wall: 0xf1e8c8, props: ['desk', 'desk', 'board', 'plant'], cost: 600, upkeep: 5, req: { tier: 1, rooms: ['mg'] },
        blurb: 'Mở cho vay margin và ứng trước tiền bán. Nguồn thu lãi lớn nhưng dễ nợ xấu.' }),
    ],
  },
  {
    id: 2, name: 'Quản trị & Rủi ro', tier: 2, cost: 1500, blurb: 'Bộ não công ty: điều hành, kiểm soát rủi ro, pháp chế.',
    rooms: [
      room({ id: 'gd', name: 'Giám đốc', short: 'GIÁM ĐỐC', color: C.amber, floor: 'herring', wall: 0x6b4423, props: ['bigdesk', 'shelf', 'rug', 'plant'], cost: 400, upkeep: 6, req: { tier: 2 },
        blurb: 'Đặt chiến lược, duyệt hạn mức, mở rộng tầng/phòng mới.' }),
      room({ id: 'rr', name: 'Rủi ro & Giải chấp', short: 'RỦI RO', color: C.purple, floor: 'carpet', wall: 0xf1e8c8, props: ['desk', 'desk', 'board', 'plant'], cost: 800, upkeep: 6, req: { tier: 2, rooms: ['mr'] },
        blurb: 'Tự động cảnh báo và giải chấp nhanh hơn; nâng hạn mức margin an toàn.' }),
      room({ id: 'cp', name: 'Compliance & Pháp chế', short: 'COMPLIANCE', color: C.orange, floor: 'brick', wall: 0xf3d9a4, props: ['desk', 'desk', 'cabinet', 'plant'], cost: 600, upkeep: 4, req: { tier: 2 },
        blurb: 'Giảm rủi ro bị thanh tra/phạt, cần cho sản phẩm phức tạp.' }),
    ],
  },
  {
    id: 3, name: 'Đầu tư & Nghiên cứu', tier: 3, cost: 6000, blurb: 'Dùng vốn công ty đầu tư: cổ phiếu, trái phiếu, quỹ.',
    rooms: [
      room({ id: 'td', name: 'Tự doanh', short: 'TỰ DOANH', color: C.blue, floor: 'teal', wall: 0xc5ccd8, props: ['desk', 'desk', 'server', 'plant'], cost: 2000, upkeep: 10, req: { tier: 3 },
        blurb: 'Đầu tư cổ phiếu VN30 bằng vốn công ty; phái sinh khi đủ tầm.' }),
      room({ id: 'tp', name: 'Trái phiếu & Quỹ', short: 'TRÁI PHIẾU', color: C.teal, floor: 'tile', wall: 0xe6dcc0, props: ['desk', 'desk', 'cabinet', 'plant'], cost: 2500, upkeep: 8, req: { tier: 3 },
        blurb: 'Trái phiếu doanh nghiệp và quỹ/ETF: lãi ổn định, rủi ro tín dụng.' }),
      room({ id: 'rs', name: 'Phân tích (Research)', short: 'RESEARCH', color: C.cyan, floor: 'carpet', wall: 0xf1e8c8, props: ['desk', 'desk', 'board', 'plant'], cost: 1200, upkeep: 6, req: { tier: 3, rooms: ['gd'] },
        blurb: 'Ra khuyến nghị cho khách và tự doanh; sai thì mất uy tín.' }),
    ],
  },
  {
    id: 4, name: 'Sản phẩm mở rộng', tier: 4, cost: 20000, blurb: 'Đa dạng hóa: vàng, bất động sản, bảo hiểm.',
    rooms: [
      room({ id: 'vg', name: 'Kinh doanh vàng', short: 'VÀNG', color: C.amber, floor: 'herring', wall: 0x6b4423, props: ['desk', 'goldcase', 'server', 'plant'], cost: 3000, upkeep: 8, req: { tier: 4, rooms: ['td'] },
        blurb: 'Mua bán vàng miếng/nhẫn, biên lợi nhuận mỏng, biến động theo giá thế giới.' }),
      room({ id: 'bd', name: 'Bất động sản', short: 'BẤT ĐỘNG SẢN', color: C.green, floor: 'checker', wall: 0xe8896c, props: ['desk', 'maquette', 'cabinet', 'plant'], cost: 8000, upkeep: 14, req: { tier: 4, rooms: ['cp'] },
        blurb: 'Cho vay thế chấp và đầu tư dự án: vốn khóa lâu, rủi ro pháp lý.' }),
      room({ id: 'bh', name: 'Bảo hiểm', short: 'BẢO HIỂM', color: C.pink, floor: 'teal', wall: 0xc5ccd8, props: ['desk', 'desk', 'board', 'plant'], cost: 4000, upkeep: 7, req: { tier: 4, rooms: ['ks'] },
        blurb: 'Đại lý bảo hiểm: hoa hồng đều đặn và dòng phí để đầu tư.' }),
    ],
  },
  {
    id: 5, name: 'Công nghệ & Tăng trưởng', tier: 5, cost: 60000, blurb: 'Quy mô tập đoàn: app giao dịch, marketing, ngân hàng đầu tư.',
    rooms: [
      room({ id: 'it', name: 'IT & Ứng dụng', short: 'IT', color: C.green, floor: 'tile', wall: 0xe6dcc0, props: ['desk', 'desk', 'server', 'plant'], cost: 5000, upkeep: 12, req: { tier: 5 },
        blurb: 'Giảm sập hệ thống giờ cao điểm, mở app giao dịch.' }),
      room({ id: 'mk', name: 'Marketing', short: 'MARKETING', color: C.orange, floor: 'brick', wall: 0xf3d9a4, props: ['desk', 'desk', 'board', 'plant'], cost: 4000, upkeep: 8, req: { tier: 5 },
        blurb: 'Kéo khách F0 mới nhưng kéo cả khách dễ cháy.' }),
      room({ id: 'ib', name: 'Ngân hàng đầu tư (IB)', short: 'IB', color: C.red, floor: 'herring', wall: 0x6b4423, props: ['bigdesk', 'shelf', 'rug', 'plant'], cost: 15000, upkeep: 20, req: { tier: 5, rooms: ['rs', 'cp'] },
        blurb: 'Bảo lãnh phát hành cổ phiếu/trái phiếu: phí rất lớn, hậu quả danh tiếng lớn.' }),
    ],
  },
];

/** Tầng đã lên kế hoạch (hiển thị mờ, chưa mở). Thêm FloorDef mới vào FLOORS để mở rộng tòa nhà. */
export const FUTURE_FLOORS = [
  { id: 6, name: 'Chi nhánh & Quốc tế', note: 'Chi nhánh tỉnh, môi giới nước ngoài (kế hoạch)' },
  { id: 7, name: 'Fintech & Dữ liệu', note: 'Robo-advisor, dữ liệu thay thế (kế hoạch)' },
];

export const PRODUCTS: ProductDef[] = [
  { id: 'margin', name: 'Cho vay margin', room: 'mr', kind: 'loan', risk: 4, yield: '12–14%/năm + phí', data: 'real', blurb: 'Khách vay mua cổ phiếu VN30. Call margin, giải chấp, kẹt sàn.' },
  { id: 'ung', name: 'Ứng trước tiền bán', room: 'mr', kind: 'loan', risk: 1, yield: '~0,03%/ngày', data: 'real', blurb: 'Ứng tiền chờ về T+2 cho khách. An toàn, thu nhỏ.' },
  { id: 'cophieu', name: 'Tự doanh cổ phiếu', room: 'td', kind: 'equity', risk: 4, yield: 'theo giá thị trường', data: 'real', blurb: 'Đầu tư vốn công ty vào VN30 theo giá thật.' },
  { id: 'phaisinh', name: 'Phái sinh VN30F', room: 'td', kind: 'deriv', risk: 5, yield: 'đòn bẩy cao', data: 'real', req: { tier: 4, rooms: ['rr'] }, blurb: 'Hợp đồng tương lai VN30: lãi/lỗ nhanh, cần Rủi ro kiểm soát.' },
  { id: 'traiphieu', name: 'Trái phiếu doanh nghiệp', room: 'tp', kind: 'bond', risk: 3, yield: '8–11%/năm', data: 'sim', blurb: 'Lãi cao hơn tiền gửi; sự kiện chậm trả có thể xảy ra.' },
  { id: 'quy', name: 'Quỹ mở / ETF', room: 'tp', kind: 'fund', risk: 3, yield: 'theo NAV', data: 'real', blurb: 'Bám VN30, thanh khoản tốt, lãi vừa phải.' },
  { id: 'vang', name: 'Kinh doanh vàng', room: 'vg', kind: 'gold', risk: 2, yield: 'chênh lệch mua bán', data: 'sim', blurb: 'Giá vàng mô phỏng bám xu hướng thế giới; có thể nối nguồn giá thật sau.' },
  { id: 'bds_vay', name: 'Cho vay thế chấp BĐS', room: 'bd', kind: 'loan', risk: 3, yield: '9–12%/năm', data: 'sim', blurb: 'An toàn khi giá nhà tăng; nợ xấu khi thị trường đóng băng.' },
  { id: 'bds_dan', name: 'Đầu tư dự án BĐS', room: 'bd', kind: 'realestate', risk: 5, yield: 'lãi lớn, khóa vốn 1–3 năm', data: 'sim', req: { tier: 5 }, blurb: 'Góp vốn dự án: vốn khóa lâu, rủi ro pháp lý và tiến độ.' },
  { id: 'baohiem', name: 'Đại lý bảo hiểm', room: 'bh', kind: 'insurance', risk: 1, yield: 'hoa hồng 10–25% phí năm 1', data: 'sim', blurb: 'Dòng tiền đều, ít rủi ro; sự kiện bồi thường tạo chi phí bất ngờ.' },
  { id: 'ib', name: 'Bảo lãnh phát hành', room: 'ib', kind: 'ib', risk: 4, yield: 'phí 1–3% giá trị đợt phát hành', data: 'sim', blurb: 'Phí rất lớn; bảo lãnh hụt thì phải mua hết phần dư.' },
];

export const roomById = (id: string): RoomDef | undefined => FLOORS.flatMap((f) => f.rooms).find((r) => r.id === id);
export const floorOfRoom = (id: string): FloorDef | undefined => FLOORS.find((f) => f.rooms.some((r) => r.id === id));
