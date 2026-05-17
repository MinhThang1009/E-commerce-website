'use strict';
const { localizeEntity, localizeList, FIELD_MAPS } = require('./localize');

const makeProduct = (overrides = {}) => ({
  id: 1,
  nameVi: 'Điện thoại iPhone 17',
  nameEn: 'iPhone 17',
  shortDescriptionVi: 'Mô tả tiếng Việt',
  shortDescriptionEn: 'English description',
  descriptionVi: 'Chi tiết tiếng Việt',
  descriptionEn: 'English details',
  seoTitleVi: 'SEO Việt',
  seoTitleEn: 'SEO English',
  seoDescriptionVi: 'SEO desc Việt',
  seoDescriptionEn: 'SEO desc English',
  ...overrides,
});

describe('localizeEntity — product', () => {
  test('locale=vi → trả nameVi', () => {
    const result = localizeEntity(makeProduct(), 'vi', 'product');
    expect(result.name).toBe('Điện thoại iPhone 17');
    expect(result.shortDescription).toBe('Mô tả tiếng Việt');
  });

  test('locale=en → trả nameEn', () => {
    const result = localizeEntity(makeProduct(), 'en', 'product');
    expect(result.name).toBe('iPhone 17');
    expect(result.shortDescription).toBe('English description');
  });

  test('locale=en, nameEn null → fallback nameVi', () => {
    const result = localizeEntity(makeProduct({ nameEn: null }), 'en', 'product');
    expect(result.name).toBe('Điện thoại iPhone 17');
  });

  test('locale=vi, nameVi null → fallback nameEn', () => {
    const result = localizeEntity(makeProduct({ nameVi: null }), 'vi', 'product');
    expect(result.name).toBe('iPhone 17');
  });

  test('cả vi lẫn en đều null → null', () => {
    const result = localizeEntity(makeProduct({ nameVi: null, nameEn: null }), 'vi', 'product');
    expect(result.name).toBeNull();
  });

  test('giữ nguyên các field không dịch (id, slug, v.v.)', () => {
    const product = makeProduct({ slug: 'iphone-17', basePrice: 30000000 });
    const result = localizeEntity(product, 'vi', 'product');
    expect(result.id).toBe(1);
    expect(result.slug).toBe('iphone-17');
    expect(result.basePrice).toBe(30000000);
  });

  test('entity null → trả null', () => {
    expect(localizeEntity(null, 'vi', 'product')).toBeNull();
  });

  test('type không hợp lệ → trả entity nguyên', () => {
    const product = makeProduct();
    const result = localizeEntity(product, 'vi', 'invalidType');
    expect(result).toBe(product);
  });

  test('Sequelize instance.toJSON() được gọi', () => {
    const mockInstance = {
      ...makeProduct(),
      toJSON: jest.fn().mockReturnValue({ ...makeProduct() }),
    };
    localizeEntity(mockInstance, 'vi', 'product');
    expect(mockInstance.toJSON).toHaveBeenCalled();
  });
});

describe('localizeEntity — category', () => {
  test('locale=vi → nameVi', () => {
    const cat = { id: 1, nameVi: 'Điện thoại', nameEn: 'Phones', descriptionVi: 'Mô tả', descriptionEn: 'Desc' };
    const result = localizeEntity(cat, 'vi', 'category');
    expect(result.name).toBe('Điện thoại');
    expect(result.description).toBe('Mô tả');
  });

  test('locale=en → nameEn', () => {
    const cat = { id: 1, nameVi: 'Điện thoại', nameEn: 'Phones', descriptionVi: 'Mô tả', descriptionEn: 'Desc' };
    const result = localizeEntity(cat, 'en', 'category');
    expect(result.name).toBe('Phones');
  });
});

describe('localizeList', () => {
  test('dịch mảng entities', () => {
    const products = [makeProduct(), makeProduct({ id: 2, nameVi: 'Samsung', nameEn: 'Samsung' })];
    const result = localizeList(products, 'en', 'product');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('iPhone 17');
    expect(result[1].name).toBe('Samsung');
  });

  test('mảng rỗng → mảng rỗng', () => {
    expect(localizeList([], 'vi', 'product')).toEqual([]);
  });

  test('null → mảng rỗng', () => {
    expect(localizeList(null, 'vi', 'product')).toEqual([]);
  });
});

describe('localizeEntity — branch coverage (lines 47, 56)', () => {
  test('type null → retorna entity sem modificar (branch !type)', () => {
    const product = { id: 5, nameVi: 'Test' };
    // type é null → !type é true → retorna entity imediatamente
    const result = localizeEntity(product, 'vi', null);
    expect(result).toBe(product);
  });

  test('type undefined → retorna entity sem modificar (branch !type)', () => {
    const product = { id: 6, nameVi: 'Test' };
    const result = localizeEntity(product, 'vi', undefined);
    expect(result).toBe(product);
  });

  test('locale=en, en existe → retorna en (sem usar fallback vi)', () => {
    // Cobre a branch onde `en` é truthy → `en || vi` retorna en diretamente
    const entity = { nameVi: 'Tên tiếng Việt', nameEn: 'English Name' };
    const result = localizeEntity(entity, 'en', 'brand');
    expect(result.name).toBe('English Name');
  });

  test('locale=vi, vi existe → retorna vi (sem usar fallback en)', () => {
    // Cobre a branch onde `vi` é truthy → `vi || en` retorna vi diretamente
    const entity = { nameVi: 'Tên Việt', nameEn: 'English' };
    const result = localizeEntity(entity, 'vi', 'brand');
    expect(result.name).toBe('Tên Việt');
  });

  test('locale=vi com valor padrão → usa vi (default parameter branch)', () => {
    // Chama sem locale → default 'vi' → cobre branch do parâmetro padrão
    const entity = { nameVi: 'Mặc định', nameEn: 'Default' };
    const result = localizeEntity(entity, undefined, 'brand');
    expect(result.name).toBe('Mặc định');
  });

  test('locale=en, cả en lẫn vi đều null → null (en||vi||null fallback — branch 6 null path, line 56)', () => {
    // locale='en' → expression: (en || vi || null)
    // en=null, vi=null → cả hai đều falsy → kết quả là null
    // Covers the third || null path of the binary-expr in locale=en branch
    const entity = { nameVi: null, nameEn: null };
    const result = localizeEntity(entity, 'en', 'brand');
    expect(result.name).toBeNull();
  });
});

describe('FIELD_MAPS', () => {
  test('tất cả supported types tồn tại', () => {
    ['product', 'category', 'brand', 'collection', 'news', 'banner'].forEach(type => {
      expect(FIELD_MAPS[type]).toBeDefined();
      expect(FIELD_MAPS[type].length).toBeGreaterThan(0);
    });
  });

  test('product có đủ 5 fields', () => {
    expect(FIELD_MAPS.product).toHaveLength(5);
  });

  test('banner có 1 field (title)', () => {
    expect(FIELD_MAPS.banner).toHaveLength(1);
    expect(FIELD_MAPS.banner[0][0]).toBe('title');
  });
});
