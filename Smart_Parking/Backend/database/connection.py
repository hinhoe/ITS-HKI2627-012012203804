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

            # 2. Đọc và thực thi dữ liệu mẫu
            if SAMPLE_FILE.exists():
                sample_sql = SAMPLE_FILE.read_text(encoding="utf-8")
                conn.executescript(sample_sql)
                logger.info("Đã nạp dữ liệu mẫu ban đầu từ %s", SAMPLE_FILE.name)

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

