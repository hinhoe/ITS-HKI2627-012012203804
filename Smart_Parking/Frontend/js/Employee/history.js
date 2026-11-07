// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Lịch sử gửi xe & Tra cứu (history.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 20 bản ghi gốc theo đúng chuẩn thiết kế thực tế ở trang 1
  const base20Records = [
    { plate: '30E-892.41', type: 'Ô tô', timeIn: '08:30:12 - 15/04/2026', timeOut: '12:44:26 - 15/04/2026', duration: '4 giờ 14 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '29A-688.88', type: 'Xe máy', timeIn: '07:15:02 - 15/04/2026', timeOut: '12:35:10 - 15/04/2026', duration: '5 giờ 20 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '29-V1 552.19', type: 'Ô tô', timeIn: '06:20:15 - 15/04/2026', timeOut: '12:20:01 - 15/04/2026', duration: '5 giờ 59 phút', fee: '40.000 VNĐ', dateGroup: 'today' },
    { plate: '30-P8 441.90', type: 'Ô tô', timeIn: '10:12:40 - 15/04/2026', timeOut: '12:05:15 - 15/04/2026', duration: '1 giờ 52 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '51K-294.63', type: 'Xe máy', timeIn: '11:10:09 - 15/04/2026', timeOut: '11:58:33 - 15/04/2026', duration: '0 giờ 48 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '29C-712.35', type: 'Xe máy', timeIn: '06:45:12 - 15/04/2026', timeOut: '11:42:00 - 15/04/2026', duration: '4 giờ 56 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '29-H1 839.12', type: 'Ô tô', timeIn: '07:10:00 - 15/04/2026', timeOut: '11:30:20 - 15/04/2026', duration: '4 giờ 20 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '30-F4 118.02', type: 'Xe máy', timeIn: '08:00:15 - 15/04/2026', timeOut: '10:15:30 - 15/04/2026', duration: '2 giờ 15 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '30G-456.78', type: 'Ô tô', timeIn: '06:05:40 - 15/04/2026', timeOut: '10:10:12 - 15/04/2026', duration: '4 giờ 04 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '29-X5 901.23', type: 'Xe máy', timeIn: '07:30:10 - 15/04/2026', timeOut: '09:45:00 - 15/04/2026', duration: '2 giờ 14 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '30F-331.89', type: 'Ô tô', timeIn: '05:15:20 - 15/04/2026', timeOut: '09:30:15 - 15/04/2026', duration: '4 giờ 15 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '29B-128.55', type: 'Xe máy', timeIn: '07:05:42 - 15/04/2026', timeOut: '09:12:00 - 15/04/2026', duration: '2 giờ 06 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '51A-982.11', type: 'Ô tô', timeIn: '06:10:00 - 15/04/2026', timeOut: '09:05:40 - 15/04/2026', duration: '2 giờ 55 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '30H-112.54', type: 'Xe máy', timeIn: '07:45:18 - 15/04/2026', timeOut: '08:58:20 - 15/04/2026', duration: '1 giờ 13 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '29D-665.32', type: 'Ô tô', timeIn: '06:30:50 - 15/04/2026', timeOut: '08:50:12 - 15/04/2026', duration: '2 giờ 19 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '30A-778.99', type: 'Ô tô', timeIn: '07:22:10 - 15/04/2026', timeOut: '08:45:30 - 15/04/2026', duration: '1 giờ 23 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '51G-332.18', type: 'Xe máy', timeIn: '07:11:05 - 15/04/2026', timeOut: '08:35:10 - 15/04/2026', duration: '1 giờ 24 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '29B-452.10', type: 'Xe máy', timeIn: '07:00:30 - 15/04/2026', timeOut: '08:20:00 - 15/04/2026', duration: '1 giờ 19 phút', fee: '5.000 VNĐ', dateGroup: 'today' },
    { plate: '30K-889.01', type: 'Ô tô', timeIn: '06:50:12 - 15/04/2026', timeOut: '08:15:45 - 15/04/2026', duration: '1 giờ 25 phút', fee: '25.000 VNĐ', dateGroup: 'today' },
    { plate: '29-S2 678.90', type: 'Xe máy', timeIn: '06:40:00 - 15/04/2026', timeOut: '08:10:15 - 15/04/2026', duration: '1 giờ 30 phút', fee: '5.000 VNĐ', dateGroup: 'today' }
  ];

  // Hàm sinh dữ liệu giả lập chuẩn xác cho đủ 1.248 bản ghi (63 trang, mỗi trang 20 bản ghi)
  function buildAllHistoryRecords(total = 1248) {
    const list = [...base20Records];
    const carPrefixes = ['30E', '29A', '30G', '51A', '30H', '29D', '30A', '51G', '30K', '29C'];
    const motorPrefixes = ['29-V1', '51K', '29-H1', '30-F4', '29-X5', '29-B1', '30-M2', '59-S3', '29-T1', '29-S2'];

    for (let i = 21; i <= total; i++) {
      const isCar = (i % 2 !== 0);
      const prefixList = isCar ? carPrefixes : motorPrefixes;
      const prefix = prefixList[(i - 1) % prefixList.length];
      const part1 = String(100 + (i % 899)).padStart(3, '0');
      const part2 = String((i * 7) % 99).padStart(2, '0');
      const plate = `${prefix} ${part1}.${part2}`;

      const type = isCar ? 'Ô tô' : 'Xe máy';
      const durationHours = (i % 7) + 1;
      const durationMinutes = (i * 11) % 60;
      const duration = `${durationHours} giờ ${durationMinutes.toString().padStart(2, '0')} phút`;
      const fee = isCar ? (durationHours >= 5 ? '40.000 VNĐ' : '25.000 VNĐ') : '5.000 VNĐ';

      // Tính giờ ra lùi dần theo thời gian trong ngày
      const dayOffset = Math.floor((i - 1) / 80);
      const day = String(Math.max(1, 15 - dayOffset)).padStart(2, '0');
      const dateStr = `${day}/04/2026`;

      const hourIn = String(6 + (i % 12)).padStart(2, '0');
      const minIn = String((i * 13) % 60).padStart(2, '0');
      const secIn = String((i * 19) % 60).padStart(2, '0');

      const hourOut = String(Math.min(23, 6 + (i % 12) + durationHours)).padStart(2, '0');
      const minOut = String((i * 17) % 60).padStart(2, '0');
      const secOut = String((i * 23) % 60).padStart(2, '0');

      list.push({
        plate: plate,
        type: type,
        timeIn: `${hourIn}:${minIn}:${secIn} - ${dateStr}`,
        timeOut: `${hourOut}:${minOut}:${secOut} - ${dateStr}`,
        duration: duration,
        fee: fee,
        dateGroup: dayOffset === 0 ? 'today' : (dayOffset === 1 ? 'yesterday' : 'this_month')
      });
    }

    return list;
  }

  // 1. Quản lý trạng thái và Dữ liệu
  const state = {
    historyData: buildAllHistoryRecords(1248),
    currentPage: 1,
    pageSize: 20,
    searchKeyword: '',
    filterDate: 'all',
    filterType: 'all'
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

  // ==========================================================================
  // HÀM TIỆN ÍCH & RENDER DỮ LIỆU
  // ==========================================================================

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
  function getFilteredData() {
    return state.historyData.filter(item => {
      // Tìm kiếm biển số xe
      const matchesSearch = item.plate.toLowerCase().includes(state.searchKeyword.toLowerCase().trim());

      // Lọc theo loại xe
      const matchesType = (state.filterType === 'all') || (item.type === state.filterType);

      // Lọc theo thời gian
      const matchesDate = (state.filterDate === 'all') || (item.dateGroup === state.filterDate);

      return matchesSearch && matchesType && matchesDate;
    });
  }

  // Render thanh cụm nút bấm phân trang động (< 1 2 3 ... 63 >)
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

    // Tính toán số trang hiển thị thông minh: 1, 2, 3 ... 63 hoặc lân cận trang hiện tại
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
          renderHistory();
          // Cuộn nhẹ lên đầu bảng để trải nghiệm xem thuận tiện
          const tableElement = document.querySelector('.table-wrapper');
          if (tableElement) {
            tableElement.scrollTop = 0;
          }
        }
      });
    });
  }

  // Hiển thị danh sách lịch sử theo đúng trang hiện tại
  function renderHistory() {
    if (!historyTableBody) return;

    // 1. Lọc dữ liệu
    const filtered = getFilteredData();
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
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 32px; color: #94a3b8;">
            <i class="fa-solid fa-clock-rotate-left" style="font-size:24px; margin-bottom:8px; display:block;"></i>
            Không tìm thấy lượt gửi xe nào phù hợp với bộ lọc
          </td>
        </tr>
      `;
    } else {
      historyTableBody.innerHTML = pageItems.map(item => `
        <tr>
          <td>
            <div class="plate-cell">
              ${createPlateThumbnail(item.type)}
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
          <td class="td-time">${item.timeOut}</td>
          <td class="td-duration">${item.duration}</td>
          <td class="td-fee">${item.fee}</td>
          <td>
            <button type="button" class="btn-view-photo" data-plate="${item.plate}">
              <i class="fa-regular fa-eye"></i>
              <span>Xem ảnh</span>
            </button>
          </td>
        </tr>
      `).join('');
    }

    // 3. Cập nhật dòng chữ hiển thị phân trang
    if (paginationInfo) {
      if (totalFiltered === 0) {
        paginationInfo.textContent = 'Không có kết quả nào';
      } else {
        paginationInfo.textContent = `Hiển thị ${startIndex + 1}–${endIndex} trên tổng ${totalFiltered.toLocaleString('vi-VN')} lượt gửi xe đã hoàn tất`;
      }
    }

    // 4. Cập nhật cụm nút phân trang tương tác
    renderPaginationControls(totalPages);

    // 5. Gán sự kiện xem ảnh chi tiết
    document.querySelectorAll('.btn-view-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const plate = btn.getAttribute('data-plate');
        const record = state.historyData.find(r => r.plate === plate);
        if (record) {
          openPhotoModal(record);
        }
      });
    });
  }

  // Mở modal đối soát ảnh xe vào/ra
  function openPhotoModal(record) {
    if (!photoModalBackdrop) return;
    if (modalPlate) modalPlate.textContent = record.plate;
    if (modalType) modalType.textContent = record.type;
    if (modalDuration) modalDuration.textContent = record.duration;
    if (modalFee) modalFee.textContent = record.fee;

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

  // B. Tìm kiếm biển số theo thời gian thực (Live Search)
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      state.currentPage = 1; // Đưa về trang 1 khi gõ tìm kiếm
      renderHistory();
    });
  }

  // C. Lọc theo Thời gian
  if (filterDateSelect) {
    filterDateSelect.addEventListener('change', (e) => {
      state.filterDate = e.target.value;
      state.currentPage = 1; // Đưa về trang 1 khi đổi bộ lọc
      renderHistory();
    });
  }

  // D. Lọc theo Loại xe
  if (filterTypeSelect) {
    filterTypeSelect.addEventListener('change', (e) => {
      state.filterType = e.target.value;
      state.currentPage = 1; // Đưa về trang 1 khi đổi loại xe
      renderHistory();
    });
  }

  // E. Nút Đặt lại bộ lọc (Reset)
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.searchKeyword = '';
      state.filterDate = 'all';
      state.filterType = 'all';
      state.currentPage = 1;

      if (searchInput) searchInput.value = '';
      if (filterDateSelect) filterDateSelect.value = 'all';
      if (filterTypeSelect) filterTypeSelect.value = 'all';

      renderHistory();
    });
  }

  // F. Nút Xuất danh sách (Mock Export)
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      alert('Hệ thống đang xuất danh sách lịch sử gửi xe ra file Excel (.xlsx)...\nVui lòng kiểm tra thư mục tải xuống!');
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

  // Khởi tạo hiển thị ban đầu
  renderHistory();
});
