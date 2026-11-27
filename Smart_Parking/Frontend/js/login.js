// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH (TRANG ĐĂNG NHẬP)
// File JavaScript xử lý logic tương tác & Xác thực tài khoản qua API Backend
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const usernameInput = document.getElementById('username');
  const eyeImg = document.getElementById('eyeImg');
  const loginForm = document.getElementById('loginForm');
  const loginErrorBox = document.getElementById('loginErrorBox');
  const quickRoleBtns = document.querySelectorAll('.btn-quick-role');

  if (togglePasswordBtn && passwordInput && eyeImg) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
      eyeImg.src = isPassword ? '../images/icon-eye-off.svg' : '../images/icon-eye.svg';
    });
  }

  function showLoginError(msg) {
    if (!loginErrorBox) return;
    loginErrorBox.textContent = msg;
    loginErrorBox.style.display = 'none';
    void loginErrorBox.offsetWidth;
    loginErrorBox.style.display = 'block';
  }

  async function executeLogin(username, password) {
    if (loginErrorBox) loginErrorBox.style.display = 'none';

    if (!username || !password) {
      showLoginError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
      return;
    }

    const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    const originalHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Đang xác thực...</span>';
    }

    try {
      const apiBase = window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Đăng nhập thất bại!');
      }

      // Lưu thông tin nhân viên / quản trị viên đang đăng nhập
      localStorage.setItem('parktech_user', JSON.stringify(data.user));

      if (data.user && data.user.role === 'admin') {
        window.location.href = 'Admin/dashboard.html';
      } else {
        window.location.href = 'Employee/checkin.html';
      }
    } catch (err) {
      showLoginError(err.message || 'Không thể kết nối máy chủ xác thực!');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      await executeLogin(username, password);
    });
  }

  quickRoleBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = btn.getAttribute('data-username') || '';
      const pass = btn.getAttribute('data-password') || '';
      if (usernameInput) usernameInput.value = user;
      if (passwordInput) passwordInput.value = pass;
      await executeLogin(user, pass);
    });
  });
});
