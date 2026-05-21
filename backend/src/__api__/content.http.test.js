require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, Banner, News, Feedback } = require('@models');

const TS = Date.now();
let admin, adminToken;
let createdBannerId, createdNewsId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_content_${TS}@t.com`,
    role: 'admin',
  }));
});

afterAll(async () => {
  if (createdBannerId)
    await Banner.destroy({ where: { id: createdBannerId }, force: true }).catch(() => {});
  if (createdNewsId)
    await News.destroy({ where: { id: createdNewsId }, force: true }).catch(() => {});
  // Feedback tạo qua POST /contact/feedback — xóa theo email test
  await Feedback.destroy({ where: { email: `__http_content_fb_${TS}@t.com` }, force: true }).catch(
    () => {},
  );
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── Banners ──────────────────────────────────────────────────

describe('GET /api/banners', () => {
  test('public → 200 + danh sách banners', async () => {
    const res = await request(app).get('/api/banners');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/banners/:id', () => {
  test('id không tồn tại → 404', async () => {
    const res = await request(app).get('/api/banners/999999999');
    expect([404, 400]).toContain(res.status);
  });
});

describe('POST /api/banners', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/banners')
      .send({ title: '__HTTP_Banner_Test', imageUrl: 'https://example.com/img.jpg' });
    expect(res.status).toBe(401);
  });
  test('admin + body hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `__HTTP_Content_Banner_${TS}`,
        imageUrl: 'https://example.com/banner.jpg',
        position: 'home_hero',
        isActive: true,
        priority: 0,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdBannerId = res.body.data?.id ?? res.body.data?.banner?.id;
  });
  test('admin + thiếu imageUrl → 422', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '__HTTP_NoImage_Banner' });
    expect(res.status).toBe(422);
  });
  test('admin + imageUrl không phải URL → 422', async () => {
    const res = await request(app)
      .post('/api/banners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '__HTTP_BadUrl_Banner', imageUrl: 'not-a-url' });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /api/banners/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).patch('/api/banners/1').send({ isActive: false });
    expect(res.status).toBe(401);
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .patch('/api/banners/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect([400, 404]).toContain(res.status);
  });
});

describe('DELETE /api/banners/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/banners/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa banner đã tạo → 200', async () => {
    if (!createdBannerId) return;
    const res = await request(app)
      .delete(`/api/banners/${createdBannerId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    createdBannerId = null;
  });
  test('admin xóa banner không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/banners/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── News ─────────────────────────────────────────────────────

describe('GET /api/news', () => {
  test('public → 200 + danh sách tin tức', async () => {
    const res = await request(app).get('/api/news');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('query page + limit → 200', async () => {
    const res = await request(app).get('/api/news').query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
  });
  test('query category + search → 200', async () => {
    const res = await request(app).get('/api/news').query({ category: 'Tin tức', search: 'test' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/news/slug/:slug', () => {
  test('slug không tồn tại → 404', async () => {
    const res = await request(app).get('/api/news/slug/slug-khong-ton-tai-xyz-999');
    expect([404, 400]).toContain(res.status);
  });
});

describe('GET /api/news/:id', () => {
  test('id không tồn tại → 404', async () => {
    const res = await request(app).get('/api/news/999999999');
    expect([404, 400]).toContain(res.status);
  });
});

describe('POST /api/news', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/news')
      .send({ title: '__HTTP_News_NoAuth', content: 'Nội dung test'.padEnd(10) });
    expect(res.status).toBe(401);
  });
  test('admin + body hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/news')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: `__HTTP_Content_News_${TS}`,
        content: 'Nội dung bài viết test HTTP integration có ít nhất 10 ký tự.',
        slug: `__http-content-news-${TS}`,
        isPublished: true,
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdNewsId = res.body.data?.id ?? res.body.data?.news?.id;
  });
  test('admin + content quá ngắn → 422', async () => {
    const res = await request(app)
      .post('/api/news')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '__HTTP_News_Short', content: 'Ngắn' });
    expect(res.status).toBe(422);
  });
  test('admin + thiếu title → 422', async () => {
    const res = await request(app)
      .post('/api/news')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Nội dung đủ dài tối thiểu 10 ký tự rồi đây.' });
    expect(res.status).toBe(422);
  });
});

describe('PUT /api/news/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/news/1').send({ title: 'Updated' });
    expect(res.status).toBe(401);
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/news/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: '__HTTP_Updated' });
    expect([400, 404]).toContain(res.status);
  });
  test('admin cập nhật bài đã tạo → 200', async () => {
    if (!createdNewsId) return;
    const res = await request(app)
      .put(`/api/news/${createdNewsId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: `__HTTP_Updated_News_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
});

describe('DELETE /api/news/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/news/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa tin tức đã tạo → 200', async () => {
    if (!createdNewsId) return;
    const res = await request(app)
      .delete(`/api/news/${createdNewsId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    createdNewsId = null;
  });
  test('admin xóa tin tức không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/news/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Contact ──────────────────────────────────────────────────

describe('POST /api/contact/feedback', () => {
  test('body hợp lệ → 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/contact/feedback')
      .send({
        name: '__HTTP_Content_User',
        email: `__http_content_fb_${TS}@t.com`,
        subject: 'Phản hồi test',
        content: 'Đây là nội dung phản hồi test tích hợp HTTP đủ dài.',
      });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
  test('thiếu name → 422', async () => {
    const res = await request(app).post('/api/contact/feedback').send({
      email: 'test@example.com',
      subject: 'Subject test',
      content: 'Nội dung test đủ dài tối thiểu mười ký tự.',
    });
    expect(res.status).toBe(422);
  });
  test('email không hợp lệ → 422', async () => {
    const res = await request(app).post('/api/contact/feedback').send({
      name: '__HTTP_User',
      email: 'not-valid-email',
      subject: 'Subject test',
      content: 'Nội dung test đủ dài tối thiểu mười ký tự.',
    });
    expect(res.status).toBe(422);
  });
  test('content quá ngắn → 422', async () => {
    const res = await request(app).post('/api/contact/feedback').send({
      name: '__HTTP_User',
      email: 'test@example.com',
      subject: 'Subject test',
      content: 'Ngắn',
    });
    expect(res.status).toBe(422);
  });
});
