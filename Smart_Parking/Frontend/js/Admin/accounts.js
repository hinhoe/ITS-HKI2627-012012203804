// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH
// File JavaScript: Quản lý tài khoản & Phân quyền (accounts.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Dữ liệu chuẩn xác 18 tài khoản theo thiết kế, bao gồm cả MẬT KHẨU
  const initialAccounts = [
    {
      id: 1,
      username: 'admin_tung',
      password: 'admin@tung2026',
      fullName: 'Nguyễn Thành Tùng',
      role: 'admin',
      roleLabel: 'Quản trị viên',
      shift: 'Toàn quyền quản trị',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '10/01/2026'
    },
    {
      id: 2,
      username: 'nv_baoanh',
      password: 'baoanh#pass123',
      fullName: 'Trần Bảo Anh',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca sáng (06:00 - 14:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '15/01/2026'
    },
    {
      id: 3,
      username: 'nv_minhchau',
      password: 'chauparktech88',
      fullName: 'Lê Minh Châu',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca chiều (14:00 - 22:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '18/01/2026'
    },
    {
      id: 4,
      username: 'nv_hoangnam',
      password: 'nam_hoang999',
      fullName: 'Phạm Hoàng Nam',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca đêm (22:00 - 06:00)',
      status: 'locked',
      statusLabel: 'Đã khóa',
      createdAt: '22/01/2026'
    },
    {
      id: 5,
      username: 'admin_hieu',
      password: 'hieu_admin@2026',
      fullName: 'Đặng Minh Hiếu',
      role: 'admin',
      roleLabel: 'Quản trị viên',
      shift: 'Phó phòng vận hành',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '02/02/2026'
    },
    {
      id: 6,
      username: 'nv_quanghuy',
      password: 'huyquang_park2',
      fullName: 'Vũ Quang Huy',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca sáng (06:00 - 14:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '05/02/2026'
    },
    {
      id: 7,
      username: 'nv_thuytien',
      fullName: 'Hoàng Thủy Tiên',
      password: 'tien_parktech1',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca chiều (14:00 - 22:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '10/02/2026'
    },
    {
      id: 8,
      username: 'nv_ducthang',
      password: 'thangduc_ca3',
      fullName: 'Ngô Đức Thắng',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca đêm (22:00 - 06:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '12/02/2026'
    },
    {
      id: 9,
      username: 'nv_kimngan',
      password: 'ngankim#2026',
      fullName: 'Đỗ Kim Ngân',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca sáng (06:00 - 14:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '15/02/2026'
    },
    {
      id: 10,
      username: 'nv_thanhtung',
      password: 'tungthanh_nv10',
      fullName: 'Bùi Thanh Tùng',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca chiều (14:00 - 22:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '20/02/2026'
    },
    {
      id: 11,
      username: 'admin_lananh',
      password: 'lananh_root99',
      fullName: 'Trương Lan Anh',
      role: 'admin',
      roleLabel: 'Quản trị viên',
      shift: 'Giám sát kỹ thuật hệ thống',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '25/02/2026'
    },
    {
      id: 12,
      username: 'nv_vanhiep',
      password: 'hiepvan_locked',
      fullName: 'Trần Văn Hiệp',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca đêm (22:00 - 06:00)',
      status: 'locked',
      statusLabel: 'Đã khóa',
      createdAt: '01/03/2026'
    },
    {
      id: 13,
      username: 'nv_phuongthao',
      password: 'thaophuong#pass',
      fullName: 'Nguyễn Phương Thảo',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca sáng (06:00 - 14:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '05/03/2026'
    },
    {
      id: 14,
      username: 'nv_tuananh',
      password: 'tuananh_nv14',
      fullName: 'Đinh Tuấn Anh',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca chiều (14:00 - 22:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '10/03/2026'
    },
    {
      id: 15,
      username: 'nv_maihoa',
      password: 'hoamai_parktech',
      fullName: 'Phan Mai Hoa',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca sáng (06:00 - 14:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '15/03/2026'
    },
    {
      id: 16,
      username: 'nv_hongquan',
      password: 'hongquan_ca3',
      fullName: 'Lưu Hồng Quân',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca đêm (22:00 - 06:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '20/03/2026'
    },
    {
      id: 17,
      username: 'nv_camtu',
      password: 'camtu#pass2026',
      fullName: 'Võ Cẩm Tú',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca chiều (14:00 - 22:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '25/03/2026'
    },
    {
      id: 18,
      username: 'nv_quockhanh',
      password: 'khanhquoc_gate1',
      fullName: 'Tạ Quốc Khánh',
      role: 'staff',
      roleLabel: 'Nhân viên bãi xe',
      shift: 'Ca sáng (06:00 - 14:00)',
      status: 'active',
      statusLabel: 'Đang hoạt động',
      createdAt: '01/04/2026'
    }
  ];

  // 2. Trạng thái ứng dụng
  const state = {
    accounts: [...initialAccounts],
    searchKeyword: '',
    roleFilter: 'all',
    statusFilter: 'all',
    currentPage: 1,
    pageSize: 5,
    visiblePasswords: {} // Lưu trạng thái ẩn/hiện mật khẩu theo từng ID tài khoản
  };

  let editingId = null;

  // 3. Tham chiếu DOM
  const searchInput = document.getElementById('searchInput');
  const roleFilterButtons = document.querySelectorAll('#roleFilterGroup .filter-pill-btn');
  const statusFilterButtons = document.querySelectorAll('#statusFilterGroup .filter-pill-btn');
  const btnResetFilter = document.getElementById('btnResetFilter');
  const accountsTableBody = document.getElementById('accountsTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationControls = document.getElementById('paginationControls');

  // KPI elements
  const statTotal = document.getElementById('statTotal');
  const statAdmin = document.getElementById('statAdmin');
  const statStaff = document.getElementById('statStaff');
  const statActive = document.getElementById('statActive');
  const statLocked = document.getElementById('statLocked');

  // Modal elements
  const btnAddAccount = document.getElementById('btnAddAccount');
  const accountModalBackdrop = document.getElementById('accountModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const accountForm = document.getElementById('accountForm');
  const modalFormTitle = document.getElementById('modalFormTitle');
  const modalSubmitBtn = document.getElementById('modalSubmitBtn');
  const inputUsername = document.getElementById('inputUsername');
  const inputFullName = document.getElementById('inputFullName');
  const selectRole = document.getElementById('selectRole');
  const inputShift = document.getElementById('inputShift');
  const inputPassword = document.getElementById('inputPassword');
  const passwordLabel = document.getElementById('passwordLabel');
  const btnCopyPwd = document.getElementById('btnCopyPwd');

  // Toast
  const toastNotification = document.getElementById('toastNotification');
  const toastTitle = document.getElementById('toastTitle');
  const toastDesc = document.getElementById('toastDesc');
  let toastTimer = null;

  // Header Dropdown
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // ==========================================================================
  // HÀM TIỆN ÍCH & RENDER DỮ LIỆU
  // ==========================================================================

  function showToast(title, desc) {
    if (!toastNotification) return;
    if (toastTitle) toastTitle.textContent = title;
    if (toastDesc) toastDesc.textContent = desc;
    toastNotification.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 3500);
  }

  // Cập nhật các thẻ KPI số liệu
  function updateKPIs() {
    const total = state.accounts.length;
    const admins = state.accounts.filter(a => a.role === 'admin').length;
    const staff = state.accounts.filter(a => a.role === 'staff').length;
    const active = state.accounts.filter(a => a.status === 'active').length;
    const locked = state.accounts.filter(a => a.status === 'locked').length;

    if (statTotal) statTotal.textContent = total;
    if (statAdmin) statAdmin.textContent = admins;
    if (statStaff) statStaff.textContent = staff;
    if (statActive) statActive.textContent = active;
    if (statLocked) statLocked.textContent = `${locked} tài khoản tạm khóa`;
  }

  // Lọc danh sách tài khoản
  function getFilteredAccounts() {
    return state.accounts.filter(acc => {
      const kw = state.searchKeyword.toLowerCase().trim();
      const matchesSearch = acc.username.toLowerCase().includes(kw) || acc.fullName.toLowerCase().includes(kw);
      const matchesRole = (state.roleFilter === 'all') || (acc.role === state.roleFilter);
      const matchesStatus = (state.statusFilter === 'all') || (acc.status === state.statusFilter);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  // Render thanh điều hướng phân trang
  function renderPagination(totalFiltered, totalPages) {
    if (!paginationControls) return;

    if (totalPages <= 1) {
      paginationControls.innerHTML = '';
      return;
    }

    let html = '';

    // Nút Trước
    const prevDisabled = state.currentPage === 1 ? 'disabled' : '';
    html += `<button class="page-btn ${prevDisabled}" type="button" data-page="${state.currentPage - 1}">Trước</button>`;

    // Nút các trang
    for (let p = 1; p <= totalPages; p++) {
      const activeClass = (p === state.currentPage) ? 'active' : '';
      html += `<button class="page-btn ${activeClass}" type="button" data-page="${p}">${p}</button>`;
    }

    // Nút Sau
    const nextDisabled = state.currentPage === totalPages ? 'disabled' : '';
    html += `<button class="page-btn ${nextDisabled}" type="button" data-page="${state.currentPage + 1}">Sau</button>`;

    paginationControls.innerHTML = html;

    // Sự kiện chuyển trang
    paginationControls.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('disabled') || btn.classList.contains('active')) return;
        const targetPage = parseInt(btn.getAttribute('data-page'), 10);
        if (targetPage >= 1 && targetPage <= totalPages) {
          state.currentPage = targetPage;
          renderAccounts();
        }
      });
    });
  }

  // Render danh sách bảng tài khoản
  function renderAccounts() {
    if (!accountsTableBody) return;

    const filtered = getFilteredAccounts();
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / state.pageSize) || 1;

    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, totalFiltered);
    const pageItems = filtered.slice(startIndex, endIndex);

    if (pageItems.length === 0) {
      accountsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 36px; color: #94a3b8;">
            <i class="fa-solid fa-user-xmark" style="font-size: 26px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy tài khoản nào phù hợp với bộ lọc
          </td>
        </tr>
      `;
    } else {
      accountsTableBody.innerHTML = pageItems.map(acc => {
        const isAdmin = acc.role === 'admin';
        const isLocked = acc.status === 'locked';
        const isPwdVisible = !!state.visiblePasswords[acc.id];
        const displayPwd = isPwdVisible ? acc.password : '••••••••';

        return `
          <tr>
            <td>
              <span class="username-cell">${acc.username}</span>
            </td>
            <td>
              <!-- Cột Mật khẩu với tính năng xem trực tiếp / ẩn -->
              <div class="password-cell-wrapper">
                <span class="password-text">${displayPwd}</span>
                <button type="button" class="btn-toggle-row-pwd" data-id="${acc.id}" title="${isPwdVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}">
                  <i class="fa-regular ${isPwdVisible ? 'fa-eye-slash' : 'fa-eye'}"></i>
                </button>
              </div>
            </td>
            <td>
              <strong style="color: #0f172a;">${acc.fullName}</strong>
            </td>
            <td>
              <span class="badge-role ${isAdmin ? 'badge-role-admin' : 'badge-role-staff'}">
                <i class="fa-solid ${isAdmin ? 'fa-shield-halved' : 'fa-parking'}"></i>
                <span>${acc.roleLabel}</span>
              </span>
            </td>
            <td>${acc.shift}</td>
            <td>
              <span class="badge-status">
                ${isLocked 
                  ? `<span class="badge-status-locked">● Đã khóa</span>` 
                  : `<span class="status-bullet-active"></span><span class="status-active-text">Đang hoạt động</span>`
                }
              </span>
            </td>
            <td class="font-mono" style="color: #64748b;">${acc.createdAt}</td>
            <td>
              <div class="action-buttons-group">
                <!-- Nút chỉnh sửa toàn bộ thông tin (bao gồm cả mật khẩu) -->
                <button type="button" class="btn-action-icon btn-action-edit" data-id="${acc.id}" title="Chỉnh sửa thông tin & mật khẩu">
                  <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <!-- Nút khóa / mở khóa -->
                <button type="button" class="btn-action-icon btn-action-lock" data-id="${acc.id}" title="${isLocked ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}">
                  <i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-ban'}"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (paginationInfo) {
      paginationInfo.textContent = `Hiển thị ${pageItems.length} / ${totalFiltered} tài khoản`;
    }

    renderPagination(totalFiltered, totalPages);
    attachActionEvents();
  }

  // ==========================================================================
  // XỬ LÝ HÀNH ĐỘNG TÀI KHOẢN (EDIT, LOCK, TOGGLE PWD)
  // ==========================================================================
  function attachActionEvents() {
    // 1. Nút Ẩn / Hiện mật khẩu trực tiếp trên dòng của bảng
    document.querySelectorAll('.btn-toggle-row-pwd').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        state.visiblePasswords[id] = !state.visiblePasswords[id];
        renderAccounts();
      });
    });

    // 2. Chỉnh sửa thông tin & mật khẩu
    document.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const account = state.accounts.find(a => a.id === id);
        if (account) {
          openEditAccountModal(account);
        }
      });
    });

    // 3. Khóa / Mở khóa
    document.querySelectorAll('.btn-action-lock').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const account = state.accounts.find(a => a.id === id);
        if (!account) return;

        if (account.username === 'admin_tung') {
          alert('Không thể khóa tài khoản Quản trị viên cấp cao của hệ thống!');
          return;
        }

        const isCurrentlyLocked = account.status === 'locked';
        account.status = isCurrentlyLocked ? 'active' : 'locked';
        account.statusLabel = isCurrentlyLocked ? 'Đang hoạt động' : 'Đã khóa';

        updateKPIs();
        renderAccounts();

        showToast(
          isCurrentlyLocked ? 'Đã mở khóa tài khoản!' : 'Đã tạm khóa tài khoản!',
          `Tài khoản "${account.username}" (${account.fullName}) đã chuyển trạng thái thành ${account.statusLabel}.`
        );
      });
    });
  }

  // ==========================================================================
  // MODAL FORM THÊM / CẬP NHẬT TÀI KHOẢN
  // ==========================================================================
  function openAddAccountModal() {
    editingId = null;
    if (modalFormTitle) modalFormTitle.textContent = 'Thêm tài khoản mới';
    if (modalSubmitBtn) modalSubmitBtn.textContent = 'Lưu tài khoản';
    if (accountForm) accountForm.reset();
    if (inputUsername) inputUsername.disabled = false;
    if (passwordLabel) passwordLabel.textContent = 'Mật khẩu khởi tạo *';
    if (inputPassword) {
      inputPassword.value = '123456'; // Mặc định gợi ý mật khẩu chuẩn
    }

    if (accountModalBackdrop) accountModalBackdrop.classList.add('show');
  }

  function openEditAccountModal(account) {
    editingId = account.id;
    if (modalFormTitle) modalFormTitle.textContent = `Chỉnh sửa tài khoản: ${account.username}`;
    if (modalSubmitBtn) modalSubmitBtn.textContent = 'Cập nhật tài khoản';

    if (inputUsername) {
      inputUsername.value = account.username;
      inputUsername.disabled = true; // Không sửa username gốc
    }
    if (inputFullName) inputFullName.value = account.fullName;
    if (selectRole) selectRole.value = account.role;
    if (inputShift) inputShift.value = account.shift;
    if (passwordLabel) passwordLabel.textContent = 'Mật khẩu tài khoản *';
    if (inputPassword) {
      inputPassword.value = account.password; // Hiển thị mật khẩu thực tế để Admin xem và đổi nếu muốn
    }

    if (accountModalBackdrop) accountModalBackdrop.classList.add('show');
  }

  function closeAccountModal() {
    if (accountModalBackdrop) {
      accountModalBackdrop.classList.remove('show');
    }
    editingId = null;
  }

  // Sao chép mật khẩu từ Modal
  if (btnCopyPwd && inputPassword) {
    btnCopyPwd.addEventListener('click', () => {
      const pwd = inputPassword.value;
      if (!pwd) return;
      navigator.clipboard.writeText(pwd).then(() => {
        showToast('Đã sao chép mật khẩu!', `Mật khẩu "${pwd}" đã được copy vào bộ nhớ tạm.`);
      });
    });
  }

  // Submit form modal
  if (accountForm) {
    accountForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const username = inputUsername.value.trim();
      const fullName = inputFullName.value.trim();
      const role = selectRole.value;
      const shift = inputShift.value.trim() || (role === 'admin' ? 'Toàn quyền quản trị' : 'Trực ca linh hoạt');
      const password = inputPassword.value.trim();
      const roleLabel = role === 'admin' ? 'Quản trị viên' : 'Nhân viên bãi xe';

      if (!fullName) {
        alert('Vui lòng nhập họ và tên!');
        return;
      }

      if (!password || password.length < 6) {
        alert('Mật khẩu phải có ít nhất 6 ký tự!');
        return;
      }

      if (editingId) {
        // Cập nhật tài khoản có sẵn
        const target = state.accounts.find(a => a.id === editingId);
        if (target) {
          target.fullName = fullName;
          target.role = role;
          target.roleLabel = roleLabel;
          target.shift = shift;
          target.password = password; // Cập nhật mật khẩu mới

          showToast('Cập nhật thành công!', `Thông tin và mật khẩu của tài khoản "${target.username}" đã được lưu.`);
        }
      } else {
        // Thêm tài khoản mới
        if (!username) {
          alert('Vui lòng nhập tên đăng nhập!');
          return;
        }

        const exists = state.accounts.some(a => a.username.toLowerCase() === username.toLowerCase());
        if (exists) {
          alert('Tên đăng nhập này đã tồn tại trên hệ thống, vui lòng chọn tên khác!');
          return;
        }

        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        const newAcc = {
          id: Date.now(),
          username: username,
          password: password,
          fullName: fullName,
          role: role,
          roleLabel: roleLabel,
          shift: shift,
          status: 'active',
          statusLabel: 'Đang hoạt động',
          createdAt: dateStr
        };

        state.accounts.unshift(newAcc);
        showToast('Thêm tài khoản thành công!', `Tài khoản "${username}" (Mật khẩu: ${password}) đã được tạo.`);
      }

      updateKPIs();
      renderAccounts();
      closeAccountModal();
    });
  }

  // ==========================================================================
  // XỬ LÝ SỰ KIỆN TƯƠNG TÁC
  // ==========================================================================

  // Tìm kiếm theo thời gian thực (Live search)
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      state.currentPage = 1;
      renderAccounts();
    });
  }

  // Lọc theo vai trò (Tất cả vai trò, Nhân viên bãi xe, Quản trị viên)
  if (roleFilterButtons) {
    roleFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        roleFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.roleFilter = btn.getAttribute('data-role');
        state.currentPage = 1;
        renderAccounts();
      });
    });
  }

  // Lọc theo trạng thái (Tất cả, Đang hoạt động, Đã khóa)
  if (statusFilterButtons) {
    statusFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        statusFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.statusFilter = btn.getAttribute('data-status');
        state.currentPage = 1;
        renderAccounts();
      });
    });
  }

  // Nút đặt lại bộ lọc
  if (btnResetFilter) {
    btnResetFilter.addEventListener('click', () => {
      state.searchKeyword = '';
      state.roleFilter = 'all';
      state.statusFilter = 'all';
      state.currentPage = 1;

      if (searchInput) searchInput.value = '';
      roleFilterButtons.forEach(b => b.classList.remove('active'));
      statusFilterButtons.forEach(b => b.classList.remove('active'));

      const defaultRoleBtn = document.querySelector('#roleFilterGroup [data-role="all"]');
      const defaultStatusBtn = document.querySelector('#statusFilterGroup [data-status="all"]');
      if (defaultRoleBtn) defaultRoleBtn.classList.add('active');
      if (defaultStatusBtn) defaultStatusBtn.classList.add('active');

      renderAccounts();
    });
  }

  // Nút Thêm tài khoản & đóng modal
  if (btnAddAccount) btnAddAccount.addEventListener('click', openAddAccountModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAccountModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeAccountModal);
  if (accountModalBackdrop) {
    accountModalBackdrop.addEventListener('click', (e) => {
      if (e.target === accountModalBackdrop) {
        closeAccountModal();
      }
    });
  }

  // Dropdown hồ sơ quản trị viên
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

  // Khởi tạo ban đầu
  updateKPIs();
  renderAccounts();
});
