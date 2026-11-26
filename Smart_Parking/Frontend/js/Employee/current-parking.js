// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Quản lý xe đang gửi trong bãi (current-parking.js)
// Kết nối trực tiếp Cơ sở dữ liệu SQLite qua Backend FastAPI (/api/current-parking/...)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái và Dữ liệu
  const state = {
    totalCapacity: 500,
    currentCount: 0,
    overdueCount: 0,
    vehicles: [],
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalItems: 0,
    searchKeyword: '',
    filterType: 'all',
    filterDuration: 'all',
    isLoading: false
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
  const capacityCountEl = document.getElementById('capacityCount');
  const capacityAvailableEl = document.getElementById('capacityAvailable');

  // Dropdown Nhân viên
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Modal xem ảnh lúc vào
  const photoModalBackdrop = document.getElementById('photoModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalImagePreview = document.getElementById('modalImagePreview');
  const modalPlate = document.getElementById('modalPlateNumber');
  const modalType = document.getElementById('modalVehicleType');
  const modalTimeIn = document.getElementById('modalTimeIn');
  const modalGate = document.getElementById('modalGateIn');

  // ==========================================================================
  // HÀM TIỆN ÍCH & KẾT NỐI API BACKEND
  // ==========================================================================

  function getApiBase() {
    return window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
  }

  // Tải thống kê sức chứa và số lượng xe quá 24h
  async function loadParkingStats() {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/current-parking/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      state.totalCapacity = data.total_capacity || 500;
      state.currentCount = data.total_parked || 0;
      state.overdueCount = data.overdue_count || 0;

      // Cập nhật Header badges
      if (totalVehiclesCountEl) {
        totalVehiclesCountEl.textContent = `${state.currentCount} xe đang trong bãi`;
      }
      if (overdueVehiclesCountEl) {
        overdueVehiclesCountEl.textContent = `${state.overdueCount} xe đã gửi quá 24h`;
      }

      // Cập nhật Widget Sidebar
      const percent = data.capacity_percent || ((state.currentCount / state.totalCapacity) * 100).toFixed(1);
      const available = data.available_spots || Math.max(0, state.totalCapacity - state.currentCount);

      if (capacityPercentEl) capacityPercentEl.textContent = `${percent}%`;
      if (capacityProgressBar) capacityProgressBar.style.width = `${percent}%`;
      if (capacityCountEl) capacityCountEl.textContent = `${state.currentCount} / ${state.totalCapacity}`;
      if (capacityAvailableEl) capacityAvailableEl.textContent = `${available} chỗ trống`;

    } catch (err) {
      console.warn('Lỗi khi tải số liệu thống kê bãi xe:', err);
    }
  }

  // Tải danh sách xe đang gửi từ CSDL thật (hỗ trợ tìm kiếm, lọc và phân trang)
  async function loadVehicles() {
    state.isLoading = true;
    if (vehiclesTableBody) {
      vehiclesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 36px; color: #64748b;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 22px; margin-bottom: 8px; display: block; color: #2563eb;"></i>
            Đang tải dữ liệu xe trong bãi từ CSDL...
          </td>
        </tr>
      `;
    }

    try {
      const apiBase = getApiBase();
      const params = new URLSearchParams({
        page: state.currentPage,
        page_size: state.pageSize,
        vehicle_type: state.filterType,
        duration_filter: state.filterDuration
      });

      if (state.searchKeyword.trim()) {
        params.append('keyword', state.searchKeyword.trim());
      }

      const res = await fetch(`${apiBase}/api/current-parking/vehicles?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      state.vehicles = data.items || [];
      state.totalItems = data.total_items || 0;
      state.totalPages = data.total_pages || 1;
      state.currentPage = data.page || 1;

      renderVehiclesTable();

    } catch (err) {
      console.error('Lỗi khi tải danh sách xe đang gửi:', err);
      if (vehiclesTableBody) {
        vehiclesTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding: 32px; color: #ef4444;">
              <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
              Không thể kết nối đến máy chủ CSDL. Vui lòng kiểm tra lại backend!
            </td>
          </tr>
        `;
      }
    } finally {
      state.isLoading = false;
    }
  }

  // Tạo thumbnail định danh cho biển số xe / vé xe đạp
  function createPlateThumbnail(type) {
    const isBike = (type === 'Xe đạp / Đạp điện');
    const isAuto = (type === 'Ô tô');
    const bg = isBike ? '#6d28d9' : (isAuto ? '#1e3a8a' : '#0f766e');
    const label = isBike ? 'BIKE' : (isAuto ? 'AUTO' : 'MOTO');
    return `
      <div class="plate-thumb" style="display:flex;align-items:center;justify-content:center;background:${bg};color:#fff;font-family:Consolas,monospace;font-size:8px;font-weight:700;">
        ${label}
      </div>
    `;
  }

  // Render bảng danh sách xe
  function renderVehiclesTable() {
    if (!vehiclesTableBody) return;

    if (state.vehicles.length === 0) {
      const isFiltered = (state.searchKeyword || state.filterType !== 'all' || state.filterDuration !== 'all');
      vehiclesTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 36px; color: #94a3b8;">
            <i class="fa-solid fa-${isFiltered ? 'magnifying-glass' : 'inbox'}" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            ${isFiltered ? 'Không có phương tiện nào phù hợp với điều kiện tìm kiếm' : 'Hiện chưa có phương tiện nào đang gửi trong bãi'}
          </td>
        </tr>
      `;
      if (paginationInfo) paginationInfo.textContent = 'Không có kết quả nào';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.vehicles.length;

    vehiclesTableBody.innerHTML = state.vehicles.map(v => `
      <tr>
        <td>
          <div class="plate-cell">
            ${createPlateThumbnail(v.type)}
            <span class="plate-text font-mono">${v.plate}</span>
          </div>
        </td>
        <td>
          <span class="vehicle-type-cell">
            <i class="fa-solid ${v.type === 'Xe đạp / Đạp điện' ? 'fa-bicycle' : (v.type === 'Ô tô' ? 'fa-car' : 'fa-motorcycle')}"></i>
            <span>${v.type}</span>
          </span>
        </td>
        <td class="td-time font-mono"><i class="fa-regular fa-clock" style="color:#94a3b8; margin-right:4px;"></i>${v.timeIn}</td>
        <td class="td-duration ${v.isOverdue ? 'duration-overdue' : ''}">
          ${v.isOverdue ? '<i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>' : ''}${v.duration}
        </td>
        <td class="td-gate">${v.gate}</td>
        <td>
          <span class="badge ${v.isOverdue ? 'badge-status-overdue' : 'badge-status-parking'}">
            ${v.status}
          </span>
        </td>
        <td>
          <div class="table-actions-cell" style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" class="btn-action-icon btn-view-photo" data-id="${v.id}" title="Xem ảnh chụp lúc vào bãi" style="background:#f0fdfa !important; color:#0f766e !important; border:1px solid #99f6e4 !important; border-radius:6px; padding:4px 9px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-regular fa-eye"></i> <span>Xem ảnh</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Cập nhật thông tin phân trang
    if (paginationInfo) {
      paginationInfo.textContent = `Hiển thị ${startIndex + 1}–${endIndex} trên tổng ${state.totalItems.toLocaleString('vi-VN')} xe`;
    }

    // Render cụm nút phân trang
    renderPaginationControls();

    // Gán sự kiện xem ảnh chi tiết Modal
    document.querySelectorAll('.btn-view-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const vehicle = state.vehicles.find(v => v.id === id);
        if (vehicle) {
          openPhotoModal(vehicle);
        }
      });
    });
  }

  // Render cụm nút phân trang thông minh
  function renderPaginationControls() {
    if (!paginationControls) return;

    const totalPages = state.totalPages;
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

    // Tính toán số trang hiển thị
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

    // Gán sự kiện click chuyển trang
    paginationControls.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled') || btn.classList.contains('active')) return;
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage >= 1 && targetPage <= totalPages) {
          state.currentPage = targetPage;
          loadVehicles();
          const tableElement = document.querySelector('.table-responsive');
          if (tableElement) {
            tableElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
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

    // Hiển thị ảnh chụp thực tế nếu có
    if (modalImagePreview) {
      const apiBase = getApiBase();
      const imgSrc = vehicle.checkin_image_url || vehicle.checkin_crop_url;

      if (imgSrc) {
        const fullUrl = imgSrc.startsWith('http') ? imgSrc : `${apiBase}${imgSrc}`;
        modalImagePreview.innerHTML = `
          <img src="${fullUrl}" alt="Ảnh xe ${vehicle.plate}" style="max-width:100%; max-height:260px; object-fit:contain; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
        `;
      } else {
        modalImagePreview.innerHTML = `
          <div style="text-align: center; color: #94a3b8; padding: 24px;">
            <i class="fa-solid fa-camera fa-2x" style="margin-bottom: 8px; display: block; color: #cbd5e1;"></i>
            <div style="font-size: 12px; font-weight: 600; color: #475569;">Biển số: ${vehicle.plate}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Ảnh chụp được lưu trữ an toàn trong hệ thống</div>
          </div>
        `;
      }
    }

    photoModalBackdrop.classList.add('show');
  }

  function closePhotoModal() {
    if (photoModalBackdrop) {
      photoModalBackdrop.classList.remove('show');
    }
  }

  // Xóa phiên gửi xe nếu người dùng / nhân viên nhập sai hoặc xe ảo
  async function handleDeleteVehicle(id, plate) {
    if (!confirm(`Bạn có chắc chắn muốn xóa lượt xe biển số ${plate} khỏi hệ thống không?\nThao tác này sẽ xóa phiên và cập nhật lại sức chứa bãi xe.`)) {
      return;
    }

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/current-parking/sessions/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi khi xóa lượt xe');

      await loadParkingStats();
      await loadVehicles();
    } catch (err) {
      alert(`Không thể xóa lượt xe: ${err.message}`);
    }
  }

  // ==========================================================================
  // XỬ LÝ SỰ KIỆN TƯƠNG TÁC (SEARCH & FILTERS)
  // ==========================================================================

  // User Dropdown
  if (userProfileBtn && userDropdownMenu) {
    userProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdownMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userDropdownMenu.contains(e.target) && !userProfileBtn.contains(e.target)) {
        userDropdownMenu.classList.remove('show');
      }
    });
  }

  // Tìm kiếm theo biển số xe với Debounce 300ms
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        state.searchKeyword = e.target.value;
        state.currentPage = 1;
        loadVehicles();
      }, 300);
    });
  }

  // ==========================================================================
  // XỬ LÝ DROPDOWN CUSTOM HIỆN ĐẠI CHO LOẠI XE VÀ THỜI GIAN GỬI
  // ==========================================================================

  // 1. Dropdown Loại xe
  const vehicleTypeSelectWrapper = document.getElementById('vehicleTypeSelectWrapper');
  const vehicleTypeTrigger = document.getElementById('vehicleTypeTrigger');
  const vehicleTypeIcon = document.getElementById('vehicleTypeIcon');
  const vehicleTypeLabel = document.getElementById('vehicleTypeLabel');
  const vehicleTypeDropdown = document.getElementById('vehicleTypeDropdown');

  // 2. Dropdown Thời gian gửi
  const durationSelectWrapper = document.getElementById('durationSelectWrapper');
  const durationTrigger = document.getElementById('durationTrigger');
  const durationIcon = document.getElementById('durationIcon');
  const durationLabel = document.getElementById('durationLabel');
  const durationDropdown = document.getElementById('durationDropdown');

  function closeAllDropdowns() {
    if (vehicleTypeDropdown) vehicleTypeDropdown.classList.remove('show');
    if (vehicleTypeTrigger) vehicleTypeTrigger.classList.remove('active');
    if (durationDropdown) durationDropdown.classList.remove('show');
    if (durationTrigger) durationTrigger.classList.remove('active');
  }

  // Bật/Tắt Dropdown Loại xe
  if (vehicleTypeTrigger && vehicleTypeDropdown) {
    vehicleTypeTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShow = vehicleTypeDropdown.classList.contains('show');
      closeAllDropdowns();
      if (!isShow) {
        vehicleTypeDropdown.classList.add('show');
        vehicleTypeTrigger.classList.add('active');
      }
    });

    document.querySelectorAll('#vehicleTypeDropdown .select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.getAttribute('data-value');
        const lbl = opt.getAttribute('data-label');
        const icon = opt.getAttribute('data-icon');
        const color = opt.getAttribute('data-color');

        state.filterType = val;
        state.currentPage = 1;

        if (filterTypeSelect) filterTypeSelect.value = val;
        if (vehicleTypeLabel) vehicleTypeLabel.textContent = lbl;
        if (vehicleTypeIcon) {
          vehicleTypeIcon.className = `${icon} select-icon`;
          vehicleTypeIcon.style.color = color;
        }

        document.querySelectorAll('#vehicleTypeDropdown .select-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');

        closeAllDropdowns();
        loadVehicles();
      });
    });
  }

  // Bật/Tắt Dropdown Thời gian gửi
  if (durationTrigger && durationDropdown) {
    durationTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isShow = durationDropdown.classList.contains('show');
      closeAllDropdowns();
      if (!isShow) {
        durationDropdown.classList.add('show');
        durationTrigger.classList.add('active');
      }
    });

    document.querySelectorAll('#durationDropdown .select-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = opt.getAttribute('data-value');
        const lbl = opt.getAttribute('data-label');
        const icon = opt.getAttribute('data-icon');
        const color = opt.getAttribute('data-color');

        state.filterDuration = val;
        state.currentPage = 1;

        if (filterDurationSelect) filterDurationSelect.value = val;
        if (durationLabel) durationLabel.textContent = lbl;
        if (durationIcon) {
          durationIcon.className = `${icon} select-icon`;
          durationIcon.style.color = color;
        }

        document.querySelectorAll('#durationDropdown .select-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');

        closeAllDropdowns();
        loadVehicles();
      });
    });
  }

  // Đóng khi click ngoài
  document.addEventListener('click', (e) => {
    if (
      (!vehicleTypeSelectWrapper || !vehicleTypeSelectWrapper.contains(e.target)) &&
      (!durationSelectWrapper || !durationSelectWrapper.contains(e.target))
    ) {
      closeAllDropdowns();
    }
  });

  // Nút đặt lại bộ lọc
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.searchKeyword = '';
      state.filterType = 'all';
      state.filterDuration = 'all';
      state.currentPage = 1;

      if (searchInput) searchInput.value = '';
      if (filterTypeSelect) filterTypeSelect.value = 'all';
      if (filterDurationSelect) filterDurationSelect.value = 'all';

      // Reset giao diện Dropdown Loại xe
      if (vehicleTypeLabel) vehicleTypeLabel.textContent = 'Loại xe: Tất cả';
      if (vehicleTypeIcon) {
        vehicleTypeIcon.className = 'fa-solid fa-layer-group select-icon';
        vehicleTypeIcon.style.color = '#64748b';
      }
      document.querySelectorAll('#vehicleTypeDropdown .select-option').forEach(o => {
        if (o.getAttribute('data-value') === 'all') o.classList.add('active');
        else o.classList.remove('active');
      });

      // Reset giao diện Dropdown Thời gian gửi
      if (durationLabel) durationLabel.textContent = 'Thời gian gửi: Tất cả';
      if (durationIcon) {
        durationIcon.className = 'fa-regular fa-clock select-icon';
        durationIcon.style.color = '#64748b';
      }
      document.querySelectorAll('#durationDropdown .select-option').forEach(o => {
        if (o.getAttribute('data-value') === 'all') o.classList.add('active');
        else o.classList.remove('active');
      });

      closeAllDropdowns();
      loadVehicles();
    });
  }

  // Đóng modal
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

  // ==========================================================================
  // KHỞI CHẠY TẢI DỮ LIỆU BAN ĐẦU TỪ CSDL
  // ==========================================================================
  loadParkingStats();
  loadVehicles();
});
