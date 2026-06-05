/**
 * Mutation-kill tests cho product-import-service.js (baseline 59.07%).
 *
 * 2 helper nội bộ (_buildLookupMaps, _insertProductRow) KHÔNG export → test gián
 * tiếp qua importProducts. Mock repository để assert CHÍNH XÁC arg create* (atomicity:
 * transaction sentinel) + control lookup. Mock csv-parser (parseCsv/validateRow) để
 * điều khiển input tất định; giữ escapeCsvField + CSV_HEADERS thật cho exportProducts.
 */

process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utils/product-helpers', () => ({
  enrichProductData: jest.fn((p) => p),
}));

jest.mock('@modules/admin/repositories/sequelize-product-import-repository', () => ({
  runInTransaction: jest.fn(),
  findCategoriesForImport: jest.fn(),
  findBrandsForImport: jest.fn(),
  findProductBySlug: jest.fn(),
  createProduct: jest.fn(),
  createProductVariant: jest.fn(),
  createProductImage: jest.fn(),
  createProductCategory: jest.fn(),
  createProductSpecification: jest.fn(),
  findProductsByIds: jest.fn(),
  findProductsForExport: jest.fn(),
}));

jest.mock('@modules/admin/utils/csv-parser', () => {
  const actual = jest.requireActual('@modules/admin/utils/csv-parser');
  return {
    ...actual,
    parseCsv: jest.fn(),
    validateRow: jest.fn(),
  };
});

const repo = require('@modules/admin/repositories/sequelize-product-import-repository');
const logger = require('@utils/logger');
const vectorStore = require('@services/vector-store/vector-store');
const { parseCsv, validateRow } = require('@modules/admin/utils/csv-parser');
const {
  importProducts,
  exportProducts,
} = require('@modules/admin/services/product-import-service');

const TX = { __isTransaction: true };
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

function jsonFile(arr) {
  return { originalname: 'p.json', buffer: Buffer.from(JSON.stringify(arr)) };
}
function csvFile() {
  return { originalname: 'p.csv', buffer: Buffer.from('dummy') };
}

beforeEach(() => {
  jest.clearAllMocks();
  repo.runInTransaction.mockImplementation((work) => work(TX));
  repo.findCategoriesForImport.mockResolvedValue([{ slug: 'dien-thoai', id: 1 }]);
  repo.findBrandsForImport.mockResolvedValue([{ name: 'Apple', slug: 'apple-inc', id: 5 }]);
  repo.findProductBySlug.mockResolvedValue(null);
  repo.createProduct.mockResolvedValue({ id: 100 });
  repo.createProductVariant.mockResolvedValue({ id: 200 });
  repo.createProductImage.mockResolvedValue({ id: 300 });
  repo.createProductCategory.mockResolvedValue({ id: 400 });
  repo.createProductSpecification.mockResolvedValue({ id: 500 });
  repo.findProductsByIds.mockResolvedValue([]);
  validateRow.mockReturnValue([]);
});

// ─── _insertProductRow (qua importProducts JSON) ────────────────────────────

describe('importProducts — insert 1 row đầy đủ field', () => {
  const fullRow = {
    name: '  iPhone  ',
    base_price: '999.5',
    category_slug: ' dien-thoai ',
    brand: ' Apple ',
    short_description: ' desc ',
    status: 'inactive',
    stock_quantity: '7',
    sku: ' SKU1 ',
    image_urls: ' a.jpg | b.jpg | ',
    spec_cpu: ' A17 ',
    spec_ram: '8GB',
    spec_storage: '256GB',
    spec_display: '6.1"',
    spec_battery: '4000',
  };

  test('createProduct nhận data đã trim/parse + categoryId/brandId resolve + transaction', async () => {
    await importProducts({ file: jsonFile([fullRow]), adminId: 1 });

    expect(repo.createProduct).toHaveBeenCalledWith(
      {
        name: 'iPhone',
        slug: 'iphone', // slug rỗng → slugify(name)
        shortDescription: 'desc',
        basePrice: 999.5,
        categoryId: 1,
        brandId: 5, // brandMap['apple']
        status: 'inactive',
        stockQuantity: 7,
      },
      TX,
    );
  });

  test('createProductVariant từ sku (price, stock, isDefault) trong transaction', async () => {
    await importProducts({ file: jsonFile([fullRow]), adminId: 1 });
    expect(repo.createProductVariant).toHaveBeenCalledWith(
      { productId: 100, sku: 'SKU1', price: 999.5, stockQuantity: 7, isDefault: true },
      TX,
    );
  });

  test('createProductImage cho từng URL (thumbnail + sortOrder)', async () => {
    await importProducts({ file: jsonFile([fullRow]), adminId: 1 });
    expect(repo.createProductImage).toHaveBeenCalledTimes(2);
    expect(repo.createProductImage).toHaveBeenNthCalledWith(
      1,
      { productId: 100, imageUrl: 'a.jpg', isThumbnail: true, sortOrder: 1 },
      TX,
    );
    expect(repo.createProductImage).toHaveBeenNthCalledWith(
      2,
      { productId: 100, imageUrl: 'b.jpg', isThumbnail: false, sortOrder: 2 },
      TX,
    );
  });

  test('createProductCategory khi categoryId resolve được', async () => {
    await importProducts({ file: jsonFile([fullRow]), adminId: 1 });
    expect(repo.createProductCategory).toHaveBeenCalledWith({ productId: 100, categoryId: 1 }, TX);
  });

  test('createProductSpecification cho 5 spec đúng key/value/order', async () => {
    await importProducts({ file: jsonFile([fullRow]), adminId: 1 });
    expect(repo.createProductSpecification).toHaveBeenCalledTimes(5);
    const calls = repo.createProductSpecification.mock.calls.map((c) => c[0]);
    expect(calls).toEqual([
      { productId: 100, name: 'CPU', value: 'A17', sortOrder: 1 },
      { productId: 100, name: 'RAM', value: '8GB', sortOrder: 2 },
      { productId: 100, name: 'Bộ nhớ', value: '256GB', sortOrder: 3 },
      { productId: 100, name: 'Màn hình', value: '6.1"', sortOrder: 4 },
      { productId: 100, name: 'Pin', value: '4000', sortOrder: 5 },
    ]);
    expect(repo.createProductSpecification).toHaveBeenCalledWith(expect.any(Object), TX);
  });
});

describe('importProducts — nhánh fallback của _insertProductRow', () => {
  test('slug có sẵn → dùng slug (trim), KHÔNG slugify', async () => {
    await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1', slug: ' custom-slug ' }]),
      adminId: 1,
    });
    expect(repo.createProduct.mock.calls[0][0].slug).toBe('custom-slug');
  });

  test('slug trùng DB → append -timestamp', async () => {
    repo.findProductBySlug.mockResolvedValueOnce({ id: 1 }); // tồn tại
    await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1', slug: 'dup' }]),
      adminId: 1,
    });
    expect(repo.createProduct.mock.calls[0][0].slug).toMatch(/^dup-\d+$/);
  });

  test('category_slug không khớp → categoryId null + KHÔNG tạo product_category', async () => {
    await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1', category_slug: 'khong-ton-tai' }]),
      adminId: 1,
    });
    expect(repo.createProduct.mock.calls[0][0].categoryId).toBeNull();
    expect(repo.createProductCategory).not.toHaveBeenCalled();
  });

  test('không brand → brandId null', async () => {
    await importProducts({ file: jsonFile([{ name: 'X', base_price: '1' }]), adminId: 1 });
    expect(repo.createProduct.mock.calls[0][0].brandId).toBeNull();
  });

  test('status mặc định active, stock mặc định 0', async () => {
    await importProducts({ file: jsonFile([{ name: 'X', base_price: '1' }]), adminId: 1 });
    expect(repo.createProduct.mock.calls[0][0].status).toBe('active');
    expect(repo.createProduct.mock.calls[0][0].stockQuantity).toBe(0);
  });

  test('không sku → KHÔNG tạo variant', async () => {
    await importProducts({ file: jsonFile([{ name: 'X', base_price: '1' }]), adminId: 1 });
    expect(repo.createProductVariant).not.toHaveBeenCalled();
  });

  test('không image_urls → KHÔNG tạo image', async () => {
    await importProducts({ file: jsonFile([{ name: 'X', base_price: '1' }]), adminId: 1 });
    expect(repo.createProductImage).not.toHaveBeenCalled();
  });

  test('spec rỗng → KHÔNG tạo specification', async () => {
    await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1', spec_cpu: '   ' }]),
      adminId: 1,
    });
    expect(repo.createProductSpecification).not.toHaveBeenCalled();
  });

  test('sku chỉ khoảng trắng → KHÔNG tạo variant (kill bỏ trim L130)', async () => {
    await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1', sku: '   ' }]),
      adminId: 1,
    });
    expect(repo.createProductVariant).not.toHaveBeenCalled();
  });

  test('image_urls chỉ khoảng trắng → KHÔNG tạo image (kill bỏ trim L143)', async () => {
    await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1', image_urls: '   ' }]),
      adminId: 1,
    });
    expect(repo.createProductImage).not.toHaveBeenCalled();
  });

  test('slug tự sinh dùng strict:true (loại ký tự đặc biệt)', async () => {
    await importProducts({
      file: jsonFile([{ name: 'Pro.Max', base_price: '1' }]),
      adminId: 1,
    });
    // strict:true → 'promax' (KHÔNG phải 'pro.max' của strict:false)
    expect(repo.createProduct.mock.calls[0][0].slug).toBe('promax');
  });
});

// ─── importProducts — parse + validate + result ─────────────────────────────

describe('importProducts — parse & validate', () => {
  test('JSON không parse được → AppError 400', async () => {
    const file = { originalname: 'p.json', buffer: Buffer.from('{not json') };
    await expect(importProducts({ file, adminId: 1 })).rejects.toMatchObject({
      statusCode: 400,
      message: 'File JSON không hợp lệ — không thể parse',
    });
  });

  test('JSON không phải mảng → AppError 400', async () => {
    const file = { originalname: 'p.json', buffer: Buffer.from('{"a":1}') };
    await expect(importProducts({ file, adminId: 1 })).rejects.toMatchObject({
      statusCode: 400,
      message: 'File JSON phải là mảng các object sản phẩm',
    });
  });

  test('CSV rỗng → AppError 400', async () => {
    parseCsv.mockReturnValueOnce({ rows: [] });
    await expect(importProducts({ file: csvFile(), adminId: 1 })).rejects.toMatchObject({
      statusCode: 400,
      message: 'File CSV rỗng hoặc không có dữ liệu',
    });
  });

  test('JSON gán _lineNumber = idx+2 (báo lỗi đúng dòng)', async () => {
    // row đầu (idx 0) lỗi DB → rowError.row phải = 2
    repo.createProduct.mockRejectedValueOnce(new Error('dup sku'));
    const res = await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1' }]),
      adminId: 1,
    });
    expect(res.errors).toContainEqual({ row: 2, field: 'general', message: 'dup sku' });
  });

  test('CSV path dùng parseCsv → rows', async () => {
    parseCsv.mockReturnValueOnce({ rows: [{ name: 'C', base_price: '1', _lineNumber: 2 }] });
    const res = await importProducts({ file: csvFile(), adminId: 1 });
    expect(parseCsv).toHaveBeenCalled();
    expect(res.successCount).toBe(1);
  });

  test('tất cả row fail validation → allFailed, KHÔNG insert', async () => {
    validateRow.mockReturnValue([{ row: 2, field: 'name', message: 'thiếu name' }]);
    const res = await importProducts({
      file: jsonFile([{ base_price: '1' }]),
      adminId: 1,
    });
    expect(res).toEqual({
      allFailed: true,
      errors: [{ row: 2, field: 'name', message: 'thiếu name' }],
      totalRows: 1,
    });
    expect(repo.createProduct).not.toHaveBeenCalled();
  });

  test('partial: 1 valid + 1 invalid → chỉ insert valid, failedCount=1', async () => {
    validateRow.mockImplementation((row) =>
      row._lineNumber === 3 ? [{ row: 3, field: 'name', message: 'thiếu' }] : [],
    );
    const res = await importProducts({
      file: jsonFile([{ name: 'A', base_price: '1' }, { base_price: '2' }]),
      adminId: 1,
    });
    expect(repo.createProduct).toHaveBeenCalledTimes(1);
    // Kill L260 ===→!==: phải insert ĐÚNG row hợp lệ (line 2, name 'A'), không phải row lỗi
    expect(repo.createProduct.mock.calls[0][0].name).toBe('A');
    expect(res.successCount).toBe(1);
    expect(res.failedCount).toBe(1);
    expect(res.errors).toContainEqual({ row: 3, field: 'name', message: 'thiếu' });
  });

  test('lỗi insert DB không message → fallback "Lỗi khi insert vào DB" + logger.warn', async () => {
    repo.createProduct.mockRejectedValueOnce({});
    const res = await importProducts({
      file: jsonFile([{ name: 'X', base_price: '1' }]),
      adminId: 1,
    });
    expect(res.errors).toContainEqual({
      row: 2,
      field: 'general',
      message: 'Lỗi khi insert vào DB',
    });
    expect(res.failedCount).toBe(1);
    expect(res.successCount).toBe(0);
    // Kill L277 template `` → assert đúng prefix log (message err undefined vì err={})
    expect(logger.warn).toHaveBeenCalledWith('[IMPORT] Lỗi dòng 2:', undefined);
  });

  test('có sản phẩm mới → sync vector store (setImmediate)', async () => {
    repo.findProductsByIds.mockResolvedValueOnce([{ toJSON: () => ({ id: 100 }) }]);
    await importProducts({ file: jsonFile([{ name: 'X', base_price: '1' }]), adminId: 1 });
    await flushAsync();
    expect(repo.findProductsByIds).toHaveBeenCalledWith([100]);
    expect(vectorStore.upsertProduct).toHaveBeenCalledWith({ id: 100 });
    expect(vectorStore.save).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('[VECTOR] Đã sync 1 sản phẩm mới vào vector store');
  });

  test('0 sản phẩm mới (row hợp lệ nhưng fail DB) → KHÔNG schedule setImmediate sync', async () => {
    repo.createProduct.mockRejectedValue(new Error('db'));
    await importProducts({ file: jsonFile([{ name: 'Y', base_price: '2' }]), adminId: 1 });
    await flushAsync();
    expect(vectorStore.upsertProduct).not.toHaveBeenCalled();
    // Kill L281 >→>= và conditional→true: 0 sản phẩm thì KHÔNG vào setImmediate nên save không gọi
    expect(vectorStore.save).not.toHaveBeenCalled();
    expect(repo.findProductsByIds).not.toHaveBeenCalled();
  });
});

// ─── exportProducts ─────────────────────────────────────────────────────────

describe('exportProducts', () => {
  const product = {
    name: 'iPhone',
    slug: 'iphone',
    shortDescription: 'Mô tả',
    basePrice: 1000,
    category: { slug: 'dien-thoai' },
    brand: { name: 'Apple' },
    status: 'active',
    stockQuantity: 9,
    productImages: [{ imageUrl: 'a.jpg' }, { imageUrl: 'b.jpg' }],
    productSpecifications: [
      { name: 'CPU', value: 'A17' },
      { name: 'RAM', value: '8GB' },
      { name: 'Bộ nhớ', value: '256GB' },
      { name: 'Màn hình', value: '6.1' },
      { name: 'Pin', value: '4000' },
    ],
  };

  test('format=json → array object đúng field + image join "|" + spec map', async () => {
    repo.findProductsForExport.mockResolvedValueOnce([product]);
    const out = await exportProducts('json');
    expect(out).toEqual([
      {
        name: 'iPhone',
        slug: 'iphone',
        short_description: 'Mô tả',
        base_price: 1000,
        category_slug: 'dien-thoai',
        brand: 'Apple',
        status: 'active',
        stock_quantity: 9,
        image_urls: 'a.jpg|b.jpg',
        spec_cpu: 'A17',
        spec_ram: '8GB',
        'spec_bộ nhớ': '256GB',
        'spec_màn hình': '6.1',
        spec_pin: '4000',
      },
    ]);
  });

  test('format=json — fallback các field rỗng', async () => {
    repo.findProductsForExport.mockResolvedValueOnce([{ name: 'B', slug: 'b', basePrice: 0 }]);
    const out = await exportProducts('json');
    expect(out[0]).toMatchObject({
      short_description: '',
      category_slug: '',
      brand: '',
      status: 'active',
      stock_quantity: 0,
      image_urls: '',
    });
  });

  test('format=csv → header + row escape + spec mapping về cột CSV', async () => {
    repo.findProductsForExport.mockResolvedValueOnce([product]);
    const { CSV_HEADERS } = jest.requireActual('@modules/admin/utils/csv-parser');
    const csv = await exportProducts('csv');
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    // cột: name,slug,short_desc,base_price,cat,brand,status,stock,sku(''),weight(''),images,cpu,ram,storage,display,battery
    // lookup trực tiếp: specMap['bộ nhớ']='256GB', specMap['màn hình']='6.1', specMap['pin']='4000'
    expect(lines[1]).toBe(
      'iPhone,iphone,Mô tả,1000,dien-thoai,Apple,active,9,,,a.jpg|b.jpg,A17,8GB,256GB,6.1,4000',
    );
  });

  test('format=csv — product tối thiểu → fallback đúng từng cột', async () => {
    repo.findProductsForExport.mockResolvedValueOnce([{ name: 'B', slug: 'b', basePrice: 5 }]);
    const cols = (await exportProducts('csv')).split('\n')[1].split(',');
    expect(cols[2]).toBe(''); // short_description || ''
    expect(cols[4]).toBe(''); // category?.slug || ''
    expect(cols[5]).toBe(''); // brand?.name || ''
    expect(cols[6]).toBe('active'); // status || 'active' (kill || → && và 'active' → '')
    expect(cols[7]).toBe('0'); // stockQuantity || 0
    expect(cols[10]).toBe(''); // images
    expect(cols[11]).toBe(''); // spec_cpu || ''
    expect(cols[12]).toBe(''); // spec_ram || ''
  });

  test('format=csv — specKey tiếng Việt bộ nhớ/màn hình/pin → cột storage/display/battery có giá trị', async () => {
    repo.findProductsForExport.mockResolvedValueOnce([
      {
        name: 'C',
        slug: 'c',
        basePrice: 5,
        productSpecifications: [
          { name: 'Bộ nhớ', value: '512GB' },
          { name: 'Màn hình', value: '7' },
          { name: 'Pin', value: '5000' },
        ],
      },
    ]);
    const csv = await exportProducts('csv');
    const cols = csv.split('\n')[1].split(',');
    // storage=index13, display=14, battery=15
    expect(cols[13]).toBe('512GB');
    expect(cols[14]).toBe('7');
    expect(cols[15]).toBe('5000');
  });
});
