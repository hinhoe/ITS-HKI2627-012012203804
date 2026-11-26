// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Nghiệp vụ Ghi nhận xe ra & Tính phí (checkout.js)
// Kết nối trực tiếp Backend FastAPI (/api/checkout/recognize, /api/checkout/confirm, /api/checkout/history)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái hệ thống
  const state = {
    totalCapacity: 500,
    currentCount: 0,
    currentImageFile: null,
    // Thông tin lượt xe đối soát hiện tại (chờ xác nhận xe ra & mở barrier)
    currentCheckout: {
      sessionId: null,
      sessionCode: null,
      plate: '---',
      type: 'Ô tô',
      checkinTime: '--:--:-- - --/--/----',
      checkoutTime: '--:--:-- - --/--/----',
      duration: '--',
      durationMinutes: 0,
      feeType: '--',
      feeAmount: 0,
      feeDisplay: '0 VNĐ',
      feeDisplayTable: '0 đ',
      cropImageUrl: null,
      originalImageUrl: null,
      annotatedImageUrl: null,
      isProcessed: false
    },
    // Danh sách lưu trữ lịch sử lượt xe ra gần đây
    checkoutHistory: []
  };

  // 2. Tham chiếu các phần tử DOM
  const btnSelectImage = document.getElementById('btnSelectImage');
  const fileInputVehicle = document.getElementById('fileInputVehicle');
  const vehiclePreviewImg = document.getElementById('vehiclePreviewImg');
  const annotatedPreviewImg = document.getElementById('annotatedPreviewImg');
  const emptyViewportPlaceholder = document.getElementById('emptyViewportPlaceholder');
  const emptyAnnotatedPlaceholder = document.getElementById('emptyAnnotatedPlaceholder');
  const viewportOriginalBox = document.getElementById('viewportOriginalBox');
  const fileStatusText = document.getElementById('fileStatusText');
  const fileStatusBadge = document.getElementById('fileStatusBadge');
  const btnRecognize = document.getElementById('btnRecognize');
  const btnLookupBikeTicket = document.getElementById('btnLookupBikeTicket');
  const btnConfirmCheckout = document.getElementById('btnConfirmCheckout');

  // Webcam elements
  const btnToggleWebcam = document.getElementById('btnToggleWebcam');
  const webcamBtnText = document.getElementById('webcamBtnText');
  const btnCaptureWebcam = document.getElementById('btnCaptureWebcam');
  const btnFlipWebcam = document.getElementById('btnFlipWebcam');
  const webcamVideo = document.getElementById('webcamVideo');
  const captureCanvas = document.getElementById('captureCanvas');
  const camStatusDot = document.getElementById('camStatusDot');
  const camStatusText = document.getElementById('camStatusText');
  const webcamLiveControls = document.getElementById('webcamLiveControls');
  let webcamStream = null;
  let isWebcamFlipped = false; // Trạng thái lật gương camera chống ngược chữ

  // Kết quả nhận diện & Tính phí
  const cropPlaceholder = document.getElementById('cropPlaceholder');
  const cropDimsText = document.getElementById('cropDimsText');
  const resultPlateText = document.getElementById('resultPlateText');
  const plateManualInput = document.getElementById('plateManualInput');
  const btnToggleEditPlate = document.getElementById('btnToggleEditPlate');
  const btnClearPlateInput = document.getElementById('btnClearPlateInput');
  const licensePlateCard = document.getElementById('licensePlateCard');
  const manualEntryHint = document.getElementById('manualEntryHint');
  const manualEntryHintText = document.getElementById('manualEntryHintText');
  const btnSwitchVehicleType = document.getElementById('btnSwitchVehicleType');
  let isManualEditMode = false;

  const vehicleTypeText = document.getElementById('vehicleTypeText');
  const feeTypeText = document.getElementById('feeTypeText');
  const timeInText = document.getElementById('timeInText');
  const timeOutText = document.getElementById('timeOutText');
  const durationText = document.getElementById('durationText');
  const feeAmountText = document.getElementById('feeAmountText');
  const feeStatusBadge = document.getElementById('feeStatusBadge');
  const aiStatusPill = document.getElementById('aiStatusPill');
  const aiStatusText = document.getElementById('aiStatusText');
  const checkoutSuccessBanner = document.getElementById('checkoutSuccessBanner');
  const historyTableBody = document.getElementById('historyTableBody');
  const btnRefreshHistory = document.getElementById('btnRefreshHistory');

  // User Dropdown
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Sức chứa thời gian thực
  const capacityPercent = document.getElementById('capacityPercent');
  const capacityProgressBar = document.getElementById('capacityProgressBar');
  const capacityCount = document.getElementById('capacityCount');
  const capacityAvailable = document.getElementById('capacityAvailable');

  // ==========================================================================
  // HÀM TIỆN ÍCH (HELPER FUNCTIONS)
  // ==========================================================================

  // Lấy API Base URL linh hoạt (hỗ trợ cả chạy qua uvicorn port 8000 hoặc Live Server)
  function getApiBase() {
    return window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
  }

  // Chuẩn hóa khoảng cách biển số không bị chèn dấu chấm ảo
  function normalizePlateSpacing(plate) {
    if (!plate || typeof plate !== 'string') return plate;
    let cleaned = plate.trim();
    cleaned = cleaned.replace(/\.(\d)(?!\d)/g, '$1');
    cleaned = cleaned.replace(/(?<!\d)\.|\.(?!\d)/g, '');
    cleaned = cleaned.replace(/\s*-\s*/g, '-');
    cleaned = cleaned.replace(/\s*\.\s*/g, '.');
    cleaned = cleaned.replace(/^([0-9]{2}-[A-Z][A-Z0-9])([0-9]{4,5})$/, '$1 $2');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  // Định dạng ngày giờ chuẩn Việt Nam (HH:MM:SS - DD/MM/YYYY)
  function formatDateTime(date = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    return `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`;
  }

  function formatPrice(num) {
    return Number(num || 0).toLocaleString('vi-VN');
  }

  // Phân loại phương tiện
  function determineVehicleType(vehicleType, plateStr) {
    if (vehicleType === 'car') return 'Ô tô';
    if (vehicleType === 'motorbike') return 'Xe máy';
    if (vehicleType === 'Ô tô' || vehicleType === 'Xe máy' || vehicleType === 'Xe đạp / Xe điện') return vehicleType;
    if (!plateStr) return 'Ô tô';
    const clean = plateStr.replace(/[\s\-\.]/g, '').toUpperCase();
    if (/^\d{6}$/.test(clean)) {
      return 'Xe đạp / Xe điện';
    }
    if (/^[0-9]{2}[A-Z][A-Z0-9]/.test(clean)) {
      return 'Xe máy';
    }
    return 'Ô tô';
  }

  // Cập nhật hiển thị thẻ sức chứa bãi xe
  function updateCapacityDisplay(total = 500, current = 0) {
    state.totalCapacity = total;
    state.currentCount = current;
    const avail = Math.max(0, total - current);
    const pct = ((current / total) * 100).toFixed(1);

    if (capacityPercent) capacityPercent.textContent = `${pct}%`;
    if (capacityProgressBar) capacityProgressBar.style.width = `${pct}%`;
    if (capacityCount) capacityCount.textContent = `${current} / ${total}`;
    if (capacityAvailable) capacityAvailable.textContent = `${avail} chỗ trống`;
  }

  // Kiểm tra tính hợp lệ của biển số xe hoặc mã vé 6 số theo quy chuẩn Việt Nam
  function validateVietnamesePlate(plateStr, vehicleType = '') {
    if (!plateStr || typeof plateStr !== 'string') {
      return {
        valid: false,
        message: 'Vui lòng nhập biển số xe hoặc mã vé trước khi xác nhận.'
      };
    }
    const clean = plateStr.trim().toUpperCase();
    if (!clean || clean === '---' || clean === 'CHƯA RÕ' || clean === 'CHUA RO' || clean === 'KHÔNG TÌM THẤY') {
      return {
        valid: false,
        message: 'Vui lòng nhập biển số xe hoặc mã vé hợp lệ.'
      };
    }

    if (vehicleType === 'Xe đạp / Xe điện') {
      if (!/^\d{6}$/.test(clean)) {
        return {
          valid: false,
          message: `Mã vé xe đạp / xe điện "${clean}" phải gồm đúng 6 chữ số (VD: 482915).`
        };
      }
      return { valid: true, cleanPlate: clean };
    }

    const stripped = clean.replace(/[\s\.\-_]/g, '');

    if (stripped.length < 6 || stripped.length > 11) {
      return {
        valid: false,
        message: `Biển số "${clean}" không đúng độ dài quy định (6–10 ký tự).`
      };
    }

    const digits = stripped.match(/\d/g) || [];
    if (digits.length < 4) {
      return {
        valid: false,
        message: `Biển số "${clean}" thiếu chữ số đăng ký (cần tối thiểu 4 chữ số).`
      };
    }

    const letters = stripped.match(/[A-Z]/g) || [];
    if (letters.length < 1) {
      return {
        valid: false,
        message: `Biển số "${clean}" thiếu ký tự chữ cái sê-ri (VD: 51F, 29A, 59P1).`
      };
    }

    const isVnStandard = /^([1-9]\d|[A-Z]{2})[A-Z0-9]{1,3}\d{4,5}$/.test(stripped);
    if (!isVnStandard) {
      return {
        valid: false,
        message: `Biển số "${clean}" chưa đúng quy chuẩn biển số Việt Nam.`
      };
    }

    return { valid: true, cleanPlate: clean };
  }

  // Bật/tắt chế độ nhập biển số bằng tay
  function toggleManualEdit(enable, focus = true) {
    isManualEditMode = (enable !== undefined) ? enable : !isManualEditMode;

    if (isManualEditMode) {
      if (resultPlateText) resultPlateText.style.display = 'none';
      if (plateManualInput) {
        plateManualInput.style.display = 'block';
        const curVal = state.currentCheckout?.plate;
        if (curVal && curVal !== '---' && curVal !== 'Chưa rõ' && curVal !== 'Không tìm thấy') {
          plateManualInput.value = curVal;
        }
        if (focus) {
          setTimeout(() => plateManualInput.focus(), 50);
        }
      }
      if (licensePlateCard) licensePlateCard.classList.add('manual-mode');
      if (btnToggleEditPlate) {
        btnToggleEditPlate.classList.add('active');
        btnToggleEditPlate.innerHTML = '<i class="fa-solid fa-check"></i>';
        btnToggleEditPlate.title = 'Xác nhận biển số đã nhập';
      }
      if (btnClearPlateInput) btnClearPlateInput.style.display = 'inline-flex';
      if (btnSwitchVehicleType) btnSwitchVehicleType.style.display = 'inline-flex';
    } else {
      if (btnClearPlateInput) btnClearPlateInput.style.display = 'none';
      if (plateManualInput) {
        const val = normalizePlateSpacing(plateManualInput.value.trim().toUpperCase());
        if (val) {
          state.currentCheckout.plate = val;
          state.currentCheckout.type = determineVehicleType(state.currentCheckout.type, val);
          if (resultPlateText) resultPlateText.textContent = val;
          renderVehicleType(state.currentCheckout.type);
          // Tự động đối soát lại DB & tính lại phí theo biển số vừa sửa
          const check = validateVietnamesePlate(val);
          if (check.valid) {
            lookupCheckoutByPlate(val, state.currentCheckout.type);
          }
        }
        plateManualInput.style.display = 'none';
      }
      if (resultPlateText) resultPlateText.style.display = 'block';
      if (licensePlateCard) licensePlateCard.classList.remove('manual-mode');
      if (btnToggleEditPlate) {
        btnToggleEditPlate.classList.remove('active');
        btnToggleEditPlate.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        btnToggleEditPlate.title = 'Nhập / Sửa biển số bằng tay';
      }
    }
  }

  // Hàm gọi API đối soát lại lượt xe vào & tiền phí khi nhân viên sửa tay biển số, tra cứu vé 6 số hoặc đổi loại xe
  async function lookupCheckoutByPlate(plate, vehicleType, showAlertIfNotFound = false) {
    try {
      const apiBase = getApiBase();
      const params = new URLSearchParams({ plate });
      if (vehicleType) params.append('vehicle_type', vehicleType);

      const res = await fetch(`${apiBase}/api/checkout/lookup?${params.toString()}`);
      if (!res.ok) return false;
      const data = await res.json();
      const chk = data.checkin_info || {};

      if (showAlertIfNotFound && !data.matched) {
        if (aiStatusPill) {
          aiStatusPill.className = 'badge-status-pill error';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Không tìm thấy vé</span>';
        }
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'Không tìm thấy mã vé trong bãi',
            message: `Mã vé "${plate}" hiện không tồn tại trong danh sách xe đang gửi.`,
            hint: 'Vui lòng kiểm tra lại 6 chữ số và dấu mộc đỏ trên phiếu của khách trước khi mở barrier.',
            type: 'error',
            confirmText: 'Kiểm tra lại'
          });
        } else {
          alert(`Không tìm thấy mã vé "${plate}" đang gửi trong bãi!`);
        }
        return false;
      }

      const resolvedVtype = chk.vehicle_type || vehicleType || 'Ô tô';
      state.currentCheckout.plate = chk.plate_number || plate;
      state.currentCheckout.type = resolvedVtype;
      state.currentCheckout.sessionId = chk.session_id || null;
      state.currentCheckout.sessionCode = chk.session_code || null;
      state.currentCheckout.checkinTime = chk.checkin_time || 'Không xác định';
      state.currentCheckout.checkoutTime = chk.checkout_time || formatDateTime();
      state.currentCheckout.duration = chk.duration_display || '--';
      state.currentCheckout.durationMinutes = chk.duration_minutes || 0;
      state.currentCheckout.feeType = chk.fee_type || 'Ban ngày';
      state.currentCheckout.feeAmount = chk.fee_amount || 0;
      state.currentCheckout.feeDisplay = chk.fee_display || '0 VNĐ';
      state.currentCheckout.feeDisplayTable = chk.fee_display_table || '0 đ';
      state.currentCheckout.isProcessed = false;

      if (resultPlateText) resultPlateText.textContent = state.currentCheckout.plate;
      if (plateManualInput) plateManualInput.value = state.currentCheckout.plate;
      renderVehicleType(resolvedVtype);

      if (timeInText) timeInText.textContent = state.currentCheckout.checkinTime;
      if (timeOutText) timeOutText.textContent = state.currentCheckout.checkoutTime;
      if (durationText) durationText.textContent = state.currentCheckout.duration;
      if (feeTypeText) feeTypeText.textContent = state.currentCheckout.feeType;
      if (feeAmountText) feeAmountText.textContent = state.currentCheckout.feeDisplay;

      if (feeStatusBadge) {
        feeStatusBadge.className = 'fee-status-badge unpaid';
        feeStatusBadge.innerHTML = '<i class="fa-solid fa-clock"></i> <span>Chờ thanh toán</span>';
      }
      if (checkoutSuccessBanner) checkoutSuccessBanner.style.display = 'none';
      if (licensePlateCard) licensePlateCard.classList.remove('warning-mode', 'error-mode');
      if (manualEntryHint) manualEntryHint.style.display = 'none';

      // Hiển thị ảnh đối soát lúc vào nếu là Xe đạp / Xe điện (hoặc có checkin_image_url)
      const checkinPhotoPath = chk.checkin_image_url || chk.checkin_crop_url;
      if (data.matched && checkinPhotoPath) {
        const photoSrc = checkinPhotoPath.startsWith('http') ? checkinPhotoPath : `${apiBase}${checkinPhotoPath}`;
        if (resolvedVtype === 'Xe đạp / Xe điện') {
          if (annotatedPreviewImg) {
            annotatedPreviewImg.src = `${photoSrc}?t=${Date.now()}`;
            annotatedPreviewImg.style.display = 'block';
          }
          if (emptyAnnotatedPlaceholder) emptyAnnotatedPlaceholder.style.display = 'none';
          const tagSpan = document.querySelector('#viewportAnnotatedBox .viewport-tag span');
          if (tagSpan) tagSpan.textContent = 'ẢNH XE LÚC VÀO (ĐỐI CHIẾU)';
          if (cropPlaceholder) {
            cropPlaceholder.innerHTML = `<img src="${photoSrc}?t=${Date.now()}" alt="Ảnh xe đạp lúc vào">`;
          }
          if (cropDimsText) cropDimsText.textContent = 'Ảnh xe lúc vào';
          if (fileStatusText) {
            fileStatusText.textContent = `Đã đối soát vé ${state.currentCheckout.plate} — Vui lòng kiểm tra khớp ảnh xe lúc vào`;
          }
        }
      }

      if (aiStatusPill) {
        if (data.matched) {
          aiStatusPill.className = 'badge-status-pill success';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Đối soát khớp</span>';
        } else {
          aiStatusPill.className = 'badge-status-pill warning';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Xe vãng lai</span>';
        }
      }
      return data.matched;
    } catch (err) {
      console.warn('Không thể đối soát lại lượt gửi:', err);
      return false;
    }
  }

  if (btnToggleEditPlate) {
    btnToggleEditPlate.addEventListener('click', () => toggleManualEdit());
  }

  // Nút xóa trắng ký tự trong ô sửa biển số ra
  if (btnClearPlateInput) {
    btnClearPlateInput.addEventListener('click', () => {
      if (plateManualInput) {
        plateManualInput.value = '';
        plateManualInput.focus();
      }
    });
  }

  if (resultPlateText) {
    resultPlateText.addEventListener('click', () => toggleManualEdit(true, true));
  }

  let lookupDebounceTimer = null;

  if (plateManualInput) {
    plateManualInput.addEventListener('input', (e) => {
      const val = normalizePlateSpacing(e.target.value.toUpperCase());
      e.target.value = val;
      if (resultPlateText) resultPlateText.textContent = val || '---';
      if (!state.currentCheckout) {
        state.currentCheckout = {
          plate: val,
          type: 'Ô tô',
          isProcessed: false
        };
      } else {
        state.currentCheckout.plate = val;
      }

      // Kiểm tra hợp lệ thời gian thực khi nhân viên đang gõ ở Checkout
      if (val.length >= 3) {
        const detectedVtype = /^\d{6}$/.test(val.trim())
          ? 'Xe đạp / Xe điện'
          : (state.currentCheckout?.type === 'Xe đạp / Xe điện' ? 'Ô tô' : determineVehicleType(null, val));
        const check = validateVietnamesePlate(val, detectedVtype);
        const hintIcon = manualEntryHint ? manualEntryHint.querySelector('i') : null;
        if (!check.valid) {
          if (manualEntryHint && manualEntryHintText) {
            manualEntryHint.className = 'manual-entry-hint danger';
            manualEntryHint.style.display = 'flex';
            if (hintIcon) hintIcon.className = 'fa-solid fa-circle-exclamation';
            manualEntryHintText.textContent = check.message;
          }
          if (licensePlateCard) licensePlateCard.classList.add('error-mode');
        } else {
          if (manualEntryHint && manualEntryHintText) {
            manualEntryHint.className = 'manual-entry-hint valid';
            manualEntryHint.style.display = 'flex';
            if (hintIcon) hintIcon.className = 'fa-solid fa-circle-check';
            manualEntryHintText.textContent = detectedVtype === 'Xe đạp / Xe điện'
              ? `Mã vé 6 số (${val}) — Đang tự động đối soát ảnh xe vào...`
              : `Biển số hợp lệ (${val}) — Sẵn sàng tính phí và mở barrier.`;
          }
          if (licensePlateCard) licensePlateCard.classList.remove('error-mode');

          // Tự động tra cứu lại thông tin xe đang đỗ & tiền phí khi nhập xong biển số / mã vé 6 số hợp lệ
          state.currentCheckout.type = detectedVtype;
          renderVehicleType(detectedVtype);
          clearTimeout(lookupDebounceTimer);
          lookupDebounceTimer = setTimeout(() => {
            lookupCheckoutByPlate(val, detectedVtype === 'Xe đạp / Xe điện' ? null : detectedVtype);
          }, 300);
        }
      } else {
        const hintIcon = manualEntryHint ? manualEntryHint.querySelector('i') : null;
        if (licensePlateCard) licensePlateCard.classList.remove('error-mode');
        if (manualEntryHint && (manualEntryHint.classList.contains('danger') || manualEntryHint.classList.contains('valid'))) {
          manualEntryHint.className = 'manual-entry-hint';
          if (hintIcon) hintIcon.className = 'fa-solid fa-circle-exclamation';
          if (manualEntryHintText) manualEntryHintText.textContent = 'Nhập đúng biển số theo quy chuẩn Việt Nam (VD: 51F-866.88)';
        }
      }
    });

    plateManualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        toggleManualEdit(false);
      }
    });
  }

  // Đổi loại phương tiện qua lại giữa Ô tô và Xe máy
  function renderVehicleType(type) {
    if (!vehicleTypeText) return;
    if (type === 'Xe đạp / Xe điện') {
      vehicleTypeText.innerHTML = '<i class="fa-solid fa-bicycle" style="color:#6d28d9; margin-right:4px;"></i> Xe đạp / Xe điện';
      return;
    }
    const isMoto = (type === 'Xe máy');
    const icon = isMoto 
      ? '<i class="fa-solid fa-motorcycle" style="color:#10b981; margin-right:4px;"></i>' 
      : '<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i>';
    vehicleTypeText.innerHTML = `${icon} ${type}`;
  }

  if (btnSwitchVehicleType) {
    btnSwitchVehicleType.addEventListener('click', () => {
      const current = state.currentCheckout?.type || 'Ô tô';
      const nextType = (current === 'Ô tô') ? 'Xe máy' : 'Ô tô';
      state.currentCheckout.type = nextType;
      renderVehicleType(nextType);

      if (state.currentCheckout.plate && state.currentCheckout.plate !== '---') {
        lookupCheckoutByPlate(state.currentCheckout.plate, nextType);
      } else {
        const baseFee = (nextType === 'Ô tô') ? 25000 : 5000;
        state.currentCheckout.feeAmount = baseFee;
        state.currentCheckout.feeDisplay = `${formatPrice(baseFee)} VNĐ`;
        state.currentCheckout.feeDisplayTable = `${formatPrice(baseFee)} đ`;
        if (feeAmountText) feeAmountText.textContent = state.currentCheckout.feeDisplay;
      }
    });
  }

  // ==========================================================================
  // XỬ LÝ WEBCAM CAMERA CỔNG RA (HỖ TRỢ LẬT GƯƠNG & CHỤP ĐỐI SOÁT)
  // ==========================================================================

  function applyWebcamMirror() {
    if (!webcamVideo) return;
    if (isWebcamFlipped) {
      webcamVideo.style.transform = 'scaleX(-1)';
      if (btnFlipWebcam) {
        btnFlipWebcam.classList.add('active');
        btnFlipWebcam.style.backgroundColor = '#eff6ff';
        btnFlipWebcam.style.borderColor = '#93c5fd';
        btnFlipWebcam.innerHTML = '<i class="fa-solid fa-arrows-left-right" style="color: #2563eb;"></i> <span>Đã lật gương</span>';
      }
    } else {
      webcamVideo.style.transform = 'scaleX(1)';
      if (btnFlipWebcam) {
        btnFlipWebcam.classList.remove('active');
        btnFlipWebcam.style.backgroundColor = '';
        btnFlipWebcam.style.borderColor = '';
        btnFlipWebcam.innerHTML = '<i class="fa-solid fa-arrows-left-right" style="color: #6366f1;"></i> <span>Lật gương</span>';
      }
    }
  }

  if (btnFlipWebcam) {
    btnFlipWebcam.addEventListener('click', () => {
      isWebcamFlipped = !isWebcamFlipped;
      applyWebcamMirror();
    });
  }

  async function startWebcam() {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      if (webcamVideo) {
        webcamVideo.srcObject = webcamStream;
        webcamVideo.style.display = 'block';
        applyWebcamMirror();
      }
      if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
      if (vehiclePreviewImg) vehiclePreviewImg.style.display = 'none';
      if (webcamLiveControls) webcamLiveControls.style.display = 'flex';
      if (webcamBtnText) webcamBtnText.textContent = 'Tắt Camera';
      if (camStatusDot) camStatusDot.style.backgroundColor = '#10b981';
      if (camStatusText) camStatusText.textContent = 'CAM 02 -- CỔNG RA (LIVE)';
      if (fileStatusText) fileStatusText.textContent = 'Camera đang bật — Bấm Nhận diện';
      if (state.currentCheckout && state.currentCheckout.type === 'Xe đạp / Xe điện') {
        state.currentCheckout.originalImageUrl = null;
      }
    } catch (err) {
      console.error('Không thể truy cập Camera:', err);
      if (window.showAppAlert) {
        await window.showAppAlert({
          title: 'KHÔNG THỂ MỞ CAMERA',
          message: 'Không thể mở camera cổng ra. Vui lòng cấp quyền truy cập webcam trên trình duyệt.',
          type: 'warning'
        });
      } else {
        alert('Không thể mở camera. Vui lòng cấp quyền truy cập webcam trên trình duyệt.');
      }
    }
  }

  function stopWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    if (webcamVideo) {
      webcamVideo.style.display = 'none';
      webcamVideo.srcObject = null;
    }
    if (webcamLiveControls) webcamLiveControls.style.display = 'none';
    if (webcamBtnText) webcamBtnText.textContent = 'Mở Camera';
    if (btnCaptureWebcam) btnCaptureWebcam.style.display = 'none';
    if (btnFlipWebcam) btnFlipWebcam.style.display = 'none';
    if (camStatusDot) camStatusDot.style.backgroundColor = '#ef4444';
    if (camStatusText) camStatusText.textContent = 'CAM 02 -- CỔNG RA';
  }

  if (btnToggleWebcam) {
    btnToggleWebcam.addEventListener('click', () => {
      if (webcamStream) {
        stopWebcam();
        if (state.currentImageFile) {
          if (vehiclePreviewImg) vehiclePreviewImg.style.display = 'block';
        } else {
          if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'flex';
        }
      } else {
        startWebcam();
      }
    });
  }

  // Chụp ảnh từ luồng webcam thời gian thực
  async function captureWebcamSnapshot() {
    if (!webcamVideo || !captureCanvas || !webcamStream) return null;
    const videoW = webcamVideo.videoWidth || 640;
    const videoH = webcamVideo.videoHeight || 480;
    captureCanvas.width = videoW;
    captureCanvas.height = videoH;
    const ctx = captureCanvas.getContext('2d');

    if (isWebcamFlipped) {
      ctx.translate(videoW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(webcamVideo, 0, 0, videoW, videoH);

    const blob = await new Promise(resolve => captureCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) return null;

    const file = new File([blob], `cam_out_${Date.now()}.jpg`, { type: 'image/jpeg' });
    state.currentImageFile = file;

    const previewUrl = URL.createObjectURL(blob);
    if (vehiclePreviewImg) {
      vehiclePreviewImg.src = previewUrl;
      vehiclePreviewImg.style.display = 'block';
    }
    if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
    if (fileStatusText) fileStatusText.textContent = `Đã chụp ảnh xe ra (${(file.size / 1024).toFixed(1)} KB)`;

    return file;
  }

  // ==========================================================================
  // TẢI ẢNH TỪ MÁY TÍNH
  // ==========================================================================

  if (btnSelectImage && fileInputVehicle) {
    btnSelectImage.addEventListener('click', () => fileInputVehicle.click());
    fileInputVehicle.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      stopWebcam();
      state.currentImageFile = file;
      const url = URL.createObjectURL(file);
      if (vehiclePreviewImg) {
        vehiclePreviewImg.src = url;
        vehiclePreviewImg.style.display = 'block';
      }
      if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
      if (fileStatusText) {
        fileStatusText.textContent = `Đã chọn: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
      }

      // Xóa kết quả annotated cũ nếu có (giữ nguyên ảnh đối chiếu lúc vào nếu đang xử lý vé xe đạp / xe điện)
      if (state.currentCheckout && state.currentCheckout.type === 'Xe đạp / Xe điện' && state.currentCheckout.sessionId && !state.currentCheckout.isProcessed) {
        state.currentCheckout.originalImageUrl = null;
      } else {
        if (annotatedPreviewImg) annotatedPreviewImg.style.display = 'none';
        if (emptyAnnotatedPlaceholder) emptyAnnotatedPlaceholder.style.display = 'flex';
      }
    });
  }

  // Chụp từ webcam đang mở (nếu có) và upload ảnh lúc ra cho Xe đạp / Xe điện
  async function captureAndUploadBikeExitPhoto() {
    if (webcamStream && (!state.currentImageFile || (webcamVideo && webcamVideo.style.display !== 'none'))) {
      const snap = await captureWebcamSnapshot();
      stopWebcam();
      if (!snap) return null;
    }

    if (!state.currentImageFile) return null;

    const formData = new FormData();
    formData.append('file', state.currentImageFile);
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/api/checkout/upload-bike-photo`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Không thể lưu ảnh xe đạp lúc ra.');
    }
    const data = await res.json();
    return data.checkout_image_url || null;
  }

  if (emptyViewportPlaceholder) {
    emptyViewportPlaceholder.addEventListener('click', () => {
      if (fileInputVehicle) fileInputVehicle.click();
    });
  }

  // ==========================================================================
  // GỌI API NHẬN DIỆN & TỰ ĐỘNG ĐỐI SOÁT LƯỢT GỬI (POST /api/checkout/recognize)
  // ==========================================================================

  async function executeCheckoutRecognition() {
    // Nếu đang bật webcam và chưa có ảnh tĩnh, chụp ngay từ webcam
    if (webcamStream && (!state.currentImageFile || webcamVideo.style.display !== 'none')) {
      const snap = await captureWebcamSnapshot();
      stopWebcam();
      if (!snap) {
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'LỖI CHỤP ẢNH',
            message: 'Không thể chụp ảnh từ Camera. Vui lòng thử lại!',
            type: 'warning'
          });
        } else {
          alert('Không thể chụp ảnh từ Camera. Vui lòng thử lại!');
        }
        return;
      }
    }

    if (!state.currentImageFile) {
      if (window.showAppAlert) {
        await window.showAppAlert({
          title: 'CHƯA CÓ ẢNH XE RA',
          message: 'Vui lòng chọn ảnh xe ra từ máy tính hoặc bật Camera để chụp trước khi nhận diện!',
          type: 'warning'
        });
      } else {
        alert('Vui lòng chọn ảnh xe ra hoặc bật Camera để chụp trước khi nhận diện!');
      }
      return;
    }

    // Hiển thị trạng thái đang xử lý
    btnRecognize.disabled = true;
    btnRecognize.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý AI...</span>';
    if (aiStatusPill) {
      aiStatusPill.className = 'badge-status-pill warning';
      aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Đang nhận diện...</span>';
    }

    const formData = new FormData();
    formData.append('file', state.currentImageFile);
    formData.append('image', state.currentImageFile);
    formData.append('use_preprocess', 'true');

    try {
      const apiBase = getApiBase();
      const response = await fetch(`${apiBase}/api/checkout/recognize`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Máy chủ báo lỗi: ${response.status}`);
      }

      const res = await response.json();
      console.log('Kết quả nhận diện xe ra:', res);

      if (!res.success && res.status === 'not_detected') {
        if (aiStatusPill) {
          aiStatusPill.className = 'badge-status-pill error';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Không thấy biển số</span>';
        }
        toggleManualEdit(true, true);
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'KHÔNG PHÁT HIỆN BIỂN SỐ',
            message: res.message || 'Không phát hiện thấy biển số xe tại cổng ra! Bạn có thể chụp lại góc rõ hơn hoặc nhập tay biển số để tính phí.',
            type: 'warning',
            confirmText: 'Nhập tay ngay'
          });
        } else {
          alert(res.message || 'Không phát hiện thấy biển số xe!');
        }
        return;
      }

      // Cập nhật Cột 2: Ảnh khoanh vùng biển số (YOLO Annotated)
      if (res.annotated_image_url && annotatedPreviewImg) {
        const annSrc = res.annotated_image_url.startsWith('http') ? res.annotated_image_url : `${apiBase}${res.annotated_image_url}`;
        annotatedPreviewImg.src = `${annSrc}?t=${Date.now()}`;
        annotatedPreviewImg.style.display = 'block';
        if (emptyAnnotatedPlaceholder) emptyAnnotatedPlaceholder.style.display = 'none';
      }

      // Cập nhật Cột 3: Ảnh cắt Crop
      if (res.crop_image_url && cropPlaceholder) {
        const cropSrc = res.crop_image_url.startsWith('http') ? res.crop_image_url : `${apiBase}${res.crop_image_url}`;
        cropPlaceholder.innerHTML = `<img src="${cropSrc}?t=${Date.now()}" alt="Biển số cắt ra">`;
      }

      // Chuẩn hóa biển số
      const cleanedPlate = normalizePlateSpacing(res.plate || '---');
      if (resultPlateText) resultPlateText.textContent = cleanedPlate;
      if (plateManualInput) plateManualInput.value = cleanedPlate;

      // Độ tin cậy & Cảnh báo nhập tay
      const confNum = parseFloat(res.confidence) || 0;
      if (confNum < 90.0) {
        if (manualEntryHint) {
          manualEntryHint.style.display = 'flex';
          if (manualEntryHintText) {
            manualEntryHintText.textContent = `Độ tin cậy OCR ${confNum.toFixed(1)}% (< 90%) — Vui lòng kiểm tra lại`;
          }
        }
        if (licensePlateCard) licensePlateCard.classList.add('warning-mode');
        if (btnSwitchVehicleType) btnSwitchVehicleType.style.display = 'inline-flex';
      } else {
        if (manualEntryHint) manualEntryHint.style.display = 'none';
        if (licensePlateCard) licensePlateCard.classList.remove('warning-mode');
        if (btnSwitchVehicleType) btnSwitchVehicleType.style.display = 'inline-flex';
      }

      // Phân loại phương tiện
      const finalVtype = determineVehicleType(res.vehicle_type, cleanedPlate);
      renderVehicleType(finalVtype);

      // Thông tin đối soát lượt gửi
      const chk = res.checkin_info || {};
      const checkinTimeFormatted = chk.checkin_time || '--:--:-- - --/--/----';
      const checkoutTimeFormatted = chk.checkout_time || formatDateTime();
      const durationDisplay = chk.duration_display || '--';
      const feeTypeDisplay = chk.fee_type || 'Ban ngày';
      const feeAmount = chk.fee_amount || (finalVtype === 'Ô tô' ? 25000 : 5000);
      const feeDisplay = chk.fee_display || `${formatPrice(feeAmount)} VNĐ`;
      const feeDisplayTable = chk.fee_display_table || `${formatPrice(feeAmount)} đ`;

      if (timeInText) timeInText.textContent = checkinTimeFormatted;
      if (timeOutText) timeOutText.textContent = checkoutTimeFormatted;
      if (durationText) durationText.textContent = durationDisplay;
      if (feeTypeText) feeTypeText.textContent = feeTypeDisplay;
      if (feeAmountText) feeAmountText.textContent = feeDisplay;

      // Cập nhật trạng thái thanh toán
      if (feeStatusBadge) {
        feeStatusBadge.className = 'fee-status-badge unpaid';
        feeStatusBadge.innerHTML = '<i class="fa-solid fa-clock"></i> <span>Chờ thanh toán</span>';
      }

      // Lưu vào state để chuẩn bị xác nhận Checkout
      state.currentCheckout = {
        sessionId: chk.session_id,
        sessionCode: chk.session_code,
        plate: cleanedPlate,
        type: finalVtype,
        checkinTime: checkinTimeFormatted,
        checkoutTime: checkoutTimeFormatted,
        duration: durationDisplay,
        durationMinutes: chk.duration_minutes || 0,
        feeType: feeTypeDisplay,
        feeAmount: feeAmount,
        feeDisplay: feeDisplay,
        feeDisplayTable: feeDisplayTable,
        cropImageUrl: res.crop_image_url,
        originalImageUrl: res.original_image_url,
        annotatedImageUrl: res.annotated_image_url,
        isProcessed: false
      };

      // Tự động bật sửa tay nếu độ tin cậy OCR thấp
      if (confNum < 90.0) {
        toggleManualEdit(true, true);
      }

      // Đổi badge trạng thái thành công
      if (aiStatusPill) {
        if (res.matched) {
          aiStatusPill.className = 'badge-status-pill success';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Đối soát khớp</span>';
        } else {
          aiStatusPill.className = 'badge-status-pill warning';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Xe vãng lai</span>';
        }
      }

      // Ẩn banner thành công cũ nếu đang hiển thị
      if (checkoutSuccessBanner) checkoutSuccessBanner.style.display = 'none';

    } catch (err) {
      console.error('Lỗi khi gọi API Check-out recognize:', err);
      if (aiStatusPill) {
        aiStatusPill.className = 'badge-status-pill error';
        aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Lỗi kết nối</span>';
      }
      toggleManualEdit(true, true);
      if (window.showAppAlert) {
        await window.showAppAlert({
          title: 'NHẬN DIỆN THẤT BẠI',
          message: `${err.message}`,
          hint: 'Hệ thống đã tự động mở chế độ nhập tay biển số để bạn xử lý cho xe ra.',
          type: 'error',
          confirmText: 'Nhập tay ngay'
        });
      } else {
        alert(`Nhận diện thất bại: ${err.message}`);
      }
    } finally {
      btnRecognize.disabled = false;
      btnRecognize.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Nhận diện biển số ra</span>';
    }
  }

  if (btnRecognize) {
    btnRecognize.addEventListener('click', executeCheckoutRecognition);
  }

  // Nút Tra cứu vé 6 số (dành cho Xe đạp / Xe điện không biển số)
  if (btnLookupBikeTicket) {
    btnLookupBikeTicket.addEventListener('click', async () => {
      let code = null;
      if (window.showAppPrompt) {
        code = await window.showAppPrompt({
          title: 'Tra cứu vé xe đạp / xe điện',
          subtitle: 'Nhập đúng 6 chữ số trên phiếu gửi xe có dấu mộc đỏ của khách:',
          defaultValue: '',
          placeholder: 'VD: 482915',
          validateFn: (val) => {
            const clean = val.trim();
            if (!/^\d{6}$/.test(clean)) {
              return { valid: false, reason: 'Mã vé phải gồm đúng 6 chữ số (VD: 482915).' };
            }
            return { valid: true, clean };
          }
        });
      } else {
        code = prompt('Nhập mã vé 6 chữ số trên phiếu gửi xe:');
      }

      if (!code) return;
      const cleanCode = code.trim();
      if (!/^\d{6}$/.test(cleanCode)) return;

      btnLookupBikeTicket.disabled = true;
      btnLookupBikeTicket.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang tra cứu...</span>';
      try {
        const matched = await lookupCheckoutByPlate(cleanCode, 'Xe đạp / Xe điện', true);
        if (matched && state.currentCheckout) {
          state.currentCheckout.originalImageUrl = null;
          const hasCamOrFile = Boolean(webcamStream || state.currentImageFile);
          if (hasCamOrFile) {
            const exitImgUrl = await captureAndUploadBikeExitPhoto();
            if (exitImgUrl) {
              state.currentCheckout.originalImageUrl = exitImgUrl;
            }
          } else if (fileStatusText) {
            fileStatusText.textContent = `Đã đối soát vé ${cleanCode} — Hãy mở Camera hoặc chọn ảnh xe ra`;
          }
        }
      } catch (err) {
        console.warn('Lỗi chụp/lưu ảnh xe đạp lúc ra khi tra cứu:', err);
      } finally {
        btnLookupBikeTicket.disabled = false;
        btnLookupBikeTicket.innerHTML = '<i class="fa-solid fa-bicycle"></i> <span>Tra cứu vé xe đạp (6 số)</span>';
      }
    });
  }

  // ==========================================================================
  // XÁC NHẬN XE RA BÃI & MỞ BARRIER (POST /api/checkout/confirm)
  // ==========================================================================

  if (btnConfirmCheckout) {
    btnConfirmCheckout.addEventListener('click', async () => {
      // 1. Đồng bộ biển số từ ô nhập tay nếu đang mở
      let currentPlate = '';
      if (isManualEditMode && plateManualInput) {
        currentPlate = normalizePlateSpacing(plateManualInput.value.trim().toUpperCase());
        toggleManualEdit(false);
      } else if (state.currentCheckout && state.currentCheckout.plate) {
        currentPlate = state.currentCheckout.plate.trim().toUpperCase();
      }

      // 2. KIỂM TRA HỢP LỆ BIỂN SỐ XE (HOẶC MÃ VÉ 6 SỐ) TRƯỚC KHI TÍNH PHÍ & MỞ BARRIER
      const currentVtype = state.currentCheckout?.type || determineVehicleType(null, currentPlate);
      const valCheck = validateVietnamesePlate(currentPlate, currentVtype);
      if (!valCheck.valid) {
        const hintIcon = manualEntryHint ? manualEntryHint.querySelector('i') : null;
        if (manualEntryHint && manualEntryHintText) {
          manualEntryHint.className = 'manual-entry-hint danger';
          manualEntryHint.style.display = 'flex';
          if (hintIcon) hintIcon.className = 'fa-solid fa-circle-exclamation';
          manualEntryHintText.textContent = valCheck.message;
        }
        if (licensePlateCard) {
          licensePlateCard.className = 'license-plate-card error-mode';
        }
        toggleManualEdit(true, true);
        if (plateManualInput) {
          plateManualInput.focus();
          plateManualInput.select();
        }

        if (window.showAppAlert) {
          await window.showAppAlert({
            title: currentVtype === 'Xe đạp / Xe điện' ? 'Mã vé 6 số không hợp lệ' : 'Biển số xe ra không hợp lệ',
            message: valCheck.message,
            hint: currentVtype === 'Xe đạp / Xe điện'
              ? 'Mã vé xe đạp / xe điện phải gồm đúng 6 chữ số (VD: 482915).'
              : 'Hệ thống tạm khóa mở barrier cổng ra để tránh sai lệch đối soát. Định dạng chuẩn: 51F-866.88 (ô tô) hoặc 59P1-998.23 (xe máy).',
            type: 'error',
            confirmText: 'Nhập lại'
          });
        } else {
          alert(`Không hợp lệ: ${valCheck.message}`);
        }
        return; // CHẶN LẠI HOÀN TOÀN
      }

      // Đã hợp lệ -> Xóa bỏ trạng thái lỗi nếu có
      if (licensePlateCard) licensePlateCard.classList.remove('error-mode');
      if (manualEntryHint && manualEntryHint.classList.contains('danger')) {
        manualEntryHint.style.display = 'none';
      }

      const chk = state.currentCheckout;
      if (!chk) {
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'CHƯA NHẬN DIỆN XE RA',
            message: 'Vui lòng nhận diện biển số xe ra trước khi ghi nhận mở barrier.',
            type: 'warning'
          });
        } else {
          alert('Vui lòng nhận diện biển số xe ra trước khi ghi nhận mở barrier!');
        }
        return;
      }
      chk.plate = currentPlate;

      if (chk.isProcessed) {
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'LƯỢT XE ĐÃ XỬ LÝ',
            message: 'Lượt gửi này đã được ghi nhận hoàn tất trước đó.',
            type: 'info'
          });
        } else {
          alert('Lượt gửi này đã được ghi nhận hoàn tất!');
        }
        return;
      }

      // Đảm bảo xe đạp / xe điện có ảnh lúc ra để lưu đầy đủ cả ảnh vào & ra trong Lịch sử
      if (chk.type === 'Xe đạp / Xe điện' && !chk.originalImageUrl) {
        try {
          if (webcamStream || state.currentImageFile) {
            btnConfirmCheckout.disabled = true;
            btnConfirmCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang lưu ảnh xe ra...</span>';
            const uploadedUrl = await captureAndUploadBikeExitPhoto();
            if (uploadedUrl) {
              chk.originalImageUrl = uploadedUrl;
            }
          }
        } catch (err) {
          btnConfirmCheckout.disabled = false;
          btnConfirmCheckout.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Ghi nhận xe ra bãi (Mở Barrier)</span>';
          if (window.showAppAlert) {
            await window.showAppAlert({
              title: 'LỖI LƯU ẢNH XE ĐẠP LÚC RA',
              message: err.message,
              type: 'error'
            });
          } else {
            alert(err.message);
          }
          return;
        }

        if (!chk.originalImageUrl) {
          btnConfirmCheckout.disabled = false;
          btnConfirmCheckout.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Ghi nhận xe ra bãi (Mở Barrier)</span>';
          if (window.showAppAlert) {
            await window.showAppAlert({
              title: 'Chưa có ảnh xe đạp lúc ra',
              message: 'Vui lòng mở Camera hoặc chọn ảnh chiếc xe đạp / xe điện lúc ra bãi trước khi xác nhận mở barrier.',
              hint: 'Hệ thống sẽ lưu cả ảnh lúc vào và ảnh lúc ra để đối soát đầy đủ trong mục Lịch sử vào ra.',
              type: 'warning',
              confirmText: 'Đã hiểu'
            });
          } else {
            alert('Vui lòng chụp hoặc chọn ảnh xe đạp / xe điện lúc ra trước khi mở barrier!');
          }
          return;
        }
      }

      btnConfirmCheckout.disabled = true;
      btnConfirmCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang mở barrier...</span>';

      try {
        const staffName = window.getCurrentStaffName ? window.getCurrentStaffName() : 'Trần Bảo Anh';
        const payload = {
          session_id: chk.sessionId,
          plate_number: chk.plate,
          vehicle_type: chk.type,
          checkout_image_url: chk.originalImageUrl || null,
          checkout_crop_url: chk.cropImageUrl,
          total_fee: chk.feeAmount,
          payment_status: 'PAID',
          staff_checkout: staffName
        };

        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/checkout/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Máy chủ báo lỗi: ${res.status}`);
        }

        const data = await res.json();
        console.log('Ghi nhận Checkout thành công:', data);

        chk.isProcessed = true;

        // Đồng bộ lại tiền phí thực tế Backend đã tính toán từ DB
        const finalFeeTable = data.session?.fee_display_table || chk.feeDisplayTable;
        if (data.session?.total_fee !== undefined && feeAmountText) {
          feeAmountText.textContent = `${formatPrice(data.session.total_fee)} VNĐ`;
        }

        // Cập nhật trạng thái thanh toán trên thẻ phí
        if (feeStatusBadge) {
          feeStatusBadge.className = 'fee-status-badge paid';
          feeStatusBadge.innerHTML = '<i class="fa-solid fa-check"></i> <span>Đã thu phí</span>';
        }

        // Cập nhật thẻ sức chứa bãi xe từ DB
        if (data.stats) {
          updateCapacityDisplay(data.stats.total_capacity, data.stats.current_count);
        }

        // Hiện banner mở barrier thành công
        if (checkoutSuccessBanner) {
          checkoutSuccessBanner.style.display = 'flex';
          checkoutSuccessBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Thêm vào đầu bảng Lịch sử xe ra gần đây
        const newRecord = {
          plate: chk.plate,
          type: chk.type,
          time: data.session?.checkout_time || chk.checkoutTime,
          fee: finalFeeTable,
          status: 'Hoàn tất & Đã mở barrier'
        };
        state.checkoutHistory.unshift(newRecord);
        renderHistoryTable();

        if (window.showAppToast) {
          window.showAppToast({
            title: 'Xuất bãi thành công!',
            message: `Xe ${currentPlate} đã hoàn tất thủ tục và mở barrier.`,
            type: 'success'
          });
        }

      } catch (err) {
        console.error('Lỗi khi ghi nhận xe ra:', err);
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'GHI NHẬN XE RA THẤT BẠI',
            message: err.message,
            type: 'error'
          });
        } else {
          alert(`Ghi nhận xe ra thất bại: ${err.message}`);
        }
      } finally {
        btnConfirmCheckout.disabled = false;
        btnConfirmCheckout.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Ghi nhận xe ra bãi (Mở Barrier)</span>';
      }
    });
  }

  // ==========================================================================
  // RENDER BẢNG LƯỢT XE RA GẦN ĐÂY
  // ==========================================================================

  function renderHistoryTable() {
    if (!historyTableBody) return;
    historyTableBody.innerHTML = '';

    const records = state.checkoutHistory.slice(0, 5); // Tối đa 5 bản ghi mới nhất
    if (records.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">
            <i class="fa-solid fa-inbox" style="font-size: 20px; margin-bottom: 6px; display: block;"></i>
            Chưa có lượt xe ra nào được ghi nhận trong ca làm việc này
          </td>
        </tr>
      `;
      return;
    }

    records.forEach(item => {
      const tr = document.createElement('tr');
      const isBike = (item.type === 'Xe đạp / Xe điện');
      const isCar = (item.type === 'Ô tô');
      const typeBadgeClass = isBike ? 'moto' : (isCar ? 'car' : 'moto');
      const typeIcon = isBike ? 'fa-bicycle' : (isCar ? 'fa-car' : 'fa-motorcycle');

      tr.innerHTML = `
        <td>
          <span class="plate-badge"><i class="fa-solid ${isBike ? 'fa-ticket' : 'fa-id-card'}"></i> ${item.plate}</span>
        </td>
        <td>
          <span class="badge-vtype ${typeBadgeClass}"><i class="fa-solid ${typeIcon}"></i> ${item.type}</span>
        </td>
        <td class="td-time"><i class="fa-regular fa-clock"></i> ${item.time}</td>
        <td class="td-fee">${item.fee}</td>
        <td>
          <span class="status-pill success">
            <span class="status-bullet"></span> ${item.status}
          </span>
        </td>
      `;
      historyTableBody.appendChild(tr);
    });
  }

  // Tải dữ liệu ban đầu từ Backend CSDL thật
  async function loadInitialDatabaseData() {
    if (btnRefreshHistory) {
      btnRefreshHistory.classList.add('spinning');
    }

    try {
      const apiBase = getApiBase();

      // 1. Tải sức chứa bãi xe
      const capRes = await fetch(`${apiBase}/api/checkin/stats`);
      if (capRes.ok) {
        const capData = await capRes.json();
        updateCapacityDisplay(capData.total_capacity, capData.current_count);
      }

      // 2. Tải lịch sử các lượt Checkout gần đây
      const histRes = await fetch(`${apiBase}/api/checkout/history?limit=5`);
      if (histRes.ok) {
        const histData = await histRes.json();
        state.checkoutHistory = histData.map(r => ({
          plate: r.plate,
          type: r.type,
          time: r.time,
          fee: r.fee,
          status: r.status
        }));
        renderHistoryTable();
      }
    } catch (err) {
      console.warn('Không thể nạp dữ liệu ban đầu từ CSDL:', err);
    } finally {
      if (btnRefreshHistory) {
        setTimeout(() => btnRefreshHistory.classList.remove('spinning'), 500);
      }
    }
  }

  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', loadInitialDatabaseData);
  }

  // Dropdown profile
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

  // Khởi chạy nạp dữ liệu lần đầu
  updateCapacityDisplay(500, 0);
  renderHistoryTable();
  loadInitialDatabaseData();
});
