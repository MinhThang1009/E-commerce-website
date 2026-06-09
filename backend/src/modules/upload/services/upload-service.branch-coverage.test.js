const UploadService = require('./upload-service');
const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

describe('UploadService — branch coverage', () => {
  test('processSingleUpload: invalid uploadType + deleteFile fails → still throw', async () => {
    const svc = new UploadService({
      uploadRepository: { deleteFile: jest.fn().mockRejectedValue(new Error('disk')) },
      uploadDirs: { product: '/uploads/product' },
      logger,
    });
    await expect(
      svc.processSingleUpload({ file: { path: '/tmp/x.jpg' }, uploadType: 'INVALID' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('processMultipleUpload: no files → throw', async () => {
    const svc = new UploadService({ uploadRepository: {}, uploadDirs: {}, logger });
    await expect(
      svc.processMultipleUpload({ files: [], uploadType: 'product' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('processMultipleUpload: invalid uploadType → delete all + throw', async () => {
    const deleteFn = jest.fn().mockResolvedValue();
    const svc = new UploadService({
      uploadRepository: { deleteFile: deleteFn },
      uploadDirs: { product: '/uploads/product' },
      logger,
    });
    await expect(
      svc.processMultipleUpload({ files: [{ path: '/tmp/a.jpg' }], uploadType: 'INVALID' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(deleteFn).toHaveBeenCalledWith('/tmp/a.jpg');
  });

  test('processMultipleUpload: valid files → returns URLs', async () => {
    const pngHeader = Buffer.alloc(12);
    pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const svc = new UploadService({
      uploadRepository: {
        readFileHeader: jest.fn().mockResolvedValue(pngHeader),
        deleteFile: jest.fn(),
      },
      uploadDirs: { product: '/uploads/product' },
      logger,
    });
    const result = await svc.processMultipleUpload({
      files: [{ path: '/tmp/a.png', filename: 'a.png' }],
      uploadType: 'product',
    });
    expect(result).toHaveLength(1);
    expect(result[0].url).toContain('product');
  });
});
