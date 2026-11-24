"""
==========================================================================
PARKTECH / PARKAIVISION — Backend API Service
==========================================================================
Cấu trúc phân hệ:
- Backend/Employee/ : Nghiệp vụ vận hành dành cho Nhân viên (Check-in, Check-out, Quản lý xe, Lịch sử)
- Backend/Admin/    : Nghiệp vụ quản trị dành cho Quản lý (Tài khoản, Báo cáo, Đơn giá)
- Backend/database/ : Module quản lý kết nối và khởi tạo CSDL SQLite
- Backend/config.py : Cấu hình ứng dụng, biến môi trường (.env)
- Backend/main.py   : FastAPI Router trung tâm điều phối toàn bộ hệ thống
"""
