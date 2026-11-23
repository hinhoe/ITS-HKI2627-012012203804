// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Nghiệp vụ Ghi nhận xe vào bãi (checkin.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái và dữ liệu
  const state = {
    totalCapacity: 500,
    currentCount: 0,
    mockPlates: [],
    currentIndex: 0,
    // Thông tin nhận diện gần nhất (đang chờ xác nhận ghi nhận vào bãi)
    currentRecognition: null,
    // Danh sách lưu trữ lịch sử lượt xe vào
    historyRecords: []
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
  const btnRecognize = document.getElementById('btnRecognize');
  const btnConfirmCheckin = document.getElementById('btnConfirmCheckin');

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
  
  // Kết quả nhận diện & Chỉ số AI
  const cropPlaceholder = document.getElementById('cropPlaceholder');
  const cropDimsText = document.getElementById('cropDimsText');
  const resultPlateText = document.getElementById('resultPlateText');
  const ocrConfidenceText = document.getElementById('ocrConfidenceText');
  const yoloConfText = document.getElementById('yoloConfText');
  const processingTimeText = document.getElementById('processingTimeText');
  const aiStatusPill = document.getElementById('aiStatusPill');
  const aiStatusText = document.getElementById('aiStatusText');
  const entryTimeText = document.getElementById('entryTimeText');
  const vehicleTypeText = document.getElementById('vehicleTypeText');
  const successBanner = document.getElementById('successBanner');
  const historyTableBody = document.getElementById('historyTableBody');

  // Khung nhập tay biển số & Chuyển đổi loại xe
  const licensePlateCard = document.getElementById('licensePlateCard');
  const plateManualInput = document.getElementById('plateManualInput');
  const btnToggleEditPlate = document.getElementById('btnToggleEditPlate');
  const btnClearPlateInput = document.getElementById('btnClearPlateInput');
  const manualEntryHint = document.getElementById('manualEntryHint');
  const manualEntryHintText = document.getElementById('manualEntryHintText');
  const btnSwitchVehicleType = document.getElementById('btnSwitchVehicleType');
  let isManualEditMode = false;

  // User Dropdown
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Capacity Elements
  const capacityPercent = document.getElementById('capacityPercent');
  const capacityProgressBar = document.getElementById('capacityProgressBar');
  const capacityCount = document.getElementById('capacityCount');
  const capacityAvailable = document.getElementById('capacityAvailable');

  // ==========================================================================
  // HÀM TIỆN ÍCH (HELPER FUNCTIONS)
  // ==========================================================================

  // Chuẩn hóa hiển thị khoảng cách mà KHÔNG dập khuôn:
  // Trên biển số có ký tự gì (chữ, số, '-', '.') thì lấy đúng ký tự đó, không tự ý chèn thêm dấu '.' nếu không có.
  // Loại bỏ dấu chấm ảo (ví dụ 121.6 -> 1216): Biển số 4 số KHÔNG BAO GIỜ có dấu chấm.
  // Bỏ khoảng trống quanh dấu '-' và dấu '.' (ví dụ: '51F-997.80' thay vì '51F - 997 . 80')
  function normalizePlateSpacing(plate) {
    if (!plate || typeof plate !== 'string') return plate;
    let cleaned = plate.trim();
    // 1. Loại bỏ dấu chấm ảo nếu sau dấu chấm chỉ có 1 số duy nhất (.x)
    cleaned = cleaned.replace(/\.(\d)(?!\d)/g, '$1');
    // 2. Loại bỏ dấu chấm nếu đứng cạnh ký tự không phải số
    cleaned = cleaned.replace(/(?<!\d)\.|\.(?!\d)/g, '');
    // 3. Chuẩn hóa khoảng trống quanh '-' và '.'
    cleaned = cleaned.replace(/\s*-\s*/g, '-');
    cleaned = cleaned.replace(/\s*\.\s*/g, '.');
    // 4. Tách khoảng cách dòng 1 và dòng 2 của xe máy nếu dính liền
    cleaned = cleaned.replace(/^([0-9]{2}-[A-Z][A-Z0-9])([0-9]{4,5})$/, '$1 $2');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  }

  // Phân loại loại phương tiện chuẩn: Ô tô hoặc Xe máy
  function determineVehicleType(vehicleType, plateStr) {
    if (vehicleType === 'car') return 'Ô tô';
    if (vehicleType === 'motorbike') return 'Xe máy';
    if (vehicleType === 'Ô tô' || vehicleType === 'Xe máy') return vehicleType;
    if (!plateStr) return 'Ô tô';
    const clean = plateStr.replace(/[\s\-\.]/g, '').toUpperCase();
    // Xe máy Việt Nam: Sê-ri có 2 ký tự (chữ cái + số/chữ cái, ví dụ 59P1, 29B1, 60U1, 59AA, 59MD)
    if (/^[0-9]{2}[A-Z][A-Z0-9]/.test(clean)) {
      return 'Xe máy';
    }
    // Mặc định theo quy chuẩn biển ô tô (ví dụ 51F, 30G, 51LD)
    return 'Ô tô';
  }

  // Bật/tắt chế độ nhập biển số bằng tay khi độ tin cậy thấp hoặc có sự cố
  function toggleManualEdit(enable, focus = true) {
    isManualEditMode = (enable !== undefined) ? enable : !isManualEditMode;

    if (isManualEditMode) {
      if (resultPlateText) resultPlateText.style.display = 'none';
      if (plateManualInput) {
        plateManualInput.style.display = 'block';
        const curVal = state.currentRecognition?.plate;
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
          if (!state.currentRecognition) {
            state.currentRecognition = {
              plate: val,
              type: determineVehicleType(null, val),
              entryTime: formatDateTime(),
              status: 'manual'
            };
          } else {
            state.currentRecognition.plate = val;
            state.currentRecognition.type = determineVehicleType(state.currentRecognition.type, val);
          }
          if (resultPlateText) resultPlateText.textContent = val;
          if (vehicleTypeText) {
            const icon = (state.currentRecognition.type === 'Xe máy') ? '<i class="fa-solid fa-motorcycle" style="color:#2563eb; margin-right:4px;"></i>' : '<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i>';
            vehicleTypeText.innerHTML = `${icon} ${state.currentRecognition.type}`;
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

  // Wire manual plate editing event listeners
  if (btnToggleEditPlate) {
    btnToggleEditPlate.addEventListener('click', () => {
      toggleManualEdit();
    });
  }

  // Nút xóa trắng ký tự trong ô nhập tay
  if (btnClearPlateInput) {
    btnClearPlateInput.addEventListener('click', () => {
      if (plateManualInput) {
        plateManualInput.value = '';
        plateManualInput.focus();
      }
    });
  }

  if (resultPlateText) {
    resultPlateText.addEventListener('click', () => {
      toggleManualEdit(true, true);
    });
  }

  if (plateManualInput) {
    plateManualInput.addEventListener('input', (e) => {
      const val = normalizePlateSpacing(e.target.value.toUpperCase());
      e.target.value = val;
      if (!state.currentRecognition) {
        state.currentRecognition = {
          plate: val,
          type: determineVehicleType(null, val),
          entryTime: formatDateTime(),
          status: 'manual'
        };
      } else {
        state.currentRecognition.plate = val;
        state.currentRecognition.type = determineVehicleType(state.currentRecognition.type, val);
      }
      if (resultPlateText) resultPlateText.textContent = val || '---';
      if (vehicleTypeText) {
        const icon = (state.currentRecognition.type === 'Xe máy') ? '<i class="fa-solid fa-motorcycle" style="color:#2563eb; margin-right:4px;"></i>' : '<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i>';
        vehicleTypeText.innerHTML = `${icon} ${state.currentRecognition.type}`;
      }
    });

    plateManualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        toggleManualEdit(false);
      }
    });
  }

  if (btnSwitchVehicleType) {
    btnSwitchVehicleType.addEventListener('click', () => {
      if (!state.currentRecognition) {
        state.currentRecognition = {
          plate: plateManualInput?.value || '---',
          type: 'Ô tô',
          entryTime: formatDateTime(),
          status: 'manual'
        };
      }
      const nextType = (state.currentRecognition.type === 'Ô tô') ? 'Xe máy' : 'Ô tô';
      state.currentRecognition.type = nextType;
      if (vehicleTypeText) {
        const icon = (nextType === 'Xe máy') ? '<i class="fa-solid fa-motorcycle" style="color:#2563eb; margin-right:4px;"></i>' : '<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i>';
        vehicleTypeText.innerHTML = `${icon} ${nextType}`;
      }
    });
  }

  // Hàm xử lý cắt vùng ảnh biển số kèm Padding an toàn theo tỷ lệ Bounding Box
  function renderLicensePlateCrop(container, imageSrc, plateText) {
    if (!container) return;

    if (imageSrc) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Phân loại tỷ lệ biển số (xe máy 2 dòng hoặc ô tô 1 dòng)
        const isMoto = plateText && (plateText.includes('P1') || (plateText.includes('-') && plateText.split('-')[1]?.length > 4));

        // Kích thước ước tính của Bounding Box từ mô hình AI
        const boxW = img.naturalWidth * 0.36;
        const boxH = isMoto ? boxW * 0.65 : boxW * 0.45;
        const centerX = img.naturalWidth * 0.5;
        const centerY = img.naturalHeight * 0.68;

        // Bổ sung Padding tỷ lệ linh hoạt (35% trên/dưới, 20% trái/phải)
        // Đảm bảo không bao giờ bị cắt mép trên, mép dưới hoặc mất bất kỳ ký tự nào
        const padY = boxH * 0.35;
        const padX = boxW * 0.20;

        const cropX = Math.max(0, centerX - boxW / 2 - padX);
        const cropY = Math.max(0, centerY - boxH / 2 - padY);
        const cropW = Math.min(img.naturalWidth - cropX, boxW + padX * 2);
        const cropH = Math.min(img.naturalHeight - cropY, boxH + padY * 2);

        canvas.width = cropW;
        canvas.height = cropH;

        // Vẽ vùng cắt đầy đủ mép lên canvas
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        container.innerHTML = `<img src="${canvas.toDataURL('image/jpeg', 0.95)}" alt="Ảnh cắt biển số" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:4px;">`;
      };
      img.src = imageSrc;
    } else {
      // Khi chưa có ảnh tải lên: Render mô phỏng biển số tiêu chuẩn rõ nét, căn giữa với lề trên/dưới rộng rãi
      const isMoto = plateText && (plateText.includes('P1') || plateText.length > 9);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 360;
      canvas.height = isMoto ? 220 : 130;

      // Nền biển số
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Viền kim loại & đường bao biển số
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

      // Chữ số biển số ở giữa, căn lề trên dưới rộng rãi, không bị sát viền
      ctx.fillStyle = '#0f172a';
      if (isMoto) {
        // Biển số xe máy 2 dòng
        const parts = (plateText || '59P1-998.23').split('-');
        ctx.font = 'bold 36px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(parts[0] || '59P1', canvas.width / 2, 75);
        ctx.fillText(parts[1] || '998.23', canvas.width / 2, 155);
      } else {
        // Biển số ô tô 1 dòng
        ctx.font = 'bold 38px Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(plateText || '30G-928.31', canvas.width / 2, canvas.height / 2);
      }

      container.innerHTML = `<img src="${canvas.toDataURL()}" alt="Ảnh cắt biển số" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:4px;">`;
    }
  }

  // Định dạng thời gian theo chuẩn: HH:mm:ss - DD/MM/YYYY
  function formatDateTime(date = new Date()) {
    const pad = (num) => String(num).padStart(2, '0');
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    return `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`;
  }

  // Cập nhật thanh tiến trình sức chứa bãi xe (Chuẩn giới hạn 500 xe)
  function updateCapacityDisplay() {
    if (!capacityPercent || !capacityProgressBar) return;
    const percentage = ((state.currentCount / state.totalCapacity) * 100).toFixed(1);
    const available = Math.max(0, state.totalCapacity - state.currentCount);

    capacityPercent.textContent = `${percentage}%`;
    capacityProgressBar.style.width = `${percentage}%`;
    capacityCount.textContent = `${state.currentCount} / ${state.totalCapacity}`;
    capacityAvailable.textContent = `${available} chỗ trống`;
  }

  // Lấy API Base URL linh hoạt
  function getApiBase() {
    return window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
  }

  // Tải dữ liệu ban đầu từ CSDL thật (Sức chứa & 5 lượt gần nhất)
  async function loadInitialDatabaseData() {
    try {
      const apiBase = getApiBase();
      
      // 1. Lấy dữ liệu thống kê sức chứa bãi xe từ DB
      const resStats = await fetch(`${apiBase}/api/checkin/stats`);
      if (resStats.ok) {
        const statsData = await resStats.json();
        state.totalCapacity = statsData.total_capacity || 500;
        state.currentCount = statsData.current_count || 0;
        updateCapacityDisplay();
      }

      // 2. Lấy danh sách lượt xe vào từ DB thật
      const resHistory = await fetch(`${apiBase}/api/checkin/history?limit=5`);
      if (resHistory.ok) {
        const historyData = await resHistory.json();
        if (Array.isArray(historyData) && historyData.length > 0) {
          state.historyRecords = historyData.map(item => ({
            id: item.id,
            plate: item.plate,
            type: item.type || 'Ô tô',
            time: item.time,
            status: item.status
          }));
          renderRecentEntries();
        }
      }
    } catch (err) {
      console.warn('Không thể kết nối CSDL khi tải ban đầu (dùng dữ liệu đệm):', err);
    }
  }

  // Hiển thị danh sách "Lượt xe vào gần đây": Đúng tối đa 5 lượt mới nhất với giao diện chỉn chu, hiện đại
  function renderRecentEntries() {
    if (!historyTableBody) return;

    // Lấy tối đa 5 bản ghi mới nhất từ state.historyRecords
    const displayRecords = state.historyRecords.slice(0, 5);

    if (displayRecords.length === 0) {
      historyTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">
            <i class="fa-solid fa-inbox" style="font-size: 20px; margin-bottom: 6px; display: block;"></i>
            Chưa có lượt xe vào nào được ghi nhận trong ca làm việc này
          </td>
        </tr>
      `;
      return;
    }

    historyTableBody.innerHTML = displayRecords.map(item => {
      const isCar = (item.type === 'Ô tô');
      const vtypeClass = isCar ? 'car' : 'moto';
      const vtypeIcon = isCar ? '<i class="fa-solid fa-car"></i>' : '<i class="fa-solid fa-motorcycle"></i>';
      const isManual = item.status && item.status.includes('Nhập tay');
      const statusClass = isManual ? 'manual' : 'success';

      return `
        <tr>
          <td>
            <span class="plate-badge">
              <i class="fa-solid fa-id-card"></i>
              ${item.plate}
            </span>
          </td>
          <td>
            <span class="badge-vtype ${vtypeClass}">
              ${vtypeIcon} ${item.type || 'Chưa rõ'}
            </span>
          </td>
          <td class="td-time">
            <i class="fa-regular fa-clock"></i> ${item.time}
          </td>
          <td>
            <span class="status-pill ${statusClass}">
              <span class="status-bullet"></span> ${item.status}
            </span>
          </td>
          <td>
            <div class="table-actions-cell" style="display:inline-flex; align-items:center; gap:6px;">
              <button type="button" class="btn-action-icon btn-action-edit btn-edit-checkin" data-id="${item.id || ''}" data-plate="${item.plate}" data-type="${item.type || 'Ô tô'}" title="Sửa biển số xe nếu nhập sai" style="background:#eff6ff !important; color:#2563eb !important; border:1px solid #bfdbfe !important; border-radius:6px; padding:4px 10px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-pen-to-square" style="color:#2563eb;"></i> <span>Sửa</span>
              </button>
              <button type="button" class="btn-action-icon btn-action-delete btn-delete-checkin" data-id="${item.id || ''}" data-plate="${item.plate}" title="Xóa lượt xe này" style="background:#fef2f2 !important; color:#ef4444 !important; border:1px solid #fecaca !important; border-radius:6px; padding:4px 10px; font-weight:600; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-trash-can" style="color:#ef4444;"></i> <span>Xóa</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Gán sự kiện Sửa lượt xe vừa vào
    document.querySelectorAll('.btn-edit-checkin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const oldPlate = btn.getAttribute('data-plate');
        const oldType = btn.getAttribute('data-type') || 'Ô tô';

        const newPlate = prompt(`Nhập lại biển số đúng cho lượt xe (hiện tại: ${oldPlate}):`, oldPlate);
        if (!newPlate || newPlate.trim().toUpperCase() === oldPlate) return;

        const clean = newPlate.trim().toUpperCase();
        try {
          if (id) {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/api/checkin/sessions/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plate_number: clean, vehicle_type: oldType })
            });
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.detail || 'Lỗi khi cập nhật');
            }
          }

          // Cập nhật mảng cục bộ
          const rec = state.historyRecords.find(r => (id && r.id == id) || r.plate === oldPlate);
          if (rec) {
            rec.plate = clean;
            rec.status = 'Ghi nhận (Đã sửa)';
          }
          renderRecentEntries();
        } catch (err) {
          alert(`Không thể sửa biển số: ${err.message}`);
        }
      });
    });

    // Gán sự kiện Xóa lượt xe vừa vào
    document.querySelectorAll('.btn-delete-checkin').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const plate = btn.getAttribute('data-plate');

        if (!confirm(`Bạn có chắc chắn muốn xóa lượt vào của xe biển số ${plate} không?\nSức chứa bãi xe sẽ được tự động hoàn lại.`)) {
          return;
        }

        try {
          if (id) {
            const apiBase = getApiBase();
            const res = await fetch(`${apiBase}/api/checkin/sessions/${id}`, {
              method: 'DELETE'
            });
            if (!res.ok) {
              const errData = await res.json();
              throw new Error(errData.detail || 'Lỗi khi xóa');
            }
          }

          // Loại bỏ khỏi state
          state.historyRecords = state.historyRecords.filter(r => (id ? r.id != id : r.plate !== plate));
          if (state.currentCount > 0) state.currentCount -= 1;
          updateCapacityDisplay();
          renderRecentEntries();
          await loadInitialDatabaseData();
        } catch (err) {
          alert(`Không thể xóa lượt xe: ${err.message}`);
        }
      });
    });
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

  // B1. Bật / Tắt Webcam Camera Laptop
  async function startWebcam() {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      if (webcamVideo) {
        webcamVideo.srcObject = webcamStream;
        webcamVideo.style.display = 'block';
        webcamVideo.style.transform = isWebcamFlipped ? 'scaleX(-1)' : 'none';
      }
      if (vehiclePreviewImg) vehiclePreviewImg.style.display = 'none';
      if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
      if (webcamLiveControls) webcamLiveControls.style.display = 'flex';

      if (btnCaptureWebcam) btnCaptureWebcam.style.display = 'inline-flex';
      if (btnFlipWebcam) btnFlipWebcam.style.display = 'inline-flex';
      if (webcamBtnText) webcamBtnText.textContent = 'Tắt Camera';
      if (fileStatusText) fileStatusText.textContent = 'Camera đang mở: Đặt biển số vào khung và bấm nút chụp';
      if (camStatusText) camStatusText.textContent = 'WEBCAM LAPTOP - TRỰC TIẾP';
      if (camStatusDot) camStatusDot.style.backgroundColor = '#10b981';
    } catch (err) {
      console.error('Không thể mở camera:', err);
      alert('Không thể mở camera laptop! Vui lòng kiểm tra quyền truy cập camera trên trình duyệt của bạn.');
    }
  }

  function stopWebcam() {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      webcamStream = null;
    }
    if (webcamVideo) {
      webcamVideo.srcObject = null;
      webcamVideo.style.display = 'none';
    }
    if (webcamLiveControls) {
      webcamLiveControls.style.display = 'none';
    }
    if (vehiclePreviewImg && vehiclePreviewImg.src && vehiclePreviewImg.src !== window.location.href) {
      vehiclePreviewImg.style.display = 'block';
    } else if (emptyViewportPlaceholder) {
      emptyViewportPlaceholder.style.display = 'flex';
    }

    if (btnCaptureWebcam) btnCaptureWebcam.style.display = 'none';
    if (btnFlipWebcam) btnFlipWebcam.style.display = 'none';
    if (webcamBtnText) webcamBtnText.textContent = 'Mở Camera';
    if (camStatusText) camStatusText.textContent = 'CAM 01 - CỔNG VÀO';
    if (camStatusDot) camStatusDot.style.backgroundColor = '#2563eb';
  }

  // Nút lật gương camera để chữ biển số không bị ngược chiều
  if (btnFlipWebcam && webcamVideo) {
    btnFlipWebcam.addEventListener('click', () => {
      isWebcamFlipped = !isWebcamFlipped;
      webcamVideo.style.transform = isWebcamFlipped ? 'scaleX(-1)' : 'none';
      if (fileStatusText) {
        fileStatusText.textContent = isWebcamFlipped ? 'Đã lật gương Camera (Chống ngược chữ)' : 'Camera hiển thị góc nhìn tự nhiên';
      }
    });
  }

  if (btnToggleWebcam) {
    btnToggleWebcam.addEventListener('click', () => {
      if (webcamStream) {
        stopWebcam();
      } else {
        startWebcam();
      }
    });
  }

  // Biến lưu trữ file hoặc blob ảnh thực tế đang được chọn
  let currentImageFile = null;

  // HÀM BẮT KHUNG HÌNH (SNAPSHOT) CHUẨN TỪ WEBCAM ĐẢM BẢO KHÔNG BỊ TRỄ BẤT ĐỒNG BỘ
  async function captureWebcamSnapshot() {
    if (!webcamStream || !webcamVideo) return null;

    const videoW = webcamVideo.videoWidth || 640;
    const videoH = webcamVideo.videoHeight || 480;

    captureCanvas.width = videoW;
    captureCanvas.height = videoH;
    const ctx = captureCanvas.getContext('2d');

    // Nếu đang lật gương, lật canvas đúng chiều để chữ số xuôi chiều tự nhiên
    if (isWebcamFlipped) {
      ctx.translate(videoW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(webcamVideo, 0, 0, videoW, videoH);
    if (isWebcamFlipped) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    const dataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);

    // Chuyển sang File/Blob có Promise chờ hoàn thành (khắc phục triệt để lỗi Async rỗng)
    const blob = await new Promise(resolve => captureCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });

    return { dataUrl, file };
  }

  // Hàm xử lý khi bấm Chụp từ Camera (cho cả nút nổi trên video và nút trên thanh công cụ)
  async function triggerWebcamCaptureAndRecognize() {
    if (!webcamStream) return;

    if (fileStatusText) {
      fileStatusText.textContent = 'Đang chụp và gửi nhận diện AI...';
    }

    const snapshot = await captureWebcamSnapshot();
    if (!snapshot) return;

    currentImageFile = snapshot.file;

    // Hiển thị ngay ảnh tĩnh vừa chụp lên màn hình
    if (vehiclePreviewImg) {
      vehiclePreviewImg.src = snapshot.dataUrl;
      vehiclePreviewImg.style.display = 'block';
    }
    if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';

    // Dừng webcam để cố định ảnh đã chụp
    stopWebcam();

    // Tự động kích hoạt nhận diện AI
    if (btnRecognize) {
      btnRecognize.click();
    }
  }

  // B2. Bắt sự kiện nút chụp nổi trên khung camera
  if (btnShutterLive) {
    btnShutterLive.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerWebcamCaptureAndRecognize();
    });
  }

  // B3. Bắt sự kiện nút chụp trên thanh công cụ tác vụ
  if (btnCaptureWebcam) {
    btnCaptureWebcam.addEventListener('click', () => {
      triggerWebcamCaptureAndRecognize();
    });
  }

  // B3. Chọn ảnh xe từ máy tính (mô phỏng tải ảnh phương tiện)
  if (btnSelectImage && fileInputVehicle) {
    btnSelectImage.addEventListener('click', () => {
      if (webcamStream) stopWebcam();
      fileInputVehicle.click();
    });

    // Cho phép nhấn trực tiếp vào khung ảnh xe ban đầu để chọn ảnh
    if (viewportOriginalBox) {
      viewportOriginalBox.style.cursor = 'pointer';
      viewportOriginalBox.addEventListener('click', (e) => {
        // Chỉ kích hoạt khi không bật webcam và không click vào nút con
        if (!webcamStream && e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
          fileInputVehicle.click();
        }
      });
    }

    fileInputVehicle.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        currentImageFile = file;
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (fileStatusText) {
          fileStatusText.textContent = `Đã tải: ${file.name} (${fileSizeMB} MB)`;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          // 1. Cột 1: Hiển thị ảnh phương tiện ban đầu
          if (vehiclePreviewImg) {
            vehiclePreviewImg.src = event.target.result;
            vehiclePreviewImg.style.display = 'block';
          }
          if (emptyViewportPlaceholder) {
            emptyViewportPlaceholder.style.display = 'none';
          }

          // 2. Cột 2: Reset chờ nhận diện
          if (annotatedPreviewImg) {
            annotatedPreviewImg.style.display = 'none';
          }
          if (emptyAnnotatedPlaceholder) {
            emptyAnnotatedPlaceholder.style.display = 'flex';
          }

          // 3. Cột 3: Reset thông tin kết quả
          if (cropPlaceholder) {
            cropPlaceholder.innerHTML = `<i class="fa-solid fa-camera"></i> <span>Chưa có ảnh crop</span>`;
          }
          if (cropDimsText) cropDimsText.textContent = 'Tỷ lệ chuẩn';
          if (resultPlateText) resultPlateText.textContent = '---';
          if (aiStatusPill) {
            aiStatusPill.className = 'badge-status-pill waiting';
            if (aiStatusText) aiStatusText.textContent = 'Chờ xử lý';
          }
          if (yoloConfText) yoloConfText.textContent = '--%';
          if (processingTimeText) processingTimeText.textContent = '-- ms';
          if (ocrConfidenceText) ocrConfidenceText.textContent = '--%';
          if (vehicleTypeText) vehicleTypeText.textContent = 'Chưa xác định';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // C. THAO TÁC 1: NHẤN NÚT "NHẬN DIỆN BIỂN SỐ" (GỌI LÕI AI THẬT)
  // Gửi ảnh trực tiếp tới FastAPI Endpoint POST /api/recognize
  // Tuyệt đối không thêm bản ghi vào lịch sử, không tăng sức chứa.
  if (btnRecognize) {
    btnRecognize.addEventListener('click', async () => {
      // Nếu đang mở camera trực tiếp thì tự động chụp khung hình hiện tại trước khi nhận diện!
      if (webcamStream) {
        const snapshot = await captureWebcamSnapshot();
        if (snapshot) {
          currentImageFile = snapshot.file;
          if (vehiclePreviewImg) {
            vehiclePreviewImg.src = snapshot.dataUrl;
            vehiclePreviewImg.style.display = 'block';
          }
          if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
          stopWebcam();
        }
      }

      if (!currentImageFile && !vehiclePreviewImg?.src) {
        alert('Vui lòng chọn ảnh phương tiện hoặc bật Camera để chụp trước khi nhận diện!');
        return;
      }

      // Ẩn banner ghi nhận trước đó nếu có
      if (successBanner) {
        successBanner.style.display = 'none';
      }

      // Trạng thái Loading
      btnRecognize.disabled = true;
      btnRecognize.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang nhận diện biển số...</span>`;

      try {
        const formData = new FormData();
        if (currentImageFile) {
          formData.append('file', currentImageFile);
        } else if (vehiclePreviewImg?.src?.startsWith('data:')) {
          // Trường hợp ảnh từ Data URL
          const res = await fetch(vehiclePreviewImg.src);
          const blob = await res.blob();
          formData.append('file', blob, 'vehicle_entry.jpg');
        } else {
          // Trường hợp ảnh mẫu có sẵn URL
          const res = await fetch(vehiclePreviewImg.src);
          const blob = await res.blob();
          formData.append('file', blob, 'sample_entry.jpg');
        }
        formData.append('use_preprocess', 'true');

        // Gọi API Backend
        const apiBase = window.location.origin.includes('8000') ? '' : 'http://127.0.0.1:8000';
        const response = await fetch(`${apiBase}/api/recognize`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || `Lỗi máy chủ (HTTP ${response.status})`);
        }

        const currentTime = formatDateTime();

        // Xử lý khi không phát hiện thấy biển số
        if (data.status === 'not_detected' || !data.plates || data.plates.length === 0) {
          alert('Không phát hiện thấy biển số xe trong ảnh! Vui lòng chụp góc rõ hơn.');
          if (resultPlateText) resultPlateText.textContent = 'Không tìm thấy';
          if (aiStatusPill) {
            aiStatusPill.className = 'badge-status-pill error';
            if (aiStatusText) aiStatusText.textContent = 'Không phát hiện';
          }
          if (ocrConfidenceText) ocrConfidenceText.textContent = '0%';
          return;
        }

        // Lấy kết quả biển số thứ nhất (hoặc biển được nhận diện)
        const plateData = data.plates[0];
        const rec = plateData.recognition;
        const rawPlate = rec?.plate_number || rec?.raw_text || 'Chưa rõ';
        const detectedPlate = normalizePlateSpacing(rawPlate);
        const rawVehicleType = rec?.vehicle_type || 'unknown';
        const vehicleTypeDisplay = determineVehicleType(rawVehicleType, detectedPlate);
        const yoloConfPercent = (plateData.bbox.confidence * 100).toFixed(1);

        const ocrConfVal = rec?.confidence ? (rec.confidence * 100) : (rec?.status === 'recognized' ? 99.5 : 85.0);
        const isLowConfidence = (ocrConfVal < 90.0) || (rec?.status && rec.status !== 'recognized');

        // Lưu thông tin nhận diện vào state
        state.currentRecognition = {
          plate: detectedPlate,
          type: vehicleTypeDisplay,
          confidence: `${yoloConfPercent}%`,
          ocrConfidence: `${ocrConfVal.toFixed(1)}%`,
          entryTime: currentTime,
          cropUrl: plateData.crop_image_url ? `${apiBase}${plateData.crop_image_url}` : null,
          status: isLowConfidence ? 'low_confidence' : (rec?.status || 'recognized')
        };

        // 1. Cột 2: Hiển thị ngay ảnh YOLOv8 Khoanh vùng biển số
        if (data.annotated_image_url && annotatedPreviewImg) {
          annotatedPreviewImg.src = `${apiBase}${data.annotated_image_url}`;
          annotatedPreviewImg.style.display = 'block';
          if (emptyAnnotatedPlaceholder) emptyAnnotatedPlaceholder.style.display = 'none';
        }

        // 2. Cột 3: Cập nhật biển số chuẩn & Huy hiệu
        if (resultPlateText) {
          resultPlateText.textContent = detectedPlate;
        }
        if (plateManualInput) {
          plateManualInput.value = detectedPlate;
        }

        if (isLowConfidence) {
          if (aiStatusPill) {
            aiStatusPill.className = 'badge-status-pill warning';
            if (aiStatusText) aiStatusText.textContent = 'Cần kiểm tra / Nhập tay';
          }
          if (licensePlateCard) licensePlateCard.classList.add('warning-mode');
          if (manualEntryHint) {
            manualEntryHint.style.display = 'flex';
            if (manualEntryHintText) {
              manualEntryHintText.textContent = `Độ tin cậy OCR (${ocrConfVal.toFixed(1)}% < 90%) - Vui lòng kiểm tra hoặc chỉnh sửa bằng tay!`;
            }
          }
          // Tự động bật chế độ nhập tay cho nhân viên
          toggleManualEdit(true, true);
        } else {
          if (aiStatusPill) {
            aiStatusPill.className = 'badge-status-pill success';
            if (aiStatusText) aiStatusText.textContent = 'Nhận diện thành công';
          }
          if (licensePlateCard) licensePlateCard.classList.remove('warning-mode');
          if (manualEntryHint) manualEntryHint.style.display = 'none';
          toggleManualEdit(false);
        }

        if (yoloConfText) {
          yoloConfText.textContent = `${yoloConfPercent}%`;
        }
        if (processingTimeText) {
          processingTimeText.textContent = `${data.processing_time_ms} ms`;
        }
        if (ocrConfidenceText) {
          ocrConfidenceText.textContent = `${ocrConfVal.toFixed(1)}%`;
        }
        if (entryTimeText) entryTimeText.textContent = currentTime;
        if (vehicleTypeText) {
          const icon = (vehicleTypeDisplay === 'Xe máy') ? '<i class="fa-solid fa-motorcycle" style="color:#2563eb; margin-right:4px;"></i>' : '<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i>';
          vehicleTypeText.innerHTML = `${icon} ${vehicleTypeDisplay}`;
        }

        // 3. Cột 3: Hiển thị ảnh cắt biển số thực tế từ AI
        if (cropPlaceholder && plateData.crop_image_url) {
          cropPlaceholder.innerHTML = `<img src="${apiBase}${plateData.crop_image_url}" alt="Ảnh cắt biển số gốc" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:4px;">`;
        }
        if (cropDimsText && plateData.bbox) {
          const bw = Math.round(plateData.bbox.x2 - plateData.bbox.x1);
          const bh = Math.round(plateData.bbox.y2 - plateData.bbox.y1);
          cropDimsText.textContent = `${bw} × ${bh} px`;
        }

        if (fileStatusText) {
          const elapsed = data.processing_time_ms ? ` (${data.processing_time_ms} ms)` : '';
          fileStatusText.textContent = `Đã nhận diện: ${detectedPlate}${elapsed}`;
        }

      } catch (err) {
        console.error('Lỗi nhận diện:', err);
        const currentTime = formatDateTime();

        // KÍCH HOẠT CHẾ ĐỘ DỰ PHÒNG NHẬP TAY (OFFLINE / LỖI OCR / BẢO TRÌ)
        if (aiStatusPill) {
          aiStatusPill.className = 'badge-status-pill warning';
          if (aiStatusText) aiStatusText.textContent = 'Chế độ nhập tay (OCR gián đoạn)';
        }
        if (licensePlateCard) licensePlateCard.classList.add('warning-mode');
        if (manualEntryHint) {
          manualEntryHint.style.display = 'flex';
          if (manualEntryHintText) {
            manualEntryHintText.textContent = 'Hệ thống nhận diện gián đoạn / bảo trì — Nhân viên vui lòng nhập biển số tay để mở barrier!';
          }
        }

        // Khởi tạo state thủ công cho nhân viên nhập
        state.currentRecognition = {
          plate: plateManualInput?.value || '',
          type: 'Ô tô',
          confidence: 'N/A',
          ocrConfidence: 'N/A',
          entryTime: currentTime,
          cropUrl: null,
          status: 'manual'
        };

        if (ocrConfidenceText) ocrConfidenceText.textContent = 'Nhập tay';
        if (yoloConfText) yoloConfText.textContent = 'N/A';
        if (processingTimeText) processingTimeText.textContent = '0 ms';
        if (entryTimeText) entryTimeText.textContent = currentTime;
        if (vehicleTypeText) {
          vehicleTypeText.innerHTML = `<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i> Ô tô`;
        }

        // Tự động mở ô input để nhân viên gõ ngay
        toggleManualEdit(true, true);

        // Hiển thị thông báo nhẹ dạng hint thay vì chặn bằng alert
        if (fileStatusText) {
          fileStatusText.textContent = 'Nhận diện tự động gián đoạn. Đã chuyển sang chế độ nhập tay.';
        }
      } finally {
        btnRecognize.disabled = false;
        btnRecognize.innerHTML = `<i class="fa-solid fa-bolt"></i> <span>Nhận diện biển số</span>`;
      }
    });
  }

  // D. THAO TÁC 2: NHẤN NÚT "GHI NHẬN XE VÀO BÃI"
  // Gọi API Backend POST /api/checkin/confirm để lưu lượt vào CSDL thật và mở barrier.
  if (btnConfirmCheckin) {
    btnConfirmCheckin.addEventListener('click', async () => {
      // Nếu đang mở ô nhập tay thì đồng bộ giá trị trước
      if (plateManualInput && plateManualInput.style.display !== 'none') {
        const val = normalizePlateSpacing(plateManualInput.value.trim().toUpperCase());
        if (val) {
          if (!state.currentRecognition) {
            state.currentRecognition = {
              plate: val,
              type: determineVehicleType(null, val),
              entryTime: formatDateTime(),
              status: 'manual'
            };
          } else {
            state.currentRecognition.plate = val;
            state.currentRecognition.type = determineVehicleType(state.currentRecognition.type, val);
          }
          if (resultPlateText) resultPlateText.textContent = val;
        }
      }

      if (!state.currentRecognition || !state.currentRecognition.plate || state.currentRecognition.plate === '---') {
        alert('Vui lòng nhận diện hoặc nhập biển số xe trước khi ghi nhận vào bãi!');
        if (plateManualInput && plateManualInput.style.display !== 'none') {
          plateManualInput.focus();
        }
        return;
      }

      const { plate, type, entryTime, status, cropUrl, confidence, ocrConfidence } = state.currentRecognition;
      const isManual = (status === 'manual' || status === 'low_confidence');

      // Tắt nút tạm thời để tránh bấm đúp
      btnConfirmCheckin.disabled = true;
      btnConfirmCheckin.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang lưu vào hệ thống...</span>`;

      try {
        const apiBase = getApiBase();
        const confNum = parseFloat(ocrConfidence || confidence || 99.5);

        const response = await fetch(`${apiBase}/api/checkin/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plate_number: plate,
            vehicle_type: type || 'Ô tô',
            checkin_crop_url: cropUrl || null,
            confidence: isNaN(confNum) ? 99.5 : confNum,
            is_manual: isManual,
            staff_checkin: 'Trần Bảo Anh'
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || `Lỗi máy chủ (HTTP ${response.status})`);
        }

        // 1. Hiển thị thông báo ghi nhận thành công / barrier tự động mở
        if (successBanner) {
          successBanner.style.display = 'flex';
        }

        // 2. Cập nhật mảng lịch sử từ phiên CSDL trả về
        const newRecord = {
          id: data.session.id,
          plate: data.session.plate_number,
          type: data.session.vehicle_type,
          time: data.session.checkin_time,
          status: data.session.status
        };
        state.historyRecords.unshift(newRecord);
        renderRecentEntries();

        // 3. Cập nhật số lượng sức chứa từ Database thực tế
        if (data.stats) {
          state.totalCapacity = data.stats.total_capacity;
          state.currentCount = data.stats.current_count;
          updateCapacityDisplay();
        }

        // 4. Nếu đang ở chế độ nhập tay, đóng lại về giao diện chuẩn
        toggleManualEdit(false);

      } catch (err) {
        console.error('Lỗi khi lưu vào Database:', err);
        // Fallback lưu tạm ở client nếu server backend chưa phản hồi
        if (successBanner) {
          successBanner.style.display = 'flex';
        }
        state.historyRecords.unshift({
          plate: plate,
          type: type || 'Ô tô',
          time: entryTime,
          status: isManual ? 'Ghi nhận (Nhập tay)' : 'Ghi nhận thành công'
        });
        renderRecentEntries();
        if (state.currentCount < state.totalCapacity) {
          state.currentCount += 1;
          updateCapacityDisplay();
        }
      } finally {
        btnConfirmCheckin.disabled = false;
        btnConfirmCheckin.innerHTML = `<i class="fa-solid fa-arrow-right-to-bracket"></i> <span>Ghi nhận xe vào bãi (Mở Barrier)</span>`;
      }
    });
  }

  // Nút làm mới dữ liệu lịch sử từ CSDL
  const btnRefreshHistory = document.getElementById('btnRefreshHistory');
  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', async () => {
      btnRefreshHistory.classList.add('spinning');
      await loadInitialDatabaseData();
      setTimeout(() => {
        btnRefreshHistory.classList.remove('spinning');
      }, 500);
    });
  }

  // ==========================================================================
  // KHỞI TẠO HIỂN THỊ BAN ĐẦU
  // ==========================================================================
  updateCapacityDisplay();
  renderRecentEntries();
  loadInitialDatabaseData();
});
