// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH / PARKAIVISION
// File JavaScript: Báo cáo & Thống kê Quản trị viên (dashboard.js)
// Kết nối dữ liệu thời gian thực từ SQLite qua API (/api/admin/dashboard)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  if (window.initAdminShell) {
    window.initAdminShell();
  }

  let currentChart = null;
  let revenueShareChart = null;
  let currentRange = '7days';
  let currentCustomDate = null;

  const auditTableBody = document.getElementById('auditTableBody');
  const auditTableFoot = document.getElementById('auditTableFoot');
  const auditTitle = document.getElementById('auditTitle');
  const chartSubtitle = document.getElementById('chartSubtitle');
  const btnExportReport = document.getElementById('btnExportReport');
  const dateFilterButtons = document.querySelectorAll('.date-filter-btn[data-range]');
  const customDateBtn = document.getElementById('customDateBtn');
  const customDatePicker = document.getElementById('customDatePicker');
  const customDateLabel = document.getElementById('customDateLabel');

  const kpiTotalIn = document.getElementById('kpiTotalIn');
  const kpiTotalOut = document.getElementById('kpiTotalOut');
  const kpiParkedNow = document.getElementById('kpiParkedNow');
  const kpiCapacityMeta = document.getElementById('kpiCapacityMeta');
  const kpiRevenue = document.getElementById('kpiRevenue');
  const kpiPeriodLabelIn = document.getElementById('kpiPeriodLabelIn');

  const aiRateBadge = document.getElementById('aiRateBadge');
  const aiAutoRate = document.getElementById('aiAutoRate');
  const aiAvgConf = document.getElementById('aiAvgConf');
  const aiBikeCount = document.getElementById('aiBikeCount');
  const aiAutoCount = document.getElementById('aiAutoCount');
  const aiManualCount = document.getElementById('aiManualCount');
  const aiProgressBar = document.getElementById('aiProgressBar');
  const alertTotalBadge = document.getElementById('alertTotalBadge');
  const alertsList = document.getElementById('alertsList');

  const doughnutCenterTotal = document.getElementById('doughnutCenterTotal');
  const revShareMotorPct = document.getElementById('revShareMotorPct');
  const revShareMotorVal = document.getElementById('revShareMotorVal');
  const revShareCarPct = document.getElementById('revShareCarPct');
  const revShareCarVal = document.getElementById('revShareCarVal');
  const revShareBikePct = document.getElementById('revShareBikePct');
  const revShareBikeVal = document.getElementById('revShareBikeVal');

  // Archive & Cleanup (Chọn Tháng -> Chọn Tuần 1-4 -> Xuất Excel -> Xóa)
  const archiveMonthSelect = document.getElementById('archiveMonthSelect');
  const archiveWeekSelect = document.getElementById('archiveWeekSelect');
  const archiveStatsBadge = document.getElementById('archiveStatsBadge');
  const btnArchiveExport = document.getElementById('btnArchiveExport');
  const btnArchiveCleanup = document.getElementById('btnArchiveCleanup');
  const archiveConfirmModalBackdrop = document.getElementById('archiveConfirmModalBackdrop');
  const archiveModalTitle = document.getElementById('archiveModalTitle');
  const archiveModalDesc = document.getElementById('archiveModalDesc');
  const btnCloseArchiveModalTop = document.getElementById('btnCloseArchiveModalTop');
  const btnCancelArchiveModal = document.getElementById('btnCancelArchiveModal');
  const btnConfirmArchiveCleanup = document.getElementById('btnConfirmArchiveCleanup');
  let archiveMonthsTree = [];
  let exportedBackupToken = null;
  let exportedBackupKey = null;

  function formatVnd(num) {
    return (Number(num) || 0).toLocaleString('vi-VN');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderKPIs(data) {
    const kpi = data.kpi || {};
    const cap = data.capacity || {};

    if (kpiTotalIn) kpiTotalIn.textContent = formatVnd(kpi.total_in);
    if (kpiTotalOut) kpiTotalOut.textContent = formatVnd(kpi.total_out);
    if (kpiParkedNow) kpiParkedNow.textContent = formatVnd(kpi.parked_now);
    if (kpiRevenue) kpiRevenue.textContent = formatVnd(kpi.total_revenue);
    if (kpiPeriodLabelIn) kpiPeriodLabelIn.textContent = `Trong kỳ ${data.period_title || 'báo cáo'}`;

    if (kpiCapacityMeta) {
      const cur = Number(cap.current_count) || 0;
      const total = Number(cap.total_capacity) || 500;
      const pct = (typeof cap.percent === 'number' ? cap.percent : 0).toFixed(1);
      kpiCapacityMeta.innerHTML = `
        <span>${cur}/${total} chỗ</span>
        <span class="dot-separator">•</span>
        <span>${pct}% công suất</span>
      `;
    }

    if (window.updateAdminSidebarCapacity) {
      window.updateAdminSidebarCapacity(cap);
    }
  }

  function renderAiAndAlerts(data) {
    const ai = data.ai_stats || {};
    const alerts = data.alerts || {};
    const autoRate = Number(ai.auto_rate || 0).toFixed(1);
    const avgConf = Number(ai.avg_confidence || 0).toFixed(1);

    if (aiRateBadge) aiRateBadge.textContent = `${autoRate}% tự động`;
    if (aiAutoRate) aiAutoRate.textContent = `${autoRate}%`;
    if (aiAvgConf) aiAvgConf.textContent = `${avgConf}%`;
    if (aiBikeCount) aiBikeCount.textContent = formatVnd(ai.bike_tickets || 0);
    if (aiAutoCount) aiAutoCount.textContent = formatVnd(ai.alpr_auto || 0);
    if (aiManualCount) aiManualCount.textContent = formatVnd(ai.alpr_manual || 0);
    if (aiProgressBar) aiProgressBar.style.width = `${Math.min(100, Math.max(0, Number(ai.auto_rate || 0)))}%`;

    const overstays = alerts.overstay_vehicles || [];
    const manuals = alerts.manual_or_low_conf || [];
    const total = Number(alerts.total_alerts || 0);

    if (alertTotalBadge) {
      alertTotalBadge.textContent = `${total} cảnh báo`;
      alertTotalBadge.className = total > 0 ? 'insight-pill warn' : 'insight-pill ok';
    }

    if (!alertsList) return;
    if (overstays.length === 0 && manuals.length === 0) {
      alertsList.innerHTML = `
        <div class="alerts-empty">
          <i class="fa-solid fa-shield-check"></i>
          <span>Hệ thống vận hành ổn định, chưa ghi nhận cảnh báo</span>
        </div>
      `;
      return;
    }

    const rows = [];
    overstays.forEach(item => {
      rows.push(`
        <div class="alert-row-item">
          <div class="alert-row-left">
            <span class="alert-plate-tag">${escapeHtml(item.plate_number)}</span>
            <span class="alert-row-desc">${escapeHtml(item.vehicle_type)} • Vào lúc ${escapeHtml(item.checkin_time)}</span>
          </div>
          <span class="alert-badge-tag overstay">Gửi tồn ${escapeHtml(item.hours_parked)}h</span>
        </div>
      `);
    });
    manuals.forEach(item => {
      rows.push(`
        <div class="alert-row-item">
          <div class="alert-row-left">
            <span class="alert-plate-tag">${escapeHtml(item.plate_number)}</span>
            <span class="alert-row-desc">${escapeHtml(item.vehicle_type)} • ${escapeHtml(item.checkin_time)}</span>
          </div>
          <span class="alert-badge-tag manual">${escapeHtml(item.reason)}</span>
        </div>
      `);
    });
    alertsList.innerHTML = rows.join('');
  }

  function renderAuditTable(data) {
    if (!auditTableBody) return;
    const items = data.audit || [];

    if (auditTitle) {
      auditTitle.textContent = `Đối soát doanh thu (${data.period_title || '7 ngày gần nhất'})`;
    }
    if (chartSubtitle) {
      chartSubtitle.textContent = `Phân bổ lượt xe ô tô, xe máy, xe đạp / đạp điện và doanh thu (${data.period_title || '7 ngày gần nhất'})`;
    }

    if (items.length === 0) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: #94a3b8;">
            Chưa có dữ liệu giao dịch trong khoảng thời gian này
          </td>
        </tr>
      `;
      if (auditTableFoot) auditTableFoot.innerHTML = '';
      return;
    }

    let totalIn = 0;
    let totalOut = 0;
    let totalCar = 0;
    let totalMotor = 0;
    let totalBike = 0;
    let grandTotal = 0;

    auditTableBody.innerHTML = items.map(item => {
      totalIn += item.in_count;
      totalOut += item.out_count;
      totalCar += item.car_rev;
      totalMotor += item.motor_rev;
      totalBike += item.bike_rev;
      grandTotal += item.total_rev;

      return `
        <tr>
          <td>
            <div class="date-cell-wrapper">
              <span>${item.date_name}</span>
              ${item.is_current ? '<span class="badge-current-day">Hiện tại</span>' : ''}
            </div>
          </td>
          <td class="font-mono">${formatVnd(item.in_count)}</td>
          <td class="font-mono">${formatVnd(item.out_count)}</td>
          <td class="td-amount">${formatVnd(item.car_rev)} đ</td>
          <td class="td-amount">${formatVnd(item.motor_rev)} đ</td>
          <td class="td-amount">${formatVnd(item.bike_rev)} đ</td>
          <td class="td-total-amount">${formatVnd(item.total_rev)} đ</td>
        </tr>
      `;
    }).join('');

    if (auditTableFoot) {
      auditTableFoot.innerHTML = `
        <tr>
          <td><strong>TỔNG CỘNG</strong></td>
          <td class="font-mono">${formatVnd(totalIn)}</td>
          <td class="font-mono">${formatVnd(totalOut)}</td>
          <td class="td-amount">${formatVnd(totalCar)} đ</td>
          <td class="td-amount">${formatVnd(totalMotor)} đ</td>
          <td class="td-amount">${formatVnd(totalBike)} đ</td>
          <td class="td-total-amount">${formatVnd(grandTotal)} đ</td>
        </tr>
      `;
    }
  }

  function renderChart(chartData) {
    const canvas = document.getElementById('trafficRevenueChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (currentChart) {
      currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
      data: {
        labels: chartData.labels || [],
        datasets: [
          {
            type: 'line',
            label: 'Doanh thu (VNĐ)',
            data: chartData.revenue || [],
            borderColor: '#06b6d4',
            backgroundColor: '#06b6d4',
            borderWidth: 2.5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: '#06b6d4',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.25,
            yAxisID: 'yRevenue',
            order: 1
          },
          {
            type: 'bar',
            label: 'Xe máy (Lượt)',
            data: chartData.motor || [],
            backgroundColor: '#1d4ed8',
            hoverBackgroundColor: '#1e40af',
            borderRadius: 3,
            barPercentage: 0.6,
            categoryPercentage: 0.65,
            yAxisID: 'yTraffic',
            order: 2
          },
          {
            type: 'bar',
            label: 'Ô tô (Lượt)',
            data: chartData.car || [],
            backgroundColor: '#0f172a',
            hoverBackgroundColor: '#1e293b',
            borderRadius: 3,
            barPercentage: 0.6,
            categoryPercentage: 0.65,
            yAxisID: 'yTraffic',
            order: 3
          },
          {
            type: 'bar',
            label: 'Xe đạp / Đạp điện (Lượt)',
            data: chartData.bike || [],
            backgroundColor: '#7c3aed',
            hoverBackgroundColor: '#6d28d9',
            borderRadius: 3,
            barPercentage: 0.6,
            categoryPercentage: 0.65,
            yAxisID: 'yTraffic',
            order: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            callbacks: {
              label: function (context) {
                if (context.dataset.type === 'line') {
                  return ` Doanh thu: ${Number(context.raw || 0).toLocaleString('vi-VN')} đ`;
                }
                return ` ${context.dataset.label}: ${Number(context.raw).toLocaleString('vi-VN')} lượt`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#64748b' }
          },
          yTraffic: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: { family: 'Inter', size: 11 },
              color: '#64748b',
              callback: value => `${Number(value).toLocaleString('vi-VN')} lượt`
            },
            grid: { color: '#f1f5f9', drawBorder: false },
            title: {
              display: true,
              text: 'Số lượt xe',
              font: { family: 'Inter', size: 11, weight: '600' },
              color: '#64748b'
            }
          },
          yRevenue: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#0891b2',
              callback: value => {
                const v = Number(value) || 0;
                if (v === 0) return '0 đ';
                if (v >= 1_000_000) {
                  const m = v / 1_000_000;
                  return `${Number.isInteger(m) ? m : m.toFixed(1).replace('.', ',')} tr`;
                }
                return `${Math.round(v).toLocaleString('vi-VN')} đ`;
              }
            },
            grid: { display: false, drawBorder: false },
            title: {
              display: true,
              text: 'Doanh thu (VNĐ)',
              font: { family: 'Inter', size: 11, weight: '600' },
              color: '#0891b2'
            }
          }
        }
      }
    });
  }

  function renderRevenueShareDoughnut(data) {
    const items = data.audit || [];
    let motorRev = 0;
    let carRev = 0;
    let bikeRev = 0;
    items.forEach(item => {
      motorRev += Number(item.motor_rev || 0);
      carRev += Number(item.car_rev || 0);
      bikeRev += Number(item.bike_rev || 0);
    });

    const grandTotal = motorRev + carRev + bikeRev;
    const pct = (val) => grandTotal > 0 ? `${((val / grandTotal) * 100).toFixed(1)}%` : '0.0%';

    if (doughnutCenterTotal) doughnutCenterTotal.textContent = `${formatVnd(grandTotal)} đ`;
    if (revShareMotorPct) revShareMotorPct.textContent = pct(motorRev);
    if (revShareMotorVal) revShareMotorVal.textContent = `${formatVnd(motorRev)} đ`;
    if (revShareCarPct) revShareCarPct.textContent = pct(carRev);
    if (revShareCarVal) revShareCarVal.textContent = `${formatVnd(carRev)} đ`;
    if (revShareBikePct) revShareBikePct.textContent = pct(bikeRev);
    if (revShareBikeVal) revShareBikeVal.textContent = `${formatVnd(bikeRev)} đ`;

    const canvas = document.getElementById('revenueShareChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');

    if (revenueShareChart) {
      revenueShareChart.destroy();
    }

    const hasData = grandTotal > 0;
    revenueShareChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasData ? ['Xe máy', 'Ô tô', 'Xe đạp / Đạp điện'] : ['Chưa có doanh thu'],
        datasets: [{
          data: hasData ? [motorRev, carRev, bikeRev] : [1],
          backgroundColor: hasData ? ['#1d4ed8', '#0f172a', '#7c3aed'] : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: hasData ? 4 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            backgroundColor: '#0f172a',
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                const val = Number(context.raw || 0);
                const share = grandTotal > 0 ? ((val / grandTotal) * 100).toFixed(1) : '0.0';
                return ` ${context.label}: ${val.toLocaleString('vi-VN')} đ (${share}%)`;
              }
            }
          }
        }
      }
    });
  }

  async function loadDashboardData(rangeKey = '7days', customDate = null) {
    currentRange = rangeKey;
    currentCustomDate = customDate;

    try {
      const apiBase = window.getAdminApiBase();
      const params = new URLSearchParams({ range_key: rangeKey });
      if (rangeKey === 'custom' && customDate) {
        params.append('date', customDate);
      }

      const res = await fetch(`${apiBase}/api/admin/dashboard?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      renderKPIs(data);
      renderAiAndAlerts(data);
      renderAuditTable(data);
      renderChart(data.chart || {});
      renderRevenueShareDoughnut(data);
    } catch (err) {
      console.error('Lỗi tải dữ liệu Dashboard Admin:', err);
      if (window.showAppToast) {
        window.showAppToast({
          title: 'Lỗi tải thống kê',
          message: 'Không thể kết nối Backend để tải số liệu Dashboard.',
          type: 'error'
        });
      }
    }
  }

  dateFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const range = btn.getAttribute('data-range');
      if (!range) return;

      document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (customDateLabel) customDateLabel.textContent = 'Tùy chọn ngày';

      loadDashboardData(range, null);
    });
  });

  if (customDateBtn && customDatePicker) {
    customDateBtn.addEventListener('click', () => {
      if (typeof customDatePicker.showPicker === 'function') {
        try {
          customDatePicker.showPicker();
        } catch (err) {
          customDatePicker.click();
        }
      }
    });

    customDatePicker.addEventListener('change', (e) => {
      const selectedDate = e.target.value;
      if (!selectedDate) return;

      const [year, month, day] = selectedDate.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      document.querySelectorAll('.date-filter-btn').forEach(b => b.classList.remove('active'));
      customDateBtn.classList.add('active');
      if (customDateLabel) customDateLabel.textContent = formattedDate;

      loadDashboardData('custom', selectedDate);
    });
  }

  if (btnExportReport) {
    btnExportReport.addEventListener('click', async () => {
      const apiBase = window.getAdminApiBase();
      const params = new URLSearchParams({ range_key: currentRange });
      if (currentRange === 'custom' && currentCustomDate) {
        params.append('date', currentCustomDate);
      }

      btnExportReport.disabled = true;
      const origHtml = btnExportReport.innerHTML;
      btnExportReport.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xuất...</span>';

      try {
        const res = await fetch(`${apiBase}/api/admin/dashboard/export?${params.toString()}`);
        if (!res.ok) throw new Error('Không thể xuất file Excel.');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BaoCao_ParkTech_${currentRange}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        if (window.showAppToast) {
          window.showAppToast({
            title: 'Xuất báo cáo thành công!',
            message: 'File Excel thống kê doanh thu (.xlsx) đã được tải xuống.',
            type: 'success'
          });
        }
      } catch (err) {
        if (window.showAppAlert) {
          await window.showAppAlert({
            title: 'Xuất báo cáo thất bại',
            message: err.message,
            type: 'error'
          });
        } else {
          alert(err.message);
        }
      } finally {
        btnExportReport.disabled = false;
        btnExportReport.innerHTML = origHtml;
      }
    });
  }

  // ==========================================================================
  // SAO LƯU EXCEL & XÓA DỮ LIỆU ĐỊNH KỲ (THÁNG -> TUẦN 1-4 -> EXCEL -> XÓA)
  // ==========================================================================
  function getSelectedWeekInfo() {
    const mVal = archiveMonthSelect?.value || '';
    const wVal = archiveWeekSelect?.value || 'ALL';
    const mObj = archiveMonthsTree.find(m => m.month === mVal);
    const wObj = mObj?.weeks?.find(w => w.week === wVal);
    return { mObj, wObj };
  }

  function updateArchiveControlsState() {
    const { mObj, wObj } = getSelectedWeekInfo();
    if (!mObj || !wObj) {
      if (archiveStatsBadge) archiveStatsBadge.textContent = 'Chưa có dữ liệu';
      if (btnArchiveExport) btnArchiveExport.disabled = true;
      if (btnArchiveCleanup) btnArchiveCleanup.disabled = true;
      return;
    }

    const cnt = Number(wObj.session_count || 0);
    if (archiveStatsBadge) {
      archiveStatsBadge.textContent = cnt > 0
        ? `${cnt} lượt • ${formatVnd(wObj.total_revenue)} đ • ${wObj.image_files_count} ảnh (${wObj.image_size_kb} KB)`
        : 'Không có lượt gửi trong mục này';
    }

    if (btnArchiveExport) btnArchiveExport.disabled = (cnt === 0);
    const lockKey = `${mObj.month}:${wObj.week}`;
    const isUnlocked = Boolean(cnt > 0 && exportedBackupToken && exportedBackupKey === lockKey);
    if (btnArchiveCleanup) btnArchiveCleanup.disabled = !isUnlocked;
  }

  function renderWeekOptionsForMonth() {
    if (!archiveWeekSelect) return;
    const mVal = archiveMonthSelect?.value || '';
    const mObj = archiveMonthsTree.find(m => m.month === mVal);
    if (!mObj || !mObj.weeks) {
      archiveWeekSelect.innerHTML = '<option value="ALL">Cả tháng</option>';
      updateArchiveControlsState();
      return;
    }
    archiveWeekSelect.innerHTML = mObj.weeks.map(w =>
      `<option value="${escapeHtml(w.week)}">${escapeHtml(w.label)} — ${w.session_count} lượt</option>`
    ).join('');
    exportedBackupToken = null;
    exportedBackupKey = null;
    updateArchiveControlsState();
  }

  async function loadArchiveSummary() {
    if (!archiveMonthSelect) return;
    try {
      const apiBase = window.getAdminApiBase();
      const res = await fetch(`${apiBase}/api/admin/archive/summary`);
      if (!res.ok) return;
      const data = await res.json();
      archiveMonthsTree = data.months || [];

      archiveMonthSelect.innerHTML = archiveMonthsTree.map(m =>
        `<option value="${escapeHtml(m.month)}">${escapeHtml(m.label)}</option>`
      ).join('');
      exportedBackupToken = null;
      exportedBackupKey = null;
      renderWeekOptionsForMonth();
    } catch (err) {
      console.warn('Không tải được danh sách tháng/tuần lưu trữ:', err);
    }
  }

  if (archiveMonthSelect) {
    archiveMonthSelect.addEventListener('change', renderWeekOptionsForMonth);
  }

  if (archiveWeekSelect) {
    archiveWeekSelect.addEventListener('change', () => {
      exportedBackupToken = null;
      exportedBackupKey = null;
      updateArchiveControlsState();
    });
  }

  if (btnArchiveExport) {
    btnArchiveExport.addEventListener('click', async () => {
      const { mObj, wObj } = getSelectedWeekInfo();
      if (!mObj || !wObj) return;

      btnArchiveExport.disabled = true;
      btnArchiveExport.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xuất Excel...</span>';
      try {
        const apiBase = window.getAdminApiBase();
        const urlApi = `${apiBase}/api/admin/archive/export?month=${encodeURIComponent(mObj.month)}&week=${encodeURIComponent(wObj.week)}`;
        const res = await fetch(urlApi);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Không thể xuất file sao lưu');
        }

        const token = res.headers.get('X-Archive-Token');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SaoLuu_ParkTech_${mObj.month}_${wObj.week === 'ALL' ? 'CaThang' : `Tuan${wObj.week}`}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        if (token) {
          exportedBackupToken = token;
          exportedBackupKey = `${mObj.month}:${wObj.week}`;
          updateArchiveControlsState();
        }
        if (window.showAppToast) {
          window.showAppToast({
            title: `Đã xuất Excel (${wObj.label})`,
            message: 'Nút "4. Xóa dữ liệu đã chọn" đã được mở khóa.',
            type: 'success'
          });
        }
      } catch (err) {
        if (window.showAppAlert) {
          window.showAppAlert({ title: 'Lỗi xuất sao lưu', message: err.message, type: 'error' });
        } else {
          alert(err.message);
        }
      } finally {
        btnArchiveExport.innerHTML = '<i class="fa-solid fa-file-excel"></i> <span>3. Xuất file Excel</span>';
        updateArchiveControlsState();
      }
    });
  }

  function closeArchiveModal() {
    if (archiveConfirmModalBackdrop) archiveConfirmModalBackdrop.classList.remove('show');
  }

  if (btnCloseArchiveModalTop) btnCloseArchiveModalTop.addEventListener('click', closeArchiveModal);
  if (btnCancelArchiveModal) btnCancelArchiveModal.addEventListener('click', closeArchiveModal);
  if (archiveConfirmModalBackdrop) {
    archiveConfirmModalBackdrop.addEventListener('click', (e) => {
      if (e.target === archiveConfirmModalBackdrop) closeArchiveModal();
    });
  }

  if (btnArchiveCleanup) {
    btnArchiveCleanup.addEventListener('click', () => {
      const { mObj, wObj } = getSelectedWeekInfo();
      if (!mObj || !wObj || !exportedBackupToken || exportedBackupKey !== `${mObj.month}:${wObj.week}`) return;

      const label = wObj.week === 'ALL' ? wObj.label : `${wObj.label} (${mObj.label})`;
      if (archiveModalTitle) archiveModalTitle.textContent = `Xóa dữ liệu: ${label}`;
      if (archiveModalDesc) {
        archiveModalDesc.textContent = `Hiện có ${wObj.session_count} lượt gửi và ${wObj.image_files_count} file ảnh (${wObj.image_size_kb} KB). Chọn hình thức xóa:`;
      }
      if (archiveConfirmModalBackdrop) archiveConfirmModalBackdrop.classList.add('show');
    });
  }

  if (btnConfirmArchiveCleanup) {
    btnConfirmArchiveCleanup.addEventListener('click', async () => {
      const { mObj, wObj } = getSelectedWeekInfo();
      if (!mObj || !wObj || !exportedBackupToken) return;
      const checkedRadio = document.querySelector('input[name="archiveCleanupMode"]:checked');
      const mode = checkedRadio ? checkedRadio.value : 'images_only';

      btnConfirmArchiveCleanup.disabled = true;
      btnConfirmArchiveCleanup.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Đang xóa...</span>';
      try {
        const apiBase = window.getAdminApiBase();
        const res = await fetch(`${apiBase}/api/admin/archive/cleanup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: mObj.month,
            week: wObj.week,
            mode,
            backup_token: exportedBackupToken
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || 'Xóa dữ liệu thất bại');

        closeArchiveModal();
        if (window.showAppToast) {
          window.showAppToast({
            title: 'Xóa dữ liệu hoàn tất',
            message: data.message || 'Đã giải phóng dữ liệu đã chọn.',
            type: 'success'
          });
        }
        await loadArchiveSummary();
        loadDashboardData(currentRange, currentCustomDate);
      } catch (err) {
        if (window.showAppAlert) {
          window.showAppAlert({ title: 'Không thể xóa dữ liệu', message: err.message, type: 'error' });
        } else {
          alert(err.message);
        }
      } finally {
        btnConfirmArchiveCleanup.disabled = false;
        btnConfirmArchiveCleanup.innerHTML = '<i class="fa-solid fa-trash-can"></i> <span>Xác nhận xóa</span>';
      }
    });
  }

  loadDashboardData('7days', null);
  loadArchiveSummary();
});
