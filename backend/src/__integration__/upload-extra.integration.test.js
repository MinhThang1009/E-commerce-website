/**
 * Integration tests bổ sung — Upload service & Image model.
 *
 * Bổ sung 5 test cho upload.integration.test.js:
 *   1. Image record: tìm tất cả ảnh active của product
 *   2. Image record: đánh dấu thumbnail (isThumbnail field)
 *   3. Image record: đổi trạng thái isActive false → true
 *   4. UploadService: validateMagicBytes PNG → true
 *   5. UploadService: validateMagicBytes GIF → false (GIF không có trong whitelist)
 *
 * Dùng Image model import trực tiếp vì đã drop khỏi index.js associations.
 */
require('module-alias/register');
const path = require('path');
const fs = require('fs').promises;
const sequelize = require('@config/sequelize');
const Image = require('@models/image');
const { Product, Category, Brand } = require('@models');

const TS = Date.now();

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

const pngFilePath = path.join(__dirname, '../../../uploads/images/temp/test-upload-extra-png.png');
const gifFilePath = path.join(__dirname, '../../../uploads/images/temp/test-upload-extra-gif.gif');

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

// ─────────────────────────────────────────────────────────────
describe('Image model — bộ bổ sung', () => {
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

// ─────────────────────────────────────────────────────────────
describe('UploadService.validateMagicBytes — bộ bổ sung', () => {
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
