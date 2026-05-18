/**
 * @file exportUtils.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import ExcelJS from 'exceljs';

/**
 * Xuất dữ liệu ra file Excel (.xlsx) — dùng exceljs thay xlsx (bảo mật hơn)
 * @param data Mảng đối tượng cần xuất
 * @param fileName Tên file (không có phần mở rộng)
 * @param sheetName Tên trang tính
 */
export const exportToExcel = async (
  data: Record<string, unknown>[],
  fileName: string,
  sheetName: string = 'Sheet1',
) => {
  if (data.length === 0) return;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);

  // Lấy headers từ keys của object đầu tiên
  const headers = Object.keys(data[0]);
  ws.columns = headers.map((h) => ({ header: h, key: h, width: 20 }));

  // Thêm các hàng dữ liệu
  ws.addRows(data);

  // Tạo blob và trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Xuất dữ liệu ra file CSV (.csv)
 * @param data Mảng đối tượng cần xuất
 * @param fileName Tên file (không có phần mở rộng)
 */
export const exportToCSV = (data: Record<string, unknown>[], fileName: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Thêm hàng tiêu đề
  csvRows.push(headers.join(','));

  // Thêm các hàng dữ liệu
  for (const row of data) {
    const values = headers.map((header) => {
      const escaped = ('' + row[header]).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
