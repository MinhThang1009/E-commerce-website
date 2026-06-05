// Image service — mutation-kill: assert OUTCOME (AppError message, Image.create
// fields, sharp options resize/quality/withMetadata, URL/path shape, base64
// regex + mime/ext, conditionals optimize/generateThumbs, getImagesByProductId
// query, uploadMultiple count, deleteImage). KHÔNG tautological.
//
// Mirror mock sharp/fs/uuid/Image/logger từ image-service.test.js.

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
jest.mock('fs', () => ({ promises: mockFsPromises }));

const mockImageCreate = jest.fn();
const mockImageFindByPk = jest.fn();
const mockImageFindAll = jest.fn();
jest.mock(
  '@models/image',
  () => ({
    create: (...args) => mockImageCreate(...args),
    findByPk: (...args) => mockImageFindByPk(...args),
    findAll: (...args) => mockImageFindAll(...args),
  }),
  { virtual: true },
);

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const imageService = require('./image-service');
const logger = require('@utils/logger');

function makeFile(overrides = {}) {
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: 102400,
    path: '/tmp/upload_photo.jpg',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // clearMocks chỉ xoá calls, KHÔNG reset implementation → tự reset default ở đây
  // (tránh mockRejectedValue rò rỉ giữa các test)
  mockSharp.toFile.mockResolvedValue({});
  mockSharp.metadata.mockResolvedValue({ width: 800, height: 600 });
  mockFsPromises.mkdir.mockResolvedValue(undefined);
  mockFsPromises.unlink.mockResolvedValue(undefined);
  mockFsPromises.copyFile.mockResolvedValue(undefined);
  mockFsPromises.writeFile.mockResolvedValue(undefined);
  mockImageCreate.mockReset();
});

// ── generateFilePath / generateUniqueFileName ──────────────────
describe('path helpers', () => {
  test('generateFilePath → images/{category}/{year}/{month}/{fileName}', () => {
    const p = imageService.generateFilePath('product', 'a.webp').replace(/\\/g, '/');
    const year = new Date().getFullYear().toString();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    expect(p).toBe(`images/product/${year}/${month}/a.webp`);
  });

  test('generateUniqueFileName → uuid + ext gốc', () => {
    expect(imageService.generateUniqueFileName('myphoto.PNG')).toBe('fixed-uuid-1234.PNG');
  });
});

// ── getImageDimensions ─────────────────────────────────────────
describe('getImageDimensions', () => {
  test('thành công → { width, height } từ sharp metadata', async () => {
    mockSharp.metadata.mockResolvedValue({ width: 1024, height: 768 });
    const dim = await imageService.getImageDimensions('/x.jpg');
    expect(dim).toEqual({ width: 1024, height: 768 });
  });

  test('sharp lỗi → { width: null, height: null } + log error', async () => {
    mockSharp.metadata.mockRejectedValue(new Error('corrupt'));
    const dim = await imageService.getImageDimensions('/x.jpg');
    expect(dim).toEqual({ width: null, height: null });
    expect(logger.error).toHaveBeenCalledWith('Lỗi khi lấy kích thước ảnh:', expect.any(Error));
  });
});

// ── processImage: sharp options + format quality + message ─────
describe('processImage', () => {
  test('resize với width/height + fit mặc định "inside" + withoutEnlargement true', async () => {
    await imageService.processImage('/in.jpg', '/out.webp', { width: 300, height: 200 });
    expect(mockSharp.resize).toHaveBeenCalledWith({
      width: 300,
      height: 200,
      fit: 'inside',
      withoutEnlargement: true,
    });
  });

  test('fit tùy chỉnh được dùng khi truyền (kill fit||"inside")', async () => {
    await imageService.processImage('/in.jpg', '/out.webp', { width: 300, fit: 'cover' });
    expect(mockSharp.resize).toHaveBeenCalledWith(expect.objectContaining({ fit: 'cover' }));
  });

  test('KHÔNG truyền width/height → KHÔNG resize (kill L79 width||height)', async () => {
    await imageService.processImage('/in.jpg', '/out.webp', { quality: 80 });
    expect(mockSharp.resize).not.toHaveBeenCalled();
  });

  test('quality + outputPath .jpg → sharp.jpeg({quality})', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', { quality: 70 });
    expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 70 });
    expect(mockSharp.png).not.toHaveBeenCalled();
    expect(mockSharp.webp).not.toHaveBeenCalled();
  });

  test('quality + .png → sharp.png({quality})', async () => {
    await imageService.processImage('/in.jpg', '/out.png', { quality: 60 });
    expect(mockSharp.png).toHaveBeenCalledWith({ quality: 60 });
  });

  test('quality + .webp → sharp.webp({quality})', async () => {
    await imageService.processImage('/in.jpg', '/out.webp', { quality: 50 });
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 50 });
  });

  test('strip EXIF: withMetadata(false) + trả outputPath', async () => {
    const out = await imageService.processImage('/in.jpg', '/out.webp', {});
    expect(mockSharp.withMetadata).toHaveBeenCalledWith(false);
    expect(out).toBe('/out.webp');
  });

  test('sharp lỗi → AppError "Failed to process image" 500', async () => {
    mockSharp.toFile.mockRejectedValue(new Error('sharp fail'));
    await expect(imageService.processImage('/in.jpg', '/out.webp', {})).rejects.toMatchObject({
      message: 'Failed to process image',
      statusCode: 500,
    });
  });
});

// ── processProductImage: pipeline 800x800 webp 85 ──────────────
describe('processProductImage', () => {
  test('resize(800,800,{fit:inside,withoutEnlargement}) + webp(85) + withMetadata(false)', async () => {
    const out = await imageService.processProductImage('/in.jpg', '/out.webp');
    expect(mockSharp.resize).toHaveBeenCalledWith(800, 800, {
      fit: 'inside',
      withoutEnlargement: true,
    });
    expect(mockSharp.webp).toHaveBeenCalledWith({ quality: 85 });
    expect(mockSharp.withMetadata).toHaveBeenCalledWith(false);
    expect(out).toBe('/out.webp');
  });

  test('lỗi → AppError "Failed to process product image" 500', async () => {
    mockSharp.toFile.mockRejectedValue(new Error('x'));
    await expect(imageService.processProductImage('/in.jpg', '/out.webp')).rejects.toThrow(
      'Failed to process product image',
    );
  });
});

// ── uploadImage: Image.create fields + url + optimize + thumbs ──
describe('uploadImage', () => {
  test('optimize=true (default) → processImage chạy (sharp), KHÔNG copyFile', async () => {
    mockImageCreate.mockResolvedValue({ id: 1 });
    await imageService.uploadImage(makeFile(), { generateThumbs: false });
    expect(mockSharp.toFile).toHaveBeenCalled();
    expect(mockFsPromises.copyFile).not.toHaveBeenCalled();
  });

  test('optimize=false → copyFile (KHÔNG sharp process) (kill L194)', async () => {
    mockImageCreate.mockResolvedValue({ id: 1 });
    await imageService.uploadImage(makeFile(), { optimize: false, generateThumbs: false });
    expect(mockFsPromises.copyFile).toHaveBeenCalled();
  });

  test('Image.create nhận đúng fields (originalName/fileName/mimeType/size/category)', async () => {
    mockImageCreate.mockResolvedValue({ id: 7 });
    await imageService.uploadImage(makeFile(), { category: 'user', generateThumbs: false });
    expect(mockImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: 'photo.jpg',
        fileName: 'fixed-uuid-1234.jpg',
        fileSize: 102400,
        mimeType: 'image/jpeg',
        width: 800,
        height: 600,
        category: 'user',
      }),
    );
  });

  test('trả về url = /uploads/{filePath} + id + dimensions', async () => {
    mockImageCreate.mockResolvedValue({ id: 9 });
    const result = await imageService.uploadImage(makeFile(), { generateThumbs: false });
    expect(result.id).toBe(9);
    expect(result.url).toBe(`/uploads/${result.filePath}`);
    expect(result.url.startsWith('/uploads/')).toBe(true);
    expect(result.dimensions).toEqual({ width: 800, height: 600 });
  });

  test('generateThumbs=true + category=product → tạo 3 thumbnail', async () => {
    mockImageCreate.mockResolvedValue({ id: 1 });
    const result = await imageService.uploadImage(makeFile(), {
      generateThumbs: true,
      category: 'product',
    });
    expect(result.thumbnails).toHaveLength(3);
    expect(result.thumbnails.map((t) => t.size)).toEqual(['small', 'medium', 'large']);
  });

  test('category != product → KHÔNG tạo thumbnail (kill L222 category===product)', async () => {
    mockImageCreate.mockResolvedValue({ id: 1 });
    const result = await imageService.uploadImage(makeFile(), {
      generateThumbs: true,
      category: 'user',
    });
    expect(result.thumbnails).toEqual([]);
  });

  test('xóa file tạm sau upload (fs.unlink file.path)', async () => {
    mockImageCreate.mockResolvedValue({ id: 1 });
    await imageService.uploadImage(makeFile({ path: '/tmp/x.jpg' }), { generateThumbs: false });
    expect(mockFsPromises.unlink).toHaveBeenCalledWith('/tmp/x.jpg');
  });

  test('Image.create lỗi → AppError "Failed to upload image" 500', async () => {
    mockImageCreate.mockRejectedValue(new Error('db'));
    await expect(imageService.uploadImage(makeFile(), {})).rejects.toThrow(
      'Failed to upload image',
    );
  });
});

// ── uploadMultipleImages: successful/failed/count ──────────────
describe('uploadMultipleImages', () => {
  test('1 thành công + 1 lỗi → successful/failed/count đúng', async () => {
    mockImageCreate.mockResolvedValueOnce({ id: 1 }).mockRejectedValueOnce(new Error('boom'));
    const files = [makeFile({ originalname: 'a.jpg' }), makeFile({ originalname: 'b.jpg' })];

    const result = await imageService.uploadMultipleImages(files, { generateThumbs: false });

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].fileName).toBe('b.jpg');
    expect(result.count).toEqual({ total: 2, successful: 1, failed: 1 });
  });
});

// ── getImageById / deleteImage ─────────────────────────────────
describe('getImageById', () => {
  test('không tồn tại → AppError "Image not found" 404', async () => {
    mockImageFindByPk.mockResolvedValue(null);
    await expect(imageService.getImageById(99)).rejects.toMatchObject({
      message: 'Image not found',
      statusCode: 404,
    });
  });

  test('tồn tại → trả image', async () => {
    mockImageFindByPk.mockResolvedValue({ id: 1, filePath: 'x' });
    const img = await imageService.getImageById(1);
    expect(img.id).toBe(1);
  });
});

describe('deleteImage', () => {
  test('xóa file + destroy DB + trả {success:true}', async () => {
    const destroy = jest.fn().mockResolvedValue();
    mockImageFindByPk.mockResolvedValue({
      id: 1,
      filePath: 'images/product/2024/01/x.webp',
      fileName: 'x.webp',
      category: 'user',
      destroy,
    });
    const result = await imageService.deleteImage(1);
    expect(mockFsPromises.unlink).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  test('category=product → xóa thêm thumbnail (unlink nhiều lần)', async () => {
    const destroy = jest.fn().mockResolvedValue();
    mockImageFindByPk.mockResolvedValue({
      id: 1,
      filePath: 'images/product/2024/01/x.webp',
      fileName: 'x.webp',
      category: 'product',
      destroy,
    });
    await imageService.deleteImage(1);
    // 1 file gốc + 3 thumbnail = 4 lần unlink
    expect(mockFsPromises.unlink).toHaveBeenCalledTimes(4);
  });
});

// ── getImagesByProductId: where + order ────────────────────────
describe('getImagesByProductId', () => {
  test('query where {productId, isActive:true} order createdAt ASC', async () => {
    mockImageFindAll.mockResolvedValue([{ id: 1 }]);
    await imageService.getImagesByProductId(42);
    expect(mockImageFindAll).toHaveBeenCalledWith({
      where: { productId: 42, isActive: true },
      order: [['createdAt', 'ASC']],
    });
  });
});

// ── convertBase64ToFile: regex + mime/ext + create + message ───
describe('convertBase64ToFile', () => {
  const validB64 = 'data:image/png;base64,aGVsbG8=';

  test('base64 không hợp lệ → AppError "Invalid base64 data" 400', async () => {
    await expect(imageService.convertBase64ToFile('khong-phai-base64', {})).rejects.toMatchObject({
      message: 'Invalid base64 data',
      statusCode: 400,
    });
  });

  test('hợp lệ → ext từ mime, fileName uuid.ext, sharp.toFile (strip EXIF), create record', async () => {
    mockImageCreate.mockResolvedValue({ id: 3 });
    const result = await imageService.convertBase64ToFile(validB64, { category: 'product' });

    // IMG-3 fix: sharp.toFile thay writeFile để strip EXIF metadata
    expect(mockSharp.toFile).toHaveBeenCalled();
    expect(mockImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'fixed-uuid-1234.png',
        mimeType: 'image/png',
        originalName: 'converted_fixed-uuid-1234.png',
        category: 'product',
      }),
    );
    expect(result.url).toBe(`/uploads/${result.filePath}`);
    expect(result.fileName).toBe('fixed-uuid-1234.png');
  });

  test('AppError gốc (400) được giữ nguyên, không bọc thành 500', async () => {
    // base64 sai định dạng → AppError 400 ở trên, KHÔNG biến thành 500
    await expect(imageService.convertBase64ToFile('bad', {})).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('lỗi I/O (sharp.toFile) → AppError "Failed to convert base64 to file" 500', async () => {
    mockSharp.toFile.mockRejectedValueOnce(new Error('disk full'));
    await expect(imageService.convertBase64ToFile(validB64, {})).rejects.toMatchObject({
      message: 'Failed to convert base64 to file',
      statusCode: 500,
    });
  });
});

// ── cleanupOrphanedFiles: orphan detection + return shape ──────
describe('cleanupOrphanedFiles', () => {
  test('phát hiện + xóa file không có DB reference, trả count đúng', async () => {
    // 2 file trên disk, 1 active trong DB → 1 orphan
    mockFsPromises.readdir.mockResolvedValue([
      { name: 'active.webp', isDirectory: () => false },
      { name: 'orphan.webp', isDirectory: () => false },
    ]);
    mockImageFindAll.mockResolvedValue([{ filePath: 'active.webp' }]);

    const result = await imageService.cleanupOrphanedFiles();

    expect(result.totalFiles).toBe(2);
    expect(result.activeFiles).toBe(1);
    expect(result.orphanedFiles).toBe(1);
    expect(result.deletedFiles).toBe(1);
    // file orphan bị unlink
    expect(mockFsPromises.unlink).toHaveBeenCalledTimes(1);
  });

  test('readdir lỗi → AppError "Failed to cleanup orphaned files" 500', async () => {
    mockFsPromises.readdir.mockRejectedValue(new Error('io'));
    await expect(imageService.cleanupOrphanedFiles()).rejects.toThrow(
      'Failed to cleanup orphaned files',
    );
  });

  test('Image.findAll query where {isActive:true} attributes [filePath]', async () => {
    mockFsPromises.readdir.mockResolvedValue([]);
    mockImageFindAll.mockResolvedValue([]);
    await imageService.cleanupOrphanedFiles();
    expect(mockImageFindAll).toHaveBeenCalledWith({
      where: { isActive: true },
      attributes: ['filePath'],
    });
  });
});

// ── ROUND 2: initializeDirectories + no-quality + base64 anchor + log ──
describe('initializeDirectories', () => {
  test('tạo 5 thư mục upload với {recursive:true} (kill path strings + recursive)', async () => {
    mockFsPromises.mkdir.mockResolvedValue();
    await imageService.initializeDirectories();

    const dirs = mockFsPromises.mkdir.mock.calls.map((c) => c[0].replace(/\\/g, '/'));
    expect(dirs.some((d) => d.endsWith('images/products'))).toBe(true);
    expect(dirs.some((d) => d.endsWith('images/thumbnails'))).toBe(true);
    expect(dirs.some((d) => d.endsWith('images/users'))).toBe(true);
    expect(dirs.some((d) => d.endsWith('images/reviews'))).toBe(true);
    expect(dirs.some((d) => d.endsWith('images/temp'))).toBe(true);
    // mọi mkdir đều { recursive: true }
    mockFsPromises.mkdir.mock.calls.forEach((c) => expect(c[1]).toEqual({ recursive: true }));
  });

  test('mkdir lỗi → logger.error "Không thể tạo thư mục"', async () => {
    mockFsPromises.mkdir.mockRejectedValue(new Error('EACCES'));
    await imageService.initializeDirectories();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Không thể tạo thư mục'),
      expect.any(Error),
    );
  });
});

describe('processImage — nhánh quality + log lỗi', () => {
  test('KHÔNG truyền quality → KHÔNG gọi jpeg/png/webp (kill L89 if quality)', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', { width: 100 });
    expect(mockSharp.jpeg).not.toHaveBeenCalled();
    expect(mockSharp.png).not.toHaveBeenCalled();
    expect(mockSharp.webp).not.toHaveBeenCalled();
  });

  test('lỗi → logger.error "Lỗi khi xử lý ảnh:"', async () => {
    mockSharp.toFile.mockRejectedValue(new Error('x'));
    await expect(imageService.processImage('/in.jpg', '/out.webp', {})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Lỗi khi xử lý ảnh:', expect.any(Error));
  });
});

describe('processProductImage — log lỗi', () => {
  test('lỗi → logger.error "Lỗi khi xử lý ảnh sản phẩm:"', async () => {
    mockSharp.toFile.mockRejectedValue(new Error('x'));
    await expect(imageService.processProductImage('/in.jpg', '/out.webp')).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Lỗi khi xử lý ảnh sản phẩm:', expect.any(Error));
  });
});

describe('convertBase64ToFile — regex anchor', () => {
  test('chuỗi rác bao quanh data-uri hợp lệ → vẫn Invalid (regex neo ^ $)', async () => {
    // Không neo ^ thì "rác data:image/png;base64,abc" sẽ match → mutant bỏ ^ proceed.
    await expect(
      imageService.convertBase64ToFile('rác data:image/png;base64,aGVsbG8=', {}),
    ).rejects.toMatchObject({ message: 'Invalid base64 data', statusCode: 400 });
  });

  test('lỗi I/O → logger.error "Lỗi khi chuyển đổi base64 thành file:"', async () => {
    mockImageCreate.mockRejectedValue(new Error('db'));
    await expect(
      imageService.convertBase64ToFile('data:image/png;base64,aGVsbG8=', {}),
    ).rejects.toThrow('Failed to convert base64 to file');
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi khi chuyển đổi base64 thành file:',
      expect.any(Error),
    );
  });
});

describe('uploadImage — log lỗi + processImage quality 90', () => {
  test('lỗi → logger.error "Lỗi khi upload ảnh:"', async () => {
    mockImageCreate.mockRejectedValue(new Error('db'));
    await expect(imageService.uploadImage(makeFile(), {})).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith('Lỗi khi upload ảnh:', expect.any(Error));
  });

  test('optimize → processImage chạy với quality 90 (.jpg → sharp.jpeg quality 90)', async () => {
    mockImageCreate.mockResolvedValue({ id: 1 });
    await imageService.uploadImage(makeFile({ originalname: 'p.jpg' }), { generateThumbs: false });
    expect(mockSharp.jpeg).toHaveBeenCalledWith({ quality: 90 });
  });
});

describe('cleanupOrphanedFiles — log', () => {
  test('lỗi → logger.error "Lỗi khi dọn dẹp file không còn tham chiếu:"', async () => {
    mockFsPromises.readdir.mockRejectedValue(new Error('io'));
    await expect(imageService.cleanupOrphanedFiles()).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith(
      'Lỗi khi dọn dẹp file không còn tham chiếu:',
      expect.any(Error),
    );
  });
});
