# 🚗 PARKTECH / PARKAIVISION — Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh

Hệ thống quản lý bãi đỗ xe thông minh ứng dụng công nghệ **AI Nhận diện biển số xe tự động (ALPR - Automatic License Plate Recognition)** kết hợp giữa **YOLOv8** (phát hiện biển số) và **Google Gemini Vision OCR** (nhận diện ký tự chính xác cao).

---

## 🌟 Tính Năng Nổi Bật

### 1. Nghiệp Vụ Vận Hành Bãi Xe (Dành cho Nhân viên)
* **Ghi nhận xe vào bãi (Check-in)**:
  * Tải ảnh/chụp camera cổng vào.
  * Tự động phát hiện vị trí biển số bằng mô hình YOLOv8 Offline.
  * Tự động nhận diện biển số xe (Ô tô, Xe máy) bằng Gemini Vision AI.
  * Cho phép chỉnh sửa/xóa nhanh nếu phát hiện biển số nhập sai ký tự.
  * Lưu trữ ảnh toàn cảnh và ảnh cắt chi tiết biển số.
* **Ghi nhận xe ra & Tính phí (Check-out)**:
  * Quét ảnh xe lúc ra, đối soát 2 chiều với ảnh lúc vào.
  * Tự động tính thời gian gửi (phút, giờ, ngày) và áp biểu phí chuẩn.
  * Hỗ trợ thanh toán tiền mặt/QR Code và mở barrier tự động.
* **Quản lý xe đang gửi trong bãi**:
  * Theo dõi danh sách xe thời gian thực với phân loại đậu bình thường / đậu quá 24h.
  * Bộ lọc tùy chỉnh đa năng (Tìm kiếm biển số, Lọc loại xe, Lọc thời gian gửi).
  * Hỗ trợ xem lại ảnh lúc vào, chỉnh sửa hoặc xóa lượt xe.
* **Lịch sử vào/ra & Tra cứu**:
  * Tra cứu toàn bộ các lượt gửi xe đã hoàn tất.
  * **Lịch chọn thời gian (Interactive Calendar)**: Hỗ trợ chọn nhanh Hôm nay, Hôm qua, 7 ngày qua, Tháng này, hoặc chọn ngày/tháng/năm cụ thể trên lịch.
  * **Xuất báo cáo Microsoft Excel (`.xlsx`)**: Định dạng chuẩn kế toán doanh nghiệp, đầy đủ tiêu đề, màu sắc, kẻ khung và dòng tổng cộng doanh thu.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```text
Smart_Parking/
├── AI/                                 # Module Trí Tuệ Nhân Tạo
│   ├── models/
│   │   └── license_plate_detector.pt   # File trọng số YOLOv8 phát hiện biển số
│   ├── __init__.py                     # Gói AI chuẩn hoá
│   ├── detect.py                       # Xử lý phát hiện biển số & cắt ảnh (YOLOv8)
│   ├── ocr.py                          # Nhận diện ký tự biển số (Gemini Vision OCR)
│   └── schemas.py                      # Pydantic Schemas dữ liệu AI
│
├── Backend/                            # Máy Chủ Dịch Vụ API (FastAPI)
│   ├── Employee/                       # Các API phục vụ phân hệ Nhân viên
│   │   ├── __init__.py
│   │   ├── checkin.py                  # API Ghi nhận xe vào
│   │   ├── checkout.py                 # API Ghi nhận xe ra & Tính phí
│   │   ├── current_parking.py          # API Quản lý xe đang trong bãi
│   │   └── history.py                  # API Lịch sử & Xuất báo cáo Excel
│   │
│   ├── Admin/                          # Các API phục vụ phân hệ Quản trị viên
│   │   └── __init__.py
│   │
│   ├── database/                       # Cơ sở dữ liệu SQLite
│   │   ├── __init__.py
│   │   ├── connection.py               # Kết nối CSDL & tạo bảng tự động
│   │   └── smart_parking.db            # File CSDL SQLite (tạo tự động)
│   │
│   ├── __init__.py
│   ├── config.py                       # Đọc biến môi trường & cấu hình hệ thống
│   └── main.py                         # Máy chủ FastAPI trung tâm
│
├── Frontend/                           # Giao Diện Người Dùng (HTML/CSS/JS)
│   ├── css/
│   │   ├── Admin/                      # CSS các trang Quản trị
│   │   ├── Employee/                   # CSS các trang Nhân viên
│   │   └── login.css
│   ├── js/
│   │   ├── Admin/                      # JS xử lý nghiệp vụ Quản trị
│   │   ├── Employee/                   # JS xử lý nghiệp vụ Nhân viên
│   │   └── login.js
│   ├── pages/
│   │   ├── Admin/                      # Trang HTML Quản trị (Dashboard, Tài khoản...)
│   │   ├── Employee/                   # Trang HTML Nhân viên (Checkin, Checkout...)
│   │   └── login.html
│   ├── images/                         # Icon SVG, Logo hệ thống
│   └── index.html                      # Trang điều hướng tự động
│
├── SQL_Scripts/                        # Kịch bản cơ sở dữ liệu mẫu
│   ├── parking_management.sql          # Cấu trúc bảng SQL chuẩn
│   └── sample_data.sql                 # Dữ liệu thử nghiệm
│
├── sample_images/                      # Ảnh mẫu phương tiện phục vụ kiểm thử
├── uploads/                            # Thư mục lưu ảnh xe tải lên
├── results/                            # Thư mục lưu ảnh phân tích AI
├── .env                                # Khóa bí mật và cấu hình môi trường
├── .env.example                        # Mẫu file cấu hình môi trường
├── requirements.txt                    # Danh sách các thư viện Python
└── run_server.bat                      # File khởi chạy 1-click tự động
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Cách 1: Khởi chạy 1-Click tự động (Khuyên dùng trên Windows)
1. Đảm bảo máy tính đã cài đặt **Python 3.10+** (nhớ tích chọn `Add Python to PATH` khi cài).
2. Nhấp đúp chuột vào file **`run_server.bat`**:
   * Hệ thống sẽ tự động tạo môi trường ảo `.venv`.
   * Tự động cài đặt toàn bộ thư viện từ `requirements.txt`.
   * Tự động mở trình duyệt web đến địa chỉ: `http://127.0.0.1:8000/`.
   * Các lần chạy sau sẽ khởi động ngay lập tức chỉ trong **1 giây**.

### Cách 2: Khởi chạy thủ công qua Terminal
```bash
# 1. Tạo môi trường ảo
python -m venv .venv

# 2. Kích hoạt môi trường ảo (Windows)
.venv\Scripts\activate

# 3. Cài đặt các thư viện phụ thuộc
pip install -r requirements.txt

# 4. Khởi chạy máy chủ FastAPI
python -m uvicorn Backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Sau khi máy chủ khởi động:
* **Giao diện làm việc**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
* **Tài liệu API Swagger**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* **Kiểm tra tình trạng hệ thống**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

## ⚙️ Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc dự án (tham khảo file `.env.example`):
```env
# Khóa API Google Gemini Vision (lấy tại https://aistudio.google.com/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Mô hình Gemini Vision sử dụng
GEMINI_MODEL=gemini-flash-lite-latest

# Đường dẫn file mô hình YOLOv8
YOLO_MODEL_PATH=AI/models/license_plate_detector.pt

# Ngưỡng tin cậy phát hiện biển số
CONFIDENCE_THRESHOLD=0.25
```
