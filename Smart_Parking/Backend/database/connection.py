"""
==========================================================================
HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE THÔNG MINH - PARKTECH / PARKAIVISION
File Kết Nối CSDL: Backend/database/connection.py
==========================================================================

Quản lý kết nối SQLite 3, tự động khởi tạo bảng cơ sở dữ liệu và dữ liệu mẫu
khi máy chủ FastAPI khởi động.
"""

from __future__ import annotations

import logging
from pathlib import Path
import sqlite3
from typing import Generator

logger = logging.getLogger("smart_parking.database")

# Đường dẫn file CSDL SQLite lưu trữ trong Backend/database/smart_parking.db
DATABASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = DATABASE_DIR / "smart_parking.db"
DB_PATH = DATABASE_PATH


# Đường dẫn file kịch bản SQL khởi tạo
PROJECT_ROOT = DATABASE_DIR.parent.parent
SCHEMA_FILE = PROJECT_ROOT / "SQL_Scripts" / "parking_management.sql"
SAMPLE_FILE = PROJECT_ROOT / "SQL_Scripts" / "sample_data.sql"


def get_db_connection() -> sqlite3.Connection:
    """
    Tạo và cấu hình kết nối SQLite trả về hàng dưới dạng dictionary (sqlite3.Row).
    """
    conn = sqlite3.connect(DATABASE_PATH, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Kích hoạt khóa ngoại
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    """
    Tự động đọc các file SQL_Scripts để khởi tạo cấu trúc bảng và nạp dữ liệu ban đầu.
    """
    try:
        DATABASE_DIR.mkdir(parents=True, exist_ok=True)
        conn = get_db_connection()
        with conn:
            # 1. Đọc và thực thi schema nếu có
            if SCHEMA_FILE.exists():
                schema_sql = SCHEMA_FILE.read_text(encoding="utf-8")
                conn.executescript(schema_sql)
                logger.info("Đã khởi tạo cấu trúc bảng CSDL từ %s", SCHEMA_FILE.name)

            # 2. Đảm bảo cột password_hash và shift_note tồn tại trên CSDL cũ (Migration an toàn)
            cols = [row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()]
            if "password_hash" not in cols:
                conn.execute(
                    "ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'"
                )
                logger.info("Đã bổ sung cột password_hash cho bảng users")
            if "shift_note" not in cols:
                conn.execute(
                    "ALTER TABLE users ADD COLUMN shift_note TEXT DEFAULT ''"
                )
                conn.execute(
                    "UPDATE users SET shift_note = CASE WHEN role = 'admin' THEN 'Toàn quyền quản trị' ELSE 'Trực ca cổng' END WHERE shift_note = '' OR shift_note IS NULL"
                )
                logger.info("Đã bổ sung cột shift_note cho bảng users")

            # 2b. Bảng nhật ký thay đổi mức phí gửi xe (Admin Audit Log)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pricing_audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    vehicle_type TEXT NOT NULL,
                    fee_type TEXT NOT NULL,
                    old_price INTEGER NOT NULL,
                    new_price INTEGER NOT NULL,
                    actor TEXT NOT NULL DEFAULT 'Quản trị viên',
                    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            # 3. Đọc và thực thi dữ liệu mẫu
            if SAMPLE_FILE.exists():
                sample_sql = SAMPLE_FILE.read_text(encoding="utf-8")
                conn.executescript(sample_sql)
                logger.info("Đã nạp dữ liệu mẫu ban đầu từ %s", SAMPLE_FILE.name)

            # 4. Đồng bộ tên loại xe 'Xe đạp / Đạp điện' cho dữ liệu cũ nếu có
            conn.execute(
                "UPDATE parking_sessions SET vehicle_type = 'Xe đạp / Đạp điện' WHERE vehicle_type = 'Xe đạp / Xe điện'"
            )
            conn.execute(
                "UPDATE pricing_rules SET vehicle_type = 'Xe đạp / Đạp điện' WHERE vehicle_type = 'Xe đạp / Xe điện'"
            )

            # 4b. Đảm bảo đủ 3 mức phí chuẩn (Ban ngày, Qua đêm, Chu kỳ 24 giờ) cho cả 3 loại phương tiện
            default_rules = [
                ("Xe máy", "Ban ngày", 5000, "Lượt gửi ban ngày (06:00 - 18:00)"),
                ("Xe máy", "Qua đêm", 10000, "Gửi qua đêm (sau 18:00)"),
                ("Xe máy", "Chu kỳ 24 giờ", 20000, "Giá cố định cho mỗi chu kỳ 24 giờ"),
                ("Ô tô", "Ban ngày", 25000, "Lượt gửi ban ngày (06:00 - 18:00)"),
                ("Ô tô", "Qua đêm", 50000, "Gửi qua đêm (sau 18:00)"),
                ("Ô tô", "Chu kỳ 24 giờ", 80000, "Giá cố định cho mỗi chu kỳ 24 giờ"),
                ("Xe đạp / Đạp điện", "Ban ngày", 3000, "Lượt gửi ban ngày (06:00 - 18:00)"),
                ("Xe đạp / Đạp điện", "Qua đêm", 6000, "Gửi qua đêm (sau 18:00)"),
                ("Xe đạp / Đạp điện", "Chu kỳ 24 giờ", 12000, "Giá cố định cho mỗi chu kỳ 24 giờ"),
            ]
            for vtype, ftype, price, desc in default_rules:
                existing = conn.execute(
                    "SELECT id FROM pricing_rules WHERE vehicle_type = ? AND fee_type = ?",
                    (vtype, ftype),
                ).fetchone()
                if not existing:
                    conn.execute(
                        "INSERT INTO pricing_rules (vehicle_type, fee_type, base_price, description, is_active) VALUES (?, ?, ?, ?, 1)",
                        (vtype, ftype, price, desc),
                    )

        conn.close()
        logger.info("Khởi tạo cơ sở dữ liệu thành công tại: %s", DATABASE_PATH)
    except Exception as exc:
        logger.error("Lỗi khi khởi tạo CSDL: %s", exc, exc_info=True)
        raise exc


# Context Manager cho FastAPI Dependency Injection
def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Yields connection cho các route FastAPI và tự động đóng kết nối sau khi xử lý xong request.
    """
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()


get_db_context = get_db

