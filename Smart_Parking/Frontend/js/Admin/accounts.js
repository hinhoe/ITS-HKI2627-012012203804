// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Quản lý tài khoản & Phân quyền (accounts.js)
// Kết nối trực tiếp bảng users trong SQLite qua API (/api/admin/accounts)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  if (window.initAdminShell) {
    window.initAdminShell();
  }

  const state = {
    accounts: [],
    kpi: { total: 0, admin: 0, staff: 0, active: 0, locked: 0 },
    searchKeyword: '',
    roleFilter: 'all',
    statusFilter: 'all',
    currentPage: 1,
    pageSize: 8
  };

  let editingId = null;

  const statTotal = document.getElementById('statTotal');
  const statAdmin = document.getElementById('statAdmin');
  const statStaff = document.getElementById('statStaff');
  const statActive = document.getElementById('statActive');
  const statLocked = document.getElementById('statLocked');

  const searchInput = document.getElementById('searchInput');
  const roleFilterButtons = document.querySelectorAll('#roleFilterGroup .filter-pill-btn');
  const statusFilterButtons = document.querySelectorAll('#statusFilterGroup .filter-pill-btn');
  const btnResetFilter = document.getElementById('btnResetFilter');

  const accountsTableBody = document.getElementById('accountsTableBody');
  const paginationInfo = document.getElementById('paginationInfo');
  const paginationControls = document.getElementById('paginationControls');

  const btnAddAccount = document.getElementById('btnAddAccount');
  const accountModalBackdrop = document.getElementById('accountModalBackdrop');
  const modalFormTitle = document.getElementById('modalFormTitle');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const accountForm = document.getElementById('accountForm');
  const modalSubmitBtn = document.getElementById('modalSubmitBtn');

  const inputUsername = document.getElementById('inputUsername');
  const inputFullName = document.getElementById('inputFullName');
  const selectRole = document.getElementById('selectRole');
  const inputShift = document.getElementById('inputShift');
  const inputPassword = document.getElementById('inputPassword');
  const passwordLabel = document.getElementById('passwordLabel');
  const btnCopyPwd = document.getElementById('btnCopyPwd');

  const toastNotification = document.getElementById('toastNotification');
  const toastTitle = document.getElementById('toastTitle');
  const toastDesc = document.getElementById('toastDesc');

  function showToast(title, desc, type = 'success') {
    if (window.showAppToast) {
      window.showAppToast({ title, message: desc, type });
      return;
    }
    if (!toastNotification || !toastTitle || !toastDesc) return;
    toastTitle.textContent = title;
    toastDesc.textContent = desc;
    toastNotification.classList.add('show');
    setTimeout(() => toastNotification.classList.remove('show'), 3500);
  }

  function getInitials(fullName) {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'NV';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function updateKPIs() {
    if (statTotal) statTotal.textContent = state.kpi.total;
    if (statAdmin) statAdmin.textContent = state.kpi.admin;
    if (statStaff) statStaff.textContent = state.kpi.staff;
    if (statActive) statActive.textContent = state.kpi.active;
    if (statLocked) statLocked.textContent = `${state.kpi.locked} khóa`;
  }

  function getFilteredAccounts() {
    const kw = state.searchKeyword.toLowerCase().trim();
    return state.accounts.filter(acc => {
      const matchesSearch =
        !kw ||
        acc.username.toLowerCase().includes(kw) ||
        acc.full_name.toLowerCase().includes(kw);
      const matchesRole = (state.roleFilter === 'all') || (acc.role === state.roleFilter);
      const matchesStatus = (state.statusFilter === 'all') || (acc.status === state.statusFilter);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  function renderPagination(totalPages) {
    if (!paginationControls) return;
    if (totalPages <= 1) {
      paginationControls.innerHTML = '';
      return;
    }

    let html = `<button class="page-btn ${state.currentPage === 1 ? 'disabled' : ''}" type="button" data-page="${state.currentPage - 1}">Trước</button>`;
    for (let p = 1; p <= totalPages; p++) {
      html += `<button class="page-btn ${p === state.currentPage ? 'active' : ''}" type="button" data-page="${p}">${p}</button>`;
    }
    html += `<button class="page-btn ${state.currentPage === totalPages ? 'disabled' : ''}" type="button" data-page="${state.currentPage + 1}">Sau</button>`;

    paginationControls.innerHTML = html;

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
          <td colspan="5" style="text-align: center; padding: 36px; color: #94a3b8;">
            <i class="fa-solid fa-user-xmark" style="font-size: 24px; margin-bottom: 8px; display: block;"></i>
            Không tìm thấy tài khoản nào phù hợp với bộ lọc
          </td>
        </tr>
      `;
    } else {
      accountsTableBody.innerHTML = pageItems.map(acc => {
        const isAdmin = acc.role === 'admin';
        const isLocked = acc.status === 'locked';
        const isDefaultRoot = acc.username === 'admin01' || acc.username === 'nhanvien01';
        const isRootAdmin = acc.username === 'admin01';

        return `
          <tr>
            <td>
              <div class="account-identity-cell">
                <div class="account-avatar-badge ${isAdmin ? 'admin' : 'staff'}">${getInitials(acc.full_name)}</div>
                <div>
                  <div class="account-name-main">${acc.full_name}</div>
                  <div class="account-username-sub">@${acc.username}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="badge-role ${isAdmin ? 'badge-role-admin' : 'badge-role-staff'}">
                <i class="fa-solid ${isAdmin ? 'fa-shield-halved' : 'fa-id-badge'}"></i>
                <span>${acc.role_label}</span>
              </span>
            </td>
            <td>
              <div style="font-size: 12.5px; color: #334155;">${acc.shift}</div>
              <div style="font-size: 11px; color: #94a3b8;">Tạo: ${acc.created_at}</div>
            </td>
            <td>
              <span class="badge-status-pill ${isLocked ? 'locked' : 'active'}">
                <span>●</span>
                <span>${isLocked ? 'Đã khóa' : 'Hoạt động'}</span>
              </span>
            </td>
            <td>
              <div class="action-buttons-group">
                <button type="button" class="btn-action-icon btn-action-edit" data-id="${acc.id}" title="Sửa thông tin &amp; đặt lại mật khẩu">
                  <i class="fa-regular fa-pen-to-square"></i>
                </button>
                <button type="button" class="btn-action-icon btn-action-lock" data-id="${acc.id}" ${isRootAdmin ? 'disabled style="opacity:0.35; cursor:not-allowed;"' : ''} title="${isRootAdmin ? 'Không thể khóa tài khoản Admin gốc' : (isLocked ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản')}">
                  <i class="fa-solid ${isLocked ? 'fa-unlock' : 'fa-ban'}"></i>
                </button>
                ${!isDefaultRoot ? `
                  <button type="button" class="btn-action-icon btn-action-delete" data-id="${acc.id}" title="Xóa tài khoản phụ này">
                    <i class="fa-regular fa-trash-can"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (paginationInfo) {
      paginationInfo.textContent = `Hiển thị ${pageItems.length} / ${totalFiltered} tài khoản`;
    }

    renderPagination(totalPages);
    attachActionEvents();
  }

  async function loadAccountsFromBackend() {
    try {
      const apiBase = window.getAdminApiBase();
      const res = await fetch(`${apiBase}/api/admin/accounts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      state.accounts = data.accounts || [];
      state.kpi = data.kpi || state.kpi;
      if (data.capacity && window.updateAdminSidebarCapacity) {
        window.updateAdminSidebarCapacity(data.capacity);
      }

      updateKPIs();
      renderAccounts();
    } catch (err) {
      console.error('Lỗi tải danh sách tài khoản:', err);
      if (paginationInfo) paginationInfo.textContent = 'Không thể kết nối CSDL tài khoản';
    }
  }

  function attachActionEvents() {
    document.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const acc = state.accounts.find(a => a.id === id);
        if (acc) openEditAccountModal(acc);
      });
    });

    document.querySelectorAll('.btn-action-lock').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const acc = state.accounts.find(a => a.id === id);
        if (!acc || acc.username === 'admin01') return;

        try {
          const apiBase = window.getAdminApiBase();
          const res = await fetch(`${apiBase}/api/admin/accounts/${id}/status`, { method: 'PATCH' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Không thể cập nhật trạng thái tài khoản.');

          await loadAccountsFromBackend();
          showToast(
            data.is_active ? 'Đã mở khóa tài khoản!' : 'Đã tạm khóa tài khoản!',
            data.message
          );
        } catch (err) {
          if (window.showAppAlert) {
            await window.showAppAlert({ title: 'Thao tác thất bại', message: err.message, type: 'error' });
          } else {
            alert(err.message);
          }
        }
      });
    });

    document.querySelectorAll('.btn-action-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const acc = state.accounts.find(a => a.id === id);
        if (!acc) return;

        const confirmed = window.showAppConfirm
          ? await window.showAppConfirm({
              title: 'Xóa tài khoản nhân sự?',
              message: `Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${acc.full_name}" (@${acc.username})?`,
              confirmText: 'Xóa tài khoản',
              cancelText: 'Hủy',
              type: 'danger'
            })
          : confirm(`Xóa tài khoản ${acc.username}?`);

        if (!confirmed) return;

        try {
          const apiBase = window.getAdminApiBase();
          const res = await fetch(`${apiBase}/api/admin/accounts/${id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Không thể xóa tài khoản.');

          await loadAccountsFromBackend();
          showToast('Đã xóa tài khoản!', data.message);
        } catch (err) {
          if (window.showAppAlert) {
            await window.showAppAlert({ title: 'Xóa thất bại', message: err.message, type: 'error' });
          } else {
            alert(err.message);
          }
        }
      });
    });
  }

  function openAddAccountModal() {
    editingId = null;
    if (modalFormTitle) modalFormTitle.textContent = 'Thêm tài khoản mới';
    if (modalSubmitBtn) modalSubmitBtn.textContent = 'Lưu tài khoản';
    if (accountForm) accountForm.reset();
    if (inputUsername) inputUsername.disabled = false;
    if (selectRole) selectRole.value = 'employee';
    if (inputShift) inputShift.value = 'Ca sáng (06:00 - 14:00)';
    if (passwordLabel) passwordLabel.textContent = 'Mật khẩu khởi tạo *';
    if (inputPassword) {
      inputPassword.required = true;
      inputPassword.placeholder = 'Tối thiểu 6 ký tự';
      inputPassword.value = '123456';
    }
    if (accountModalBackdrop) accountModalBackdrop.classList.add('show');
  }

  function normalizeShiftSelection(rawShift, role) {
    if (!inputShift) return;
    const mapLegacy = {
      'Trực ca cổng': 'Ca sáng (06:00 - 14:00)',
      'Trực ca linh hoạt': 'Trực ca linh hoạt (Xoay ca)',
      'Toàn quyền quản trị': 'Toàn quyền quản trị (24/7)'
    };
    const targetVal = mapLegacy[rawShift] || rawShift || (role === 'admin' ? 'Toàn quyền quản trị (24/7)' : 'Ca sáng (06:00 - 14:00)');
    const hasOption = Array.from(inputShift.options).some(opt => opt.value === targetVal);
    if (!hasOption && targetVal) {
      const opt = document.createElement('option');
      opt.value = targetVal;
      opt.textContent = targetVal;
      inputShift.appendChild(opt);
    }
    inputShift.value = targetVal;
  }

  function openEditAccountModal(account) {
    editingId = account.id;
    if (modalFormTitle) modalFormTitle.textContent = `Cập nhật: @${account.username}`;
    if (modalSubmitBtn) modalSubmitBtn.textContent = 'Cập nhật tài khoản';

    if (inputUsername) {
      inputUsername.value = account.username;
      inputUsername.disabled = true;
    }
    if (inputFullName) inputFullName.value = account.full_name;
    if (selectRole) selectRole.value = account.role;
    normalizeShiftSelection(account.shift, account.role);
    if (passwordLabel) passwordLabel.textContent = 'Mật khẩu mới (để trống nếu giữ nguyên)';
    if (inputPassword) {
      inputPassword.required = false;
      inputPassword.value = '';
      inputPassword.placeholder = 'Nhập mật khẩu mới nếu muốn đặt lại';
    }
    if (accountModalBackdrop) accountModalBackdrop.classList.add('show');
  }

  if (selectRole && inputShift) {
    selectRole.addEventListener('change', () => {
      if (selectRole.value === 'admin') {
        inputShift.value = 'Toàn quyền quản trị (24/7)';
      } else if (inputShift.value === 'Toàn quyền quản trị (24/7)') {
        inputShift.value = 'Ca sáng (06:00 - 14:00)';
      }
    });
  }

  function closeAccountModal() {
    if (accountModalBackdrop) accountModalBackdrop.classList.remove('show');
    editingId = null;
  }

  if (btnCopyPwd && inputPassword) {
    btnCopyPwd.addEventListener('click', () => {
      const pwd = inputPassword.value;
      if (!pwd) return;
      navigator.clipboard.writeText(pwd).then(() => {
        showToast('Đã sao chép mật khẩu!', 'Mật khẩu đã được copy vào bộ nhớ tạm.');
      });
    });
  }

  if (accountForm) {
    accountForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = inputUsername ? inputUsername.value.trim() : '';
      const fullName = inputFullName ? inputFullName.value.trim() : '';
      const role = selectRole ? selectRole.value : 'employee';
      const shift = inputShift ? inputShift.value.trim() : '';
      const password = inputPassword ? inputPassword.value.trim() : '';

      if (!fullName) {
        if (window.showAppAlert) {
          await window.showAppAlert({ title: 'Thiếu thông tin', message: 'Vui lòng nhập họ và tên!', type: 'warning' });
        }
        return;
      }

      if (!editingId && (!password || password.length < 6)) {
        if (window.showAppAlert) {
          await window.showAppAlert({ title: 'Mật khẩu chưa hợp lệ', message: 'Mật khẩu khởi tạo phải có ít nhất 6 ký tự!', type: 'warning' });
        }
        return;
      }

      if (editingId && password && password.length < 6) {
        if (window.showAppAlert) {
          await window.showAppAlert({ title: 'Mật khẩu chưa hợp lệ', message: 'Mật khẩu mới phải có ít nhất 6 ký tự!', type: 'warning' });
        }
        return;
      }

      if (modalSubmitBtn) modalSubmitBtn.disabled = true;

      try {
        const apiBase = window.getAdminApiBase();
        let res;
        if (editingId) {
          res = await fetch(`${apiBase}/api/admin/accounts/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              full_name: fullName,
              role,
              shift_note: shift,
              password: password || null
            })
          });
        } else {
          res = await fetch(`${apiBase}/api/admin/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username,
              full_name: fullName,
              role,
              shift_note: shift,
              password
            })
          });
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Không thể lưu thông tin tài khoản.');

        closeAccountModal();
        await loadAccountsFromBackend();
        showToast(editingId ? 'Cập nhật thành công!' : 'Tạo tài khoản thành công!', data.message);
      } catch (err) {
        if (window.showAppAlert) {
          await window.showAppAlert({ title: 'Lưu tài khoản thất bại', message: err.message, type: 'error' });
        } else {
          alert(err.message);
        }
      } finally {
        if (modalSubmitBtn) modalSubmitBtn.disabled = false;
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value;
      state.currentPage = 1;
      renderAccounts();
    });
  }

  roleFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleFilterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.roleFilter = btn.getAttribute('data-role') || 'all';
      state.currentPage = 1;
      renderAccounts();
    });
  });

  statusFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.statusFilter = btn.getAttribute('data-status') || 'all';
      state.currentPage = 1;
      renderAccounts();
    });
  });

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

  if (btnAddAccount) btnAddAccount.addEventListener('click', openAddAccountModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeAccountModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeAccountModal);
  if (accountModalBackdrop) {
    accountModalBackdrop.addEventListener('click', (e) => {
      if (e.target === accountModalBackdrop) closeAccountModal();
    });
  }

  loadAccountsFromBackend();
});
