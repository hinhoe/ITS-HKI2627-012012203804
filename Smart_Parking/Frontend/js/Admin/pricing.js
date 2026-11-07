// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH
// File JavaScript: Quản lý mức phí gửi xe (pricing.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Quản lý trạng thái bảng giá xe máy & ô tô theo thiết kế
  const pricingData = {
    motor: {
      name: 'Xe máy',
      day: { label: 'Ban ngày (06:00 - 22:00)', price: 5000, unit: '/lượt' },
      night: { label: 'Qua đêm (22:00 - 06:00)', price: 8000, unit: '/lượt qua đêm' },
      cycle: { label: 'Chu kỳ 24 giờ', price: 20000, unit: '/24 giờ' }
    },
    car: {
      name: 'Ô tô',
      day: { label: 'Ban ngày (06:00 - 22:00)', price: 30000, unit: '/lượt' },
      night: { label: 'Qua đêm (22:00 - 06:00)', price: 50000, unit: '/lượt qua đêm' },
      cycle: { label: 'Chu kỳ 24 giờ', price: 80000, unit: '/24 giờ' }
    }
  };

  // 2. Dữ liệu mẫu Nhật ký thay đổi mức phí (Audit Log)
  const priceAuditLogs = [
    {
      time: '14:30 - 15/04/2026',
      vehicle: 'Xe máy',
      tier: 'Ban ngày (06:00 - 22:00)',
      oldPrice: '4.000 VNĐ',
      newPrice: '5.000 VNĐ',
      actor: 'Nguyễn Thành Tùng (Admin)'
    },
    {
      time: '09:15 - 12/04/2026',
      vehicle: 'Ô tô',
      tier: 'Qua đêm (22:00 - 06:00)',
      oldPrice: '45.000 VNĐ',
      newPrice: '50.000 VNĐ',
      actor: 'Nguyễn Thành Tùng (Admin)'
    },
    {
      time: '17:00 - 01/04/2026',
      vehicle: 'Ô tô',
      tier: 'Chu kỳ 24 giờ',
      oldPrice: '70.000 VNĐ',
      newPrice: '80.000 VNĐ',
      actor: 'Nguyễn Thành Tùng (Admin)'
    },
    {
      time: '08:00 - 20/03/2026',
      vehicle: 'Xe máy',
      tier: 'Chu kỳ 24 giờ',
      oldPrice: '15.000 VNĐ',
      newPrice: '20.000 VNĐ',
      actor: 'Nguyễn Thành Tùng (Admin)'
    }
  ];

  let editingContext = null;

  // 3. Tham chiếu các phần tử DOM
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');

  // Modal Chỉnh sửa giá
  const editPriceModalBackdrop = document.getElementById('editPriceModalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const editPriceForm = document.getElementById('editPriceForm');
  const modalRuleName = document.getElementById('modalRuleName');
  const inputNewPrice = document.getElementById('inputNewPrice');

  // Modal Lịch sử đổi giá (Audit Log)
  const btnHistoryLog = document.getElementById('btnHistoryLog');
  const historyLogModalBackdrop = document.getElementById('historyLogModalBackdrop');
  const historyLogCloseBtn = document.getElementById('historyLogCloseBtn');
  const historyLogCloseFooterBtn = document.getElementById('historyLogCloseFooterBtn');
  const historyLogTableBody = document.getElementById('historyLogTableBody');

  // Toast thông báo
  const toastNotification = document.getElementById('toastNotification');
  const toastDesc = document.getElementById('toastDesc');
  let toastTimer = null;

  // Hiển thị Toast thông báo thành công
  function showToast(message) {
    if (!toastNotification) return;
    if (toastDesc) toastDesc.textContent = message;
    toastNotification.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotification.classList.remove('show');
    }, 3500);
  }

  // Cập nhật số tiền hiển thị trên giao diện
  function updatePriceDisplay(vehicle, tier) {
    const el = document.getElementById(`price-${vehicle}-${tier}`);
    if (el) {
      const val = pricingData[vehicle][tier].price;
      el.textContent = `${val.toLocaleString('vi-VN')} VNĐ`;
    }
  }

  // Mở modal chỉnh sửa mức phí
  function openEditModal(vehicle, tier) {
    editingContext = { vehicle, tier };
    const ruleInfo = pricingData[vehicle][tier];
    const vehicleName = pricingData[vehicle].name;

    if (modalRuleName) {
      modalRuleName.textContent = `${vehicleName} • ${ruleInfo.label}`;
    }

    if (inputNewPrice) {
      inputNewPrice.value = ruleInfo.price;
      inputNewPrice.focus();
    }

    if (editPriceModalBackdrop) {
      editPriceModalBackdrop.classList.add('show');
    }
  }

  // Đóng modal chỉnh sửa
  function closeEditModal() {
    if (editPriceModalBackdrop) {
      editPriceModalBackdrop.classList.remove('show');
    }
    editingContext = null;
  }

  // Mở modal Lịch sử đổi giá
  function openHistoryLogModal() {
    if (!historyLogModalBackdrop || !historyLogTableBody) return;

    historyLogTableBody.innerHTML = priceAuditLogs.map(log => `
      <tr>
        <td class="font-mono">${log.time}</td>
        <td><strong>${log.vehicle}</strong></td>
        <td>${log.tier}</td>
        <td class="price-old">${log.oldPrice}</td>
        <td class="price-new">${log.newPrice}</td>
        <td>${log.actor}</td>
      </tr>
    `).join('');

    historyLogModalBackdrop.classList.add('show');
  }

  // Đóng modal Lịch sử đổi giá
  function closeHistoryLogModal() {
    if (historyLogModalBackdrop) {
      historyLogModalBackdrop.classList.remove('show');
    }
  }

  // ==========================================================================
  // XỬ LÝ SỰ KIỆN TƯƠNG TÁC
  // ==========================================================================

  // A. Gán sự kiện click nút cây bút chỉnh sửa từng mức phí
  document.querySelectorAll('.btn-edit-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const vehicle = btn.getAttribute('data-vehicle');
      const tier = btn.getAttribute('data-tier');
      if (vehicle && tier) {
        openEditModal(vehicle, tier);
      }
    });
  });

  // B. Xử lý lưu form chỉnh sửa giá
  if (editPriceForm) {
    editPriceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!editingContext) return;

      const newPrice = parseInt(inputNewPrice.value, 10);
      if (isNaN(newPrice) || newPrice <= 0) {
        alert('Vui lòng nhập mức giá hợp lệ lớn hơn 0!');
        return;
      }

      const vehicle = editingContext.vehicle;
      const tier = editingContext.tier;
      const oldVal = pricingData[vehicle][tier].price;

      // Lưu giá trị mới vào state
      pricingData[vehicle][tier].price = newPrice;
      updatePriceDisplay(vehicle, tier);

      // Cập nhật dòng footer của thẻ
      const footerEl = document.getElementById(`footer-${vehicle}`);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      if (footerEl) {
        footerEl.innerHTML = `<i class="fa-regular fa-clock"></i> <span>Cập nhật lần cuối: <strong>${timeStr}</strong> bởi <strong>Nguyễn Thành Tùng</strong></span>`;
      }

      // Thêm vào đầu bảng Audit log
      priceAuditLogs.unshift({
        time: `${timeStr}`,
        vehicle: pricingData[vehicle].name,
        tier: pricingData[vehicle][tier].label,
        oldPrice: `${oldVal.toLocaleString('vi-VN')} VNĐ`,
        newPrice: `${newPrice.toLocaleString('vi-VN')} VNĐ`,
        actor: 'Nguyễn Thành Tùng (Admin)'
      });

      closeEditModal();

      // Kích hoạt Toast thông báo xanh
      showToast(`Đã cập nhật mức phí ${pricingData[vehicle].name} (${pricingData[vehicle][tier].label}) thành ${newPrice.toLocaleString('vi-VN')} VNĐ!`);
    });
  }

  // C. Đóng modal chỉnh sửa khi bấm nút Hủy hoặc X hoặc ngoài backdrop
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeEditModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);
  if (editPriceModalBackdrop) {
    editPriceModalBackdrop.addEventListener('click', (e) => {
      if (e.target === editPriceModalBackdrop) {
        closeEditModal();
      }
    });
  }

  // D. Mở & Đóng modal Lịch sử đổi giá
  if (btnHistoryLog) btnHistoryLog.addEventListener('click', openHistoryLogModal);
  if (historyLogCloseBtn) historyLogCloseBtn.addEventListener('click', closeHistoryLogModal);
  if (historyLogCloseFooterBtn) historyLogCloseFooterBtn.addEventListener('click', closeHistoryLogModal);
  if (historyLogModalBackdrop) {
    historyLogModalBackdrop.addEventListener('click', (e) => {
      if (e.target === historyLogModalBackdrop) {
        closeHistoryLogModal();
      }
    });
  }

  // E. Dropdown menu profile nhân viên/admin
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
});
