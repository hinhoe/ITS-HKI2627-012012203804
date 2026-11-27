// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Quản lý mức phí gửi xe (pricing.js)
// Kết nối trực tiếp bảng pricing_rules & pricing_audit_logs trong SQLite
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const actorName = window.initAdminShell ? window.initAdminShell() : 'Quản trị viên';

  const pricingState = {
    motor: {
      vehicleType: 'Xe máy',
      name: 'Xe máy',
      tiers: {
        day: { feeType: 'Ban ngày', label: 'Ban ngày (06:00 - 18:00)', price: 5000 },
        night: { feeType: 'Qua đêm', label: 'Qua đêm (18:00 - 06:00)', price: 10000 },
        cycle: { feeType: 'Chu kỳ 24 giờ', label: 'Chu kỳ 24 giờ', price: 20000 }
      }
    },
    car: {
      vehicleType: 'Ô tô',
      name: 'Ô tô',
      tiers: {
        day: { feeType: 'Ban ngày', label: 'Ban ngày (06:00 - 18:00)', price: 25000 },
        night: { feeType: 'Qua đêm', label: 'Qua đêm (18:00 - 06:00)', price: 50000 },
        cycle: { feeType: 'Chu kỳ 24 giờ', label: 'Chu kỳ 24 giờ', price: 80000 }
      }
    },
    bike: {
      vehicleType: 'Xe đạp / Đạp điện',
      name: 'Xe đạp / Đạp điện',
      tiers: {
        day: { feeType: 'Ban ngày', label: 'Ban ngày (06:00 - 18:00)', price: 3000 },
        night: { feeType: 'Qua đêm', label: 'Qua đêm (18:00 - 06:00)', price: 6000 },
        cycle: { feeType: 'Chu kỳ 24 giờ', label: 'Chu kỳ 24 giờ', price: 12000 }
      }
    }
  };

  let priceAuditLogs = [];
  let editingContext = null;

  const editPriceModalBackdrop = document.getElementById('editPriceModalBackdrop');
  const modalRuleName = document.getElementById('modalRuleName');
  const inputNewPrice = document.getElementById('inputNewPrice');
  const editPriceForm = document.getElementById('editPriceForm');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalCancelBtn = document.getElementById('modalCancelBtn');

  const btnHistoryLog = document.getElementById('btnHistoryLog');
  const historyLogModalBackdrop = document.getElementById('historyLogModalBackdrop');
  const historyLogCloseBtn = document.getElementById('historyLogCloseBtn');
  const historyLogCloseFooterBtn = document.getElementById('historyLogCloseFooterBtn');
  const historyLogTableBody = document.getElementById('historyLogTableBody');

  const toastNotification = document.getElementById('toastNotification');
  const toastDesc = document.getElementById('toastDesc');
  const headerMetaSummary = document.getElementById('headerMetaSummary');

  function showToast(message) {
    if (window.showAppToast) {
      window.showAppToast({
        title: 'Cập nhật thành công!',
        message,
        type: 'success'
      });
      return;
    }
    if (!toastNotification || !toastDesc) return;
    toastDesc.textContent = message;
    toastNotification.classList.add('show');
    setTimeout(() => toastNotification.classList.remove('show'), 3500);
  }

  function renderPricingCards() {
    Object.keys(pricingState).forEach(vKey => {
      const vObj = pricingState[vKey];
      Object.keys(vObj.tiers).forEach(tKey => {
        const el = document.getElementById(`price-${vKey}-${tKey}`);
        if (el) {
          el.textContent = `${Number(vObj.tiers[tKey].price).toLocaleString('vi-VN')} VNĐ`;
        }
      });

      const footerEl = document.getElementById(`footer-${vKey}`);
      if (footerEl) {
        if (vObj.lastUpdated && vObj.lastActor) {
          footerEl.innerHTML = `<i class="fa-regular fa-clock"></i> <span>Cập nhật lần cuối: <strong>${vObj.lastUpdated}</strong> bởi <strong>${vObj.lastActor}</strong></span>`;
        } else {
          footerEl.innerHTML = `<i class="fa-regular fa-clock"></i> <span>Đang áp dụng theo cấu hình hệ thống</span>`;
        }
      }
    });
  }

  async function loadPricingFromBackend() {
    try {
      const apiBase = window.getAdminApiBase();
      const res = await fetch(`${apiBase}/api/admin/pricing`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.capacity) {
        if (window.updateAdminSidebarCapacity) {
          window.updateAdminSidebarCapacity(data.capacity);
        }
        if (headerMetaSummary) {
          headerMetaSummary.textContent = `3 loại phương tiện • 3 mức phí mỗi loại • Bãi tối đa ${data.capacity.total_capacity} xe`;
        }
      }

      if (data.pricing) {
        Object.keys(data.pricing).forEach(vKey => {
          const remoteV = data.pricing[vKey];
          if (!pricingState[vKey] || !remoteV) return;
          pricingState[vKey].lastUpdated = remoteV.last_updated;
          pricingState[vKey].lastActor = remoteV.last_actor;

          const tiers = remoteV.tiers || {};
          Object.keys(tiers).forEach(tKey => {
            if (pricingState[vKey].tiers[tKey] && tiers[tKey].price !== undefined) {
              pricingState[vKey].tiers[tKey].price = Number(tiers[tKey].price);
            }
          });
        });
      }

      priceAuditLogs = data.logs || [];
      renderPricingCards();
    } catch (err) {
      console.error('Lỗi tải biểu phí từ CSDL:', err);
      renderPricingCards();
    }
  }

  function openEditModal(vehicleKey, tierKey) {
    const vObj = pricingState[vehicleKey];
    if (!vObj || !vObj.tiers[tierKey]) return;
    editingContext = { vehicleKey, tierKey };

    if (modalRuleName) {
      modalRuleName.textContent = `${vObj.name} • ${vObj.tiers[tierKey].label}`;
    }
    if (inputNewPrice) {
      inputNewPrice.value = vObj.tiers[tierKey].price;
      setTimeout(() => {
        inputNewPrice.focus();
        inputNewPrice.select();
      }, 60);
    }
    if (editPriceModalBackdrop) {
      editPriceModalBackdrop.classList.add('show');
    }
  }

  function closeEditModal() {
    if (editPriceModalBackdrop) {
      editPriceModalBackdrop.classList.remove('show');
    }
    editingContext = null;
  }

  function openHistoryLogModal() {
    if (!historyLogModalBackdrop || !historyLogTableBody) return;

    if (priceAuditLogs.length === 0) {
      historyLogTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 28px; color: #94a3b8;">
            Chưa có lịch sử chỉnh sửa mức phí nào được ghi nhận
          </td>
        </tr>
      `;
    } else {
      historyLogTableBody.innerHTML = priceAuditLogs.map(log => `
        <tr>
          <td class="font-mono">${log.time}</td>
          <td><strong>${log.vehicle}</strong></td>
          <td>${log.tier}</td>
          <td class="price-old">${Number(log.old_price).toLocaleString('vi-VN')} VNĐ</td>
          <td class="price-new">${Number(log.new_price).toLocaleString('vi-VN')} VNĐ</td>
          <td>${log.actor}</td>
        </tr>
      `).join('');
    }

    historyLogModalBackdrop.classList.add('show');
  }

  function closeHistoryLogModal() {
    if (historyLogModalBackdrop) {
      historyLogModalBackdrop.classList.remove('show');
    }
  }

  document.querySelectorAll('.btn-edit-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const vehicleKey = btn.getAttribute('data-vehicle');
      const tierKey = btn.getAttribute('data-tier');
      if (vehicleKey && tierKey) {
        openEditModal(vehicleKey, tierKey);
      }
    });
  });

  if (editPriceForm) {
    editPriceForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!editingContext) return;

      const newPrice = parseInt(inputNewPrice.value, 10);
      if (isNaN(newPrice) || newPrice < 1000 || newPrice % 1000 !== 0) {
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'Mức giá chưa hợp lệ',
            message: 'Mức giá phải từ 1.000 VNĐ trở lên và chia hết cho 1.000 VNĐ.',
            type: 'warning'
          });
        } else {
          alert('Mức giá phải từ 1.000 VNĐ trở lên và chia hết cho 1.000 VNĐ!');
        }
        return;
      }

      const { vehicleKey, tierKey } = editingContext;
      const vObj = pricingState[vehicleKey];
      const tierObj = vObj.tiers[tierKey];

      const submitBtn = editPriceForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang lưu...';
      }

      try {
        const apiBase = window.getAdminApiBase();
        const res = await fetch(`${apiBase}/api/admin/pricing`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_type: vObj.vehicleType,
            fee_type: tierObj.feeType,
            base_price: newPrice,
            actor: actorName || 'Quản trị viên'
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Không thể lưu biểu phí mới.');

        closeEditModal();
        await loadPricingFromBackend();
        showToast(data.message || `Đã cập nhật giá ${vObj.name} (${tierObj.label}) thành ${newPrice.toLocaleString('vi-VN')} VNĐ!`);
      } catch (err) {
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'Lưu biểu phí thất bại',
            message: err.message,
            type: 'error'
          });
        } else {
          alert(err.message);
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Lưu thay đổi';
        }
      }
    });
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeEditModal);
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeEditModal);
  if (editPriceModalBackdrop) {
    editPriceModalBackdrop.addEventListener('click', (e) => {
      if (e.target === editPriceModalBackdrop) closeEditModal();
    });
  }

  if (btnHistoryLog) btnHistoryLog.addEventListener('click', openHistoryLogModal);
  if (historyLogCloseBtn) historyLogCloseBtn.addEventListener('click', closeHistoryLogModal);
  if (historyLogCloseFooterBtn) historyLogCloseFooterBtn.addEventListener('click', closeHistoryLogModal);
  if (historyLogModalBackdrop) {
    historyLogModalBackdrop.addEventListener('click', (e) => {
      if (e.target === historyLogModalBackdrop) closeHistoryLogModal();
    });
  }

  loadPricingFromBackend();
});
