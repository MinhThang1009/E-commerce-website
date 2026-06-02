// Phase 42.8 — Unit tests cho UploadService (modules/upload).
const path = require('path');
const UploadService = require('./upload-service');

describe('UploadService', () => {
  let uploadRepository;
  let service;
  const baseDir = path.resolve('/test/uploads');
  const uploadDirs = {
    products: path.join(baseDir, 'products'),
    reviews: path.join(baseDir, 'reviews'),
    avatars: path.join(baseDir, 'avatars'),
  };

  beforeEach(() => {
    uploadRepository = {
      fileExists: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(),
      readFileHeader: jest.fn(),
    };
    service = new UploadService({
      uploadRepository,
      uploadDirs,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('isValidImageMagic (static)', () => {
    test('JPEG signature → true', () => {
      const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(9)]);
      expect(UploadService.isValidImageMagic(buf)).toBe(true);
    });

    test('PNG signature → true', () => {
      const buf = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(4),
      ]);
      expect(UploadService.isValidImageMagic(buf)).toBe(true);
    });

    test('WebP signature → true (RIFF + WEBP marker)', () => {
      const buf = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
      expect(UploadService.isValidImageMagic(buf)).toBe(true);
    });

    test('Random bytes → false', () => {
      expect(UploadService.isValidImageMagic(Buffer.alloc(12))).toBe(false);
    });

    test('Buffer < 12 bytes → false', () => {
      expect(UploadService.isValidImageMagic(Buffer.alloc(8))).toBe(false);
    });

    test('null buffer → false', () => {
      expect(UploadService.isValidImageMagic(null)).toBe(false);
    });
  });

  describe('processSingleUpload', () => {
    test('thiếu file → 400', async () => {
      await expect(
        service.processSingleUpload({ file: null, uploadType: 'products' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'upload.noFile' });
    });

    test('uploadType lạ → xóa file + 400 (không lệch thư mục)', async () => {
      const file = {
        path: '/tmp/x.jpg',
        filename: 'x.jpg',
        originalname: 'a.jpg',
        size: 100,
      };

      await expect(
        service.processSingleUpload({ file, uploadType: 'hacker-type' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'upload.invalidType' });

      expect(uploadRepository.deleteFile).toHaveBeenCalledWith('/tmp/x.jpg');
      // Không đọc magic bytes vì đã reject ở bước type
      expect(uploadRepository.readFileHeader).not.toHaveBeenCalled();
    });

    test('magic bytes invalid → xóa file + 400', async () => {
      uploadRepository.readFileHeader.mockResolvedValue(Buffer.alloc(12)); // not valid image
      const file = {
        path: '/tmp/fake.jpg',
        filename: 'fake.jpg',
        originalname: 'a.jpg',
        size: 100,
      };

      await expect(
        service.processSingleUpload({ file, uploadType: 'products' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'upload.invalidFileType' });

      expect(uploadRepository.deleteFile).toHaveBeenCalledWith('/tmp/fake.jpg');
    });

    test('magic bytes valid → trả file metadata + URL', async () => {
      const jpegBuf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(9)]);
      uploadRepository.readFileHeader.mockResolvedValue(jpegBuf);
      const file = { path: '/tmp/x.jpg', filename: 'x.jpg', originalname: 'foo.jpg', size: 1024 };

      const result = await service.processSingleUpload({ file, uploadType: 'products' });

      expect(result).toEqual({
        filename: 'x.jpg',
        originalName: 'foo.jpg',
        url: '/uploads/products/x.jpg',
        size: 1024,
        type: 'products',
      });
      expect(uploadRepository.deleteFile).not.toHaveBeenCalled();
    });
  });

  describe('processMultipleUpload', () => {
    test('không file nào → 400', async () => {
      await expect(
        service.processMultipleUpload({ files: [], uploadType: 'reviews' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'upload.noFile' });
    });

    test('uploadType lạ → xóa hết + 400', async () => {
      const files = [
        { path: '/tmp/a.jpg', filename: 'a.jpg', originalname: 'a.jpg', size: 1 },
        { path: '/tmp/b.jpg', filename: 'b.jpg', originalname: 'b.jpg', size: 1 },
      ];

      await expect(
        service.processMultipleUpload({ files, uploadType: 'hacker-type' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'upload.invalidType' });

      expect(uploadRepository.deleteFile).toHaveBeenCalledTimes(2);
      expect(uploadRepository.readFileHeader).not.toHaveBeenCalled();
    });

    test('mix valid + invalid → xóa invalid, trả valid', async () => {
      const jpegBuf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(9)]);
      uploadRepository.readFileHeader
        .mockResolvedValueOnce(jpegBuf)
        .mockResolvedValueOnce(Buffer.alloc(12)) // invalid
        .mockResolvedValueOnce(jpegBuf);

      const files = [
        { path: '/tmp/a.jpg', filename: 'a.jpg', originalname: 'a.jpg', size: 1 },
        { path: '/tmp/fake.jpg', filename: 'fake.jpg', originalname: 'b.jpg', size: 1 },
        { path: '/tmp/c.jpg', filename: 'c.jpg', originalname: 'c.jpg', size: 1 },
      ];

      const result = await service.processMultipleUpload({ files, uploadType: 'reviews' });

      expect(result).toHaveLength(2);
      expect(uploadRepository.deleteFile).toHaveBeenCalledTimes(1);
      expect(uploadRepository.deleteFile).toHaveBeenCalledWith('/tmp/fake.jpg');
    });

    test('toàn bộ invalid → xóa hết + 400', async () => {
      uploadRepository.readFileHeader.mockResolvedValue(Buffer.alloc(12));
      const files = [
        { path: '/tmp/a', filename: 'a', originalname: 'a', size: 1 },
        { path: '/tmp/b', filename: 'b', originalname: 'b', size: 1 },
      ];

      await expect(
        service.processMultipleUpload({ files, uploadType: 'reviews' }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(uploadRepository.deleteFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile (admin/staff)', () => {
    test('customer → 403', async () => {
      await expect(
        service.deleteFile({ user: { role: 'customer' }, type: 'products', filenameRaw: 'a.jpg' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('không user → 403', async () => {
      await expect(
        service.deleteFile({ user: null, type: 'products', filenameRaw: 'a.jpg' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('type không hợp lệ → 400', async () => {
      await expect(
        service.deleteFile({ user: { role: 'admin' }, type: 'invalid-type', filenameRaw: 'a.jpg' }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('path traversal qua filename → 400', async () => {
      await expect(
        service.deleteFile({
          user: { role: 'admin' },
          type: 'products',
          filenameRaw: '../../../etc/passwd',
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'upload.invalidFileName' });
    });

    test('file không tồn tại → 404', async () => {
      uploadRepository.fileExists.mockResolvedValue(false);
      await expect(
        service.deleteFile({ user: { role: 'admin' }, type: 'products', filenameRaw: 'a.jpg' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('admin hợp lệ → xóa file + return message', async () => {
      uploadRepository.fileExists.mockResolvedValue(true);
      const result = await service.deleteFile({
        user: { role: 'admin' },
        type: 'products',
        filenameRaw: 'a.jpg',
      });
      expect(result.message).toBe('upload.deleteSuccess');
      expect(uploadRepository.deleteFile).toHaveBeenCalled();
    });

    test('staff hợp lệ → xóa file + return message (RBAC back-office)', async () => {
      uploadRepository.fileExists.mockResolvedValue(true);
      const result = await service.deleteFile({
        user: { role: 'staff' },
        type: 'products',
        filenameRaw: 'a.jpg',
      });
      expect(result.message).toBe('upload.deleteSuccess');
      expect(uploadRepository.deleteFile).toHaveBeenCalledWith(expect.stringContaining('a.jpg'));
    });
  });

  describe('buildFileUrl (pure)', () => {
    test('format /uploads/{type}/{filename}', () => {
      expect(service.buildFileUrl('products', 'abc.jpg')).toBe('/uploads/products/abc.jpg');
    });
  });
});

// ─── processSingleUpload — deleteFile catch (.catch(() => {})) ────────────────

describe('processSingleUpload — deleteFile catch arrow function', () => {
  test('swallow lỗi khi deleteFile reject (covers .catch(() => {}))', async () => {
    const svc = new UploadService({
      uploadRepository: {
        fileExists: jest.fn(),
        deleteFile: jest.fn().mockRejectedValue(new Error('disk error')),
        readFileHeader: jest.fn().mockResolvedValue(Buffer.alloc(12)),
      },
      uploadDirs: { products: '/test/products' },
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });

    await expect(
      svc.processSingleUpload({
        file: { path: '/tmp/e.jpg', filename: 'e.jpg', originalname: 'e.jpg', size: 1 },
        uploadType: 'products',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
