# Sàn Đỏ Sàn Xanh — prototype chế độ Phiên

## Chạy
```
python -m http.server 8765
```
Mở http://127.0.0.1:8765/web/index.html (cần chạy qua server, không mở file trực tiếp vì trình duyệt chặn `fetch`).

## Cập nhật dữ liệu
```
python tools/fetch_data.py 2018
```
Nguồn: endpoint công khai của DNSE (nến ngày, giá nghìn đồng). Xuất `data/*.json` + `data/index.json`.

## Cách replay hoạt động
- Mỗi phiên = nến ngày thật (O/H/L/C/V) → nội suy thành 255 bước "phút" (9:00–14:45, bỏ nghỉ trưa) bằng cầu Brown có seed, luôn chạm đúng High/Low/Close.
- ATO 9:00–9:15, liên tục, nghỉ trưa 11:30, ATC 14:30–14:45; trần/sàn HOSE ±7%, HNX ±10%, UPCOM ±15%.
- Đường giá trong phiên là **mô phỏng**, không phải dữ liệu tick thật.
- Phím cách = chạy/dừng. Thanh trượt chỉ hiển thị tiến độ (không tua được vì trạng thái khách phụ thuộc hành động của bạn).

## Gameplay chế độ Phiên
- Chọn **chính sách margin** trước phiên (Thận trọng / Cân bằng / Liều): vay nhiều → lãi vay cao nhưng dễ cháy.
- Mỗi khách NPC (F0, Lướt sóng, Giá trị, Cá mập, Zalo) giữ 1 mã có vay margin. Dư nợ ≥62% = **cảnh báo**, ≥70% = **bị xử lý**.
- Hành động (chỉ khi đang chạy): 📞 trấn an (+tâm trạng) · 💵 gọi bổ sung ký quỹ (xác suất theo tâm trạng/loại khách) · 🔨 giải chấp ngay.
- Không xử lý khi bị xử lý → hệ thống tự bán sau 25 phút ảo. Mã **nằm sàn thì không bán được** (kẹt sàn).
- Vị thế cảnh báo/xử lý chưa đóng sẽ **mang qua đêm** sang phiên kế tiếp (nút "Phiên kế tiếp"), có thể thành nợ xấu.
- "Tự động xử lý" = hệ thống tự gọi ký quỹ/giải chấp (lối chơi quản lý, chậm hơn người chơi giỏi).
- Cuối phiên: phí + lãi vay − nợ xấu, uy tín (ảnh hưởng số khách mới), khách bỏ đi nếu tâm trạng thấp hoặc cháy tài khoản.
