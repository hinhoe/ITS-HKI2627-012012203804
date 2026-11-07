// ==========================================================================
// HỆ THỐNG QUẢN LÝ BÃI ĐỖ XE - PARKTECH
// File JavaScript: Báo cáo & Thống kê Quản trị viên (dashboard.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Dữ liệu theo từng mốc thời gian lọc
  const dataByRange = {
    '7days': {
      kpiIn: '1.480',
      kpiOut: '1.432',
      kpiParking: '412',
      kpiRevenue: '7.420.000',
      labels: ['T2 (18/05)', 'T3 (19/05)', 'T4 (20/05)', 'T5 (21/05)', 'T6 (22/05)', 'T7 (23/05)', 'CN (Hôm nay)'],
      motor: [1120, 1180, 1230, 1270, 1310, 1390, 1480],
      car: [510, 560, 620, 690, 720, 830, 890],
      revenue: [5.3, 5.5, 5.8, 6.1, 6.3, 6.9, 7.42],
      audit: [
        { dateName: 'Hôm nay - CN (24/05/2025)', isCurrent: true, inCount: 1480, outCount: 1432, cash: 2180000, qr: 5240000 },
        { dateName: 'Thứ Bảy, 23/05/2025', isCurrent: false, inCount: 1368, outCount: 1332, cash: 2010000, qr: 4890000 },
        { dateName: 'Thứ Sáu, 22/05/2025', isCurrent: false, inCount: 1295, outCount: 1280, cash: 1850000, qr: 4480000 },
        { dateName: 'Thứ Năm, 21/05/2025', isCurrent: false, inCount: 1240, outCount: 1215, cash: 1740000, qr: 4360000 },
        { dateName: 'Thứ Tư, 20/05/2025', isCurrent: false, inCount: 1190, outCount: 1182, cash: 1620000, qr: 4180000 },
        { dateName: 'Thứ Ba, 19/05/2025', isCurrent: false, inCount: 1145, outCount: 1120, cash: 1550000, qr: 3950000 },
        { dateName: 'Thứ Hai, 18/05/2025', isCurrent: false, inCount: 1080, outCount: 1065, cash: 1480000, qr: 3820000 }
      ]
    },
    'today': {
      kpiIn: '1.480',
      kpiOut: '1.432',
      kpiParking: '412',
      kpiRevenue: '7.420.000',
      labels: ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'],
      motor: [220, 310, 260, 190, 240, 320, 280],
      car: [90, 140, 130, 110, 120, 160, 140],
      revenue: [1.1, 1.6, 1.3, 0.9, 1.2, 1.7, 1.4],
      audit: [
        { dateName: 'Hôm nay (24/05/2025)', isCurrent: true, inCount: 1480, outCount: 1432, cash: 2180000, qr: 5240000 }
      ]
    },
    'month': {
      kpiIn: '41.250',
      kpiOut: '39.880',
      kpiParking: '412',
      kpiRevenue: '215.600.000',
      labels: ['Tuần 1', 'Tuần 2', 'Tuần 3', 'Tuần 4'],
      motor: [9200, 9850, 10200, 11500],
      car: [4100, 4350, 4700, 5200],
      revenue: [48.5, 52.3, 54.8, 60.0],
      audit: [
        { dateName: 'Tuần 4 (18/05 - 24/05)', isCurrent: true, inCount: 10450, outCount: 10120, cash: 15400000, qr: 36800000 },
        { dateName: 'Tuần 3 (11/05 - 17/05)', isCurrent: false, inCount: 9800, outCount: 9650, cash: 14200000, qr: 34500000 },
        { dateName: 'Tuần 2 (04/05 - 10/05)', isCurrent: false, inCount: 9400, outCount: 9280, cash: 13800000, qr: 33100000 },
        { dateName: 'Tuần 1 (01/05 - 03/05)', isCurrent: false, inCount: 5200, outCount: 5100, cash: 7600000, qr: 18200000 }
      ]
    }
  };

  let currentChart = null;

  // 2. Tham chiếu các phần tử DOM
  const auditTableBody = document.getElementById('auditTableBody');
  const auditTableFoot = document.getElementById('auditTableFoot');
  const userProfileBtn = document.getElementById('userProfileBtn');
  const userDropdownMenu = document.getElementById('userDropdownMenu');
  const btnExportReport = document.getElementById('btnExportReport');
  const dateFilterButtons = document.querySelectorAll('.date-filter-btn');
  const customDatePicker = document.getElementById('customDatePicker');
  const customDateLabel = document.getElementById('customDateLabel');

  // ==========================================================================
  // HÀM RENDER DỮ LIỆU BẢNG ĐỐI SOÁT & DÒNG TỔNG CỘNG
  // ==========================================================================
  function renderAuditTable(rangeKey = '7days') {
    if (!auditTableBody) return;
    const items = dataByRange[rangeKey]?.audit || dataByRange['7days'].audit;

    // Cập nhật tiêu đề bảng theo kỳ lọc
    const auditTitle = document.getElementById('auditTitle');
    if (auditTitle) {
      if (rangeKey === '7days') auditTitle.textContent = 'Đối soát doanh thu 7 ngày gần nhất (1 tuần)';
      else if (rangeKey === 'today') auditTitle.textContent = 'Đối soát doanh thu ngày hôm nay';
      else if (rangeKey === 'month') auditTitle.textContent = 'Đối soát doanh thu theo các tuần trong tháng';
    }

    // Tính tổng các cột
    let totalIn = 0;
    let totalOut = 0;
    let totalCash = 0;
    let totalQr = 0;

    auditTableBody.innerHTML = items.map(item => {
      totalIn += item.inCount;
      totalOut += item.outCount;
      totalCash += item.cash;
      totalQr += item.qr;
      const rowTotal = item.cash + item.qr;

      return `
        <tr>
          <td>
            <div class="date-cell-wrapper">
              <span>${item.dateName}</span>
              ${item.isCurrent ? '<span class="badge-current-day">Hiện tại</span>' : ''}
            </div>
          </td>
          <td class="font-mono">${item.inCount.toLocaleString('vi-VN')}</td>
          <td class="font-mono">${item.outCount.toLocaleString('vi-VN')}</td>
          <td class="td-amount">${item.cash.toLocaleString('vi-VN')} đ</td>
          <td class="td-amount">${item.qr.toLocaleString('vi-VN')} đ</td>
          <td class="td-total-amount">${rowTotal.toLocaleString('vi-VN')} đ</td>
        </tr>
      `;
    }).join('');

    // Render dòng tổng kết (Tfoot)
    if (auditTableFoot) {
      const grandTotal = totalCash + totalQr;
      auditTableFoot.innerHTML = `
        <tr>
          <td><strong>TỔNG CỘNG</strong></td>
          <td class="font-mono">${totalIn.toLocaleString('vi-VN')}</td>
          <td class="font-mono">${totalOut.toLocaleString('vi-VN')}</td>
          <td class="td-amount">${totalCash.toLocaleString('vi-VN')} đ</td>
          <td class="td-amount">${totalQr.toLocaleString('vi-VN')} đ</td>
          <td class="td-total-amount">${grandTotal.toLocaleString('vi-VN')} đ</td>
        </tr>
      `;
    }
  }

  // ==========================================================================
  // KHỞI TẠO BIỂU ĐỒ LƯU LƯỢNG & DOANH THU (CHART.JS COMBO CHART)
  // ==========================================================================
  function initChart(rangeKey = '7days') {
    const canvas = document.getElementById('trafficRevenueChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rangeData = dataByRange[rangeKey] || dataByRange['7days'];

    if (currentChart) {
      currentChart.destroy();
    }

    currentChart = new Chart(ctx, {
      data: {
        labels: rangeData.labels,
        datasets: [
          // 1. Đường doanh thu (Line)
          {
            type: 'line',
            label: 'Doanh thu (Triệu VNĐ)',
            data: rangeData.revenue,
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
          // 2. Cột xe máy (Bar)
          {
            type: 'bar',
            label: 'Xe máy (Lượt)',
            data: rangeData.motor,
            backgroundColor: '#1d4ed8',
            hoverBackgroundColor: '#1e40af',
            borderRadius: 3,
            barPercentage: 0.5,
            categoryPercentage: 0.6,
            yAxisID: 'yTraffic',
            order: 2
          },
          // 3. Cột ô tô (Bar)
          {
            type: 'bar',
            label: 'Ô tô (Lượt)',
            data: rangeData.car,
            backgroundColor: '#0f172a',
            hoverBackgroundColor: '#1e293b',
            borderRadius: 3,
            barPercentage: 0.5,
            categoryPercentage: 0.6,
            yAxisID: 'yTraffic',
            order: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 500
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleFont: { family: 'Inter', size: 12, weight: '600' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4,
            callbacks: {
              label: function(context) {
                if (context.dataset.type === 'line') {
                  return ` Doanh thu: ${context.raw} Triệu VNĐ`;
                }
                return ` ${context.dataset.label}: ${context.raw.toLocaleString('vi-VN')} lượt`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              drawBorder: false
            },
            ticks: {
              font: { family: 'Inter', size: 11, weight: '500' },
              color: '#64748b'
            }
          },
          // Trục tung trái: Lượt phương tiện
          yTraffic: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#94a3b8',
              callback: function(value) {
                return value === 0 ? '0' : value.toLocaleString('vi-VN');
              }
            },
            grid: {
              color: '#f1f5f9',
              drawBorder: false
            },
            title: {
              display: true,
              text: 'Lượt phương tiện',
              font: { family: 'Inter', size: 11, weight: '500' },
              color: '#94a3b8'
            }
          },
          // Trục tung phải: Doanh thu triệu VNĐ
          yRevenue: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            ticks: {
              font: { family: 'Inter', size: 11 },
              color: '#94a3b8',
              callback: function(value) {
                return value.toFixed(1);
              }
            },
            grid: {
              display: false,
              drawBorder: false
            },
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

  // ==========================================================================
  // XỬ LÝ SỰ KIỆN TƯƠNG TÁC
  // ==========================================================================

  // 1. Bật / Tắt menu hồ sơ quản trị viên
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

  // 2. Chuyển đổi bộ lọc khoảng thời gian nhanh (Hôm nay, 7 ngày qua, Tháng này)
  if (dateFilterButtons) {
    dateFilterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range');
        if (!range) return; // nút date picker riêng

        dateFilterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (customDateLabel) {
          customDateLabel.textContent = 'Tùy chọn ngày';
        }

        renderAuditTable(range);
        initChart(range);
      });
    });
  }

  // 3. Tùy chọn ngày từ lịch DatePicker
  const customDateBtn = document.getElementById('customDateBtn');
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

      dateFilterButtons.forEach(b => b.classList.remove('active'));
      customDateBtn.classList.add('active');

      if (customDateLabel) {
        customDateLabel.textContent = formattedDate;
      }

      // Cập nhật tiêu đề bảng theo ngày đã chọn
      const auditTitle = document.getElementById('auditTitle');
      if (auditTitle) {
        auditTitle.textContent = `Đối soát doanh thu ngày ${formattedDate}`;
      }

      // Nạp dữ liệu giả lập theo ngày được chọn
      renderAuditTable('today');
      initChart('today');
    });
  }

  // 4. Nút Xuất báo cáo
  if (btnExportReport) {
    btnExportReport.addEventListener('click', () => {
      const activeBtn = document.querySelector('.date-filter-btn.active');
      const timeText = activeBtn ? activeBtn.textContent.trim() : '7 ngày qua';
      alert(`Hệ thống đang xuất Báo cáo Thống kê doanh thu & Lưu lượng xe (${timeText}) ra file Excel (.xlsx)...\nVui lòng kiểm tra thư mục Tải xuống!`);
    });
  }

  // Khởi chạy render ban đầu
  renderAuditTable('7days');
  initChart('7days');
});
