/**
 * Tests bổ sung cho ImageService (src/services/image.js)
 * Nhắm vào các nhánh còn lại:
 * - line 29:  initializeDirectories → logger.error khi mkdir throw
 * - line 153: generateThumbnails → logger.error khi processImage throw với một size
 * - line 338: getImagesByProductId → re-throw khi Image.findAll throw
 * - line 428: cleanupOrphanedFiles → logger.error khi fs.unlink throw với file orphan
 * - lines 439-440: cleanupOrphanedFiles → outer catch throw AppError khi readdir throw
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('uuid', () => ({ v4: () => 'fixed-uuid-extra' }));

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

const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
jest.mock('../../../utils/logger', () => mockLogger);

// ── Load service sau mock ─────────────────────────────────────────────────────
const imageService = require('./imageService');

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeImageRecord(overrides = {}) {
  return {
    id: 1,
    filePath: 'images/product/2026/05/fixed-uuid-extra.jpg',
    fileName: 'fixed-uuid-extra.jpg',
    category: 'product',
    destroy: mockImageDestroy,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
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

// ─── initializeDirectories — mkdir throw → logger.error (line 29) ─────────────

describe('ImageService — initializeDirectories() mkdir lỗi (line 29)', () => {
  it('khi fs.mkdir throw → logger.error được gọi với đường dẫn thư mục', async () => {
    mockFsPromises.mkdir.mockRejectedValue(new Error('permission denied'));

    // Gọi trực tiếp initializeDirectories — đây là async method
    await imageService.initializeDirectories();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Không thể tạo thư mục'),
      expect.any(Error),
    );
  });

  it('mkdir throw nhưng KHÔNG throw ra ngoài (lỗi được swallow per design)', async () => {
    mockFsPromises.mkdir.mockRejectedValue(new Error('disk read-only'));

    // Không nên throw
    await expect(imageService.initializeDirectories()).resolves.not.toThrow();
  });
});

// ─── generateThumbnails — processImage throw → logger.error (line 153) ────────

describe('ImageService — generateThumbnails() processImage lỗi (line 153)', () => {
  it('khi processImage (sharp.toFile) throw → logger.error ghi thumbnail size lỗi', async () => {
    // Lần 1 (main upload): thành công. Lần 2-4 (thumbnails): throw
    mockSharp.toFile
      .mockResolvedValueOnce({}) // main processImage
      .mockRejectedValue(new Error('thumbnail write failed')); // thumbnails

    mockImageCreate.mockResolvedValue(makeImageRecord());

    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      path: '/tmp/test.jpg',
    };

    const result = await imageService.uploadImage(file, {
      category: 'product',
      generateThumbs: true,
    });

    // Không throw ra ngoài (thumbnail error được swallow)
    expect(result).toBeDefined();
    // logger.error được gọi cho thumbnail size bị lỗi
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringMatching(/Lỗi khi tạo thumbnail/),
      expect.any(Error),
    );
  });

  it('thumbnail thất bại → result.thumbnails vẫn trả về các thumbnail đã thành công', async () => {
    // small: thành công, medium: thất bại, large: thành công
    // toFile được gọi: 1 (main) + 3 (thumbnails theo thứ tự small/medium/large)
    mockSharp.toFile
      .mockResolvedValueOnce({}) // main
      .mockResolvedValueOnce({}) // small thumb thành công
      .mockRejectedValueOnce(new Error('medium thumb fail')) // medium thất bại
      .mockResolvedValueOnce({}); // large thành công

    const file = {
      originalname: 'partial.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
      path: '/tmp/partial.jpg',
    };

    const result = await imageService.uploadImage(file, {
      category: 'product',
      generateThumbs: true,
    });

    // thumbnails trả về những cái thành công (small + large = 2)
    expect(result.thumbnails.length).toBe(2);
  });
});

// ─── getImagesByProductId — re-throw khi DB throw (line 338) ─────────────────

describe('ImageService — getImagesByProductId() DB lỗi (line 338)', () => {
  it('khi Image.findAll throw → lỗi được re-throw ra ngoài', async () => {
    const dbError = new Error('connection lost');
    mockImageFindAll.mockRejectedValue(dbError);

    await expect(imageService.getImagesByProductId(100)).rejects.toThrow('connection lost');
  });

  it('lỗi được throw đúng loại (không bị wrap thành AppError)', async () => {
    const originalError = new Error('query timeout');
    mockImageFindAll.mockRejectedValue(originalError);

    await expect(imageService.getImagesByProductId(50)).rejects.toBe(originalError);
  });
});

// ─── cleanupOrphanedFiles — fs.unlink throw per file (line 428) ───────────────

describe('ImageService — cleanupOrphanedFiles() unlink lỗi cho file orphan (line 428)', () => {
  it('khi fs.unlink throw cho file orphan → logger.error được gọi, tiếp tục xử lý', async () => {
    mockFsPromises.readdir.mockResolvedValue([
      { name: 'orphan1.jpg', isDirectory: () => false },
      { name: 'orphan2.jpg', isDirectory: () => false },
    ]);
    mockImageFindAll.mockResolvedValue([]); // không có file active → cả 2 là orphan

    // orphan1: thành công, orphan2: throw
    mockFsPromises.unlink
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('EACCES: permission denied'));

    const result = await imageService.cleanupOrphanedFiles();

    // Không throw ra ngoài
    expect(result.orphanedFiles).toBe(2);
    // logger.error gọi cho file không xóa được
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi khi xóa file không còn tham chiếu'),
      expect.any(Error),
    );
  });
});

// ─── cleanupOrphanedFiles — outer catch (lines 439-440) ──────────────────────

describe('ImageService — cleanupOrphanedFiles() outer error (lines 439-440)', () => {
  it('khi getAllFiles (readdir) throw → logger.error + throw AppError(500)', async () => {
    mockFsPromises.readdir.mockRejectedValue(new Error('NFS mount failed'));

    await expect(imageService.cleanupOrphanedFiles()).rejects.toMatchObject({
      statusCode: 500,
      message: 'Failed to cleanup orphaned files',
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi khi dọn dẹp file'),
      expect.any(Error),
    );
  });

  it('khi Image.findAll throw trong cleanupOrphanedFiles → throw AppError(500)', async () => {
    mockFsPromises.readdir.mockResolvedValue([{ name: 'file.jpg', isDirectory: () => false }]);
    mockImageFindAll.mockRejectedValue(new Error('DB crashed'));

    await expect(imageService.cleanupOrphanedFiles()).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});

// ─── processImage — gọi không truyền options (default-arg branch line 65) ────

describe('ImageService — processImage gọi không có options argument (line 65 default-arg)', () => {
  it('hoạt động bình thường khi không truyền options argument (dùng default {})', async () => {
    // Gọi processImage với chỉ 2 argument → options sử dụng default {} → default-arg branch hit
    await imageService.processImage('/in.jpg', '/out.jpg');

    expect(mockSharp.toFile).toHaveBeenCalledWith('/out.jpg');
    expect(mockSharp.resize).not.toHaveBeenCalled(); // no width/height
    expect(mockSharp.jpeg).not.toHaveBeenCalled(); // no quality
  });
});

// ─── processImage — no quality option → không gọi jpeg/png/webp (line 83 false branch) ────

describe('ImageService — processImage không có quality option (line 83 false branch)', () => {
  it('KHÔNG gọi jpeg/png/webp khi options.quality không được cung cấp', async () => {
    await imageService.processImage('/in.jpg', '/out.jpg', { width: 200 });

    expect(mockSharp.jpeg).not.toHaveBeenCalled();
    expect(mockSharp.png).not.toHaveBeenCalled();
    expect(mockSharp.webp).not.toHaveBeenCalled();
    expect(mockSharp.toFile).toHaveBeenCalled();
  });
});

// ─── processImage — quality với output format không được nhận dạng (no jpeg/png/webp) ────

describe('ImageService — processImage quality với format không được nhận dạng', () => {
  it('KHÔNG gọi jpeg/png/webp khi outputPath là .bmp (format không được nhận dạng)', async () => {
    // if (options.quality) true, nhưng không phải .jpg/.jpeg/.png/.webp → không gọi format method
    await imageService.processImage('/in.jpg', '/out.bmp', { quality: 85 });

    expect(mockSharp.jpeg).not.toHaveBeenCalled();
    expect(mockSharp.png).not.toHaveBeenCalled();
    expect(mockSharp.webp).not.toHaveBeenCalled();
    expect(mockSharp.toFile).toHaveBeenCalledWith('/out.bmp');
  });
});

// ─── generateThumbnails — trả về mảng rỗng khi không có file nào ────────────

describe('ImageService — generateThumbnails trực tiếp', () => {
  it('trả về 3 thumbnail entries khi tất cả processImage thành công', async () => {
    const thumbnails = await imageService.generateThumbnails(
      '/path/original.jpg',
      'original.jpg',
      'product',
    );

    expect(thumbnails).toHaveLength(3);
    expect(thumbnails.map((t) => t.size)).toEqual(['small', 'medium', 'large']);
  });

  it('bỏ qua thumbnail lỗi và tiếp tục xử lý — trả về array với ít phần tử hơn', async () => {
    // small: thành công, medium: throw, large: thành công
    mockSharp.toFile
      .mockResolvedValueOnce({}) // small
      .mockRejectedValueOnce(new Error('medium failed'))
      .mockResolvedValueOnce({}); // large

    const thumbnails = await imageService.generateThumbnails(
      '/original.jpg',
      'photo.jpg',
      'product',
    );

    expect(thumbnails).toHaveLength(2);
    expect(thumbnails[0].size).toBe('small');
    expect(thumbnails[1].size).toBe('large');
  });
});

// ─── uploadImage — gọi không truyền options (default-arg branch line 161) ─────

describe('ImageService — uploadImage gọi không có options argument (line 161 default-arg)', () => {
  it('hoạt động bình thường khi không truyền options argument (dùng default {})', async () => {
    mockImageCreate.mockResolvedValue({
      id: 99,
      filePath: 'images/product/2026/05/fixed-uuid-extra.jpg',
      fileName: 'fixed-uuid-extra.jpg',
      category: 'product',
      destroy: mockImageDestroy,
    });

    const file = {
      originalname: 'noopt.jpg',
      mimetype: 'image/jpeg',
      size: 512,
      path: '/tmp/noopt.jpg',
    };

    // Gọi uploadImage với chỉ 1 argument → options dùng default {} → default-arg branch hit
    const result = await imageService.uploadImage(file);

    expect(result).toMatchObject({ category: 'product' }); // default category
    expect(mockImageCreate).toHaveBeenCalled();
  });
});

// ─── uploadImage — generateThumbs default true, category product ─────────────

describe('ImageService — uploadImage generateThumbs default true (line 175)', () => {
  it('tạo thumbnails khi không truyền generateThumbs (default = true) và category = product', async () => {
    mockImageCreate.mockResolvedValue({
      id: 77,
      filePath: 'images/product/2026/05/fixed-uuid-extra.jpg',
      fileName: 'fixed-uuid-extra.jpg',
      category: 'product',
      destroy: mockImageDestroy,
    });

    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 2048,
      path: '/tmp/test-default.jpg',
    };

    // Không truyền generateThumbs → default true
    const result = await imageService.uploadImage(file, { category: 'product' });

    // processImage được gọi ít nhất 1 lần main + 3 thumbnails = 4 lần
    expect(mockSharp.toFile.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(result.thumbnails.length).toBeGreaterThan(0);
  });
});

// ─── uploadMultipleImages — options default {} (line 249) ────────────────────

describe('ImageService — uploadMultipleImages options default (line 249)', () => {
  it('xử lý thành công khi không truyền options (sử dụng default {})', async () => {
    mockImageCreate.mockResolvedValue({
      id: 88,
      filePath: 'images/product/2026/05/fixed-uuid-extra.jpg',
      fileName: 'fixed-uuid-extra.jpg',
      category: 'product',
      destroy: mockImageDestroy,
    });

    const files = [
      {
        originalname: 'img.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        path: '/tmp/img.jpg',
      },
    ];

    // Không truyền options → sử dụng default {}
    const result = await imageService.uploadMultipleImages(files);

    expect(result.count.total).toBe(1);
    expect(result.count.successful).toBe(1);
  });
});

// ─── convertBase64ToFile — gọi không truyền options (default-arg branch line 343) ─

describe('ImageService — convertBase64ToFile gọi không có options argument (line 343 default-arg)', () => {
  it('hoạt động bình thường khi không truyền options (dùng default {})', async () => {
    mockImageCreate.mockResolvedValue({
      id: 111,
      filePath: 'images/product/2026/05/fixed-uuid-extra.png',
      fileName: 'fixed-uuid-extra.png',
      category: 'product',
      destroy: mockImageDestroy,
    });

    const validBase64 = 'data:image/png;base64,' + Buffer.from('px').toString('base64');

    // Gọi convertBase64ToFile với chỉ 1 argument → options dùng default {} → default-arg branch hit
    const result = await imageService.convertBase64ToFile(validBase64);

    expect(result.url).toMatch('/uploads/');
    expect(mockImageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'product' }), // default category
    );
  });
});

// ─── convertBase64ToFile — Image.create throw → outer catch → AppError(500) ─

describe('ImageService — convertBase64ToFile Image.create lỗi (line 343 catch)', () => {
  it('throw AppError(500) khi Image.create thất bại', async () => {
    mockImageCreate.mockRejectedValue(new Error('DB write failed'));
    const validBase64 = 'data:image/png;base64,' + Buffer.from('fake-data').toString('base64');

    await expect(
      imageService.convertBase64ToFile(validBase64, { category: 'product' }),
    ).rejects.toMatchObject({ statusCode: 500, message: 'Failed to convert base64 to file' });
  });

  it('throw AppError(500) khi fs.writeFile thất bại', async () => {
    mockFsPromises.writeFile.mockRejectedValueOnce(new Error('disk full'));
    const validBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-data').toString('base64');

    await expect(imageService.convertBase64ToFile(validBase64, {})).rejects.toMatchObject({
      statusCode: 500,
    });
  });
});
