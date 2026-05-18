/**
 * @file csvParser.js
 * @layer Utils
 * @module admin
 * @description Utilities parse và export CSV cho product import/export
 */

const CSV_HEADERS = [
  'name', 'slug', 'short_description', 'base_price', 'category_slug',
  'brand', 'status', 'stock_quantity', 'sku', 'weight_kg', 'image_urls',
  'spec_cpu', 'spec_ram', 'spec_storage', 'spec_display', 'spec_battery',
];

/**
 * Parse một dòng CSV, xử lý giá trị có dấu phẩy bên trong ngoặc kép.
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse toàn bộ CSV content → mảng objects { header: value }.
 */
function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.every((v) => v === '')) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] !== undefined ? values[idx] : ''; });
    row._lineNumber = i + 1;
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Validate một row từ CSV/JSON.
 */
function validateRow(row, rowIndex) {
  const errors = [];
  if (!row.name || !String(row.name).trim())
    errors.push({ row: rowIndex, field: 'name', message: 'Trường name là bắt buộc' });
  if (!row.base_price || isNaN(parseFloat(row.base_price)))
    errors.push({ row: rowIndex, field: 'base_price', message: 'base_price phải là số hợp lệ' });
  else if (parseFloat(row.base_price) < 0)
    errors.push({ row: rowIndex, field: 'base_price', message: 'base_price không được âm' });
  if (!row.category_slug || !String(row.category_slug).trim())
    errors.push({ row: rowIndex, field: 'category_slug', message: 'Trường category_slug là bắt buộc' });
  return errors;
}

/**
 * Escape field cho CSV — bọc ngoặc kép nếu có dấu phẩy/ngoặc kép/newline.
 */
function escapeCsvField(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

module.exports = { CSV_HEADERS, parseCsvLine, parseCsv, validateRow, escapeCsvField };
