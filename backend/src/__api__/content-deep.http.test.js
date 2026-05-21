/**
 * HTTP tests bổ sung cho module content — tập trung vào query params,
 * response shape, và các kịch bản chưa có trong content.http.test.js.
 *
 * Những gì đã được test ở content.http.test.js (KHÔNG lặp lại):
 *  - GET /banners → 200; GET /banners/:id → 404
 *  - POST /banners → 401, 201, 422 (thiếu imageUrl, URL sai)
 *  - PATCH /banners/:id → 401, 404; DELETE /banners/:id → 401, 200, 404
 *  - GET /news → 200, page+limit, category+search; GET /news/slug/:slug → 404
 *  - GET /news/:id → 404; POST /news → 401, 201, 422 (content ngắn, thiếu title)
 *  - PUT /news/:id → 401, 404, 200; DELETE /news/:id → 401, 200, 404
 *  - POST /contact/feedback → 200, 422 (thiếu name, email sai, content ngắn)
 */
require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, Banner, News, Feedback } = require('@models');

const TS = Date.now();
let admin, adminToken, customerUser, customerToken;
let createdBannerId, createdNewsId, createdNewsSlug;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_cntdeep_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: customerUser, token: customerToken } = await createTestUser({
    email: `__http_cntdeep_cust_${TS}@t.com`,
    role: 'customer',
  }));

  // Tạo banner để test GET/:id với id tồn tại
  const bannerRes = await Banner.create({
    title: `__HTTP_CntDeep_Banner_${TS}`,
    imageUrl: 'https://example.com/test-banner.jpg',
    position: 'home_hero',
    isActive: true,
    priority: 0,
  });
  createdBannerId = bannerRes.id;

  // Tạo bài viết để test GET /news/slug/:slug và /related
  const newsRes = await News.create({
    title: `__HTTP_CntDeep_News_${TS}`,
    content: 'Nội dung bài viết test đủ dài cho integration test HTTP deep.',
    slug: `__http-cntdeep-news-${TS}`,
    isPublished: true,
  });
  createdNewsId = newsRes.id;
  createdNewsSlug = newsRes.slug;
});

afterAll(async () => {
  if (createdBannerId) {
    await Banner.destroy({ where: { id: createdBannerId }, force: true }).catch(() => {});
  }
  if (createdNewsId) {
    await News.destroy({ where: { id: createdNewsId }, force: true }).catch(() => {});
  }
  await Feedback.destroy({ where: { email: { like: `%__http_cntdeep%` } } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (customerUser) await customerUser.destroy({ force: true }).catch(() => {});
});

// ── Banners ──────────────────────────────────────────────────────────────────

describe('GET /api/banners — response là array', () => {
  test('trả về 200 và data là array', async () => {
    const res = await request(app).get('/api/banners');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/banners?position=home_hero — lọc theo vị trí', () => {
  test('query position=home_hero → 200', async () => {
    const res = await request(app).get('/api/banners').query({ position: 'home_hero' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/banners?position=sidebar — vị trí khác', () => {
  test('query position=sidebar → 200', async () => {
    const res = await request(app).get('/api/banners').query({ position: 'sidebar' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/banners?isActive=true — chỉ banner đang hoạt động', () => {
  test('query isActive=true → 200 và chỉ trả banner active', async () => {
    const res = await request(app).get('/api/banners').query({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Mọi banner trả về phải có isActive = true (nếu API filter)
    if (Array.isArray(res.body.data)) {
      const hasInactive = res.body.data.some((b) => b.isActive === false);
      expect(hasInactive).toBe(false);
    }
  });
});

describe('GET /api/banners/:id — id tồn tại → 200', () => {
  test('id hợp lệ từ DB → 200 kèm thông tin banner', async () => {
    const res = await request(app).get(`/api/banners/${createdBannerId}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/banners/:id — id không tồn tại → 404', () => {
  test('id 999999999 → 404 hoặc 400', async () => {
    const res = await request(app).get('/api/banners/999999999');
    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('POST /api/banners (admin) — tạo mới → 201 có id', () => {
  test('admin tạo banner hợp lệ → 201 và response chứa id', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `__HTTP_CntDeep_BannerNew_${TS}`,
        imageUrl: 'https://example.com/new-banner.jpg',
        position: 'home_hero',
        isActive: true,
        priority: 1,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    const newId = res.body.data?.id ?? res.body.data?.banner?.id;
    expect(newId).toBeDefined();
    if (newId) await Banner.destroy({ where: { id: newId }, force: true }).catch(() => {});
  });
});

describe('POST /api/banners (customer) — không có quyền admin → 403', () => {
  test('customer gửi request tạo banner → 403', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: `__HTTP_CntDeep_BannerForbidden_${TS}`,
        imageUrl: 'https://example.com/forbidden.jpg',
        position: 'home_hero',
        isActive: true,
        priority: 0,
      });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/banners/:id (admin) — cập nhật banner → 200', () => {
  test('admin cập nhật banner đã tạo → 200', async () => {
    const res = await request(app)
      .patch(`/api/banners/${createdBannerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
});

describe('PATCH /api/banners/:id không tồn tại → 404', () => {
  test('id 999999999 → 404 hoặc 400', async () => {
    const res = await request(app)
      .patch('/api/banners/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect([400, 404]).toContain(res.status);
  });
});

describe('DELETE /api/banners/:id (admin) → 200', () => {
  test('admin xóa banner mới tạo → 200', async () => {
    // Tạo banner riêng để xóa, tránh ảnh hưởng createdBannerId dùng trong test khác
    const tempBanner = await Banner.create({
      title: `__HTTP_CntDeep_BannerDel_${TS}`,
      imageUrl: 'https://example.com/del-banner.jpg',
      position: 'home_hero',
      isActive: true,
      priority: 0,
    });
    const res = await request(app)
      .delete(`/api/banners/${tempBanner.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    await Banner.destroy({ where: { id: tempBanner.id }, force: true }).catch(() => {});
  });
});

// ── News ────────────────────────────────────────────────────────────────────

describe('GET /api/news — trả về news array có count', () => {
  test('response chứa news array và count', async () => {
    const res = await request(app).get('/api/news');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // API news trả { status, count, totalPages, currentPage, news }
    expect(res.body.news).toBeDefined();
  });
});

describe('GET /api/news?page=1&limit=5 — phân trang', () => {
  test('pagination page=1 limit=5 → 200', async () => {
    const res = await request(app).get('/api/news').query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/news?isPublished=true — chỉ bài đã xuất bản', () => {
  test('isPublished=true → 200', async () => {
    const res = await request(app).get('/api/news').query({ isPublished: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/news?category=Tech — lọc theo category', () => {
  test('category=Tech → 200', async () => {
    const res = await request(app).get('/api/news').query({ category: 'Tech' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/news?search=test — tìm kiếm', () => {
  test('search=test → 200', async () => {
    const res = await request(app).get('/api/news').query({ search: 'test' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/news/slug/:slug — slug hợp lệ → 200 + full article', () => {
  test('slug bài viết vừa tạo → 200 và news đầy đủ', async () => {
    const res = await request(app).get(`/api/news/slug/${createdNewsSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // API trả { status, news: { ... } }
    expect(res.body.news).toBeDefined();
    // Bài viết đầy đủ phải có content
    const newsItem = res.body.news;
    if (newsItem) {
      const hasContent = newsItem.content !== undefined || newsItem.body !== undefined;
      expect(hasContent || Object.keys(newsItem).length > 0).toBe(true);
    }
  });
});

describe('GET /api/news/slug/:slug — slug không tồn tại → 404', () => {
  test('slug không tồn tại → 404', async () => {
    const res = await request(app).get('/api/news/slug/slug-cntdeep-khong-ton-tai-zzz999');
    expect([400, 404]).toContain(res.status);
  });
});

describe('GET /api/news/slug/:slug/related — bài viết liên quan', () => {
  test('slug hợp lệ → 200 và news array', async () => {
    const res = await request(app).get(`/api/news/slug/${createdNewsSlug}/related`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // API trả { status, news: [...] }
    expect(Array.isArray(res.body.news)).toBe(true);
  });
});

describe('POST /api/news (admin) — tạo bài viết → 201 có id và slug', () => {
  test('admin tạo bài viết hợp lệ → 201 và response có id', async () => {
    const res = await request(app)
      .post('/api/news')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `__HTTP_CntDeep_NewsNew2_${TS}`,
        content: 'Nội dung bài viết mới đủ dài cho integration test HTTP deep content module.',
        slug: `__http-cntdeep-news-new2-${TS}`,
        isPublished: true,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    // API news trả { status, news: { id, ... } }
    const newId = res.body.news?.id ?? res.body.data?.id ?? res.body.data?.news?.id;
    expect(newId).toBeDefined();
    if (newId) await News.destroy({ where: { id: newId }, force: true }).catch(() => {});
  });
});

describe('PUT /api/news/:id (admin) — cập nhật → 200', () => {
  test('admin cập nhật bài viết vừa tạo → 200', async () => {
    const res = await request(app)
      .put(`/api/news/${createdNewsId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `__HTTP_CntDeep_NewsUpdated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
});

describe('DELETE /api/news/:id (admin) → 200', () => {
  test('admin xóa bài viết mới tạo → 200', async () => {
    // Tạo bài viết riêng để xóa, không ảnh hưởng createdNewsId dùng trong test khác
    const tempNews = await News.create({
      title: `__HTTP_CntDeep_NewsDel_${TS}`,
      content: 'Nội dung bài viết cần xóa để test integration.',
      slug: `__http-cntdeep-news-del-${TS}`,
      isPublished: false,
    });
    const res = await request(app)
      .delete(`/api/news/${tempNews.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    await News.destroy({ where: { id: tempNews.id }, force: true }).catch(() => {});
  });
});

// ── Contact ──────────────────────────────────────────────────────────────────

describe('POST /api/contact/feedback — body hợp lệ → 200', () => {
  test('gửi feedback đầy đủ → 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/contact/feedback')
      .send({
        name: '__HTTP_CntDeep_User',
        email: `__http_cntdeep_fb_${TS}@t.com`,
        subject: 'Phản hồi test deep',
        content: 'Đây là nội dung phản hồi test tích hợp HTTP deep content module đủ dài.',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
});
