/* VN30 → tòa nhà. Mỗi mã là một tòa trên bản đồ; sprite theo NGÀNH, đổi sắc nhẹ theo mã để khác nhau.
   Sprite sinh bằng PixelLab, lưu ở public/assets/iso/*.png. */

export type Sector = 'bank' | 'sec' | 'resi' | 'complex' | 'retail' | 'food' | 'steel' | 'oil' | 'tech' | 'air' | 'rubber';
export interface StockInfo { sym: string; name: string; sector: Sector }

export const STOCKS: StockInfo[] = [
  { sym: 'ACB', name: 'Ngân hàng Á Châu', sector: 'bank' }, { sym: 'BID', name: 'BIDV', sector: 'bank' },
  { sym: 'CTG', name: 'VietinBank', sector: 'bank' }, { sym: 'HDB', name: 'HDBank', sector: 'bank' },
  { sym: 'LPB', name: 'LPBank', sector: 'bank' }, { sym: 'MBB', name: 'MB Bank', sector: 'bank' },
  { sym: 'SHB', name: 'SHB', sector: 'bank' }, { sym: 'SSB', name: 'SeABank', sector: 'bank' },
  { sym: 'STB', name: 'Sacombank', sector: 'bank' }, { sym: 'TCB', name: 'Techcombank', sector: 'bank' },
  { sym: 'VCB', name: 'Vietcombank', sector: 'bank' }, { sym: 'VIB', name: 'VIB', sector: 'bank' },
  { sym: 'VPB', name: 'VPBank', sector: 'bank' },
  { sym: 'SSI', name: 'Chứng khoán SSI', sector: 'sec' }, { sym: 'TCX', name: 'Chứng khoán Techcom', sector: 'sec' },
  { sym: 'VHM', name: 'Vinhomes', sector: 'resi' }, { sym: 'VIC', name: 'Vingroup', sector: 'complex' },
  { sym: 'VPL', name: 'Vinpearl', sector: 'complex' }, { sym: 'VRE', name: 'Vincom Retail', sector: 'retail' },
  { sym: 'MWG', name: 'Thế Giới Di Động', sector: 'retail' }, { sym: 'MCH', name: 'Masan Consumer', sector: 'food' },
  { sym: 'MSN', name: 'Masan Group', sector: 'food' }, { sym: 'SAB', name: 'Sabeco', sector: 'food' },
  { sym: 'VNM', name: 'Vinamilk', sector: 'food' }, { sym: 'HPG', name: 'Hòa Phát', sector: 'steel' },
  { sym: 'GVR', name: 'Cao su Việt Nam', sector: 'rubber' }, { sym: 'FPT', name: 'FPT', sector: 'tech' },
  { sym: 'VJC', name: 'Vietjet', sector: 'air' }, { sym: 'BSR', name: 'Lọc dầu Bình Sơn', sector: 'oil' },
  { sym: 'GAS', name: 'PV GAS', sector: 'oil' },
];
export const stockInfo = (sym: string) => STOCKS.find((s) => s.sym === sym);

/** sprite (key trong assets/iso) cho từng ngành; ngân hàng xoay vòng 3 kiểu. */
export const SECTOR_SPRITES: Record<Sector, string[]> = {
  bank: ['bank_a', 'bank_b', 'bank_c'], sec: ['securities'], resi: ['resi'], complex: ['complex'], retail: ['mall'],
  food: ['dairy'], steel: ['steel'], oil: ['oil'], tech: ['tech'], air: ['airport'], rubber: ['rubber'],
};
export const SPRITE_FILES = ['bank_a', 'bank_b', 'bank_c', 'securities', 'resi', 'complex', 'mall', 'dairy', 'steel', 'oil', 'tech', 'airport', 'rubber', 'hq'];

/** lưới 6×6 ô đất (hàng j, cột i). 'HQ' = công ty; 'lot:<room>' = lô mở rộng; 'future' = chưa mở. */
export const PLOTS: string[][] = [
  ['ACB', 'BID', 'CTG', 'HDB', 'LPB', 'MBB'],
  ['SHB', 'SSB', 'STB', 'TCB', 'VCB', 'VIB'],
  ['VPB', 'SSI', 'TCX', 'VHM', 'VIC', 'VPL'],
  ['VRE', 'MWG', 'lot:vg', 'HQ', 'lot:bd', 'MCH'],
  ['MSN', 'SAB', 'VNM', 'HPG', 'lot:bh', 'GVR'],
  ['FPT', 'VJC', 'BSR', 'GAS', 'future', 'future'],
];
