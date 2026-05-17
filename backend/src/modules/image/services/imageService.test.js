/**
 * Unit tests cho ImageService (src/services/image.js)
 *
 * Strategy: mock sharp, fs.promises, uuid, Image model — tất cả I/O bị isolate.
 * Không có file thật nào bị chạm đến.
 */

// ── Mocks phải đứng trước require service ──────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'fixed-uuid-1234' }));

const mockSharp = {
  rotate: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  png: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  withMetadata: jest.fn().mockReturnThis(),
  toFile: jest.fn().mockResolvedValue({}),
  metadata: jest.fn().mockResolvedValue({ width: 800, height: 600 }),
};
const mockSharpFactory = jest.fn(() => mockSharp);
jest.mock('sharp', () => mockSharpFactory);

const mockFsPromises = {
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  copyFile: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn(),
};
jest.mock('fs', () => ({
  promises: mockFsPromises,
}));

const mockImageCreate = jest.fn();
const mockImageFindByPk = jest.fn();
const mockImageFindAll = jest.fn();
const mockImageDestroy = jest.fn();
jest.mock(
  '../../../models/image',
  () => ({
    create: (...args) => mockImageCreate(...args),
    findByPk: (...args) => mockImageFindByPk(...args),
    findAll: (...args) => mockImageFindAll(...args),
  }),
  { virtual: true },
);

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// ── Load service SETELAH mock ──────────────────────────────────────────────
const imageService = require('./imageService');

// ── Helper ─────────────────────────────────────────────────────────────────
function makeFile(overrides = {}) {
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 102400,
    path: '/tmp/upload_photo.jpg',
    ...overrides,
  };
}

function makeImageRecord(overrides = {}) {
  const record = {
    id: 10,
    filePath: 'images/product/2026/05/fixed-uuid-1234.jpg',
    fileName: 'fixed-uuid-1234.jpg',
    category: 'product',
    destroy: mockImageDestroy,
    ...overrides,
  };
  return record;
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  // Default happy-path stubs
  mockImageCreate.mockResolvedValue(makeImageRecord());
  mockImageFindByPk.mockResolvedValue(makeImageRecord());
  mockImageFindAll.mockResolvedValue([]);
  mockImageDestroy.mockResolvedValue(undefined);
  mockFsPromises.mkdir.mockResolvedValue(undefined);
  mockFsPromises.unlink.mockResolvedValue(undefined);
  mockFsPromises.copyFile.mockResolvedValue(undefined);
  mockFsPromises.writeFile.mockResolvedValue(undefined);
  mockSharp.toFile.mockResolvedValue({});
  mockSharp.metadata.mockResolvedValue({ width: 800, height: 600 });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateUniqueFileName', () => {
  it('trả về UUID + extension từ tên gốc', () => {
    const result = imageService.generateUniqueFileName('my-photo.jpg');
    expect(result).toBe('fixed-uuid-1234.jpg');
  });

  it('giữ đúng extension khi tên gốc có dấu chấm nhiều lần', () => {
    const result = imageService.generateUniqueFileName('my.photo.final.png');
    expect(result).toBe('fixed-uuid-1234.png');
  });

  it('extension viết thường được giữ nguyên', () => {
    const result = imageService.generateUniqueFileName('img.WEBP');
    expect(result).toBe('fixed-uuid-1234.WEBP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('generateFilePath', () => {
  it('trả về đường dẫn có cấu trúc images/<category>/<year>/<month>/<fileName>', () => {
    const result = imageService.generateFilePath('product', 'test.jpg');
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Normalize separators: Windows dùng \, Linux dùng /
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toContain(`images/product/${year}/${month}/test.jpg`);
  });

  it('month padding là 2 chữ số (tháng 1 → 01)', () => {
    // Giả lập tháng 1 bằng cách spy
    const spy = jest.spyOn(global, 'Date').mockImplementation(() => ({
      getFullYear: () => 2026,
      getMonth: () => 0, // January
    }));
    const result = imageService.generateFilePath('user', 'avatar.png');
    const normalized = result.replace(/\\/g, '/');
    expect(normalized).toContain('2026/01/avatar.png');
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getImageDimensions', () => {
  it('trả về width và height khi sharp.metadata() thành công', async () => {
    mockSharp.metadata.mockResolvedValue({ width: 1920, height: 1080 });

    const result = await imageService.getImageDimensions('/path/to/img.jpg');

    expect(mockSharpFactory).toHaveBeenCalledWith('/path/to/img.jpg');
    expect(result).toEqual({ width: 1920, height: 1080 });
  });

  it('trả về { width: null, height: null } khi sharp throw', async () => {
    mockSharp.metadata.mockRejectedValue(new Error('unsupported format'));

    const result = await imageService.getImageDimensions('/bad/path.bmp');

    expect(result).toEqual({ width: null, height: null });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('processImage', () => {
  it('gọi sharp().rotate().withMetadata(false).toFile() theo thứ tự chuẩn', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', {});

    expect(mockSharpFactory).toHaveBeenCalledWith('/in.jpg');
    expect(mockSharp.rotate).toHaveBeenCalled();
    expect(mockSharp.withMetadata).toHaveBeenCalledWith(false);
    expect(mockSharp.toFile).toHaveBeenCalledWith('/out.jpg');
  });

  it('gọi resize() khi có options.width hoặc height', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', { width: 400, height: 300 });

    expect(mockSharp.resize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 400, height: 300 }),
    );
  });

  it('KHÔNG gọi resize() khi không có width/height', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', {});
    expect(mockSharp.resize).not.toHaveBeenCalled();
  });

  it('gọi jpeg() khi outputPath kết thúc bằng .jpg và có quality', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', { quality: 80 });
    expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 80 });
  });

  it('gọi png() khi outputPath kết thúc bằng .png và có quality', async () => {
    await imageService.processImage('/in.jpg', '/out.png', { quality: 75 });
    expect(mockSharp.png).toHaveBeenCalledWith({ quality: 75 });
  });

  it('gọi webp() khi outputPath kết thúc bằng .webp và có quality', async () => {
    await imageService.processImage('/in.jpg', '/out.webp', { quality: 85 });
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 });
  });

  it('throw AppError(500) khi sharp.toFile() thất bại', async () => {
    mockSharp.toFile.mockRejectedValue(new Error('disk full'));

    await expect(imageService.processImage('/in.jpg', '/out.jpg', {})).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to process image',
    });
  });

  it('tạo thư mục đích trước khi ghi file', async () => {
    await imageService.processImage('/in.jpg', '/some/nested/dir/out.jpg', {});
    expect(mockFsPromises.mkdir).toHaveBeenCalledWith(expect.stringContaining('nested/dir'), {
      recursive: true,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('processProductImage', () => {
  it('gọi sharp().rotate().resize(800,800).webp({quality:85}).withMetadata(false).toFile()', async () => {
    await imageService.processProductImage('/in.jpg', '/out.webp');

    expect(mockSharp.rotate).toHaveBeenCalled();
    expect(mockSharp.resize).toHaveBeenCalledWith(
      800,
      800,
      expect.objectContaining({ fit: 'inside' }),
    );
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 });
    expect(mockSharp.withMetadata).toHaveBeenCalledWith(false);
    expect(mockSharp.toFile).toHaveBeenCalledWith('/out.webp');
  });

  it('throw AppError(500) khi xử lý thất bại', async () => {
    mockSharp.toFile.mockRejectedValueOnce(new Error('IO error'));

    await expect(imageService.processProductImage('/in.jpg', '/out.webp')).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to process product image',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('uploadImage', () => {
  it('upload thành công → trả về object với id, url, fileName, dimensions', async () => {
    mockSharp.metadata.mockResolvedValue({ width: 800, height: 600 });
    // makeImageRecord trả về id: 10 — dùng đúng id đó để assert
    mockImageCreate.mockResolvedValue(makeImageRecord({ id: 10 }));

    const result = await imageService.uploadImage(makeFile(), {
      category: 'product',
      generateThumbs: false,
    });

    expect(result).toMatchObject({
      id: 10,
      url: expect.stringContaining('/uploads/'),
      dimensions: { width: 800, height: 600 },
      category: 'product',
    });
  });

  it('lưu vào DB với originalName, fileSize, mimeType đúng', async () => {
    const file = makeFile({ originalname: 'camera.jpg', size: 204800, mimetype: 'image/jpeg' });
    await imageService.uploadImage(file, { category: 'product', generateThumbs: false });

    expect(mockImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: 'camera.jpg',
        fileSize: 204800,
        mimeType: 'image/jpeg',
      }),
    );
  });

  it('optimize=false → gọi fs.copyFile thay vì sharp', async () => {
    await imageService.uploadImage(makeFile(), { optimize: false, generateThumbs: false });

    expect(mockFsPromises.copyFile).toHaveBeenCalled();
    expect(mockSharp.toFile).not.toHaveBeenCalled();
  });

  it('optimize=true (default) → gọi sharp để xử lý ảnh', async () => {
    await imageService.uploadImage(makeFile(), { generateThumbs: false });

    expect(mockSharp.toFile).toHaveBeenCalled();
    expect(mockFsPromises.copyFile).not.toHaveBeenCalled();
  });

  it('xóa file tạm sau khi upload xong', async () => {
    await imageService.uploadImage(makeFile({ path: '/tmp/tempfile123.jpg' }), {
      generateThumbs: false,
    });

    expect(mockFsPromises.unlink).toHaveBeenCalledWith('/tmp/tempfile123.jpg');
  });

  it('category=product + generateThumbs=true → gọi generateThumbnails', async () => {
    // generateThumbnails gọi processImage 3 lần (small/medium/large)
    const result = await imageService.uploadImage(makeFile(), {
      category: 'product',
      generateThumbs: true,
    });

    // processImage được gọi ít nhất 4 lần (1 main + 3 thumbnails)
    expect(mockSharp.toFile.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(result.thumbnails).toBeDefined();
    expect(result.thumbnails.length).toBeGreaterThan(0);
  });

  it('category khác product → KHÔNG tạo thumbnails', async () => {
    const result = await imageService.uploadImage(makeFile(), {
      category: 'user',
      generateThumbs: true,
    });

    expect(result.thumbnails).toEqual([]);
  });

  it('throw AppError(500) khi Image.create thất bại', async () => {
    mockImageCreate.mockRejectedValue(new Error('DB error'));

    await expect(
      imageService.uploadImage(makeFile(), { generateThumbs: false }),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it('không throw khi xóa file tạm thất bại (lỗi fs.unlink)', async () => {
    mockFsPromises.unlink.mockRejectedValue(new Error('file not found'));

    // Không nên throw
    await expect(
      imageService.uploadImage(makeFile(), { generateThumbs: false }),
    ).resolves.toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('uploadMultipleImages', () => {
  it('tất cả file thành công → successful.length = total', async () => {
    const files = [makeFile({ originalname: 'a.jpg' }), makeFile({ originalname: 'b.jpg' })];

    const result = await imageService.uploadMultipleImages(files, { generateThumbs: false });

    expect(result.count.total).toBe(2);
    expect(result.count.successful).toBe(2);
    expect(result.count.failed).toBe(0);
    expect(result.successful).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it('một file thất bại → failed.length = 1, successful.length = 1', async () => {
    mockImageCreate
      .mockResolvedValueOnce(makeImageRecord())
      .mockRejectedValueOnce(new Error('DB error'));

    const files = [makeFile({ originalname: 'ok.jpg' }), makeFile({ originalname: 'bad.jpg' })];

    const result = await imageService.uploadMultipleImages(files, { generateThumbs: false });

    expect(result.count.successful).toBe(1);
    expect(result.count.failed).toBe(1);
    expect(result.failed[0].fileName).toBe('bad.jpg');
  });

  it('mảng rỗng → trả về count.total = 0', async () => {
    const result = await imageService.uploadMultipleImages([], {});

    expect(result.count.total).toBe(0);
    expect(result.successful).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getImageById', () => {
  it('tìm thấy → trả về image record', async () => {
    const record = makeImageRecord({ id: 55 });
    mockImageFindByPk.mockResolvedValue(record);

    const result = await imageService.getImageById(55);

    expect(result).toBe(record);
    expect(mockImageFindByPk).toHaveBeenCalledWith(55);
  });

  it('không tìm thấy → throw AppError(404)', async () => {
    mockImageFindByPk.mockResolvedValue(null);

    await expect(imageService.getImageById(999)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Image not found',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deleteImage', () => {
  it('xóa file vật lý + xóa thumbnail + destroy DB record', async () => {
    const record = makeImageRecord({
      id: 10,
      filePath: 'images/product/2026/05/abc.jpg',
      fileName: 'abc.jpg',
      category: 'product',
    });
    mockImageFindByPk.mockResolvedValue(record);

    const result = await imageService.deleteImage(10);

    expect(mockFsPromises.unlink).toHaveBeenCalled();
    expect(mockImageDestroy).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('category khác product → KHÔNG thử xóa thumbnail', async () => {
    const record = makeImageRecord({ category: 'user', fileName: 'avatar.jpg' });
    mockImageFindByPk.mockResolvedValue(record);

    await imageService.deleteImage(record.id);

    // unlink chỉ gọi 1 lần (file chính), không có 3 lần thumbnail
    const unlinkCalls = mockFsPromises.unlink.mock.calls;
    expect(unlinkCalls.length).toBe(1);
  });

  it('fs.unlink thất bại (file đã bị xóa thủ công) → KHÔNG throw, vẫn xóa DB record', async () => {
    const record = makeImageRecord({ category: 'user' });
    mockImageFindByPk.mockResolvedValue(record);
    mockFsPromises.unlink.mockRejectedValue(new Error('ENOENT'));

    await expect(imageService.deleteImage(record.id)).resolves.toEqual({ success: true });
    expect(mockImageDestroy).toHaveBeenCalled();
  });

  it('image không tồn tại → throw AppError(404)', async () => {
    mockImageFindByPk.mockResolvedValue(null);

    await expect(imageService.deleteImage(999)).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getImagesByProductId', () => {
  it('trả về danh sách ảnh của sản phẩm', async () => {
    const images = [makeImageRecord({ id: 1 }), makeImageRecord({ id: 2 })];
    mockImageFindAll.mockResolvedValue(images);

    const result = await imageService.getImagesByProductId(100);

    expect(result).toBe(images);
    expect(mockImageFindAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 100, isActive: true }),
      }),
    );
  });

  it('không có ảnh → trả về mảng rỗng', async () => {
    mockImageFindAll.mockResolvedValue([]);

    const result = await imageService.getImagesByProductId(999);

    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('convertBase64ToFile', () => {
  const validBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-data').toString('base64');

  it('parse base64 đúng → lưu file + tạo DB record', async () => {
    mockImageCreate.mockResolvedValue({ id: 20, ...makeImageRecord() });

    const result = await imageService.convertBase64ToFile(validBase64, { category: 'product' });

    expect(mockFsPromises.writeFile).toHaveBeenCalled();
    expect(mockImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'image/jpeg', category: 'product' }),
    );
    expect(result.url).toMatch('/uploads/');
  });

  it('input không phải data:URI hợp lệ → throw AppError (caught by outer handler)', async () => {
    // AppError(400) bên trong bị catch bởi outer try-catch và re-wrap thành AppError(500)
    // Đây là behavior thực tế của service
    await expect(
      imageService.convertBase64ToFile('not-valid-base64-data', {}),
    ).rejects.toHaveProperty('statusCode', 500);
  });

  it('trả về url dạng /uploads/...', async () => {
    const result = await imageService.convertBase64ToFile(validBase64, {});

    expect(result.url).toMatch(/^\/uploads\//);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getAllFiles', () => {
  it('trả về danh sách file phẳng từ cây thư mục đệ quy', async () => {
    // cấu trúc: /root/a.jpg, /root/sub/b.jpg
    mockFsPromises.readdir
      .mockResolvedValueOnce([
        { name: 'a.jpg', isDirectory: () => false },
        { name: 'sub', isDirectory: () => true },
      ])
      .mockResolvedValueOnce([{ name: 'b.jpg', isDirectory: () => false }]);

    const files = await imageService.getAllFiles('/root');

    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith('a.jpg'))).toBe(true);
    expect(files.some((f) => f.endsWith('b.jpg'))).toBe(true);
  });

  it('thư mục rỗng → trả về mảng rỗng', async () => {
    mockFsPromises.readdir.mockResolvedValue([]);

    const files = await imageService.getAllFiles('/empty');

    expect(files).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('cleanupOrphanedFiles', () => {
  it('trả về thống kê số file orphan đã xóa', async () => {
    // Giả lập 3 files trên đĩa, 2 trong DB, 1 orphan
    const uploadDir = imageService.uploadDir;
    mockFsPromises.readdir.mockResolvedValue([
      { name: 'active.jpg', isDirectory: () => false },
      { name: 'active2.jpg', isDirectory: () => false },
      { name: 'orphan.jpg', isDirectory: () => false },
    ]);

    mockImageFindAll.mockResolvedValue([{ filePath: 'active.jpg' }, { filePath: 'active2.jpg' }]);

    const result = await imageService.cleanupOrphanedFiles();

    expect(result.totalFiles).toBe(3);
    expect(result.activeFiles).toBe(2);
    expect(result.orphanedFiles).toBe(1);
    expect(mockFsPromises.unlink).toHaveBeenCalledTimes(1);
  });

  it('không có orphan → không gọi fs.unlink', async () => {
    mockFsPromises.readdir.mockResolvedValue([{ name: 'active.jpg', isDirectory: () => false }]);
    mockImageFindAll.mockResolvedValue([{ filePath: 'active.jpg' }]);

    await imageService.cleanupOrphanedFiles();

    expect(mockFsPromises.unlink).not.toHaveBeenCalled();
  });

  it('không có file trên đĩa → trả về orphanedFiles = 0', async () => {
    mockFsPromises.readdir.mockResolvedValue([]);
    mockImageFindAll.mockResolvedValue([]);

    const result = await imageService.cleanupOrphanedFiles();

    expect(result.orphanedFiles).toBe(0);
    expect(result.totalFiles).toBe(0);
  });
});
