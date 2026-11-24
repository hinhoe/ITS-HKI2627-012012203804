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
  const btnShutterLive = document.getElementById('btnShutterLive');
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
    if (vehicleType === 'Ô tô' || vehicleType === 'Xe máy') return vehicleType;
    if (!plateStr) return 'Ô tô';
    const clean = plateStr.replace(/[\s\-\.]/g, '').toUpperCase();
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

  // Kiểm tra tính hợp lệ của biển số xe theo quy chuẩn Việt Nam
  function validateVietnamesePlate(plateStr) {
    if (!plateStr || typeof plateStr !== 'string') {
      return {
        valid: false,
        message: 'Chưa có biển số xe. Nhân viên vui lòng nhập biển số trước khi xác nhận mở barrier!'
      };
    }
    const clean = plateStr.trim().toUpperCase();
    if (!clean || clean === '---' || clean === 'CHƯA RÕ' || clean === 'CHUA RO' || clean === 'KHÔNG TÌM THẤY') {
      return {
        valid: false,
        message: 'Chưa có biển số xe. Nhân viên vui lòng nhập biển số bằng tay để mở barrier!'
      };
    }

    // Loại bỏ ký tự phân cách khoảng trắng, dấu chấm, gạch ngang
    const stripped = clean.replace(/[\s\.\-_]/g, '');

    // 1. Phải có độ dài từ 6 đến 11 ký tự
    if (stripped.length < 6 || stripped.length > 11) {
      return {
        valid: false,
        message: `Biển số "${clean}" sai độ dài (cần từ 6-10 ký tự, ví dụ: 51F-866.88, 29A-123.45). Vui lòng nhập lại gấp!`
      };
    }

    // 2. Bắt buộc phải có chữ số (chống trường hợp chỉ nhập chữ tùm lum, không có số)
    const digits = stripped.match(/\d/g) || [];
    if (digits.length < 4) {
      return {
        valid: false,
        message: `Biển số "${clean}" KHÔNG HỢP LỆ (thiếu chữ số hoặc chỉ nhập chữ tùm lum)! Biển số xe bắt buộc phải có chữ số (Ví dụ: 51F-866.88, 59S1-123.45). Yêu cầu nhập lại gấp!`
      };
    }

    // 3. Bắt buộc phải có chữ cái seri (chống trường hợp chỉ toàn số)
    const letters = stripped.match(/[A-Z]/g) || [];
    if (letters.length < 1) {
      return {
        valid: false,
        message: `Biển số "${clean}" KHÔNG HỢP LỆ (thiếu ký tự chữ cái seri, ví dụ: 51F, 29A, 59S1). Vui lòng nhập lại!`
      };
    }

    // 4. Kiểm tra cấu trúc chuẩn Việt Nam:
    // Bắt đầu bằng 2 số mã tỉnh (11-99) hoặc 2 chữ cái (quân đội/ngoại giao), theo sau là seri và dãy 4-5 số
    const isVnStandard = /^([1-9]\d|[A-Z]{2})[A-Z0-9]{1,3}\d{4,5}$/.test(stripped);
    if (!isVnStandard) {
      return {
        valid: false,
        message: `Biển số "${clean}" không đúng định dạng quy chuẩn Việt Nam (Ví dụ đúng: 51F-866.88, 29A-123.45, 59S1-123.45). Yêu cầu nhập lại gấp!`
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
        const check = validateVietnamesePlate(val);
        if (!check.valid) {
          if (manualEntryHint && manualEntryHintText) {
            manualEntryHint.className = 'manual-entry-hint danger';
            manualEntryHint.style.display = 'flex';
            manualEntryHintText.textContent = check.message;
          }
          if (licensePlateCard) licensePlateCard.classList.add('error-mode');
        } else {
          if (manualEntryHint && manualEntryHintText) {
            manualEntryHint.className = 'manual-entry-hint';
            manualEntryHint.style.display = 'flex';
            manualEntryHintText.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981; margin-right:4px;"></i> Biển số hợp lệ (${val}) — Sẵn sàng tính phí và mở barrier!`;
          }
          if (licensePlateCard) licensePlateCard.classList.remove('error-mode');
        }
      } else {
        if (licensePlateCard) licensePlateCard.classList.remove('error-mode');
        if (manualEntryHint && manualEntryHint.classList.contains('danger')) {
          manualEntryHint.className = 'manual-entry-hint';
          if (manualEntryHintText) manualEntryHintText.textContent = 'Vui lòng nhập đầy đủ biển số (Ví dụ: 51F-866.88)...';
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

      // Cập nhật lại ước tính giá nếu chưa đối soát
      if (!state.currentCheckout.sessionId) {
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
      if (btnCaptureWebcam) btnCaptureWebcam.style.display = 'inline-flex';
      if (btnFlipWebcam) btnFlipWebcam.style.display = 'inline-flex';
      if (camStatusDot) camStatusDot.style.backgroundColor = '#10b981';
      if (camStatusText) camStatusText.textContent = 'CAM 02 -- CỔNG RA (LIVE)';
      if (fileStatusText) fileStatusText.textContent = 'Đang xem trực tiếp từ camera Cổng Ra';
    } catch (err) {
      console.error('Không thể truy cập Camera:', err);
      alert('Không thể mở camera. Vui lòng cấp quyền truy cập webcam trên trình duyệt.');
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

  if (btnCaptureWebcam) {
    btnCaptureWebcam.addEventListener('click', async () => {
      await captureWebcamSnapshot();
      stopWebcam();
    });
  }

  if (btnShutterLive) {
    btnShutterLive.addEventListener('click', async (e) => {
      e.stopPropagation();
      await captureWebcamSnapshot();
      stopWebcam();
      executeCheckoutRecognition();
    });
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

      // Xóa kết quả annotated cũ nếu có
      if (annotatedPreviewImg) annotatedPreviewImg.style.display = 'none';
      if (emptyAnnotatedPlaceholder) emptyAnnotatedPlaceholder.style.display = 'flex';
    });
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
        alert('Không thể chụp ảnh từ Camera. Vui lòng thử lại!');
        return;
      }
    }

    if (!state.currentImageFile) {
      alert('Vui lòng chọn ảnh xe ra hoặc bật Camera để chụp trước khi nhận diện!');
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
        alert(res.message || 'Không phát hiện thấy biển số xe!');
        if (aiStatusPill) {
          aiStatusPill.className = 'badge-status-pill error';
          aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Không thấy biển số</span>';
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
        annotatedImageUrl: res.annotated_image_url,
        isProcessed: false
      };

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
      alert(`Nhận diện thất bại: ${err.message}`);
      if (aiStatusPill) {
        aiStatusPill.className = 'badge-status-pill error';
        aiStatusPill.innerHTML = '<span class="status-bullet"></span> <span id="aiStatusText">Lỗi kết nối</span>';
      }
    } finally {
      btnRecognize.disabled = false;
      btnRecognize.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Nhận diện biển số ra</span>';
    }
  }

  if (btnRecognize) {
    btnRecognize.addEventListener('click', executeCheckoutRecognition);
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

      // 2. KIỂM TRA HỢP LỆ BIỂN SỐ XE TRƯỚC KHI TÍNH PHÍ & MỞ BARRIER
      const valCheck = validateVietnamesePlate(currentPlate);
      if (!valCheck.valid) {
        if (manualEntryHint && manualEntryHintText) {
          manualEntryHint.className = 'manual-entry-hint danger';
          manualEntryHint.style.display = 'flex';
          manualEntryHintText.textContent = `❌ ${valCheck.message}`;
        }
        if (licensePlateCard) {
          licensePlateCard.className = 'license-plate-card error-mode';
        }
        toggleManualEdit(true, true);
        if (plateManualInput) {
          plateManualInput.focus();
          plateManualInput.select();
        }

        alert(`🚨 YÊU CẦU NHẬP LẠI BIỂN SỐ GẤP!\n\n${valCheck.message}\n\n❌ Hệ thống KHÔNG XÁC NHẬN và KHÔNG MỞ BARRIER khi biển số sai quy chuẩn!`);
        return; // CHẶN LẠI HOÀN TOÀN
      }

      // Đã hợp lệ -> Xóa bỏ trạng thái lỗi nếu có
      if (licensePlateCard) licensePlateCard.classList.remove('error-mode');
      if (manualEntryHint && manualEntryHint.classList.contains('danger')) {
        manualEntryHint.style.display = 'none';
      }

      const chk = state.currentCheckout;
      if (!chk) {
        alert('Vui lòng nhận diện biển số xe ra trước khi ghi nhận mở barrier!');
        return;
      }
      chk.plate = currentPlate;

      if (chk.isProcessed) {
        alert('Lượt gửi này đã được ghi nhận hoàn tất!');
        return;
      }

      btnConfirmCheckout.disabled = true;
      btnConfirmCheckout.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang mở barrier...</span>';

      try {
        const payload = {
          session_id: chk.sessionId,
          plate_number: chk.plate,
          vehicle_type: chk.type,
          checkout_crop_url: chk.cropImageUrl,
          total_fee: chk.feeAmount,
          payment_status: 'PAID',
          staff_checkout: 'Trần Bảo Anh'
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
          time: chk.checkoutTime,
          fee: chk.feeDisplayTable,
          status: 'Hoàn tất & Đã mở barrier'
        };
        state.checkoutHistory.unshift(newRecord);
        renderHistoryTable();

      } catch (err) {
        console.error('Lỗi khi ghi nhận xe ra:', err);
        alert(`Ghi nhận xe ra thất bại: ${err.message}`);
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
      const isCar = (item.type === 'Ô tô');
      const typeBadgeClass = isCar ? 'car' : 'moto';
      const typeIcon = isCar ? 'fa-car' : 'fa-motorcycle';

      tr.innerHTML = `
        <td>
          <span class="plate-badge"><i class="fa-solid fa-id-card"></i> ${item.plate}</span>
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
