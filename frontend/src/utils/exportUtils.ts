import * as XLSX from 'xlsx';

/**
 * Xuất dữ liệu ra file Excel (.xlsx)
 * @param data Mảng đối tượng cần xuất
 * @param fileName Tên file (không có phần mở rộng)
 * @param sheetName Tên trang tính
 */
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/**
 * Xuất dữ liệu ra file CSV (.csv)
 * @param data Mảng đối tượng cần xuất
 * @param fileName Tên file (không có phần mở rộng)
 */
export const exportToCSV = (data: any[], fileName: string) => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Thêm hàng tiêu đề
  csvRows.push(headers.join(','));

  // Thêm các hàng dữ liệu
  for (const row of data) {
    const values = headers.map(header => {
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
