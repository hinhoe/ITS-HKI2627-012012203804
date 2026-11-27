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

  function formatVnd(num) {
    return (Number(num) || 0).toLocaleString('vi-VN');
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
            label: 'Doanh thu (Triệu VNĐ)',
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
                  const vndExact = Math.round((Number(context.raw) || 0) * 1_000_000);
                  return ` Doanh thu: ${vndExact.toLocaleString('vi-VN')} đ (${context.raw} Triệu)`;
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
              color: '#94a3b8',
              callback: value => Number(value).toLocaleString('vi-VN')
            },
            grid: { color: '#f1f5f9', drawBorder: false },
            title: {
              display: true,
              text: 'Lượt phương tiện',
              font: { family: 'Inter', size: 11, weight: '500' },
              color: '#94a3b8'
            }
          },
          yRevenue: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#94a3b8',
              callback: value => Number(value).toFixed(2)
            },
            grid: { display: false, drawBorder: false },
            title: {
              display: true,
              text: 'Triệu VNĐ',
              font: { family: 'Inter', size: 11, weight: '500' },
              color: '#94a3b8'
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
      renderAuditTable(data);
      renderChart(data.chart || {});
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

  loadDashboardData('7days', null);
});
