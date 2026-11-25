/**
 * ==========================================================================
 * HỆ THỐNG THÔNG BÁO & HỘP THOẠI CHUYÊN NGHIỆP - PARKTECH / PARKAIVISION
 * File JS: Frontend/js/Employee/notification-modal.js
 * Cung cấp:
 * 1. window.showAppAlert(...)   : Hộp thoại cảnh báo/lỗi/thành công cao cấp
 * 2. window.showAppPrompt(...)  : Hộp thoại nhập liệu/sửa biển số xịn sò
 * 3. window.showAppToast(...)   : Toast thông báo góc phải màn hình
 * ==========================================================================
 */

(function () {
  'use strict';

  // Khởi tạo container dùng chung
  let alertModalEl = null;
  let promptModalEl = null;
  let toastContainerEl = null;

  function ensureContainers() {
    // 1. Alert Modal DOM
    if (!alertModalEl) {
      alertModalEl = document.createElement('div');
      alertModalEl.className = 'park-modal-backdrop';
      alertModalEl.id = 'parkAppAlertModal';
      alertModalEl.innerHTML = `
        <div class="park-modal-card">
          <div class="park-modal-icon-badge error" id="parkAlertIcon">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="park-modal-title" id="parkAlertTitle">THÔNG BÁO</h3>
          <p class="park-modal-subtitle" id="parkAlertSubtitle" style="display:none;"></p>
          <div class="park-modal-error-box" id="parkAlertBox">
            <div class="park-modal-error-reason" id="parkAlertReason"></div>
            <div class="park-modal-error-hint" id="parkAlertHint"></div>
          </div>
          <div class="park-modal-actions">
            <button type="button" class="park-btn-modal primary" id="parkAlertConfirmBtn">
              <i class="fa-solid fa-check"></i> <span>Đã hiểu</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(alertModalEl);
    }

    // 2. Prompt Modal DOM (Dành cho việc Sửa biển số chuyên nghiệp)
    if (!promptModalEl) {
      promptModalEl = document.createElement('div');
      promptModalEl.className = 'park-modal-backdrop';
      promptModalEl.id = 'parkAppPromptModal';
      promptModalEl.innerHTML = `
        <div class="park-modal-card">
          <div class="park-modal-icon-badge warning" id="parkPromptIcon">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
          <h3 class="park-modal-title" id="parkPromptTitle">CHỈNH SỬA BIỂN SỐ</h3>
          <p class="park-modal-subtitle" id="parkPromptSubtitle">Nhập lại biển số đúng theo quy chuẩn biển xe Việt Nam</p>
          
          <div class="park-prompt-input-group">
            <input type="text" class="park-prompt-input" id="parkPromptInput" maxlength="15" autocomplete="off" spellcheck="false">
            <div class="park-prompt-feedback" id="parkPromptFeedback"></div>
          </div>

          <div class="park-modal-actions">
            <button type="button" class="park-btn-modal secondary" id="parkPromptCancelBtn">
              <i class="fa-solid fa-xmark"></i> <span>Hủy bỏ</span>
            </button>
            <button type="button" class="park-btn-modal primary" id="parkPromptConfirmBtn">
              <i class="fa-solid fa-check"></i> <span>Lưu biển số</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(promptModalEl);
    }

    // 3. Toast Container DOM
    if (!toastContainerEl) {
      toastContainerEl = document.createElement('div');
      toastContainerEl.className = 'park-toast-container';
      document.body.appendChild(toastContainerEl);
    }
  }

  // Đảm bảo tạo DOM khi tài liệu sẵn sàng
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureContainers);
  } else {
    ensureContainers();
  }

  /**
   * Hiển thị Hộp thoại Cảnh báo / Lỗi đẹp mắt
   * @param {Object} options
   * @param {string} options.title - Tiêu đề (VD: 'BIỂN SỐ KHÔNG HỢP LỆ!')
   * @param {string} options.message - Nội dung lý do chính
   * @param {string} [options.hint] - Gợi ý khắc phục
   * @param {string} [options.type='error'] - 'error' | 'warning' | 'success' | 'info'
   * @param {string} [options.confirmText='Đã hiểu'] - Chữ trên nút xác nhận
   * @returns {Promise<boolean>}
   */
  window.showAppAlert = function (options = {}) {
    return new Promise((resolve) => {
      ensureContainers();

      const {
        title = 'THÔNG BÁO',
        message = '',
        hint = '',
        type = 'error',
        confirmText = 'Đã hiểu'
      } = options;

      const iconEl = alertModalEl.querySelector('#parkAlertIcon');
      const titleEl = alertModalEl.querySelector('#parkAlertTitle');
      const reasonEl = alertModalEl.querySelector('#parkAlertReason');
      const hintEl = alertModalEl.querySelector('#parkAlertHint');
      const boxEl = alertModalEl.querySelector('#parkAlertBox');
      const confirmBtn = alertModalEl.querySelector('#parkAlertConfirmBtn');
      const cardEl = alertModalEl.querySelector('.park-modal-card');

      // Thiết lập Icon & Style
      iconEl.className = `park-modal-icon-badge ${type}`;
      if (type === 'error') {
        iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        confirmBtn.className = 'park-btn-modal danger';
      } else if (type === 'warning') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
        confirmBtn.className = 'park-btn-modal primary';
      } else if (type === 'success') {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        confirmBtn.className = 'park-btn-modal primary';
      } else {
        iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
        confirmBtn.className = 'park-btn-modal primary';
      }

      titleEl.textContent = title;
      reasonEl.innerHTML = `<i class="fa-solid fa-circle-xmark" style="color:#ef4444; flex-shrink:0; margin-top:2px;"></i> <span>${message}</span>`;

      if (hint) {
        hintEl.innerHTML = `<i class="fa-solid fa-lightbulb" style="color:#f59e0b; margin-right:4px;"></i> ${hint}`;
        hintEl.style.display = 'block';
      } else {
        hintEl.style.display = 'none';
      }

      confirmBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>${confirmText}</span>`;

      // Hiển thị modal & hiệu ứng rung nếu là lỗi
      alertModalEl.classList.add('show');
      if (type === 'error') {
        cardEl.classList.remove('shake');
        void cardEl.offsetWidth; // trigger reflow
        cardEl.classList.add('shake');
      }

      // Xử lý đóng modal
      function handleClose() {
        alertModalEl.classList.remove('show');
        confirmBtn.removeEventListener('click', handleClose);
        alertModalEl.removeEventListener('click', handleBackdropClick);
        document.removeEventListener('keydown', handleKeydown);
        resolve(true);
      }

      function handleBackdropClick(e) {
        if (e.target === alertModalEl) handleClose();
      }

      function handleKeydown(e) {
        if (e.key === 'Escape' || e.key === 'Enter') handleClose();
      }

      confirmBtn.addEventListener('click', handleClose);
      alertModalEl.addEventListener('click', handleBackdropClick);
      document.addEventListener('keydown', handleKeydown);

      // Focus nút xác nhận
      setTimeout(() => confirmBtn.focus(), 80);
    });
  };

  /**
   * Hiển thị Hộp thoại Nhập liệu / Sửa biển số chuyên nghiệp thay thế prompt()
   * @param {Object} options
   * @param {string} options.title - Tiêu đề
   * @param {string} options.subtitle - Phụ đề hướng dẫn
   * @param {string} options.defaultValue - Giá trị ban đầu
   * @param {string} options.placeholder - Placeholder gợi ý
   * @param {Function} [options.validateFn] - Hàm kiểm tra tính hợp lệ: str => { valid: boolean, reason?: string, clean?: string }
   * @returns {Promise<string|null>} - Trả về chuỗi nhập hoặc null nếu hủy
   */
  window.showAppPrompt = function (options = {}) {
    return new Promise((resolve) => {
      ensureContainers();

      const {
        title = 'CHỈNH SỬA BIỂN SỐ XE',
        subtitle = 'Nhập lại biển số đúng theo quy chuẩn Việt Nam:',
        defaultValue = '',
        placeholder = 'VD: 51F-888.88 hoặc 29A-12345',
        validateFn = null
      } = options;

      const titleEl = promptModalEl.querySelector('#parkPromptTitle');
      const subtitleEl = promptModalEl.querySelector('#parkPromptSubtitle');
      const inputEl = promptModalEl.querySelector('#parkPromptInput');
      const feedbackEl = promptModalEl.querySelector('#parkPromptFeedback');
      const cancelBtn = promptModalEl.querySelector('#parkPromptCancelBtn');
      const confirmBtn = promptModalEl.querySelector('#parkPromptConfirmBtn');
      const cardEl = promptModalEl.querySelector('.park-modal-card');

      titleEl.textContent = title;
      subtitleEl.textContent = subtitle;
      inputEl.value = defaultValue;
      inputEl.placeholder = placeholder;
      inputEl.classList.remove('error');
      feedbackEl.className = 'park-prompt-feedback';
      feedbackEl.textContent = '';

      function runValidation() {
        const val = inputEl.value.trim().toUpperCase();
        if (!val) {
          inputEl.classList.remove('error');
          feedbackEl.className = 'park-prompt-feedback';
          feedbackEl.textContent = 'Vui lòng nhập biển số xe';
          return false;
        }

        if (typeof validateFn === 'function') {
          const res = validateFn(val);
          if (!res.valid) {
            inputEl.classList.add('error');
            feedbackEl.className = 'park-prompt-feedback error';
            feedbackEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${res.reason}`;
            return false;
          } else {
            inputEl.classList.remove('error');
            feedbackEl.className = 'park-prompt-feedback valid';
            feedbackEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Biển số đúng quy chuẩn (${res.clean || val})`;
            return true;
          }
        }
        return true;
      }

      inputEl.oninput = runValidation;

      // Mở modal
      promptModalEl.classList.add('show');
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
        runValidation();
      }, 100);

      function handleConfirm() {
        const val = inputEl.value.trim().toUpperCase();
        const isValid = runValidation();
        if (!isValid) {
          cardEl.classList.remove('shake');
          void cardEl.offsetWidth;
          cardEl.classList.add('shake');
          inputEl.focus();
          return;
        }

        closeModal();
        resolve(val);
      }

      function handleCancel() {
        closeModal();
        resolve(null);
      }

      function closeModal() {
        promptModalEl.classList.remove('show');
        cancelBtn.removeEventListener('click', handleCancel);
        confirmBtn.removeEventListener('click', handleConfirm);
        document.removeEventListener('keydown', handleKeydown);
      }

      function handleKeydown(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleConfirm();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      }

      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
      document.addEventListener('keydown', handleKeydown);
    });
  };

  /**
   * Hiển thị Toast thông báo góc phải màn hình
   * @param {Object} options
   * @param {string} options.title - Tiêu đề thông báo
   * @param {string} options.message - Nội dung ngắn gọn
   * @param {string} [options.type='success'] - 'success' | 'error' | 'warning'
   * @param {number} [options.duration=3500] - Thời gian hiển thị (ms)
   */
  window.showAppToast = function (options = {}) {
    ensureContainers();

    const {
      title = 'Thông báo',
      message = '',
      type = 'success',
      duration = 3500
    } = options;

    const toastItem = document.createElement('div');
    toastItem.className = `park-toast-item ${type}`;

    let iconHtml = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') iconHtml = '<i class="fa-solid fa-circle-xmark"></i>';
    else if (type === 'warning') iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';

    toastItem.innerHTML = `
      <div class="park-toast-icon">${iconHtml}</div>
      <div class="park-toast-content">
        <div class="park-toast-title">${title}</div>
        <div class="park-toast-msg">${message}</div>
      </div>
    `;

    toastContainerEl.appendChild(toastItem);

    // Kích hoạt animation xuất hiện
    requestAnimationFrame(() => {
      toastItem.classList.add('show');
    });

    // Tự động đóng sau duration
    setTimeout(() => {
      toastItem.classList.remove('show');
      setTimeout(() => {
        if (toastItem.parentNode) toastItem.parentNode.removeChild(toastItem);
      }, 400);
    }, duration);
  };

  /**
   * Lấy tên nhân viên đang đăng nhập từ localStorage (mặc định: Trần Bảo Anh)
   */
  window.getCurrentStaffName = function () {
    try {
      const raw = localStorage.getItem('parktech_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.full_name) return u.full_name;
      }
    } catch (e) { /* ignore */ }
    return 'Trần Bảo Anh';
  };

  // Tự động đồng bộ tên & vai trò nhân viên lên thanh Header và xử lý Đăng xuất
  document.addEventListener('DOMContentLoaded', () => {
    try {
      const raw = localStorage.getItem('parktech_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.full_name) {
          document.querySelectorAll('.user-name').forEach(el => {
            el.textContent = u.full_name;
          });
          document.querySelectorAll('.user-role').forEach(el => {
            el.textContent = u.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
          });
        }
      }
    } catch (e) { /* ignore */ }

    document.querySelectorAll('.dropdown-item.logout').forEach(link => {
      link.addEventListener('click', () => {
        localStorage.removeItem('parktech_user');
      });
    });
  });

})();
