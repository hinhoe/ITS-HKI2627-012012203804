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
  const fileStatusText = document.getElementById('fileStatusText');
  const btnRecognize = document.getElementById('btnRecognize');
  const btnConfirmCheckin = document.getElementById('btnConfirmCheckin');
  const aiPlateBox = document.getElementById('aiPlateBox');
  const aiPlateText = document.getElementById('aiPlateText');
  
  // Kết quả nhận diện
  const cropPlaceholder = document.getElementById('cropPlaceholder');
  const resultPlateText = document.getElementById('resultPlateText');
  const ocrConfidenceText = document.getElementById('ocrConfidenceText');
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

  // B. Chọn ảnh xe từ máy tính (mô phỏng tải ảnh phương tiện)
  if (btnSelectImage && fileInputVehicle) {
    btnSelectImage.addEventListener('click', () => {
      fileInputVehicle.click();
    });

    fileInputVehicle.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        if (fileStatusText) {
          fileStatusText.textContent = `Đã tải: ${file.name} (${fileSizeMB} MB)`;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          if (vehiclePreviewImg) {
            vehiclePreviewImg.src = event.target.result;
            vehiclePreviewImg.style.display = 'block';
          }
          // Gọi hàm cắt biển số kèm padding tỷ lệ an toàn, không làm mất mép trên dưới
          renderLicensePlateCrop(cropPlaceholder, event.target.result, state.currentRecognition?.plate);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // C. THAO TÁC 1: NHẤN NÚT "NHẬN DIỆN BIỂN SỐ"
  // CHỈ thực hiện nhận diện từ ảnh và hiển thị kết quả.
  // TUYỆT ĐỐI KHÔNG thêm bản ghi vào lịch sử, không tăng sức chứa.
  if (btnRecognize) {
    btnRecognize.addEventListener('click', () => {
      // Ẩn banner ghi nhận trước đó nếu có
      if (successBanner) {
        successBanner.style.display = 'none';
      }

      // Lấy mock data luân phiên
      const currentItem = state.mockPlates[state.currentIndex];
      state.currentIndex = (state.currentIndex + 1) % state.mockPlates.length;

      // Mô phỏng hiệu ứng loading nhận diện AI
      btnRecognize.disabled = true;
      btnRecognize.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý AI...</span>`;

      setTimeout(() => {
        const currentTime = formatDateTime();

        // Lưu thông tin nhận diện vào state hiện tại
        state.currentRecognition = {
          plate: currentItem.plate,
          type: currentItem.type,
          confidence: currentItem.confidence,
          entryTime: currentTime
        };

        // 1. Cập nhật khung bounding box AI trên viewport
        if (aiPlateText) {
          aiPlateText.textContent = `[ ${currentItem.plate} ]`;
        }
        if (aiPlateBox) {
          aiPlateBox.style.display = 'flex';
        }

        // 2. Cập nhật thẻ kết quả nhận diện
        if (resultPlateText) resultPlateText.textContent = currentItem.plate;
        if (ocrConfidenceText) ocrConfidenceText.textContent = currentItem.confidence;
        if (entryTimeText) entryTimeText.textContent = currentTime;
        if (vehicleTypeText) vehicleTypeText.textContent = currentItem.type;

        // Cập nhật ảnh cắt biển số với vùng crop chuẩn và padding an toàn
        renderLicensePlateCrop(cropPlaceholder, vehiclePreviewImg?.src, currentItem.plate);

        // Trả lại trạng thái nút
        btnRecognize.disabled = false;
        btnRecognize.innerHTML = `<i class="fa-solid fa-expand"></i> <span>Nhận diện biển số</span>`;
      }, 500);
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
  renderLicensePlateCrop(cropPlaceholder, null, '30G-928.31');
});
