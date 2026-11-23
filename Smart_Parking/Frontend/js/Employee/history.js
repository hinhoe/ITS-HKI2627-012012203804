// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Lịch sử gửi xe & Tra cứu (history.js)
// Kết nối trực tiếp Cơ sở dữ liệu SQLite qua Backend FastAPI (/api/history/...)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái và Dữ liệu
  const state = {
    historyData: [],
    totalItems: 0,
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    searchKeyword: '',
    filterDate: 'all',
    filterType: 'all',
    isLoading: false
  };

  // 2. Tham chiếu các phần tử DOM
  const searchInput = document.getElementById('searchInput');
  const filterDateSelect = document.getElementById('filterDateSelect');
  const filterTypeSelect = document.getElementById('filterTypeSelect');
  const btnResetFilter = document.getElementById('btnResetFilter');
  const btnExport = document.getElementById('btnExport');
  const historyTableBody = document.getElementById('historyTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationControls = document.getElementById('paginationControls');

  // Tham chiếu các phần tử của Lịch Datepicker
  const datePickerWrapper = document.getElementById('datePickerWrapper');
  const datePickerTriggerBtn = document.getElementById('datePickerTriggerBtn');
  const datePickerLabel = document.getElementById('datePickerLabel');
  const datePickerPopover = document.getElementById('datePickerPopover');
  const calHeaderTitle = document.getElementById('calHeaderTitle');
  const calTitleText = document.getElementById('calTitleText');
  const calPrevMonthBtn = document.getElementById('calPrevMonthBtn');
  const calNextMonthBtn = document.getElementById('calNextMonthBtn');
  const calDaysView = document.getElementById('calDaysView');
  const calDaysGrid = document.getElementById('calDaysGrid');
  const calQuickSelector = document.getElementById('calQuickSelector');
  const quickYearPrev = document.getElementById('quickYearPrev');
  const quickYearLabel = document.getElementById('quickYearLabel');
  const quickYearNext = document.getElementById('quickYearNext');
  const quickMonthsGrid = document.getElementById('quickMonthsGrid');
  const calBtnClearFilter = document.getElementById('calBtnClearFilter');
  const calBtnGoToday = document.getElementById('calBtnGoToday');
  const btnPresetCurrentMonth = document.getElementById('btnPresetCurrentMonth');
  const labelPresetCurrentMonth = document.getElementById('labelPresetCurrentMonth');
  const btnPresetCurrentYear = document.getElementById('btnPresetCurrentYear');
  const labelPresetCurrentYear = document.getElementById('labelPresetCurrentYear');

  // Widget sức chứa Sidebar
  const capacityPercent = document.getElementById('capacityPercent');
  const capacityProgressBar = document.getElementById('capacityProgressBar');
  const capacityCount = document.getElementById('capacityCount');
  const capacityAvailable = document.getElementById('capacityAvailable');

  // User Dropdown
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Modal so sánh ảnh vào/ra
  const photoModalBackdrop = document.getElementById('photoModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPlate = document.getElementById('modalPlate');
  const modalType = document.getElementById('modalType');
  const modalDuration = document.getElementById('modalDuration');
  const modalFee = document.getElementById('modalFee');
  const modalCheckinPhotoBox = document.getElementById('modalCheckinPhotoBox');
  const modalCheckoutPhotoBox = document.getElementById('modalCheckoutPhotoBox');

  // ==========================================================================
  // HÀM TIỆN ÍCH & KẾT NỐI API BACKEND
  // ==========================================================================

  function getApiBase() {
    return window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
  }

  // Tải thông tin sức chứa bãi xe ở Sidebar
  async function loadCapacityStats() {
    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/checkin/stats`);
      if (res.ok) {
        const data = await res.json();
        const total = data.total_capacity || 500;
        const current = data.current_count || 0;
        const avail = data.available_spots || Math.max(0, total - current);
        const pct = ((current / total) * 100).toFixed(1);

        if (capacityPercent) capacityPercent.textContent = `${pct}%`;
        if (capacityProgressBar) capacityProgressBar.style.width = `${pct}%`;
        if (capacityCount) capacityCount.textContent = `${current} / ${total}`;
        if (capacityAvailable) capacityAvailable.textContent = `${avail} chỗ trống`;
      }
    } catch (err) {
      console.warn('Lỗi khi tải sức chứa ở thanh bên:', err);
    }
  }

  // Tải danh sách lịch sử gửi xe từ CSDL Backend
  async function loadHistory() {
    state.isLoading = true;

    if (historyTableBody) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 36px; color: #64748b;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 22px; margin-bottom: 8px; display: block; color: #2563eb;"></i>
            Đang tải dữ liệu lịch sử từ CSDL...
          </td>
        </tr>
      `;
    }

    try {
      const apiBase = getApiBase();
      const params = new URLSearchParams({
        page: state.currentPage,
        page_size: state.pageSize,
        date_filter: state.filterDate,
        vehicle_type: state.filterType
      });

      if (state.searchKeyword.trim()) {
        params.append('keyword', state.searchKeyword.trim());
      }

      const res = await fetch(`${apiBase}/api/history?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      state.historyData = data.items || [];
      state.totalItems = data.total_items || 0;
      state.totalPages = data.total_pages || 1;
      state.currentPage = data.page || 1;

      renderHistory();

    } catch (err) {
      console.error('Lỗi khi tải lịch sử gửi xe:', err);
      if (historyTableBody) {
        historyTableBody.innerHTML = `
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

  // Tạo thumbnail định danh cho biển số xe
  function createPlateThumbnail(type) {
    const isAuto = type === 'Ô tô';
    return `
      <div class="plate-thumb" style="display:flex;align-items:center;justify-content:center;background:${isAuto ? '#1e3a8a' : '#0f766e'};color:#fff;font-family:Consolas,monospace;font-size:8px;font-weight:700;">
        ${isAuto ? 'AUTO' : 'MOTO'}
      </div>
    `;
  }

  // Render thanh phân trang động (< 1 2 3 ... 5 >)
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

    // Gán sự kiện click để chuyển đổi trang
    paginationControls.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled') || btn.classList.contains('active')) return;
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage >= 1 && targetPage <= totalPages) {
          state.currentPage = targetPage;
          loadHistory();
        }
      });
    });
  }

  // Hiển thị danh sách lịch sử theo đúng dữ liệu CSDL nạp về
  function renderHistory() {
    if (!historyTableBody) return;

    if (state.historyData.length === 0) {
      const isFiltered = (state.searchKeyword || state.filterDate !== 'all' || state.filterType !== 'all');
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 36px; color: #94a3b8;">
            <i class="fa-solid fa-${isFiltered ? 'magnifying-glass' : 'inbox'}" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            ${isFiltered ? 'Không tìm thấy lượt gửi xe nào phù hợp với bộ lọc' : 'Hiện chưa có lượt gửi xe nào đã hoàn tất trong hệ thống'}
          </td>
        </tr>
      `;

      if (paginationInfo) paginationInfo.textContent = 'Không có kết quả nào';
      if (paginationControls) paginationControls.innerHTML = '';
      return;
    }

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.historyData.length;

    historyTableBody.innerHTML = state.historyData.map(item => `
      <tr>
        <td>
          <div class="plate-cell">
            ${createPlateThumbnail(item.type)}
            <span class="plate-text font-mono">${item.plate}</span>
          </div>
        </td>
        <td>
          <span class="vehicle-type-cell">
            <i class="fa-solid ${item.type === 'Ô tô' ? 'fa-car' : 'fa-motorcycle'}"></i>
            <span>${item.type}</span>
          </span>
        </td>
        <td class="td-time font-mono">${item.timeIn}</td>
        <td class="td-time font-mono">${item.timeOut}</td>
        <td class="td-duration">${item.duration}</td>
        <td class="td-fee">${item.fee}</td>
        <td>
          <div class="table-actions-cell" style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" class="btn-action-icon btn-view-photo" data-id="${item.id}" title="Xem ảnh đối soát vào/ra" style="background:#f0fdfa !important; color:#0f766e !important; border:1px solid #99f6e4 !important; border-radius:6px; padding:4px 9px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;">
              <i class="fa-regular fa-eye"></i> <span>Xem</span>
            </button>
            <button type="button" class="btn-action-icon btn-action-edit btn-edit-history" data-id="${item.id}" title="Sửa biển số xe hoặc loại xe nếu sai" style="background:#eff6ff !important; color:#2563eb !important; border:1px solid #bfdbfe !important; border-radius:6px; padding:4px 10px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i class="fa-solid fa-pen-to-square" style="color:#2563eb;"></i> <span>Sửa</span>
            </button>
            <button type="button" class="btn-action-icon btn-action-delete btn-delete-history" data-id="${item.id}" data-plate="${item.plate}" title="Xóa bản ghi này" style="background:#fef2f2 !important; color:#ef4444 !important; border:1px solid #fecaca !important; border-radius:6px; padding:4px 10px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
              <i class="fa-solid fa-trash-can" style="color:#ef4444;"></i> <span>Xóa</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Cập nhật dòng chữ hiển thị phân trang
    if (paginationInfo) {
      paginationInfo.textContent = `Hiển thị ${startIndex + 1}–${endIndex} trên tổng ${state.totalItems.toLocaleString('vi-VN')} lượt gửi xe đã hoàn tất`;
    }

    // Cập nhật cụm nút phân trang
    renderPaginationControls(state.totalPages);

    // Gán sự kiện mở modal xem ảnh chi tiết
    document.querySelectorAll('.btn-view-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const record = state.historyData.find(v => v.id === id);
        if (record) {
          openPhotoModal(record);
        }
      });
    });

    // Gán sự kiện Sửa bản ghi
    document.querySelectorAll('.btn-edit-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const record = state.historyData.find(v => v.id === id);
        if (record) {
          openEditModal(record);
        }
      });
    });

    // Gán sự kiện Xóa bản ghi
    document.querySelectorAll('.btn-delete-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const plate = btn.getAttribute('data-plate');
        handleDeleteHistory(id, plate);
      });
    });
  }

  // Mở modal xem ảnh đối soát xe vào / xe ra
  function openPhotoModal(record) {
    if (!photoModalBackdrop) return;

    if (modalPlate) modalPlate.textContent = record.plate;
    if (modalType) modalType.textContent = record.type;
    if (modalDuration) modalDuration.textContent = record.duration;
    if (modalFee) modalFee.textContent = record.fee;

    const apiBase = getApiBase();

    // 1. Ảnh lúc vào bãi
    if (modalCheckinPhotoBox) {
      if (record.checkin_photo) {
        const fullUrl = record.checkin_photo.startsWith('http') ? record.checkin_photo : `${apiBase}${record.checkin_photo}`;
        modalCheckinPhotoBox.innerHTML = `
          <img src="${fullUrl}" alt="Ảnh lúc vào" style="width:100%; height:100%; object-fit:contain; border-radius:6px; background:#0f172a;" onerror="this.parentElement.innerHTML='<div style=\\'text-align:center;color:#94a3b8;\\'>Ảnh vào không khả dụng</div>'">
        `;
      } else {
        modalCheckinPhotoBox.innerHTML = `
          <div style="text-align: center; color: #94a3b8;">
            <i class="fa-solid fa-camera fa-lg" style="margin-bottom: 4px; display: block;"></i>
            <span>CHƯA CÓ ẢNH VÀO</span>
          </div>
        `;
      }
    }

    // 2. Ảnh lúc ra bãi
    if (modalCheckoutPhotoBox) {
      if (record.checkout_photo) {
        const fullUrl = record.checkout_photo.startsWith('http') ? record.checkout_photo : `${apiBase}${record.checkout_photo}`;
        modalCheckoutPhotoBox.innerHTML = `
          <img src="${fullUrl}" alt="Ảnh lúc ra" style="width:100%; height:100%; object-fit:contain; border-radius:6px; background:#0f172a;" onerror="this.parentElement.innerHTML='<div style=\\'text-align:center;color:#94a3b8;\\'>Ảnh ra không khả dụng</div>'">
        `;
      } else {
        modalCheckoutPhotoBox.innerHTML = `
          <div style="text-align: center; color: #94a3b8;">
            <i class="fa-solid fa-camera fa-lg" style="margin-bottom: 4px; display: block;"></i>
            <span>CHƯA CÓ ẢNH RA</span>
          </div>
        `;
      }
    }

    photoModalBackdrop.classList.add('show');
  }

  // Đóng modal
  function closePhotoModal() {
    if (photoModalBackdrop) {
      photoModalBackdrop.classList.remove('show');
    }
  }

  // ==========================================================================
  // XỬ LÝ MODAL SỬA & XÓA THÔNG TIN LỊCH SỬ GỬI XE
  // ==========================================================================
  const editHistoryModalBackdrop = document.getElementById('editHistoryModalBackdrop');
  const modalCloseEditHistBtn = document.getElementById('modalCloseEditHistBtn');
  const btnCancelEditHist = document.getElementById('btnCancelEditHist');
  const btnSaveEditHist = document.getElementById('btnSaveEditHist');
  const editHistoryId = document.getElementById('editHistoryId');
  const editHistoryPlate = document.getElementById('editHistoryPlate');
  const editHistoryType = document.getElementById('editHistoryType');
  const btnClearEditHistPlate = document.getElementById('btnClearEditHistPlate');

  function openEditModal(record) {
    if (!editHistoryModalBackdrop) return;
    if (editHistoryId) editHistoryId.value = record.id;
    if (editHistoryPlate) {
      editHistoryPlate.value = record.plate;
      setTimeout(() => editHistoryPlate.focus(), 100);
    }
    if (editHistoryType) editHistoryType.value = record.type || 'Ô tô';
    editHistoryModalBackdrop.classList.add('show');
  }

  function closeEditModal() {
    if (editHistoryModalBackdrop) {
      editHistoryModalBackdrop.classList.remove('show');
    }
  }

  if (modalCloseEditHistBtn) modalCloseEditHistBtn.addEventListener('click', closeEditModal);
  if (btnCancelEditHist) btnCancelEditHist.addEventListener('click', closeEditModal);
  if (editHistoryModalBackdrop) {
    editHistoryModalBackdrop.addEventListener('click', (e) => {
      if (e.target === editHistoryModalBackdrop) closeEditModal();
    });
  }

  // Nút xóa trắng ký tự trong ô sửa biển số lịch sử
  if (btnClearEditHistPlate && editHistoryPlate) {
    btnClearEditHistPlate.addEventListener('click', () => {
      editHistoryPlate.value = '';
      editHistoryPlate.focus();
    });
  }

  // Lưu thông tin sau khi sửa
  if (btnSaveEditHist) {
    btnSaveEditHist.addEventListener('click', async () => {
      const id = editHistoryId ? editHistoryId.value : null;
      const newPlate = editHistoryPlate ? editHistoryPlate.value.trim().toUpperCase() : '';
      const newType = editHistoryType ? editHistoryType.value : 'Ô tô';

      if (!id || !newPlate) {
        alert('Vui lòng nhập biển số xe hợp lệ!');
        return;
      }

      try {
        btnSaveEditHist.disabled = true;
        btnSaveEditHist.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/history/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plate_number: newPlate, vehicle_type: newType })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Lỗi khi cập nhật bản ghi');

        closeEditModal();
        await loadHistory();
      } catch (err) {
        alert(`Không thể sửa bản ghi: ${err.message}`);
      } finally {
        btnSaveEditHist.disabled = false;
        btnSaveEditHist.innerHTML = '<i class="fa-solid fa-check"></i> <span>Lưu thay đổi</span>';
      }
    });
  }

  // Xóa bản ghi lịch sử
  async function handleDeleteHistory(id, plate) {
    if (!confirm(`Bạn có chắc chắn muốn xóa bản ghi lượt gửi xe biển số ${plate} khỏi hệ thống không?`)) {
      return;
    }

    try {
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/api/history/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi khi xóa bản ghi');

      await loadHistory();
    } catch (err) {
      alert(`Không thể xóa bản ghi: ${err.message}`);
    }
  }

  // ==========================================================================
  // XỬ LÝ LỊCH VÀ CHỌN THỜI GIAN THEO NGÀY / THÁNG / NĂM
  // ==========================================================================

  let calViewDate = new Date(); // Tháng và năm đang được hiển thị trên lịch
  let selectedSpecificDate = null; // Ngày cụ thể được chọn: 'YYYY-MM-DD' hoặc null

  // Cập nhật lại giao diện lịch tháng
  function renderCalendar() {
    if (!calDaysGrid || !calTitleText) return;

    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth(); // 0-indexed (0: Tháng 1, 10: Tháng 11)

    // Tiêu đề tháng năm chuẩn: "Tháng 11, 2026"
    calTitleText.textContent = `Tháng ${month + 1}, ${year}`;

    // Cập nhật nhãn nút "Cả tháng..." và "Cả năm..." ở thanh bên
    if (labelPresetCurrentMonth) {
      labelPresetCurrentMonth.textContent = `Cả tháng ${month + 1}, ${year}`;
    }
    if (labelPresetCurrentYear) {
      labelPresetCurrentYear.textContent = `Cả năm ${year}`;
    }

    calDaysGrid.innerHTML = '';

    // Xác định ngày đầu tiên của tháng rơi vào thứ mấy
    // Trong JS: 0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7
    // Header của ta là: t2(0), t3(1), t4(2), t5(3), t6(4), t7(5), cn(6)
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = (firstDay === 0) ? 6 : (firstDay - 1);

    // Số ngày trong tháng trước và tháng hiện tại
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    const currentMonthLastDate = new Date(year, month + 1, 0).getDate();

    // 1. Điền các ngày cuối của tháng trước (màu mờ)
    for (let i = startOffset - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDate - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.textContent = dayNum;
      calDaysGrid.appendChild(cell);
    }

    // 2. Điền các ngày trong tháng hiện tại
    const realToday = new Date();
    const isCurrentRealMonth = (realToday.getFullYear() === year && realToday.getMonth() === month);
    const realTodayDate = realToday.getDate();

    for (let d = 1; d <= currentMonthLastDate; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      cell.textContent = d;

      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const displayStr = `${String(d).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

      // Highlight ngày hôm nay
      if (isCurrentRealMonth && realTodayDate === d) {
        cell.classList.add('today');
      }

      // Highlight ngày đang được chọn (hình tròn xanh lam như thiết kế)
      if (selectedSpecificDate === dateStr) {
        cell.classList.add('selected');
      }

      // Sự kiện chọn ngày cụ thể
      cell.addEventListener('click', () => {
        applySpecificDateFilter(dateStr, displayStr);
      });

      calDaysGrid.appendChild(cell);
    }

    // 3. Điền các ngày đầu của tháng sau để hoàn thiện bảng (35 hoặc 42 ô)
    const totalFilled = startOffset + currentMonthLastDate;
    const targetTotal = totalFilled <= 35 ? 35 : 42;
    const nextMonthDays = targetTotal - totalFilled;

    for (let n = 1; n <= nextMonthDays; n++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.textContent = n;
      calDaysGrid.appendChild(cell);
    }
  }

  // Chọn ngày cụ thể
  function applySpecificDateFilter(dateStr, displayStr) {
    selectedSpecificDate = dateStr;
    state.filterDate = dateStr;
    state.currentPage = 1;

    if (datePickerLabel) {
      datePickerLabel.textContent = `Ngày: ${displayStr}`;
    }
    if (filterDateSelect) {
      filterDateSelect.value = dateStr;
    }

    // Đánh dấu bỏ active các preset
    document.querySelectorAll('.preset-option-btn').forEach(b => b.classList.remove('active'));

    // Đóng dropdown và render lại
    closeDatePicker();
    renderCalendar();
    loadHistory();
  }

  // Chọn mốc thời gian nhanh hoặc cả tháng / cả năm
  function applyPresetFilter(presetKey, labelText) {
    selectedSpecificDate = null;
    state.filterDate = presetKey;
    state.currentPage = 1;

    if (datePickerLabel) {
      datePickerLabel.textContent = labelText;
    }
    if (filterDateSelect) {
      filterDateSelect.value = presetKey;
    }

    // Cập nhật trạng thái active cho nút preset
    document.querySelectorAll('.preset-option-btn').forEach(btn => {
      const p = btn.getAttribute('data-preset');
      if (p === presetKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    closeDatePicker();
    renderCalendar();
    loadHistory();
  }

  // Mở / Đóng Datepicker
  function toggleDatePicker() {
    if (!datePickerPopover) return;
    const isShowing = datePickerPopover.classList.contains('show');
    if (isShowing) {
      closeDatePicker();
    } else {
      openDatePicker();
    }
  }

  function openDatePicker() {
    if (!datePickerPopover) return;
    // Đóng dropdown loại xe nếu đang mở
    const vtDrop = document.getElementById('vehicleTypeDropdown');
    const vtTrig = document.getElementById('vehicleTypeTrigger');
    if (vtDrop) vtDrop.classList.remove('show');
    if (vtTrig) vtTrig.classList.remove('active');

    datePickerPopover.classList.add('show');
    if (datePickerTriggerBtn) datePickerTriggerBtn.classList.add('active');
    // Reset view ngày
    if (calDaysView) calDaysView.style.display = 'block';
    if (calQuickSelector) calQuickSelector.style.display = 'none';
    renderCalendar();
  }

  function closeDatePicker() {
    if (!datePickerPopover) return;
    datePickerPopover.classList.remove('show');
    if (datePickerTriggerBtn) datePickerTriggerBtn.classList.remove('active');
  }

  // Khởi tạo các sự kiện cho Datepicker
  if (datePickerTriggerBtn) {
    datePickerTriggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDatePicker();
    });
  }

  // Điều hướng tháng trước / tháng sau
  if (calPrevMonthBtn) {
    calPrevMonthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      calViewDate.setMonth(calViewDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calNextMonthBtn) {
    calNextMonthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      calViewDate.setMonth(calViewDate.getMonth() + 1);
      renderCalendar();
    });
  }

  // Bấm vào tiêu đề "Tháng MM, YYYY" để mở bảng chọn nhanh tháng / năm
  let quickYear = calViewDate.getFullYear();
  if (calHeaderTitle) {
    calHeaderTitle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!calQuickSelector || !calDaysView) return;
      
      const isQuickOpen = calQuickSelector.style.display !== 'none';
      if (isQuickOpen) {
        calQuickSelector.style.display = 'none';
        calDaysView.style.display = 'block';
      } else {
        calQuickSelector.style.display = 'block';
        calDaysView.style.display = 'none';
        quickYear = calViewDate.getFullYear();
        renderQuickSelector();
      }
    });
  }

  function renderQuickSelector() {
    if (!quickYearLabel || !quickMonthsGrid) return;
    quickYearLabel.textContent = quickYear;
    quickMonthsGrid.innerHTML = '';

    const currentSelectedMonth = calViewDate.getMonth();
    const currentSelectedYear = calViewDate.getFullYear();

    for (let m = 0; m < 12; m++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-month-btn';
      if (m === currentSelectedMonth && quickYear === currentSelectedYear) {
        btn.classList.add('active');
      }
      btn.textContent = `Tháng ${m + 1}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        calViewDate.setFullYear(quickYear);
        calViewDate.setMonth(m);
        calQuickSelector.style.display = 'none';
        calDaysView.style.display = 'block';
        renderCalendar();
      });
      quickMonthsGrid.appendChild(btn);
    }
  }

  if (quickYearPrev) {
    quickYearPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      quickYear--;
      renderQuickSelector();
    });
  }

  if (quickYearNext) {
    quickYearNext.addEventListener('click', (e) => {
      e.stopPropagation();
      quickYear++;
      renderQuickSelector();
    });
  }

  // Các nút chọn nhanh (Preset Options)
  document.querySelectorAll('.preset-option-btn[data-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const preset = btn.getAttribute('data-preset');
      const text = btn.textContent.trim();
      applyPresetFilter(preset, `Thời gian: ${text}`);
    });
  });

  // Chọn cả tháng hiện tại đang xem
  if (btnPresetCurrentMonth) {
    btnPresetCurrentMonth.addEventListener('click', (e) => {
      e.stopPropagation();
      const year = calViewDate.getFullYear();
      const month = calViewDate.getMonth() + 1;
      const monthFilter = `${year}-${String(month).padStart(2, '0')}`;
      applyPresetFilter(monthFilter, `Tháng ${month}/${year}`);
    });
  }

  // Chọn cả năm hiện tại đang xem
  if (btnPresetCurrentYear) {
    btnPresetCurrentYear.addEventListener('click', (e) => {
      e.stopPropagation();
      const year = calViewDate.getFullYear();
      applyPresetFilter(String(year), `Năm ${year}`);
    });
  }

  // Nút Xóa lọc trong lịch
  if (calBtnClearFilter) {
    calBtnClearFilter.addEventListener('click', (e) => {
      e.stopPropagation();
      applyPresetFilter('all', 'Thời gian: Tất cả');
    });
  }

  // Nút nhảy về ngày Hôm nay
  if (calBtnGoToday) {
    calBtnGoToday.addEventListener('click', (e) => {
      e.stopPropagation();
      const now = new Date();
      calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const displayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      applySpecificDateFilter(todayStr, displayStr);
    });
  }

  // Đóng Datepicker khi click ngoài
  document.addEventListener('click', (e) => {
    if (datePickerWrapper && !datePickerWrapper.contains(e.target)) {
      closeDatePicker();
    }
  });

  // Khởi tạo hiển thị lịch
  renderCalendar();

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

  // B. Tìm kiếm biển số theo thời gian thực (Debounce 300ms)
  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.searchKeyword = e.target.value;
        state.currentPage = 1;
        loadHistory();
      }, 300);
    });
  }

  // C. Lọc theo Thời gian
  if (filterDateSelect) {
    filterDateSelect.addEventListener('change', (e) => {
      state.filterDate = e.target.value;
      state.currentPage = 1;
      loadHistory();
    });
  }

  // D. Lọc theo Loại xe Custom Đẹp Mắt Hiện Đại
  const vehicleTypeSelectWrapper = document.getElementById('vehicleTypeSelectWrapper');
  const vehicleTypeTrigger = document.getElementById('vehicleTypeTrigger');
  const vehicleTypeIcon = document.getElementById('vehicleTypeIcon');
  const vehicleTypeLabel = document.getElementById('vehicleTypeLabel');
  const vehicleTypeDropdown = document.getElementById('vehicleTypeDropdown');

  if (vehicleTypeTrigger && vehicleTypeDropdown) {
    vehicleTypeTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDatePicker(); // Đóng lịch nếu đang mở
      const isShow = vehicleTypeDropdown.classList.toggle('show');
      vehicleTypeTrigger.classList.toggle('active', isShow);
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

        vehicleTypeDropdown.classList.remove('show');
        vehicleTypeTrigger.classList.remove('active');

        loadHistory();
      });
    });

    document.addEventListener('click', (e) => {
      if (vehicleTypeSelectWrapper && !vehicleTypeSelectWrapper.contains(e.target)) {
        vehicleTypeDropdown.classList.remove('show');
        vehicleTypeTrigger.classList.remove('active');
      }
    });
  }

  // E. Nút Đặt lại bộ lọc (Reset)
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.searchKeyword = '';
      state.filterDate = 'all';
      state.filterType = 'all';
      state.currentPage = 1;
      selectedSpecificDate = null;

      if (searchInput) searchInput.value = '';
      if (filterDateSelect) filterDateSelect.value = 'all';
      if (filterTypeSelect) filterTypeSelect.value = 'all';
      if (datePickerLabel) datePickerLabel.textContent = 'Thời gian: Tất cả';
      if (vehicleTypeLabel) vehicleTypeLabel.textContent = 'Loại xe: Tất cả';
      if (vehicleTypeIcon) {
        vehicleTypeIcon.className = 'fa-solid fa-layer-group select-icon';
        vehicleTypeIcon.style.color = '#64748b';
      }

      // Reset active cho dropdown Loại xe
      document.querySelectorAll('#vehicleTypeDropdown .select-option').forEach(o => {
        if (o.getAttribute('data-value') === 'all') {
          o.classList.add('active');
        } else {
          o.classList.remove('active');
        }
      });

      // Reset active preset
      document.querySelectorAll('.preset-option-btn').forEach(btn => {
        if (btn.getAttribute('data-preset') === 'all') {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      renderCalendar();
      loadHistory();
    });
  }

  // F. Nút Xuất danh sách ra file Microsoft Excel (.xlsx) chuẩn chỉnh chuyên nghiệp
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      const apiBase = getApiBase();
      const params = new URLSearchParams({
        keyword: state.searchKeyword,
        date_filter: state.filterDate,
        vehicle_type: state.filterType
      });

      const exportUrl = `${apiBase}/api/history/export?${params.toString()}`;
      
      // Tạo thẻ download ẩn để tải file Excel trực tiếp về máy tính
      const a = document.createElement('a');
      a.href = exportUrl;
      a.setAttribute('download', '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // G. Đóng Modal khi bấm nút X hoặc bấm ngoài màn hình mờ
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

  // Khởi tạo hiển thị ban đầu từ CSDL
  loadCapacityStats();
  loadHistory();
});
