require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand } = require('@models');

const TS = Date.now();
let user, token, adminUser, staffToken, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_catcomp_${TS}@t.com` }));
  ({ user: adminUser, token: staffToken } = await createTestUser({
    email: `__http_catcomp_admin_${TS}@t.com`,
    role: 'staff',
  }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (user) await user.destroy({ force: true }).catch(() => {});
  if (adminUser) await adminUser.destroy({ force: true }).catch(() => {});
});

// ── Categories ───────────────────────────────────────────────────────────────

describe('GET /api/categories', () => {
  test('trả về 200 và array danh mục', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/categories/tree', () => {
  test('trả về 200 và cây danh mục phân cấp', async () => {
    const res = await request(app).get('/api/categories/tree');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/categories/featured', () => {
  test('trả về 200 và danh sách danh mục nổi bật', async () => {
    const res = await request(app).get('/api/categories/featured');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/categories/slug/:slug', () => {
  test('slug hợp lệ từ DB → 200 kèm thông tin danh mục', async () => {
    const res = await request(app).get(`/api/categories/slug/${cat.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('slug không tồn tại → 404', async () => {
    const res = await request(app).get('/api/categories/slug/khong-ton-tai-slug-999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/categories/:id/products', () => {
  test('id hợp lệ → 200 và array sản phẩm', async () => {
    const res = await request(app).get(`/api/categories/${cat.id}/products`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/categories/:id', () => {
  test('id hợp lệ → 200 kèm thông tin danh mục', async () => {
    const res = await request(app).get(`/api/categories/${cat.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('id không tồn tại → 404', async () => {
    const res = await request(app).get('/api/categories/999999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/categories (admin)', () => {
  test('admin tạo danh mục → 201', async () => {
    const newCatName = `__HTTP_CatComp_${TS}`;
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: newCatName, isActive: true });
    expect([200, 201]).toContain(res.status);
    // Dọn danh mục vừa tạo
    const createdId = res.body?.data?.id || res.body?.data?.category?.id;
    if (createdId) await Category.destroy({ where: { id: createdId } }).catch(() => {});
  });

  test('không phải admin → 403', async () => {
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `__HTTP_CatComp_Forbidden_${TS}`, isActive: true });
    expect(res.status).toBe(403);
  });

  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/categories')
      .send({ name: `__HTTP_CatComp_NoAuth_${TS}`, isActive: true });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/categories/:id (admin, có sản phẩm)', () => {
  test('danh mục đang có sản phẩm → 400 không cho xóa', async () => {
    // cat đang được dùng bởi product tạo trong beforeAll
    const res = await request(app)
      .delete(`/api/categories/${cat.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    // Server phải từ chối vì vẫn còn sản phẩm thuộc danh mục
    expect([400, 409]).toContain(res.status);
  });
});

// ── Brands ───────────────────────────────────────────────────────────────────

describe('GET /api/brands', () => {
  test('trả về 200 và array thương hiệu', async () => {
    const res = await request(app).get('/api/brands');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/brands/slug/:slug', () => {
  test('slug hợp lệ → 200 kèm thông tin thương hiệu', async () => {
    const res = await request(app).get(`/api/brands/slug/${brand.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('slug không tồn tại → 404 hoặc 200 rỗng', async () => {
    const res = await request(app).get('/api/brands/slug/thuong-hieu-khong-ton-tai-999999');
    expect([200, 404]).toContain(res.status);
  });
});

describe('GET /api/brands/slug/:slug/products', () => {
  test('slug hợp lệ → 200 và danh sách sản phẩm', async () => {
    const res = await request(app).get(`/api/brands/slug/${brand.slug}/products`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/brands (admin)', () => {
  test('admin tạo thương hiệu → 201', async () => {
    const newBrandName = `__HTTP_BrandComp_${TS}`;
    const res = await request(app)
      .post('/api/brands')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: newBrandName });
    expect([200, 201]).toContain(res.status);
    const createdId = res.body?.data?.id || res.body?.data?.brand?.id;
    if (createdId) await Brand.destroy({ where: { id: createdId } }).catch(() => {});
  });

  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/brands')
      .send({ name: `__HTTP_BrandComp_NoAuth_${TS}` });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/brands/:id (admin)', () => {
  test('admin cập nhật thương hiệu → 200', async () => {
    const res = await request(app)
      .put(`/api/brands/${brand.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_BrandComp_Updated_${TS}` });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('không auth → 401', async () => {
    const res = await request(app).put(`/api/brands/${brand.id}`).send({ name: 'Updated' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/brands/:id (admin)', () => {
  test('xóa thương hiệu không có sản phẩm → 200', async () => {
    // Tạo brand mới không có sản phẩm để xóa an toàn
    const tempBrand = await Brand.create({
      nameVi: `__HTTP_BrandComp_Del_${TS}`,
      nameEn: `__HTTP_BrandComp_Del_${TS}`,
      slug: `http-brand-comp-del-${TS}`,
    });
    const res = await request(app)
      .delete(`/api/brands/${tempBrand.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 204]).toContain(res.status);
    await Brand.destroy({ where: { id: tempBrand.id } }).catch(() => {});
  });

  test('xóa thương hiệu đang có sản phẩm → 400', async () => {
    // brand được tạo trong beforeAll đang được product dùng
    const res = await request(app)
      .delete(`/api/brands/${brand.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 409]).toContain(res.status);
  });
});

// ── Products ─────────────────────────────────────────────────────────────────

describe('GET /api/products', () => {
  test('trả về 200 và data array', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('tìm kiếm với search=laptop → 200', async () => {
    const res = await request(app).get('/api/products?search=laptop');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('sắp xếp với sort=price_asc → 200', async () => {
    const res = await request(app).get('/api/products?sort=price_asc');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/featured', () => {
  test('trả về 200 và sản phẩm nổi bật', async () => {
    const res = await request(app).get('/api/products/featured');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/new-arrivals', () => {
  test('trả về 200 và sản phẩm mới về', async () => {
    const res = await request(app).get('/api/products/new-arrivals');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/best-sellers', () => {
  test('trả về 200 và sản phẩm bán chạy', async () => {
    const res = await request(app).get('/api/products/best-sellers');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/deals', () => {
  test('trả về 200 và sản phẩm đang giảm giá', async () => {
    const res = await request(app).get('/api/products/deals');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/filters', () => {
  test('trả về 200 và các tùy chọn bộ lọc', async () => {
    const res = await request(app).get('/api/products/filters');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/products/search', () => {
  test('tìm kiếm q=apple → 200', async () => {
    const res = await request(app).get('/api/products/search?q=apple');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/suggestions', () => {
  test('gợi ý q=ip → 200', async () => {
    const res = await request(app).get('/api/products/suggestions?q=ip');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/recently-viewed', () => {
  test('authenticated → 200', async () => {
    const res = await request(app)
      .get('/api/products/recently-viewed')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('không auth → 401', async () => {
    const res = await request(app).get('/api/products/recently-viewed');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/products/:id', () => {
  test('id hợp lệ → 200 kèm chi tiết sản phẩm', async () => {
    const res = await request(app).get(`/api/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('id không tồn tại → 404', async () => {
    const res = await request(app).get('/api/products/999999');
    expect(res.status).toBe(404);
  });
});

describe('GET /api/products/:id/related', () => {
  test('trả về 200 và array sản phẩm liên quan', async () => {
    const res = await request(app).get(`/api/products/${product.id}/related`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/products/:id/variants', () => {
  test('trả về 200 và array biến thể', async () => {
    const res = await request(app).get(`/api/products/${product.id}/variants`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/products/:id/reviews-summary', () => {
  test('trả về 200 và tóm tắt đánh giá', async () => {
    const res = await request(app).get(`/api/products/${product.id}/reviews-summary`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
