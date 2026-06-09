/**
 * Integration tests — Upload service & Image model với real filesystem + DB.
 *
 * Scope:
 *   - Image model: tạo, tìm theo productId, lọc theo isActive
 *   - UploadService.validateMagicBytes: JPEG hợp lệ → true, file không hợp lệ → false
 *
 * File test JPEG tạm được tạo trong beforeAll và xóa trong afterAll.
 */
require('module-alias/register');
const path = require('path');
const fs = require('fs').promises;
const sequelize = require('@config/sequelize');
// Image không export từ barrel @models (dropped từ index.js) — import trực tiếp
const Image = require('@models/image');
const { Product, Category, Brand } = require('@models');

const TS = Date.now();

// Đường dẫn file test tạm — dùng thư mục temp đã có
const testImagePath = path.join(__dirname, '../../../uploads/images/temp/test-image-int.jpg');
const invalidFilePath = path.join(__dirname, '../../../uploads/images/temp/test-fake-int.jpg');

// Header JPEG tối thiểu hợp lệ (1×1 pixel)
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
  0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0xff, 0xda, 0x00, 0x08,
  0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfb, 0x5f, 0xff, 0xd9,
]);

// File giả mạo — bytes đầu không phải ảnh
const FAKE_FILE_BUFFER = Buffer.from('This is not an image file, just plain text.');

let testProduct, testCategory, testBrand, uploadService;
const createdImageIds = [];

beforeAll(async () => {
  await sequelize.authenticate();

  // Tạo file test thật trên filesystem
  await fs.writeFile(testImagePath, VALID_JPEG_BUFFER);
  await fs.writeFile(invalidFilePath, FAKE_FILE_BUFFER);

  // Tạo dữ liệu DB cần thiết
  testCategory = await Category.create({
    nameVi: `__INT_Upload_Cat_${TS}`,
    nameEn: `__INT_Upload_Cat_${TS}`,
    slug: `int-upload-cat-${TS}`,
    isActive: true,
  });

  testBrand = await Brand.create({
    nameVi: `__INT_Upload_Brand_${TS}`,
    nameEn: `__INT_Upload_Brand_${TS}`,
    slug: `int-upload-brand-${TS}`,
  });

  testProduct = await Product.create({
    nameVi: `__INT_Upload_Product_${TS}`,
    nameEn: `__INT_Upload_Product_${TS}`,
    baseName: `__INT_Upload_Product_${TS}`,
    slug: `int-upload-product-${TS}`,
    basePrice: 1_500_000,
    categoryId: testCategory.id,
    brandId: testBrand.id,
    status: 'active',
    stockQuantity: 10,
  });

  // Khởi tạo UploadService với FilesystemUploadRepository thật
  const FilesystemUploadRepository = require('@modules/upload/repositories/filesystem-upload-repository');
  const UploadService = require('@modules/upload/services/upload-service');
  const uploadRepository = new FilesystemUploadRepository();
  uploadService = new UploadService({
    uploadRepository,
    uploadDirs: {},
    eventBus: null,
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });
});

afterAll(async () => {
  // Xóa Image records test
  if (createdImageIds.length > 0) {
    await Image.destroy({ where: { id: createdImageIds }, force: true });
  }

  // Xóa product + category + brand
  if (testProduct) await testProduct.destroy({ force: true });
  if (testCategory) await testCategory.destroy({ force: true });
  if (testBrand) await testBrand.destroy({ force: true });

  // Xóa file test tạm
  await fs.unlink(testImagePath).catch(() => {});
  await fs.unlink(invalidFilePath).catch(() => {});
});

// ─────────────────────────────────────────────────────────────
describe('Image model — tạo và đọc record', () => {
  test('tạo record với filePath, mimeType, fileSize → lưu đúng fields', async () => {
    const imageData = {
      originalName: `upload-int-original-${TS}.jpg`,
      fileName: `upload-int-file-${TS}.jpg`,
      filePath: `uploads/images/product/upload-int-${TS}.jpg`,
      fileSize: 12_345,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    };

    const image = await Image.create(imageData);
    createdImageIds.push(image.id);

    expect(image.id).toBeDefined();
    expect(image.filePath).toBe(imageData.filePath);
    expect(image.mimeType).toBe('image/jpeg');
    expect(image.fileSize).toBe(12_345);
    expect(image.productId).toBe(testProduct.id);
  });

  test('tìm theo productId → trả đúng ảnh', async () => {
    // Tạo ảnh gắn với testProduct
    const image = await Image.create({
      originalName: `upload-int-find-${TS}.jpg`,
      fileName: `upload-int-find-${TS}.jpg`,
      filePath: `uploads/images/product/upload-int-find-${TS}.jpg`,
      fileSize: 8_192,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    });
    createdImageIds.push(image.id);

    const results = await Image.findAll({ where: { productId: testProduct.id } });
    const foundIds = results.map((r) => r.id);

    expect(foundIds).toContain(image.id);
  });

  test('isActive=false → không xuất hiện khi query active', async () => {
    const inactiveImage = await Image.create({
      originalName: `upload-int-inactive-${TS}.jpg`,
      fileName: `upload-int-inactive-${TS}.jpg`,
      filePath: `uploads/images/product/upload-int-inactive-${TS}.jpg`,
      fileSize: 4_096,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: false,
    });
    createdImageIds.push(inactiveImage.id);

    // Query chỉ lấy active → không được chứa ảnh inactive
    const activeImages = await Image.findAll({
      where: { productId: testProduct.id, isActive: true },
    });
    const activeIds = activeImages.map((r) => r.id);

    expect(activeIds).not.toContain(inactiveImage.id);

    // Query không filter → vẫn thấy ảnh inactive
    const allImages = await Image.findAll({
      where: { productId: testProduct.id },
    });
    const allIds = allImages.map((r) => r.id);
    expect(allIds).toContain(inactiveImage.id);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Upload service — validateMagicBytes', () => {
  test('validateMagicBytes JPEG hợp lệ → true', async () => {
    const result = await uploadService.validateMagicBytes(testImagePath);

    expect(result).toBe(true);
  });

  test('validateMagicBytes file không phải ảnh → false', async () => {
    const result = await uploadService.validateMagicBytes(invalidFilePath);

    expect(result).toBe(false);
  });
});

describe('Image model — bộ bổ sung', () => {
  // 1×1 PNG tối thiểu — header hợp lệ (magic bytes: 89 50 4E 47 0D 0A 1A 0A)
  const PNG_BUFFER = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  // GIF header — 47 49 46 38 39 61 (GIF89a) — không có trong MAGIC_BYTES whitelist
  const GIF_BUFFER = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
  ]);

  const pngFilePath = path.join(
    __dirname,
    '../../../uploads/images/temp/test-upload-extra-png.png',
  );
  const gifFilePath = path.join(
    __dirname,
    '../../../uploads/images/temp/test-upload-extra-gif.gif',
  );

  let testProduct, testCategory, testBrand, uploadService;
  const createdImageIds = [];

  beforeAll(async () => {
    await sequelize.authenticate();

    // Tạo file tạm trên filesystem
    await fs.writeFile(pngFilePath, PNG_BUFFER);
    await fs.writeFile(gifFilePath, GIF_BUFFER);

    testCategory = await Category.create({
      nameVi: `__INT_UpExt_Cat_${TS}`,
      nameEn: `__INT_UpExt_Cat_${TS}`,
      slug: `int-up-ext-cat-${TS}`,
      isActive: true,
    });

    testBrand = await Brand.create({
      nameVi: `__INT_UpExt_Brand_${TS}`,
      nameEn: `__INT_UpExt_Brand_${TS}`,
      slug: `int-up-ext-brand-${TS}`,
    });

    testProduct = await Product.create({
      nameVi: `__INT_UpExt_Product_${TS}`,
      nameEn: `__INT_UpExt_Product_${TS}`,
      baseName: `__INT_UpExt_Product_${TS}`,
      slug: `int-up-ext-product-${TS}`,
      basePrice: 2_000_000,
      categoryId: testCategory.id,
      brandId: testBrand.id,
      status: 'active',
      stockQuantity: 10,
    });

    // Khởi tạo UploadService với FilesystemUploadRepository thật
    const FilesystemUploadRepository = require('@modules/upload/repositories/filesystem-upload-repository');
    const UploadService = require('@modules/upload/services/upload-service');
    const uploadRepository = new FilesystemUploadRepository();
    uploadService = new UploadService({
      uploadRepository,
      uploadDirs: {},
      eventBus: null,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  afterAll(async () => {
    if (createdImageIds.length > 0) {
      await Image.destroy({ where: { id: createdImageIds }, force: true });
    }
    if (testProduct) await testProduct.destroy({ force: true });
    if (testCategory) await testCategory.destroy({ force: true });
    if (testBrand) await testBrand.destroy({ force: true });

    await fs.unlink(pngFilePath).catch(() => {});
    await fs.unlink(gifFilePath).catch(() => {});
  });

  test('tìm tất cả ảnh active của product → chỉ trả ảnh isActive=true', async () => {
    // Arrange — tạo 2 ảnh active và 1 ảnh inactive
    const activeImg1 = await Image.create({
      originalName: `extra-active-1-${TS}.jpg`,
      fileName: `extra-active-1-${TS}.jpg`,
      filePath: `uploads/images/product/extra-active-1-${TS}.jpg`,
      fileSize: 1_024,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    });
    const activeImg2 = await Image.create({
      originalName: `extra-active-2-${TS}.jpg`,
      fileName: `extra-active-2-${TS}.jpg`,
      filePath: `uploads/images/product/extra-active-2-${TS}.jpg`,
      fileSize: 2_048,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    });
    const inactiveImg = await Image.create({
      originalName: `extra-inactive-${TS}.jpg`,
      fileName: `extra-inactive-${TS}.jpg`,
      filePath: `uploads/images/product/extra-inactive-${TS}.jpg`,
      fileSize: 512,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: false,
    });
    createdImageIds.push(activeImg1.id, activeImg2.id, inactiveImg.id);

    // Act
    const activeImages = await Image.findAll({
      where: { productId: testProduct.id, isActive: true },
    });

    // Assert
    const ids = activeImages.map((img) => img.id);
    expect(ids).toContain(activeImg1.id);
    expect(ids).toContain(activeImg2.id);
    expect(ids).not.toContain(inactiveImg.id);
    expect(activeImages.every((img) => img.isActive)).toBe(true);
  });

  test('đánh dấu thumbnail → category="thumbnail" được lưu và truy vấn đúng', async () => {
    // Arrange — category enum có giá trị 'thumbnail' đại diện cho ảnh thumbnail
    const thumbnailImg = await Image.create({
      originalName: `extra-thumb-${TS}.jpg`,
      fileName: `extra-thumb-${TS}.jpg`,
      filePath: `uploads/images/product/extra-thumb-${TS}.jpg`,
      fileSize: 4_096,
      mimeType: 'image/jpeg',
      category: 'thumbnail',
      productId: testProduct.id,
      isActive: true,
    });
    createdImageIds.push(thumbnailImg.id);

    // Act — đọc lại từ DB
    const reloaded = await Image.findByPk(thumbnailImg.id);

    // Assert — category được lưu đúng
    expect(reloaded.category).toBe('thumbnail');

    // Query theo category='thumbnail' → tìm thấy ảnh
    const thumbnails = await Image.findAll({
      where: { productId: testProduct.id, category: 'thumbnail' },
    });
    const ids = thumbnails.map((img) => img.id);
    expect(ids).toContain(thumbnailImg.id);
  });

  test('đổi trạng thái isActive từ false lên true → phản ánh trong DB', async () => {
    // Arrange — tạo ảnh inactive
    const img = await Image.create({
      originalName: `extra-toggle-${TS}.jpg`,
      fileName: `extra-toggle-${TS}.jpg`,
      filePath: `uploads/images/product/extra-toggle-${TS}.jpg`,
      fileSize: 8_192,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: false,
    });
    createdImageIds.push(img.id);
    expect(img.isActive).toBe(false);

    // Act — kích hoạt ảnh
    await img.update({ isActive: true });

    // Assert
    const reloaded = await Image.findByPk(img.id);
    expect(reloaded.isActive).toBe(true);
  });
});

describe('UploadService.validateMagicBytes — bộ bổ sung', () => {
  const PNG_BUFFER = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  const GIF_BUFFER = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
    0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x00, 0x00,
  ]);

  const pngFilePath = path.join(
    __dirname,
    '../../../uploads/images/temp/test-upload-extra-png.png',
  );
  const gifFilePath = path.join(
    __dirname,
    '../../../uploads/images/temp/test-upload-extra-gif.gif',
  );

  let uploadService;

  beforeAll(async () => {
    await fs.writeFile(pngFilePath, PNG_BUFFER);
    await fs.writeFile(gifFilePath, GIF_BUFFER);

    const FilesystemUploadRepository = require('@modules/upload/repositories/filesystem-upload-repository');
    const UploadService = require('@modules/upload/services/upload-service');
    const uploadRepository = new FilesystemUploadRepository();
    uploadService = new UploadService({
      uploadRepository,
      uploadDirs: {},
      eventBus: null,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  afterAll(async () => {
    await fs.unlink(pngFilePath).catch(() => {});
    await fs.unlink(gifFilePath).catch(() => {});
  });

  test('validateMagicBytes PNG hợp lệ → true', async () => {
    // PNG nằm trong MAGIC_BYTES whitelist (89 50 4E 47...)
    const result = await uploadService.validateMagicBytes(pngFilePath);
    expect(result).toBe(true);
  });

  test('validateMagicBytes GIF → false (GIF không có trong whitelist JPEG/PNG/WebP)', async () => {
    // GIF header (47 49 46 38 ...) không khớp với bất kỳ entry nào trong MAGIC_BYTES
    const result = await uploadService.validateMagicBytes(gifFilePath);
    expect(result).toBe(false);
  });
});
