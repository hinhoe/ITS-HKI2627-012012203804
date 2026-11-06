// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Nghiệp vụ Ghi nhận xe ra & Tính phí (checkout.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái và dữ liệu Mock
  const state = {
    totalCapacity: 500,
    currentCount: 412, // Số xe hiện tại trong bãi
    mockCheckouts: [
      {
        plate: '30G-928.31',
        type: 'Ô tô',
        confidence: '99.8%',
        timeIn: '14:35:10 - 28/10/2026',
        timeOut: '16:45:20 - 28/10/2026',
        duration: '2 giờ 10 phút',
        feeType: 'Ban ngày',
        feeAmount: '25.000 VNĐ',
        feeDisplayTable: '25.000 đ'
      },
      {
        plate: '51K-812.90',
        type: 'Ô tô',
        confidence: '98.5%',
        timeIn: '14:32:44 - 28/10/2026',
        timeOut: '16:38:15 - 28/10/2026',
        duration: '2 giờ 05 phút',
        feeType: 'Ban ngày',
        feeAmount: '25.000 VNĐ',
        feeDisplayTable: '25.000 đ'
      },
      {
        plate: '29A-673.45',
        type: 'Xe máy',
        confidence: '99.2%',
        timeIn: '14:28:19 - 28/10/2026',
        timeOut: '16:20:04 - 28/10/2026',
        duration: '1 giờ 51 phút',
        feeType: 'Bình thường',
        feeAmount: '15.000 VNĐ',
        feeDisplayTable: '15.000 đ'
      }
    ],
    currentIndex: 0,
    // Trạng thái đã ghi nhận cho lượt hiện tại hay chưa (tránh ghi nhận trùng lặp)
    isCurrentCheckoutProcessed: false,
    // Thông tin lượt xe đang đối soát hiện tại (chờ xác nhận ra bãi)
    currentPendingCheckout: {
      plate: '30G-928.31',
      timeOut: '16:45:20 - 28/10/2026',
      feeDisplayTable: '25.000 đ'
    },
    // Lịch sử lượt xe ra gần đây (hiển thị tối đa 5 lượt mới nhất)
    checkoutHistory: [
      { plate: '30G-928.31', time: '16:45:20 - 28/10/2026', fee: '25.000 đ', status: 'Hoàn tất & Đã mở barrier' },
      { plate: '51K-812.90', time: '16:38:15 - 28/10/2026', fee: '25.000 đ', status: 'Hoàn tất & Đã mở barrier' },
      { plate: '29A-673.45', time: '16:20:04 - 28/10/2026', fee: '15.000 đ', status: 'Hoàn tất & Đã mở barrier' },
      { plate: '59P1-998.23', time: '16:05:12 - 28/10/2026', fee: '10.000 đ', status: 'Hoàn tất & Đã mở barrier' }
    ]
  };

  // 2. Tham chiếu các phần tử DOM
  const btnSelectImage = document.getElementById('btnSelectImage');
  const fileInputVehicle = document.getElementById('fileInputVehicle');
  const vehiclePreviewImg = document.getElementById('vehiclePreviewImg');
  const fileStatusText = document.getElementById('fileStatusText');
  const btnRecognize = document.getElementById('btnRecognize');
  const btnConfirmCheckout = document.getElementById('btnConfirmCheckout');
  const aiPlateBox = document.getElementById('aiPlateBox');
  const aiPlateText = document.getElementById('aiPlateText');
  
  // Kết quả nhận diện & Phí
  const cropPlaceholder = document.getElementById('cropPlaceholder');
  const resultPlateText = document.getElementById('resultPlateText');
  const ocrConfidenceText = document.getElementById('ocrConfidenceText');
  const timeInText = document.getElementById('timeInText');
  const timeOutText = document.getElementById('timeOutText');
  const durationText = document.getElementById('durationText');
  const vehicleTypeText = document.getElementById('vehicleTypeText');
  const feeTypeText = document.getElementById('feeTypeText');
  const feeAmountText = document.getElementById('feeAmountText');
  const checkoutSuccessBanner = document.getElementById('checkoutSuccessBanner');
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

  // Hiển thị danh sách "Lượt xe ra gần đây": ĐÚNG TỐI ĐA 5 LƯỢT MỚI NHẤT
  function renderRecentCheckouts() {
    if (!historyTableBody) return;

    // Lấy đúng tối đa 5 bản ghi mới nhất
    const displayRecords = state.checkoutHistory.slice(0, 5);

    historyTableBody.innerHTML = displayRecords.map(item => `
      <tr>
        <td class="td-plate">${item.plate}</td>
        <td class="td-time">${item.time}</td>
        <td class="td-fee">${item.fee}</td>
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

  // B. Chọn ảnh xe ra từ máy tính (mô phỏng tải ảnh phương tiện)
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
          // Gọi hàm cắt biển số kèm padding an toàn tỷ lệ
          renderLicensePlateCrop(cropPlaceholder, event.target.result, state.currentPendingCheckout?.plate);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // C. THAO TÁC 1: NHẤN NÚT "NHẬN DIỆN BIỂN SỐ"
  // CHỈ nhận diện, đối soát lượt gửi và tính phí.
  // TUYỆT ĐỐI KHÔNG hiển thị thông báo thành công, KHÔNG trừ xe, KHÔNG thêm vào bảng lịch sử.
  if (btnRecognize) {
    btnRecognize.addEventListener('click', () => {
      // Đảm bảo ẩn thông báo màu xanh lá khi vừa nhận diện lượt xe mới
      if (checkoutSuccessBanner) {
        checkoutSuccessBanner.style.display = 'none';
      }

      // Reset trạng thái chưa hoàn tất cho lượt xe mới
      state.isCurrentCheckoutProcessed = false;
      if (btnConfirmCheckout) {
        btnConfirmCheckout.disabled = false;
        btnConfirmCheckout.innerHTML = `<i class="fa-solid fa-arrow-right-from-bracket"></i> <span>Ghi nhận xe ra bãi</span>`;
      }

      const currentItem = state.mockCheckouts[state.currentIndex];
      state.currentIndex = (state.currentIndex + 1) % state.mockCheckouts.length;

      btnRecognize.disabled = true;
      btnRecognize.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xử lý AI...</span>`;

      setTimeout(() => {
        const currentTime = formatDateTime();

        // Lưu thông tin đối soát hiện tại
        state.currentPendingCheckout = {
          plate: currentItem.plate,
          timeOut: currentTime,
          feeDisplayTable: currentItem.feeDisplayTable
        };

        // 1. Cập nhật Bounding Box AI
        if (aiPlateText) {
          aiPlateText.textContent = `[ ${currentItem.plate} ]`;
        }
        if (aiPlateBox) {
          aiPlateBox.style.display = 'flex';
        }

        // 2. Cập nhật chi tiết kết quả nhận diện & đối soát
        if (resultPlateText) resultPlateText.textContent = currentItem.plate;
        if (ocrConfidenceText) ocrConfidenceText.textContent = currentItem.confidence;
        if (timeInText) timeInText.textContent = currentItem.timeIn;
        if (timeOutText) timeOutText.textContent = currentTime;
        if (durationText) durationText.textContent = currentItem.duration;
        if (vehicleTypeText) vehicleTypeText.textContent = currentItem.type;
        if (feeTypeText) feeTypeText.textContent = currentItem.feeType;
        if (feeAmountText) feeAmountText.textContent = currentItem.feeAmount;

        // Cập nhật ảnh cắt biển số với vùng crop chuẩn và padding an toàn
        renderLicensePlateCrop(cropPlaceholder, vehiclePreviewImg?.src, currentItem.plate);

        // Trả lại trạng thái nút nhận diện
        btnRecognize.disabled = false;
        btnRecognize.innerHTML = `<i class="fa-solid fa-expand"></i> <span>Nhận diện biển số</span>`;
      }, 500);
    });
  }

  // D. THAO TÁC 2: NHẤN NÚT "GHI NHẬN XE RA BÃI"
  // CHỈ khi nhân viên chủ động nhấn nút này:
  // - Kiểm tra tính hợp lệ
  // - Hiển thị khung thông báo màu xanh lá (Ghi nhận xe ra thành công - Xe đã hoàn tất thủ tục ra bãi)
  // - Khóa nút để tránh nhân viên nhấn nhiều lần gây trùng lặp
  // - Thêm 1 bản ghi vào danh sách lịch sử xe ra (chỉ hiển thị 3 bản ghi mới nhất)
  // - Giảm số lượng xe trong bãi đi 1 phương tiện
  if (btnConfirmCheckout) {
    btnConfirmCheckout.addEventListener('click', () => {
      // 1. Kiểm tra tồn tại thông tin xe
      if (!state.currentPendingCheckout || !state.currentPendingCheckout.plate) {
        alert('Chưa có thông tin nhận diện lượt gửi xe! Vui lòng tải ảnh và nhận diện trước.');
        return;
      }

      // 2. Kiểm tra nếu lượt này đã được ghi nhận rồi thì không cho ghi nhận lại
      if (state.isCurrentCheckoutProcessed) {
        alert('Lượt xe này đã được ghi nhận hoàn tất ra bãi!');
        return;
      }

      const { plate, timeOut, feeDisplayTable } = state.currentPendingCheckout;

      // Đánh dấu đã hoàn tất lượt hiện tại
      state.isCurrentCheckoutProcessed = true;

      // 3. Hiển thị khung thông báo thành công màu xanh lá
      if (checkoutSuccessBanner) {
        checkoutSuccessBanner.style.display = 'flex';
      }

      // 4. Khóa nút ghi nhận hiện tại để tránh tạo nhiều bản ghi trùng
      btnConfirmCheckout.disabled = true;
      btnConfirmCheckout.innerHTML = `<i class="fa-solid fa-check"></i> <span>Đã ghi nhận ra bãi</span>`;

      // 5. Thêm vào đầu danh sách lịch sử xe ra
      state.checkoutHistory.unshift({
        plate: plate,
        time: timeOut,
        fee: feeDisplayTable,
        status: 'Hoàn tất & Đã mở barrier'
      });

      // 6. Render lại bảng lịch sử (đúng tối đa 3 lượt gần nhất)
      renderRecentCheckouts();

      // 7. Giảm số lượng xe đang trong bãi (nếu còn > 0)
      if (state.currentCount > 0) {
        state.currentCount -= 1;
        updateCapacityDisplay();
      }
    });
  }

  // Khởi tạo hiển thị ban đầu
  updateCapacityDisplay();
  renderRecentCheckouts();
  renderLicensePlateCrop(cropPlaceholder, null, '30G-928.31');
});
