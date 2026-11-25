/**
 * ==========================================================================
 * HỆ THỐNG THÔNG BÁO & HỘP THOẠI CHUYÊN NGHIỆP - PARKTECH / PARKAIVISION
 * File JS: Frontend/js/Employee/notification-modal.js
 * ==========================================================================
 */

(function () {
  'use strict';

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
        <div class="park-modal-card type-error">
          <div class="park-modal-icon-badge error" id="parkAlertIcon">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="park-modal-title" id="parkAlertTitle">Thông báo</h3>
          <p class="park-modal-message" id="parkAlertMessage"></p>
          <div class="park-modal-hint-strip" id="parkAlertHint" style="display:none;">
            <i class="fa-solid fa-circle-info"></i>
            <span id="parkAlertHintText"></span>
          </div>
          <div class="park-modal-actions">
            <button type="button" class="park-btn-modal primary" id="parkAlertConfirmBtn">
              <span>Đã hiểu</span>
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(alertModalEl);
    }

    // 2. Prompt Modal DOM
    if (!promptModalEl) {
      promptModalEl = document.createElement('div');
      promptModalEl.className = 'park-modal-backdrop';
      promptModalEl.id = 'parkAppPromptModal';
      promptModalEl.innerHTML = `
        <div class="park-modal-card type-info">
          <div class="park-modal-icon-badge info" id="parkPromptIcon">
            <i class="fa-solid fa-pen-to-square"></i>
          </div>
          <h3 class="park-modal-title" id="parkPromptTitle">Chỉnh sửa biển số xe</h3>
          <p class="park-modal-subtitle" id="parkPromptSubtitle">Nhập biển số xe đúng theo quy chuẩn Việt Nam</p>
          
          <div class="park-prompt-input-group">
            <input type="text" class="park-prompt-input" id="parkPromptInput" maxlength="15" autocomplete="off" spellcheck="false">
            <div class="park-prompt-feedback" id="parkPromptFeedback"></div>
          </div>

          <div class="park-modal-actions">
            <button type="button" class="park-btn-modal secondary" id="parkPromptCancelBtn">
              <span>Hủy bỏ</span>
            </button>
            <button type="button" class="park-btn-modal primary" id="parkPromptConfirmBtn">
              <i class="fa-solid fa-check"></i> <span>Lưu thay đổi</span>
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureContainers);
  } else {
    ensureContainers();
  }

  /**
   * Hiển thị Hộp thoại Cảnh báo / Lỗi / Thông tin gọn gàng, chuyên nghiệp
   */
  window.showAppAlert = function (options = {}) {
    return new Promise((resolve) => {
      ensureContainers();

      const {
        title = 'Thông báo',
        message = '',
        hint = '',
        type = 'error',
        confirmText = 'Đã hiểu'
      } = options;

      const iconEl = alertModalEl.querySelector('#parkAlertIcon');
      const titleEl = alertModalEl.querySelector('#parkAlertTitle');
      const msgEl = alertModalEl.querySelector('#parkAlertMessage');
      const hintBoxEl = alertModalEl.querySelector('#parkAlertHint');
      const hintTextEl = alertModalEl.querySelector('#parkAlertHintText');
      const confirmBtn = alertModalEl.querySelector('#parkAlertConfirmBtn');
      const cardEl = alertModalEl.querySelector('.park-modal-card');

      cardEl.className = `park-modal-card type-${type}`;
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
      msgEl.textContent = message;

      if (hint) {
        hintTextEl.textContent = hint;
        hintBoxEl.style.display = 'flex';
      } else {
        hintBoxEl.style.display = 'none';
      }

      confirmBtn.innerHTML = `<span>${confirmText}</span>`;

      alertModalEl.classList.add('show');
      if (type === 'error') {
        cardEl.classList.remove('shake');
        void cardEl.offsetWidth;
        cardEl.classList.add('shake');
      }

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

      setTimeout(() => confirmBtn.focus(), 80);
    });
  };

  /**
   * Hiển thị Hộp thoại Nhập liệu / Sửa biển số
   */
  window.showAppPrompt = function (options = {}) {
    return new Promise((resolve) => {
      ensureContainers();

      const {
        title = 'Chỉnh sửa biển số xe',
        subtitle = 'Nhập biển số xe theo đúng quy chuẩn Việt Nam:',
        defaultValue = '',
        placeholder = 'VD: 51F-866.88 hoặc 29A-12345',
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
            feedbackEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${res.reason}</span>`;
            return false;
          } else {
            inputEl.classList.remove('error');
            feedbackEl.className = 'park-prompt-feedback valid';
            feedbackEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>Biển số hợp lệ (${res.clean || val})</span>`;
            return true;
          }
        }
        return true;
      }

      inputEl.oninput = runValidation;

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

    requestAnimationFrame(() => {
      toastItem.classList.add('show');
    });

    setTimeout(() => {
      toastItem.classList.remove('show');
      setTimeout(() => {
        if (toastItem.parentNode) toastItem.parentNode.removeChild(toastItem);
      }, 400);
    }, duration);
  };

  /**
   * Lấy tên nhân viên đang đăng nhập từ localStorage
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
