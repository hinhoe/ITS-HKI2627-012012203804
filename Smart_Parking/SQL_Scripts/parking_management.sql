-- ==========================================================================
-- HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
-- File CSDL: Thiết kế bảng cơ sở dữ liệu (parking_management.sql)
-- Hỗ trợ: SQLite 3 & tương thích cú pháp MySQL / PostgreSQL chuẩn
-- ==========================================================================

-- 1. Bảng cấu hình sức chứa và thông tin bãi xe
CREATE TABLE IF NOT EXISTS parking_lots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lot_code TEXT UNIQUE NOT NULL,
    lot_name TEXT NOT NULL,
    total_capacity INTEGER NOT NULL DEFAULT 500,
    moto_capacity INTEGER NOT NULL DEFAULT 300,
    car_capacity INTEGER NOT NULL DEFAULT 200,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng quy định bảng giá dịch vụ gửi xe
CREATE TABLE IF NOT EXISTS pricing_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_type TEXT NOT NULL,         -- 'Ô tô' hoặc 'Xe máy'
    fee_type TEXT NOT NULL,             -- 'Ban ngày', 'Qua đêm', 'Theo lượt'
    base_price INTEGER NOT NULL,        -- Số tiền (VNĐ)
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng tài khoản nhân viên & quản trị viên
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee', -- 'admin' hoặc 'employee'
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. BẢNG TRỌNG TÂM: LƯỢT GỬI XE (PARKING SESSIONS)
-- Lưu trữ toàn bộ thông tin đối soát từ lúc xe vào (Check-in) đến khi xe ra (Check-out)
CREATE TABLE IF NOT EXISTS parking_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code TEXT UNIQUE NOT NULL,      -- Mã phiên lượt gửi duy nhất (VD: SES-20261121-001)
    plate_number TEXT NOT NULL,             -- Biển số xe đã nhận diện / nhập tay (VD: 51F-866.88)
    vehicle_type TEXT NOT NULL,             -- 'Ô tô' hoặc 'Xe máy'
    checkin_time DATETIME NOT NULL,         -- Thời điểm vào bãi
    checkout_time DATETIME,                 -- Thời điểm ra bãi (NULL khi xe đang đỗ)
    duration_minutes INTEGER DEFAULT 0,     -- Tổng thời gian đỗ (tính theo phút)
    
    -- Hình ảnh đối soát ALPR
    checkin_image_url TEXT,                 -- Ảnh phương tiện lúc vào
    checkin_crop_url TEXT,                  -- Ảnh cắt riêng biển số lúc vào
    checkout_image_url TEXT,                -- Ảnh phương tiện lúc ra
    checkout_crop_url TEXT,                 -- Ảnh cắt riêng biển số lúc ra
    
    -- Chỉ số chất lượng AI & Nhập tay
    confidence REAL DEFAULT 0.0,            -- Độ tin cậy nhận diện (%)
    is_manual INTEGER DEFAULT 0,            -- 0: Nhận diện tự động AI, 1: Nhân viên nhập tay
    
    -- Tài chính & Trạng thái
    total_fee INTEGER DEFAULT 0,            -- Phí gửi xe (VNĐ)
    payment_status TEXT DEFAULT 'UNPAID',   -- 'UNPAID' (chưa thu), 'PAID' (đã thu)
    status TEXT DEFAULT 'PARKED',           -- 'PARKED' (đang đỗ), 'COMPLETED' (đã ra), 'CANCELLED'
    
    -- Nhân sự vận hành
    staff_checkin TEXT DEFAULT 'Trần Bảo Anh',
    staff_checkout TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tạo chỉ mục (Index) tăng tốc độ tìm kiếm biển số khi Check-out
CREATE INDEX IF NOT EXISTS idx_sessions_plate ON parking_sessions (plate_number);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON parking_sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_checkin_time ON parking_sessions (checkin_time DESC);
