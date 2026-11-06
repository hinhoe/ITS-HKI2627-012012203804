// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Quản lý xe đang gửi trong bãi (current-parking.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái và Dữ liệu Mock chuẩn xác theo hình thiết kế
  const state = {
    totalCapacity: 500,
    currentCount: 412,
    overdueCount: 3,
    // Danh sách 20 xe mẫu trong bãi
    vehicles: [
      {
        plate: '30E-892.41',
        type: 'Ô tô',
        timeIn: '08:15:20 - 14/04/2026',
        duration: '1 ngày 06 giờ',
        gate: 'Cổng A',
        status: 'Đậu quá 24h',
        isOverdue: true
      },
      {
        plate: '29A-688.88',
        type: 'Ô tô',
        timeIn: '07:20:11 - 15/04/2026',
        duration: '7 giờ 12 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '29-V1 552.19',
        type: 'Xe máy',
        timeIn: '12:14:45 - 15/04/2026',
        duration: '2 giờ 17 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '30-P8 441.90',
        type: 'Xe máy',
        timeIn: '10:45:00 - 15/04/2026',
        duration: '3 giờ 47 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '51K-294.63',
        type: 'Ô tô',
        timeIn: '06:50:33 - 15/04/2026',
        duration: '7 giờ 41 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '29C-712.35',
        type: 'Ô tô',
        timeIn: '13:05:12 - 15/04/2026',
        duration: '1 giờ 27 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '29-H1 839.12',
        type: 'Xe máy',
        timeIn: '09:12:44 - 15/04/2026',
        duration: '5 giờ 19 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '30-F4 118.02',
        type: 'Xe máy',
        timeIn: '11:00:19 - 13/04/2026',
        duration: '2 ngày 03 giờ',
        gate: 'Cổng B',
        status: 'Đậu quá 24h',
        isOverdue: true
      },
      {
        plate: '30G-456.78',
        type: 'Ô tô',
        timeIn: '11:30:40 - 15/04/2026',
        duration: '3 giờ 01 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '29-X5 901.23',
        type: 'Xe máy',
        timeIn: '13:50:18 - 15/04/2026',
        duration: '0 giờ 42 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '51G-623.14',
        type: 'Ô tô',
        timeIn: '08:45:10 - 15/04/2026',
        duration: '5 giờ 47 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '29-B1 773.05',
        type: 'Xe máy',
        timeIn: '09:30:22 - 15/04/2026',
        duration: '5 giờ 02 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '30A-991.82',
        type: 'Ô tô',
        timeIn: '10:15:00 - 15/04/2026',
        duration: '4 giờ 17 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '30-M2 334.61',
        type: 'Xe máy',
        timeIn: '11:05:40 - 15/04/2026',
        duration: '3 giờ 26 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '43C-512.90',
        type: 'Ô tô',
        timeIn: '11:42:19 - 15/04/2026',
        duration: '2 giờ 50 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '29-K1 445.89',
        type: 'Xe máy',
        timeIn: '12:20:15 - 15/04/2026',
        duration: '2 giờ 12 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '30H-883.19',
        type: 'Ô tô',
        timeIn: '06:10:05 - 14/04/2026',
        duration: '1 ngày 08 giờ',
        gate: 'Cổng A',
        status: 'Đậu quá 24h',
        isOverdue: true
      },
      {
        plate: '29-D2 619.47',
        type: 'Xe máy',
        timeIn: '13:10:55 - 15/04/2026',
        duration: '1 giờ 21 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '51F-302.81',
        type: 'Ô tô',
        timeIn: '13:40:08 - 15/04/2026',
        duration: '0 giờ 52 phút',
        gate: 'Cổng A',
        status: 'Đang gửi',
        isOverdue: false
      },
      {
        plate: '30-T9 852.16',
        type: 'Xe máy',
        timeIn: '14:15:30 - 15/04/2026',
        duration: '0 giờ 17 phút',
        gate: 'Cổng B',
        status: 'Đang gửi',
        isOverdue: false
      }
    ],
    searchKeyword: '',
    filterType: 'all',
    filterDuration: 'all',
    currentPage: 1,
    pageSize: 20
  };

  // 2. Tham chiếu các phần tử DOM
  const searchInput = document.getElementById('searchInput');
  const filterTypeSelect = document.getElementById('filterTypeSelect');
  const filterDurationSelect = document.getElementById('filterDurationSelect');
  const btnResetFilter = document.getElementById('btnResetFilter');
  const vehiclesTableBody = document.getElementById('vehiclesTableBody');
  const paginationInfo = document.getElementById('paginationInfo');

  // User Dropdown
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Modal xem ảnh
  const photoModalBackdrop = document.getElementById('photoModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPlateNumber = document.getElementById('modalPlateNumber');
  const modalVehicleType = document.getElementById('modalVehicleType');
  const modalTimeIn = document.getElementById('modalTimeIn');
  const modalGateIn = document.getElementById('modalGateIn');

  // ==========================================================================
  // HÀM TIỆN ÍCH & RENDER DỮ LIỆU
  // ==========================================================================

  // Tạo ảnh thumbnail nhỏ cho biển số
  function createPlateThumbnail(plate, type) {
    const isAuto = type === 'Ô tô';
    return `
      <div class="plate-thumb" style="display:flex;align-items:center;justify-content:center;background:${isAuto ? '#1e3a8a' : '#0f766e'};color:#fff;font-family:Consolas,monospace;font-size:8px;font-weight:700;border-radius:3px;">
        ${isAuto ? 'AUTO' : 'MOTO'}
      </div>
    `;
  }

  // Lọc và hiển thị danh sách xe
  function renderVehicles() {
    if (!vehiclesTableBody) return;

    // 1. Áp dụng bộ lọc
    const filtered = state.vehicles.filter(item => {
      // Tìm kiếm theo biển số
      const matchesSearch = item.plate.toLowerCase().includes(state.searchKeyword.toLowerCase().trim());
      
      // Lọc theo loại xe
      const matchesType = (state.filterType === 'all') || (item.type === state.filterType);
      
      // Lọc theo thời gian gửi (quá 24h hoặc dưới 24h)
      let matchesDuration = true;
      if (state.filterDuration === 'overdue') {
        matchesDuration = item.isOverdue === true;
      } else if (state.filterDuration === 'under24') {
        matchesDuration = item.isOverdue === false;
      }

      return matchesSearch && matchesType && matchesDuration;
    });

    // 2. Render từng dòng của bảng
    if (filtered.length === 0) {
      vehiclesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 32px; color: #94a3b8;">
            <i class="fa-solid fa-magnifying-glass" style="font-size:24px; margin-bottom:8px; display:block;"></i>
            Không tìm thấy phương tiện nào phù hợp với bộ lọc
          </td>
        </tr>
      `;
    } else {
      vehiclesTableBody.innerHTML = filtered.map(item => `
        <tr>
          <td>
            <div class="plate-cell">
              ${createPlateThumbnail(item.plate, item.type)}
              <span class="plate-text">${item.plate}</span>
            </div>
          </td>
          <td>
            <span class="vehicle-type-cell">
              <i class="fa-solid ${item.type === 'Ô tô' ? 'fa-car' : 'fa-motorcycle'}"></i>
              <span>${item.type}</span>
            </span>
          </td>
          <td class="td-time">${item.timeIn}</td>
          <td class="td-duration ${item.isOverdue ? 'overdue' : ''}">
            ${item.duration}
          </td>
          <td style="font-weight: 500; color: #475569;">${item.gate}</td>
          <td>
            <span class="badge-status ${item.isOverdue ? 'badge-status-overdue' : 'badge-status-active'}">
              ${item.status}
            </span>
          </td>
          <td>
            <button type="button" class="btn-view-photo" data-plate="${item.plate}">
              <i class="fa-regular fa-eye"></i>
              <span>Xem ảnh vào</span>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 3. Cập nhật dòng thông tin phân trang
    if (paginationInfo) {
      paginationInfo.textContent = `Hiển thị 1–${filtered.length} trên tổng ${state.currentCount} xe`;
    }

    // 4. Gán sự kiện cho các nút "Xem ảnh vào"
    document.querySelectorAll('.btn-view-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const plate = btn.getAttribute('data-plate');
        const vehicle = state.vehicles.find(v => v.plate === plate);
        if (vehicle) {
          openPhotoModal(vehicle);
        }
      });
    });
  }

  // Mở modal xem ảnh xe
  function openPhotoModal(vehicle) {
    if (!photoModalBackdrop) return;
    if (modalPlateNumber) modalPlateNumber.textContent = vehicle.plate;
    if (modalVehicleType) modalVehicleType.textContent = vehicle.type;
    if (modalTimeIn) modalTimeIn.textContent = vehicle.timeIn;
    if (modalGateIn) modalGateIn.textContent = vehicle.gate;

    photoModalBackdrop.classList.add('show');
  }

  // Đóng modal xem ảnh
  function closePhotoModal() {
    if (photoModalBackdrop) {
      photoModalBackdrop.classList.remove('show');
    }
  }

  // ==========================================================================
  // XỬ LÝ SỰ KIỆN TƯƠNG TÁC (EVENT LISTENERS)
  // ==========================================================================

  // A. Bật / Tắt menu hồ sơ cá nhân của nhân viên
  if (userProfileBtn && userDropdownMenu) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userProfileBtn.contains(e.target)) {
        userDropdownMenu.classList.remove('show');
      }
    });
  }

  // B. Tìm kiếm biển số theo thời gian thực (Live Search)
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      renderVehicles();
    });
  }

  // C. Lọc theo Loại xe
  if (filterTypeSelect) {
    filterTypeSelect.addEventListener('change', (e) => {
      state.filterType = e.target.value;
      renderVehicles();
    });
  }

  // D. Lọc theo Thời gian gửi
  if (filterDurationSelect) {
    filterDurationSelect.addEventListener('change', (e) => {
      state.filterDuration = e.target.value;
      renderVehicles();
    });
  }

  // E. Nút Đặt lại bộ lọc (Reset)
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.searchKeyword = '';
      state.filterType = 'all';
      state.filterDuration = 'all';

      if (searchInput) searchInput.value = '';
      if (filterTypeSelect) filterTypeSelect.value = 'all';
      if (filterDurationSelect) filterDurationSelect.value = 'all';

      renderVehicles();
    });
  }

  // F. Đóng Modal khi bấm nút X hoặc bấm ra ngoài màn hình mờ
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closePhotoModal);
  }
  if (photoModalBackdrop) {
    photoModalBackdrop.addEventListener('click', (e) => {
      if (e.target === photoModalBackdrop) {
        closePhotoModal();
      }
    });
  }

  // Khởi tạo hiển thị ban đầu
  renderVehicles();
});
