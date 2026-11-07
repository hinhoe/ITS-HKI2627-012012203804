// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Quản lý xe đang gửi trong bãi (current-parking.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 20 xe gốc ban đầu chuẩn theo thiết kế thực tế ở trang 1
  const base20Vehicles = [
    { plate: '30E-892.41', type: 'Ô tô', timeIn: '08:15:20 - 14/04/2026', duration: '1 ngày 06 giờ', gate: 'Cổng A', status: 'Đậu quá 24h', isOverdue: true },
    { plate: '29A-688.88', type: 'Ô tô', timeIn: '07:20:11 - 15/04/2026', duration: '7 giờ 12 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '29-V1 552.19', type: 'Xe máy', timeIn: '12:14:45 - 15/04/2026', duration: '2 giờ 17 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '30-P8 441.90', type: 'Xe máy', timeIn: '10:45:00 - 15/04/2026', duration: '3 giờ 47 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '51K-294.63', type: 'Ô tô', timeIn: '06:50:33 - 15/04/2026', duration: '7 giờ 41 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '29C-712.35', type: 'Ô tô', timeIn: '13:05:12 - 15/04/2026', duration: '1 giờ 27 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '29-H1 839.12', type: 'Xe máy', timeIn: '09:12:44 - 15/04/2026', duration: '5 giờ 19 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '30-F4 118.02', type: 'Xe máy', timeIn: '11:00:19 - 13/04/2026', duration: '2 ngày 03 giờ', gate: 'Cổng B', status: 'Đậu quá 24h', isOverdue: true },
    { plate: '30G-456.78', type: 'Ô tô', timeIn: '11:30:40 - 15/04/2026', duration: '3 giờ 01 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '29-X5 901.23', type: 'Xe máy', timeIn: '13:50:18 - 15/04/2026', duration: '0 giờ 42 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '30F-331.89', type: 'Ô tô', timeIn: '12:05:30 - 15/04/2026', duration: '2 giờ 26 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '29B-128.55', type: 'Xe máy', timeIn: '08:35:10 - 15/04/2026', duration: '5 giờ 56 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '51A-982.11', type: 'Ô tô', timeIn: '09:15:00 - 14/04/2026', duration: '1 ngày 05 giờ', gate: 'Cổng A', status: 'Đậu quá 24h', isOverdue: true },
    { plate: '30H-112.54', type: 'Xe máy', timeIn: '10:20:45 - 15/04/2026', duration: '4 giờ 11 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '29D-665.32', type: 'Ô tô', timeIn: '07:40:22 - 15/04/2026', duration: '6 giờ 51 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '30A-778.99', type: 'Ô tô', timeIn: '11:15:10 - 15/04/2026', duration: '3 giờ 16 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '51G-332.18', type: 'Xe máy', timeIn: '13:10:05 - 15/04/2026', duration: '1 giờ 22 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '29B-452.10', type: 'Xe máy', timeIn: '08:50:30 - 15/04/2026', duration: '5 giờ 41 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false },
    { plate: '30K-889.01', type: 'Ô tô', timeIn: '12:40:12 - 15/04/2026', duration: '1 giờ 51 phút', gate: 'Cổng A', status: 'Đang gửi', isOverdue: false },
    { plate: '29-S2 678.90', type: 'Xe máy', timeIn: '09:55:00 - 15/04/2026', duration: '4 giờ 37 phút', gate: 'Cổng B', status: 'Đang gửi', isOverdue: false }
  ];

  // Hàm sinh dữ liệu giả lập chuẩn xác đủ 412 xe (21 trang, trang 1-20 mỗi trang 20 xe, trang 21 có 12 xe)
  function buildAllCurrentVehicles(total = 412) {
    const list = [...base20Vehicles];
    const carPrefixes = ['30E', '29A', '51K', '29C', '30G', '30F', '51A', '29D', '30A', '30K'];
    const motorPrefixes = ['29-V1', '30-P8', '29-H1', '30-F4', '29-X5', '29-B1', '30-H1', '51G', '29B', '29-S2'];

    for (let i = 21; i <= total; i++) {
      const isCar = (i % 2 !== 0);
      const prefixList = isCar ? carPrefixes : motorPrefixes;
      const prefix = prefixList[(i - 1) % prefixList.length];
      const part1 = String(100 + (i % 899)).padStart(3, '0');
      const part2 = String((i * 9) % 99).padStart(2, '0');
      const plate = `${prefix} ${part1}.${part2}`;

      const type = isCar ? 'Ô tô' : 'Xe máy';
      const gate = (i % 2 === 0) ? 'Cổng B' : 'Cổng A';
      const durationHours = (i % 9) + 1;
      const durationMinutes = (i * 13) % 60;
      const duration = `${durationHours} giờ ${durationMinutes.toString().padStart(2, '0')} phút`;

      const hourIn = String(6 + (i % 8)).padStart(2, '0');
      const minIn = String((i * 11) % 60).padStart(2, '0');
      const secIn = String((i * 17) % 60).padStart(2, '0');

      list.push({
        plate: plate,
        type: type,
        timeIn: `${hourIn}:${minIn}:${secIn} - 15/04/2026`,
        duration: duration,
        gate: gate,
        status: 'Đang gửi',
        isOverdue: false
      });
    }

    return list;
  }

  // 1. Quản lý trạng thái và Dữ liệu
  const state = {
    totalCapacity: 500,
    currentCount: 412,
    overdueCount: 3,
    vehicles: buildAllCurrentVehicles(412),
    currentPage: 1,
    pageSize: 20,
    searchKeyword: '',
    filterType: 'all',
    filterDuration: 'all'
  };

  // 2. Tham chiếu các phần tử DOM
  const searchInput = document.getElementById('searchInput');
  const filterTypeSelect = document.getElementById('filterTypeSelect');
  const filterDurationSelect = document.getElementById('filterDurationSelect');
  const btnResetFilter = document.getElementById('btnResetFilter');
  const vehiclesTableBody = document.getElementById('vehiclesTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationControls = document.getElementById('paginationControls');

  // Badge thống kê Header
  const totalVehiclesCountEl = document.getElementById('totalVehiclesCount');
  const overdueVehiclesCountEl = document.getElementById('overdueVehiclesCount');

  // Widget sức chứa Sidebar
  const capacityPercentEl = document.getElementById('capacityPercent');
  const capacityProgressBar = document.getElementById('capacityProgressBar');
  const capacityCurrentEl = document.getElementById('capacityCurrent');
  const capacityEmptyEl = document.getElementById('capacityEmpty');

  // Dropdown Nhân viên
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Modal xem ảnh
  const photoModalBackdrop = document.getElementById('photoModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPlate = document.getElementById('modalPlateNumber');
  const modalType = document.getElementById('modalVehicleType');
  const modalTimeIn = document.getElementById('modalTimeIn');
  const modalGate = document.getElementById('modalGateIn');

  // ==========================================================================
  // HÀM TIỆN ÍCH & RENDER DỮ LIỆU
  // ==========================================================================

  // Cập nhật các chỉ số sức chứa và thống kê
  function updateStats() {
    const total = state.totalCapacity;
    const current = state.currentCount;
    const empty = Math.max(0, total - current);
    const percent = ((current / total) * 100).toFixed(1);

    if (totalVehiclesCountEl) totalVehiclesCountEl.textContent = `${current} xe đang trong bãi`;
    if (overdueVehiclesCountEl) overdueVehiclesCountEl.textContent = `${state.overdueCount} xe đã gửi quá 24h`;

    if (capacityPercentEl) capacityPercentEl.textContent = `${percent}%`;
    if (capacityProgressBar) capacityProgressBar.style.width = `${percent}%`;
    if (capacityCurrentEl) capacityCurrentEl.textContent = `${current} / ${total}`;
    if (capacityEmptyEl) capacityEmptyEl.textContent = `${empty} chỗ trống`;
  }

  // Tạo thumbnail định danh cho biển số xe
  function createPlateThumbnail(type) {
    const isAuto = type === 'Ô tô';
    return `
      <div class="plate-thumb" style="display:flex;align-items:center;justify-content:center;background:${isAuto ? '#1e3a8a' : '#0f766e'};color:#fff;font-family:Consolas,monospace;font-size:8px;font-weight:700;">
        ${isAuto ? 'AUTO' : 'MOTO'}
      </div>
    `;
  }

  // Lọc dữ liệu theo điều kiện tìm kiếm và dropdown
  function getFilteredVehicles() {
    return state.vehicles.filter(v => {
      // Tìm theo biển số
      const matchesSearch = v.plate.toLowerCase().includes(state.searchKeyword.toLowerCase().trim());

      // Lọc theo loại xe
      const matchesType = (state.filterType === 'all') || (v.type === state.filterType);

      // Lọc theo thời gian gửi
      let matchesDuration = true;
      if (state.filterDuration === 'under_4h') {
        matchesDuration = v.duration.includes('giờ') && !v.duration.includes('ngày') && parseInt(v.duration, 10) < 4;
      } else if (state.filterDuration === '4h_to_24h') {
        matchesDuration = v.duration.includes('giờ') && !v.duration.includes('ngày') && parseInt(v.duration, 10) >= 4;
      } else if (state.filterDuration === 'over_24h') {
        matchesDuration = v.isOverdue;
      }

      return matchesSearch && matchesType && matchesDuration;
    });
  }

  // Render thanh cụm nút bấm phân trang động (< 1 2 3 ... 21 >)
  function renderPaginationControls(totalPages) {
    if (!paginationControls) return;

    if (totalPages <= 1) {
      paginationControls.innerHTML = '';
      return;
    }

    let html = '';

    // Nút Trang trước (<)
    const prevDisabled = state.currentPage === 1 ? 'disabled' : '';
    html += `
      <button class="page-btn ${prevDisabled}" type="button" data-page="${state.currentPage - 1}" aria-label="Trang trước">
        <i class="fa-solid fa-chevron-left" style="font-size: 10px;"></i>
      </button>
    `;

    // Tính toán số trang hiển thị thông minh: 1, 2, 3 ... 21 hoặc lân cận trang hiện tại
    const current = state.currentPage;
    const pages = [];

    if (totalPages <= 7) {
      for (let p = 1; p <= totalPages; p++) pages.push(p);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (current >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', totalPages);
      }
    }

    // Render từng nút trang
    pages.forEach(p => {
      if (p === '...') {
        html += `<span class="page-dots">...</span>`;
      } else {
        const activeClass = (p === current) ? 'active' : '';
        html += `<button class="page-btn ${activeClass}" type="button" data-page="${p}">${p}</button>`;
      }
    });

    // Nút Trang sau (>)
    const nextDisabled = state.currentPage === totalPages ? 'disabled' : '';
    html += `
      <button class="page-btn ${nextDisabled}" type="button" data-page="${state.currentPage + 1}" aria-label="Trang sau">
        <i class="fa-solid fa-chevron-right" style="font-size: 10px;"></i>
      </button>
    `;

    paginationControls.innerHTML = html;

    // Gán sự kiện click để chuyển đổi trang
    paginationControls.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled') || btn.classList.contains('active')) return;
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage >= 1 && targetPage <= totalPages) {
          state.currentPage = targetPage;
          renderVehicles();
          // Cuộn nhẹ lên đầu bảng để quan sát thuận tiện
          const tableElement = document.querySelector('.table-wrapper');
          if (tableElement) {
            tableElement.scrollTop = 0;
          }
        }
      });
    });
  }

  // Hiển thị danh sách xe theo đúng trang hiện tại
  function renderVehicles() {
    if (!vehiclesTableBody) return;

    // 1. Lọc danh sách xe
    const filtered = getFilteredVehicles();
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / state.pageSize) || 1;

    // Đảm bảo trang nằm trong khoảng hợp lệ
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    // Cắt dữ liệu 20 bản ghi cho trang hiện tại
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, totalFiltered);
    const pageItems = filtered.slice(startIndex, endIndex);

    // 2. Render các dòng dữ liệu vào bảng
    if (pageItems.length === 0) {
      vehiclesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 32px; color: #94a3b8;">
            <i class="fa-solid fa-magnifying-glass" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy phương tiện nào phù hợp với bộ lọc
          </td>
        </tr>
      `;
    } else {
      vehiclesTableBody.innerHTML = pageItems.map(v => `
        <tr>
          <td>
            <div class="plate-cell">
              ${createPlateThumbnail(v.type)}
              <span class="plate-text">${v.plate}</span>
            </div>
          </td>
          <td>
            <span class="vehicle-type-cell">
              <i class="fa-solid ${v.type === 'Ô tô' ? 'fa-car' : 'fa-motorcycle'}"></i>
              <span>${v.type}</span>
            </span>
          </td>
          <td class="td-time">${v.timeIn}</td>
          <td class="td-duration ${v.isOverdue ? 'duration-overdue' : ''}">${v.duration}</td>
          <td class="td-gate">${v.gate}</td>
          <td>
            <span class="badge ${v.isOverdue ? 'badge-status-overdue' : 'badge-status-parking'}">
              ${v.status}
            </span>
          </td>
          <td>
            <button type="button" class="btn-view-photo" data-plate="${v.plate}">
              <i class="fa-regular fa-eye"></i>
              <span>Xem ảnh vào</span>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 3. Cập nhật thông tin phân trang
    if (paginationInfo) {
      if (totalFiltered === 0) {
        paginationInfo.textContent = 'Không có kết quả nào';
      } else {
        paginationInfo.textContent = `Hiển thị ${startIndex + 1}–${endIndex} trên tổng ${totalFiltered.toLocaleString('vi-VN')} xe`;
      }
    }

    // 4. Render cụm nút phân trang tương tác
    renderPaginationControls(totalPages);

    // 5. Gán sự kiện xem ảnh chi tiết
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

  // Mở modal xem ảnh phương tiện lúc vào
  function openPhotoModal(vehicle) {
    if (!photoModalBackdrop) return;
    if (modalPlate) modalPlate.textContent = vehicle.plate;
    if (modalType) modalType.textContent = vehicle.type;
    if (modalTimeIn) modalTimeIn.textContent = vehicle.timeIn;
    if (modalGate) modalGate.textContent = vehicle.gate;

    photoModalBackdrop.classList.add('show');
  }

  // Đóng modal
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

  // B. Tìm kiếm biển số xe theo thời gian thực (Live Search)
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      state.currentPage = 1; // Reset về trang 1 khi lọc
      renderVehicles();
    });
  }

  // C. Lọc theo Loại xe
  if (filterTypeSelect) {
    filterTypeSelect.addEventListener('change', (e) => {
      state.filterType = e.target.value;
      state.currentPage = 1; // Reset về trang 1 khi lọc
      renderVehicles();
    });
  }

  // D. Lọc theo Thời gian gửi
  if (filterDurationSelect) {
    filterDurationSelect.addEventListener('change', (e) => {
      state.filterDuration = e.target.value;
      state.currentPage = 1; // Reset về trang 1 khi lọc
      renderVehicles();
    });
  }

  // E. Nút Đặt lại bộ lọc (Reset)
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.searchKeyword = '';
      state.filterType = 'all';
      state.filterDuration = 'all';
      state.currentPage = 1;

      if (searchInput) searchInput.value = '';
      if (filterTypeSelect) filterTypeSelect.value = 'all';
      if (filterDurationSelect) filterDurationSelect.value = 'all';

      renderVehicles();
    });
  }

  // F. Đóng modal khi bấm nút X hoặc bấm ngoài màn hình mờ
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

  // Khởi tạo ban đầu
  updateStats();
  renderVehicles();
});
