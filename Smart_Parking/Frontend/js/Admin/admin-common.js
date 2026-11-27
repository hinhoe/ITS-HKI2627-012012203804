// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// Helper dùng chung cho phân hệ Quản trị viên (Admin Common)
// ==========================================================================

(function () {
  window.getAdminApiBase = function () {
    return window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
  };

  window.getCurrentAdminUser = function () {
    try {
      const raw = localStorage.getItem('parktech_user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  window.updateAdminSidebarCapacity = function (cap) {
    if (!cap) return;
    const total = Number(cap.total_capacity) || 500;
    const current = Number(cap.current_count) || 0;
    const empty = Math.max(0, total - current);
    const pct = typeof cap.percent === 'number'
      ? cap.percent
      : Math.min(100, (current / Math.max(1, total)) * 100);

    document.querySelectorAll('.capacity-percentage, #capacityPercent').forEach(el => {
      el.textContent = `${pct.toFixed(1)}%`;
    });
    document.querySelectorAll('.progress-fill, #capacityProgressBar').forEach(el => {
      el.style.width = `${Math.min(100, pct)}%`;
    });
    document.querySelectorAll('.capacity-count, #capacityCurrent').forEach(el => {
      el.textContent = `${current} / ${total}`;
    });
    document.querySelectorAll('.capacity-empty, #capacityEmpty').forEach(el => {
      el.textContent = `${empty} chỗ trống`;
    });
  };

  window.initAdminShell = function () {
    const user = window.getCurrentAdminUser();
    if (user && user.role && user.role !== 'admin') {
      window.location.href = '../Employee/checkin.html';
      return null;
    }

    const displayName = (user && user.full_name) ? user.full_name : 'Quản trị viên Hệ thống';
    document.querySelectorAll('.user-name').forEach(el => {
      el.textContent = displayName;
    });

    const userProfileBtn = document.getElementById('userProfileBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    if (userProfileBtn && userDropdownMenu) {
      userProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdownMenu.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!userProfileBtn.contains(e.target) && !userDropdownMenu.contains(e.target)) {
          userDropdownMenu.classList.remove('show');
        }
      });

      userDropdownMenu.querySelectorAll('.dropdown-item.logout').forEach(link => {
        link.addEventListener('click', () => {
          localStorage.removeItem('parktech_user');
        });
      });

      const sysSettingLink = userDropdownMenu.querySelector('a[href="#"]');
      if (sysSettingLink) {
        sysSettingLink.setAttribute('href', 'pricing.html');
      }
    }

    return displayName;
  };
})();
