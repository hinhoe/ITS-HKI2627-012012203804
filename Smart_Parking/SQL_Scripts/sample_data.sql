-- ==========================================================================
-- HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
-- File Dữ liệu mẫu ban đầu: SQL_Scripts/sample_data.sql
-- ==========================================================================

-- 1. Bãi xe mặc định
INSERT OR IGNORE INTO parking_lots (id, lot_code, lot_name, total_capacity, moto_capacity, car_capacity)
VALUES (1, 'LOT-A', 'Bãi đỗ xe thông minh ParkTech', 500, 300, 200);

-- 2. Bảng giá mặc định
INSERT OR IGNORE INTO pricing_rules (id, vehicle_type, fee_type, base_price, description)
VALUES 
    (1, 'Xe máy', 'Ban ngày', 5000, 'Lượt gửi ban ngày (06:00 - 18:00)'),
    (2, 'Xe máy', 'Qua đêm', 10000, 'Gửi qua đêm (sau 18:00)'),
    (3, 'Ô tô', 'Ban ngày', 25000, 'Lượt gửi ban ngày (06:00 - 18:00)'),
    (4, 'Ô tô', 'Qua đêm', 50000, 'Gửi qua đêm (sau 18:00)');

-- 3. Tài khoản mẫu
INSERT OR IGNORE INTO users (id, username, full_name, role)
VALUES 
    (1, 'nhanvien01', 'Trần Bảo Anh', 'employee'),
    (2, 'admin01', 'Quản trị viên Hệ thống', 'admin');
