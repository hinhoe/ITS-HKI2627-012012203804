// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH (TRANG ĐĂNG NHẬP)
// File JavaScript xử lý logic tương tác
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordInput = document.getElementById('password');
  const eyeImg = document.getElementById('eyeImg');

  if (togglePasswordBtn && passwordInput && eyeImg) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = passwordInput.getAttribute('type') === 'password';
      passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

      // Thay đổi đường dẫn ảnh mắt từ thư mục ../images/
      eyeImg.src = isPassword ? '../images/icon-eye-off.svg' : '../images/icon-eye.svg';
    });
  }
});
