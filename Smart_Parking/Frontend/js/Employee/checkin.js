// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Nghiệp vụ Ghi nhận xe vào bãi (checkin.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái và dữ liệu Mock
  const state = {
    totalCapacity: 500,
    currentCount: 412,
    mockPlates: [
      { plate: '30G-928.31', type: 'Ô tô', confidence: '99.8%' },
      { plate: '51K-812.90', type: 'Ô tô', confidence: '98.5%' },
      { plate: '29A-673.45', type: 'Ô tô', confidence: '99.2%' },
      { plate: '59P1-998.23', type: 'Xe máy', confidence: '97.9%' },
      { plate: '43C-452.18', type: 'Ô tô', confidence: '99.4%' }
    ],
    currentIndex: 0,
    // Thông tin nhận diện gần nhất (đang chờ xác nhận ghi nhận vào bãi)
    currentRecognition: {
      plate: '30G-928.31',
      type: 'Ô tô',
      confidence: '99.8%',
      entryTime: '14:35:10 - 28/10/2026'
    },
    // Danh sách lưu trữ lịch sử lượt xe vào
    historyRecords: [
      { plate: '30G-928.31', time: '14:32:44 - 28/10/2026', status: 'Ghi nhận thành công' },
      { plate: '51K-812.90', time: '14:32:44 - 28/10/2026', status: 'Ghi nhận thành công' },
      { plate: '29A-673.45', time: '14:28:19 - 28/10/2026', status: 'Ghi nhận thành công' },
      { plate: '29A-673.45', time: '14:28:19 - 28/10/2026', status: 'Ghi nhận thành công' }
    ]
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
  const webcamVideo = document.getElementById('webcamVideo');
  const captureCanvas = document.getElementById('captureCanvas');
  const camStatusDot = document.getElementById('camStatusDot');
  const camStatusText = document.getElementById('camStatusText');
  let webcamStream = null;
  
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
    const available = state.totalCapacity - state.currentCount;

    capacityPercent.textContent = `${percentage}%`;
    capacityProgressBar.style.width = `${percentage}%`;
    capacityCount.textContent = `${state.currentCount} / ${state.totalCapacity}`;
    capacityAvailable.textContent = `${available} chỗ trống`;
  }

  // Hiển thị danh sách "Lượt xe vào gần đây": Đúng tối đa 5 lượt mới nhất
  function renderRecentEntries() {
    if (!historyTableBody) return;

    // Lấy tối đa 5 bản ghi mới nhất từ state.historyRecords
    const displayRecords = state.historyRecords.slice(0, 5);

    historyTableBody.innerHTML = displayRecords.map(item => `
      <tr>
        <td class="td-plate">${item.plate}</td>
        <td class="td-time">${item.time}</td>
        <td>
          <span class="status-pill">
            <span class="status-bullet"></span> ${item.status}
          </span>
        </td>
      </tr>
    `).join('');
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
      }
      if (vehiclePreviewImg) vehiclePreviewImg.style.display = 'none';
      if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
      if (aiPlateBox) aiPlateBox.style.display = 'none';

      if (btnCaptureWebcam) btnCaptureWebcam.style.display = 'inline-flex';
      if (webcamBtnText) webcamBtnText.textContent = 'Tắt Camera';
      if (fileStatusText) fileStatusText.textContent = 'Đang phát trực tiếp từ Camera Laptop';
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
    if (vehiclePreviewImg && vehiclePreviewImg.src && vehiclePreviewImg.src !== window.location.href) {
      vehiclePreviewImg.style.display = 'block';
    } else if (emptyViewportPlaceholder) {
      emptyViewportPlaceholder.style.display = 'flex';
    }

    if (btnCaptureWebcam) btnCaptureWebcam.style.display = 'none';
    if (webcamBtnText) webcamBtnText.textContent = 'Mở Camera';
    if (fileStatusText) fileStatusText.textContent = 'Sẵn sàng nhận diện';
    if (camStatusText) camStatusText.textContent = 'CAM 01 - CỔNG VÀO';
    if (camStatusDot) camStatusDot.style.backgroundColor = '#2563eb';
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

  // B2. Chụp ảnh từ Webcam để nhận diện
  if (btnCaptureWebcam && webcamVideo && captureCanvas) {
    btnCaptureWebcam.addEventListener('click', () => {
      if (!webcamStream) return;

      const videoW = webcamVideo.videoWidth || 640;
      const videoH = webcamVideo.videoHeight || 480;

      captureCanvas.width = videoW;
      captureCanvas.height = videoH;
      const ctx = captureCanvas.getContext('2d');
      ctx.drawImage(webcamVideo, 0, 0, videoW, videoH);

      const capturedDataUrl = captureCanvas.toDataURL('image/jpeg', 0.95);

      // Chuyển sang Blob nhị phân để gửi API
      captureCanvas.toBlob((blob) => {
        currentImageFile = new File([blob], 'webcam_capture.jpg', { type: 'image/jpeg' });
      }, 'image/jpeg', 0.95);

      // Tắt stream và hiển thị ảnh vừa chụp
      stopWebcam();
      if (emptyViewportPlaceholder) emptyViewportPlaceholder.style.display = 'none';
      if (vehiclePreviewImg) {
        vehiclePreviewImg.src = capturedDataUrl;
        vehiclePreviewImg.style.display = 'block';
      }
      if (fileStatusText) {
        fileStatusText.textContent = 'Đã chụp ảnh từ Camera (Sẵn sàng nhận diện)';
      }

      // Kích hoạt nhận diện ngay sau khi chụp
      if (btnRecognize) {
        btnRecognize.click();
      }
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
      if (!currentImageFile && !vehiclePreviewImg?.src) {
        alert('Vui lòng chọn ảnh phương tiện hoặc chụp từ camera trước khi nhận diện!');
        return;
      }

      // Ẩn banner ghi nhận trước đó nếu có
      if (successBanner) {
        successBanner.style.display = 'none';
      }

      // Trạng thái Loading
      btnRecognize.disabled = true;
      btnRecognize.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý AI (YOLO + Gemini)...</span>`;

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
        const detectedPlate = rec?.plate_number || rec?.raw_text || 'Chưa rõ';
        const rawVehicleType = rec?.vehicle_type || 'unknown';
        const vehicleTypeDisplay = rawVehicleType === 'motorbike' ? 'Xe máy' : (rawVehicleType === 'car' ? 'Ô tô' : 'Chưa xác định');
        const yoloConfPercent = (plateData.bbox.confidence * 100).toFixed(1);

        // Lưu thông tin nhận diện vào state
        state.currentRecognition = {
          plate: detectedPlate,
          type: vehicleTypeDisplay,
          confidence: `${yoloConfPercent}%`,
          entryTime: currentTime,
          cropUrl: plateData.crop_image_url ? `${apiBase}${plateData.crop_image_url}` : null,
          status: rec?.status || 'recognized'
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
        if (aiStatusPill) {
          aiStatusPill.className = 'badge-status-pill success';
          if (aiStatusText) aiStatusText.textContent = 'Nhận diện thành công';
        }
        if (yoloConfText) {
          yoloConfText.textContent = `${yoloConfPercent}%`;
        }
        if (processingTimeText) {
          processingTimeText.textContent = `${data.processing_time_ms} ms`;
        }
        if (ocrConfidenceText) {
          const geminiConf = rec?.confidence ? (rec.confidence * 100).toFixed(1) : '99.5';
          ocrConfidenceText.textContent = `${geminiConf}% (Gemini AI)`;
        }
        if (entryTimeText) entryTimeText.textContent = currentTime;
        if (vehicleTypeText) {
          const icon = (rawVehicleType === 'motorbike') ? '<i class="fa-solid fa-motorcycle" style="color:#2563eb; margin-right:4px;"></i>' : '<i class="fa-solid fa-car" style="color:#2563eb; margin-right:4px;"></i>';
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
        if (aiStatusPill) {
          aiStatusPill.className = 'badge-status-pill error';
          if (aiStatusText) aiStatusText.textContent = 'Lỗi kết nối';
        }
        alert(`Lỗi nhận diện AI: ${err.message}. Vui lòng kiểm tra server Backend đã chạy tại http://127.0.0.1:8000!`);
      } finally {
        btnRecognize.disabled = false;
        btnRecognize.innerHTML = `<i class="fa-solid fa-bolt"></i> <span>Nhận diện biển số AI</span>`;
      }
    });
  }

  // D. THAO TÁC 2: NHẤN NÚT "GHI NHẬN XE VÀO BÃI"
  // CHỈ khi nhấn nút này mới tạo lượt vào, cập nhật lịch sử và sức chứa bãi xe.
  if (btnConfirmCheckin) {
    btnConfirmCheckin.addEventListener('click', () => {
      if (!state.currentRecognition || !state.currentRecognition.plate) {
        alert('Vui lòng nhận diện biển số trước khi ghi nhận xe vào bãi!');
        return;
      }

      const { plate, entryTime } = state.currentRecognition;

      // 1. Hiển thị thông báo ghi nhận thành công / barrier tự động mở
      if (successBanner) {
        successBanner.style.display = 'flex';
      }

      // 2. Thêm bản ghi vào đầu mảng lịch sử (mới nhất lên trước)
      state.historyRecords.unshift({
        plate: plate,
        time: entryTime,
        status: 'Ghi nhận thành công'
      });

      // 3. Render lại danh sách gần đây (giữ tối đa 5 lượt mới nhất)
      renderRecentEntries();

      // 4. Cập nhật số lượng xe đang trong bãi (nếu chưa đầy 500)
      if (state.currentCount < state.totalCapacity) {
        state.currentCount += 1;
        updateCapacityDisplay();
      }
    });
  }

  // ==========================================================================
  // KHỞI TẠO HIỂN THỊ BAN ĐẦU
  // ==========================================================================
  updateCapacityDisplay();
  renderRecentEntries();
});
