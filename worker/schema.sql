-- Dữ liệu thị trường (nến 1 phút, slot 20 phút, bảng giá) lưu dạng JSON trong meta để
-- mỗi lần cron chỉ tốn vài query D1 (gói free: 50 query/lần chạy).
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT 0);

-- Người chơi ẩn danh: chỉ lưu SHA-256 của device id và mã khôi phục (KHÔNG lưu IP).
CREATE TABLE IF NOT EXISTS players (
  device_hash TEXT PRIMARY KEY,
  recovery_hash TEXT NOT NULL UNIQUE,
  role TEXT,
  save TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
