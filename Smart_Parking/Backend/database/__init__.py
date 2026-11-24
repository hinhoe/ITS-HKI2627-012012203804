"""
Module quản lý kết nối và khởi tạo Cơ sở dữ liệu SQLite
"""

from Backend.database.connection import DB_PATH, get_db, get_db_context, init_db

__all__ = ["DB_PATH", "get_db", "get_db_context", "init_db"]
