/**
 * Integration tests — Image model với database thật (techstore).
 *
 * Scope: DB operations của Image model
 *   - Tạo, đọc, cập nhật, xóa Image record
 *   - Lọc ảnh theo productId
 *   - Các trường đặc thù: category ENUM, isActive flag
 *
 * KHÔNG test file processing (sharp/multer) — chỉ test DB layer.
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const Image = require('@models/image');
const { Product, Category, Brand } = require('@models');

const TS = Date.now();
let testProduct, testCategory, testBrand;

beforeAll(async () => {
  await sequelize.authenticate();

  testCategory = await Category.create({
    nameVi: `__INT_Image_Cat_${TS}`,
    nameEn: `__INT_Image_Cat_${TS}`,
    slug: `int-image-cat-${TS}`,
    isActive: true,
  });

  testBrand = await Brand.create({
    nameVi: `__INT_Image_Brand_${TS}`,
    nameEn: `__INT_Image_Brand_${TS}`,
    slug: `int-image-brand-${TS}`,
  });

  testProduct = await Product.create({
    nameVi: `__INT_Image_Product_${TS}`,
    nameEn: `__INT_Image_Product_${TS}`,
    baseName: `__INT_Image_Product_${TS}`,
    slug: `int-image-product-${TS}`,
    basePrice: 1_000_000,
    categoryId: testCategory.id,
    brandId: testBrand.id,
    status: 'active',
    stockQuantity: 10,
  });
});

afterAll(async () => {
  // Xóa tất cả Image record test trước khi xóa product
  await Image.destroy({
    where: { productId: testProduct?.id },
    force: true,
  });
  if (testProduct) await testProduct.destroy({ force: true });
  if (testCategory) await testCategory.destroy({ force: true });
  if (testBrand) await testBrand.destroy({ force: true });
});

// ─────────────────────────────────────────────────────────────
describe('Image Integration — Tạo & đọc record', () => {
  test('Tạo Image record → lưu vào DB với đầy đủ fields', async () => {
    const imageData = {
      originalName: `test-image-${TS}.jpg`,
      fileName: `int-image-full-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-full-${TS}.jpg`,
      fileSize: 204800,
      mimeType: 'image/jpeg',
      width: 800,
      height: 600,
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    };

    const image = await Image.create(imageData);

    expect(image.id).toBeDefined();
    expect(image.originalName).toBe(imageData.originalName);
    expect(image.fileName).toBe(imageData.fileName);
    expect(image.filePath).toBe(imageData.filePath);
    expect(image.fileSize).toBe(imageData.fileSize);
    expect(image.mimeType).toBe(imageData.mimeType);
    expect(image.width).toBe(imageData.width);
    expect(image.height).toBe(imageData.height);
    expect(image.category).toBe('product');
    expect(image.productId).toBe(testProduct.id);
    expect(image.isActive).toBe(true);
  });

  test('getImageById → tìm thấy record vừa tạo', async () => {
    const created = await Image.create({
      originalName: `find-by-id-${TS}.jpg`,
      fileName: `int-image-findbyid-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-findbyid-${TS}.jpg`,
      fileSize: 102400,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    });

    const found = await Image.findByPk(created.id);

    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.fileName).toBe(created.fileName);
  });

  test('getImageById → không tồn tại → null', async () => {
    const found = await Image.findByPk(9_999_999);

    expect(found).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Image Integration — Lọc theo productId', () => {
  test('findAll theo productId → trả đúng ảnh của product', async () => {
    // Tạo product B để đảm bảo không bị lẫn ảnh
    const otherProduct = await Product.create({
      nameVi: `__INT_Image_OtherProd_${TS}`,
      nameEn: `__INT_Image_OtherProd_${TS}`,
      baseName: `__INT_Image_OtherProd_${TS}`,
      slug: `int-image-other-prod-${TS}`,
      basePrice: 500_000,
      categoryId: testCategory.id,
      brandId: testBrand.id,
      status: 'active',
      stockQuantity: 5,
    });

    // 2 ảnh cho product A (testProduct)
    const imgA1 = await Image.create({
      originalName: `prod-a-1-${TS}.jpg`,
      fileName: `int-image-a1-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-a1-${TS}.jpg`,
      fileSize: 50000,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    });
    const imgA2 = await Image.create({
      originalName: `prod-a-2-${TS}.jpg`,
      fileName: `int-image-a2-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-a2-${TS}.jpg`,
      fileSize: 60000,
      mimeType: 'image/jpeg',
      category: 'thumbnail',
      productId: testProduct.id,
      isActive: true,
    });

    // 1 ảnh cho product B
    const imgB1 = await Image.create({
      originalName: `prod-b-1-${TS}.jpg`,
      fileName: `int-image-b1-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-b1-${TS}.jpg`,
      fileSize: 70000,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: otherProduct.id,
      isActive: true,
    });

    const imagesForProductA = await Image.findAll({
      where: { productId: testProduct.id },
    });

    // Phải tìm được ít nhất 2 ảnh của testProduct (có thể có ảnh từ test trước)
    const testImageIds = [imgA1.id, imgA2.id];
    const foundIds = imagesForProductA.map((img) => img.id);
    for (const id of testImageIds) {
      expect(foundIds).toContain(id);
    }
    // Ảnh của product B không được lẫn vào
    expect(foundIds).not.toContain(imgB1.id);

    // Cleanup
    await imgA1.destroy({ force: true });
    await imgA2.destroy({ force: true });
    await imgB1.destroy({ force: true });
    await otherProduct.destroy({ force: true });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Image Integration — Xóa record', () => {
  test('destroy → xóa hoàn toàn khỏi DB (model không có paranoid)', async () => {
    const image = await Image.create({
      originalName: `to-delete-${TS}.jpg`,
      fileName: `int-image-delete-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-delete-${TS}.jpg`,
      fileSize: 30000,
      mimeType: 'image/jpeg',
      category: 'product',
      productId: testProduct.id,
      isActive: true,
    });
    const deletedId = image.id;

    await image.destroy({ force: true });

    const afterDelete = await Image.findByPk(deletedId);
    expect(afterDelete).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Image Integration — isActive flag', () => {
  test('isActive: false → đánh dấu ảnh không hoạt động', async () => {
    const image = await Image.create({
      originalName: `inactive-${TS}.jpg`,
      fileName: `int-image-inactive-${TS}.jpg`,
      filePath: `uploads/images/product/2025/01/int-image-inactive-${TS}.jpg`,
      fileSize: 45000,
      mimeType: 'image/png',
      category: 'product',
      productId: testProduct.id,
      isActive: false,
    });

    expect(image.isActive).toBe(false);

    // Query chỉ active → không được chứa ảnh inactive này
    const activeImages = await Image.findAll({
      where: { productId: testProduct.id, isActive: true },
    });
    const activeIds = activeImages.map((img) => img.id);
    expect(activeIds).not.toContain(image.id);

    // Query không filter → vẫn tìm thấy
    const allImages = await Image.findAll({
      where: { productId: testProduct.id },
    });
    const allIds = allImages.map((img) => img.id);
    expect(allIds).toContain(image.id);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Image Integration — category ENUM', () => {
  test('category thumbnail → lưu và đọc đúng giá trị', async () => {
    const image = await Image.create({
      originalName: `thumbnail-${TS}.jpg`,
      fileName: `int-image-thumb-${TS}.jpg`,
      filePath: `uploads/images/thumbnail/2025/01/int-image-thumb-${TS}.jpg`,
      fileSize: 15000,
      mimeType: 'image/jpeg',
      category: 'thumbnail',
      productId: testProduct.id,
      isActive: true,
    });

    const reloaded = await Image.findByPk(image.id);
    expect(reloaded.category).toBe('thumbnail');
  });
});
