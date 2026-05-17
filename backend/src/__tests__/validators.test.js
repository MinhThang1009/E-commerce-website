/**
 * validators.test.js
 *
 * Tests cho các Joi schema validators:
 *   - src/validators/news.js
 *   - src/validators/collection.js
 *   - src/validators/brand.js
 *   - src/validators/banner.js
 *   - src/modules/reviews/validators/reviewsValidator.js
 *   - src/modules/payment/validators/paymentValidator.js
 *   - src/modules/users/validators/usersValidator.js
 */

process.env.NODE_ENV = 'test';

// ════════════════════════════════════════════════════════════════════════════
// src/validators/news.js
// ════════════════════════════════════════════════════════════════════════════

describe('createNewsSchema', () => {
  const { createNewsSchema } = require('../validators/news');

  it('chấp nhận dữ liệu hợp lệ đầy đủ', () => {
    const validInput = {
      title: 'Tin tức mới nhất',
      content: 'Nội dung bài viết phải có ít nhất 10 ký tự.',
    };
    const { error } = createNewsSchema.validate(validInput);
    expect(error).toBeUndefined();
  });

  it('chấp nhận dữ liệu hợp lệ với tất cả trường tuỳ chọn', () => {
    const validInput = {
      title: 'Tiêu đề bài viết',
      content: 'Nội dung đủ dài để hợp lệ trong schema.',
      slug: 'tieu-de-bai-viet',
      description: 'Mô tả ngắn',
      thumbnail: 'https://example.com/image.jpg',
      category: 'Công nghệ',
      tags: 'tag1,tag2',
      isPublished: true,
    };
    const { error } = createNewsSchema.validate(validInput);
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu title', () => {
    const { error } = createNewsSchema.validate({
      content: 'Nội dung bài viết hợp lệ có ít nhất 10 ký tự.',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Tiêu đề là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu content', () => {
    const { error } = createNewsSchema.validate({ title: 'Tiêu đề' });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Nội dung là trường bắt buộc/);
  });

  it('trả về lỗi khi content quá ngắn (dưới 10 ký tự)', () => {
    const { error } = createNewsSchema.validate({
      title: 'Tiêu đề',
      content: 'Ngắn',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/ít nhất 10 ký tự/);
  });

  it('trả về lỗi khi title vượt quá 255 ký tự', () => {
    const { error } = createNewsSchema.validate({
      title: 'A'.repeat(256),
      content: 'Nội dung bài viết hợp lệ có ít nhất 10 ký tự.',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/255 ký tự/);
  });

  it('trả về lỗi khi thumbnail không phải URL hợp lệ', () => {
    const { error } = createNewsSchema.validate({
      title: 'Tiêu đề',
      content: 'Nội dung bài viết hợp lệ.',
      thumbnail: 'not-a-valid-url',
    });
    expect(error).toBeDefined();
  });
});

describe('updateNewsSchema', () => {
  const { updateNewsSchema } = require('../validators/news');

  it('chấp nhận object rỗng (tất cả trường đều tuỳ chọn)', () => {
    const { error } = updateNewsSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('chấp nhận update chỉ một trường', () => {
    const { error } = updateNewsSchema.validate({ title: 'Tiêu đề mới' });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi content update quá ngắn', () => {
    const { error } = updateNewsSchema.validate({ content: 'Ngắn' });
    expect(error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/validators/collection.js
// ════════════════════════════════════════════════════════════════════════════

describe('createCollectionSchema', () => {
  const { createCollectionSchema } = require('../validators/collection');

  it('chấp nhận dữ liệu hợp lệ với name bắt buộc', () => {
    const { error } = createCollectionSchema.validate({ name: 'Bộ sưu tập mùa hè' });
    expect(error).toBeUndefined();
  });

  it('chấp nhận dữ liệu đầy đủ với tất cả trường tuỳ chọn', () => {
    const { error } = createCollectionSchema.validate({
      name: 'Flash Sale',
      slug: 'flash-sale',
      description: 'Giảm giá sốc cuối tuần',
      thumbnail: 'https://example.com/banner.jpg',
      isActive: true,
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu name', () => {
    const { error } = createCollectionSchema.validate({});
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Tên là trường bắt buộc/);
  });

  it('trả về lỗi khi name vượt quá 255 ký tự', () => {
    const { error } = createCollectionSchema.validate({ name: 'A'.repeat(256) });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/255 ký tự/);
  });

  it('trả về lỗi khi thumbnail không phải URL hợp lệ', () => {
    const { error } = createCollectionSchema.validate({
      name: 'Bộ sưu tập',
      thumbnail: 'invalid-url',
    });
    expect(error).toBeDefined();
  });
});

describe('updateCollectionSchema', () => {
  const { updateCollectionSchema } = require('../validators/collection');

  it('chấp nhận object rỗng', () => {
    const { error } = updateCollectionSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('chấp nhận update isActive = false', () => {
    const { error } = updateCollectionSchema.validate({ isActive: false });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi name vượt quá 255 ký tự', () => {
    const { error } = updateCollectionSchema.validate({ name: 'A'.repeat(256) });
    expect(error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/validators/brand.js
// ════════════════════════════════════════════════════════════════════════════

describe('createBrandSchema', () => {
  const { createBrandSchema } = require('../validators/brand');

  it('chấp nhận dữ liệu hợp lệ với name bắt buộc', () => {
    const { error } = createBrandSchema.validate({ name: 'Samsung' });
    expect(error).toBeUndefined();
  });

  it('chấp nhận dữ liệu đầy đủ với tất cả trường tuỳ chọn', () => {
    const { error } = createBrandSchema.validate({
      name: 'Apple',
      slug: 'apple',
      logoUrl: 'https://example.com/logo.png',
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu name', () => {
    const { error } = createBrandSchema.validate({});
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Tên là trường bắt buộc/);
  });

  it('trả về lỗi khi name vượt quá 100 ký tự', () => {
    const { error } = createBrandSchema.validate({ name: 'A'.repeat(101) });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/100 ký tự/);
  });

  it('trả về lỗi khi logoUrl không phải URL hợp lệ', () => {
    const { error } = createBrandSchema.validate({
      name: 'Nike',
      logoUrl: 'not-a-url',
    });
    expect(error).toBeDefined();
  });

  it('chấp nhận logoUrl là null', () => {
    const { error } = createBrandSchema.validate({
      name: 'Adidas',
      logoUrl: null,
    });
    expect(error).toBeUndefined();
  });
});

describe('updateBrandSchema', () => {
  const { updateBrandSchema } = require('../validators/brand');

  it('chấp nhận object rỗng', () => {
    const { error } = updateBrandSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('chấp nhận update chỉ slug', () => {
    const { error } = updateBrandSchema.validate({ slug: 'new-slug' });
    expect(error).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/validators/banner.js
// ════════════════════════════════════════════════════════════════════════════

describe('createBannerSchema', () => {
  const { createBannerSchema } = require('../validators/banner');

  it('chấp nhận dữ liệu hợp lệ với title và imageUrl bắt buộc', () => {
    const { error } = createBannerSchema.validate({
      title: 'Banner mùa hè',
      imageUrl: 'https://example.com/banner.jpg',
    });
    expect(error).toBeUndefined();
  });

  it('chấp nhận dữ liệu đầy đủ với tất cả trường tuỳ chọn', () => {
    const { error } = createBannerSchema.validate({
      title: 'Flash Sale',
      imageUrl: 'https://example.com/flash.jpg',
      linkUrl: 'https://example.com/sale',
      position: 'home_hero',
      isActive: true,
      priority: 1,
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu title', () => {
    const { error } = createBannerSchema.validate({
      imageUrl: 'https://example.com/banner.jpg',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Tiêu đề là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu imageUrl', () => {
    const { error } = createBannerSchema.validate({ title: 'Banner' });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/imageUrl là trường bắt buộc/);
  });

  it('trả về lỗi khi imageUrl không phải URL hợp lệ', () => {
    const { error } = createBannerSchema.validate({
      title: 'Banner',
      imageUrl: 'not-a-url',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/URL hợp lệ/);
  });

  it('trả về lỗi khi position không thuộc danh sách cho phép', () => {
    const { error } = createBannerSchema.validate({
      title: 'Banner',
      imageUrl: 'https://example.com/img.jpg',
      position: 'invalid_position',
    });
    expect(error).toBeDefined();
  });

  it('chấp nhận position hợp lệ: home_middle', () => {
    const { error } = createBannerSchema.validate({
      title: 'Banner',
      imageUrl: 'https://example.com/img.jpg',
      position: 'home_middle',
    });
    expect(error).toBeUndefined();
  });

  it('chấp nhận position hợp lệ: sidebar', () => {
    const { error } = createBannerSchema.validate({
      title: 'Banner',
      imageUrl: 'https://example.com/img.jpg',
      position: 'sidebar',
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi priority là số âm', () => {
    const { error } = createBannerSchema.validate({
      title: 'Banner',
      imageUrl: 'https://example.com/img.jpg',
      priority: -1,
    });
    expect(error).toBeDefined();
  });
});

describe('updateBannerSchema', () => {
  const { updateBannerSchema } = require('../validators/banner');

  it('chấp nhận object rỗng', () => {
    const { error } = updateBannerSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('chấp nhận update chỉ isActive', () => {
    const { error } = updateBannerSchema.validate({ isActive: false });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi imageUrl update không phải URL', () => {
    const { error } = updateBannerSchema.validate({ imageUrl: 'bad-url' });
    expect(error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/reviews/validators/reviewsValidator.js
// ════════════════════════════════════════════════════════════════════════════

describe('reviewSchema', () => {
  const { reviewSchema } = require('../modules/reviews/validators/reviewsValidator');

  it('chấp nhận review hợp lệ đầy đủ', () => {
    const { error } = reviewSchema.validate({
      productId: 1,
      rating: 5,
      title: 'Sản phẩm tuyệt vời',
      comment: 'Rất hài lòng với sản phẩm này.',
    });
    expect(error).toBeUndefined();
  });

  it('chấp nhận productId dạng string', () => {
    const { error } = reviewSchema.validate({
      productId: '123',
      rating: 4,
      title: 'Tốt',
      comment: 'Chất lượng ổn.',
    });
    expect(error).toBeUndefined();
  });

  it('chấp nhận images là mảng URL hợp lệ', () => {
    const { error } = reviewSchema.validate({
      productId: 1,
      rating: 3,
      title: 'Bình thường',
      comment: 'Không tệ lắm.',
      images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu productId', () => {
    const { error } = reviewSchema.validate({
      rating: 4,
      title: 'Tốt',
      comment: 'Tốt lắm.',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/ID sản phẩm là trường bắt buộc/);
  });

  it('trả về lỗi khi rating dưới 1', () => {
    const { error } = reviewSchema.validate({
      productId: 1,
      rating: 0,
      title: 'Tệ',
      comment: 'Không hài lòng.',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/1 đến 5/);
  });

  it('trả về lỗi khi rating trên 5', () => {
    const { error } = reviewSchema.validate({
      productId: 1,
      rating: 6,
      title: 'Quá tốt',
      comment: 'Xuất sắc.',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/1 đến 5/);
  });

  it('trả về lỗi khi thiếu title', () => {
    const { error } = reviewSchema.validate({
      productId: 1,
      rating: 4,
      comment: 'Tốt lắm.',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Tiêu đề là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu comment', () => {
    const { error } = reviewSchema.validate({
      productId: 1,
      rating: 4,
      title: 'Tốt',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Nội dung đánh giá là trường bắt buộc/);
  });
});

describe('reviewHelpfulSchema', () => {
  const { reviewHelpfulSchema } = require('../modules/reviews/validators/reviewsValidator');

  it('chấp nhận helpful = true', () => {
    const { error } = reviewHelpfulSchema.validate({ helpful: true });
    expect(error).toBeUndefined();
  });

  it('chấp nhận helpful = false', () => {
    const { error } = reviewHelpfulSchema.validate({ helpful: false });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu helpful', () => {
    const { error } = reviewHelpfulSchema.validate({});
    expect(error).toBeDefined();
    expect(error.message).toMatch(/helpful là trường bắt buộc/);
  });

  it('trả về lỗi khi helpful là string thay vì boolean', () => {
    const { error } = reviewHelpfulSchema.validate({ helpful: 'yes' });
    expect(error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/payment/validators/paymentValidator.js
// ════════════════════════════════════════════════════════════════════════════

describe('createUrlSchema', () => {
  const { createUrlSchema } = require('../modules/payment/validators/paymentValidator');

  it('chấp nhận orderId hợp lệ là số nguyên dương', () => {
    const { error } = createUrlSchema.validate({ orderId: 42 });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu orderId', () => {
    const { error } = createUrlSchema.validate({});
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Order ID là bắt buộc/);
  });

  it('trả về lỗi khi orderId là số âm', () => {
    const { error } = createUrlSchema.validate({ orderId: -1 });
    expect(error).toBeDefined();
  });

  it('trả về lỗi khi orderId không phải số', () => {
    const { error } = createUrlSchema.validate({ orderId: 'abc' });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Order ID phải là số/);
  });
});

describe('refundSchema', () => {
  const { refundSchema } = require('../modules/payment/validators/paymentValidator');

  it('chấp nhận refund hợp lệ chỉ với orderId', () => {
    const { error } = refundSchema.validate({ orderId: 10 });
    expect(error).toBeUndefined();
  });

  it('chấp nhận refund đầy đủ với amount và reason', () => {
    const { error } = refundSchema.validate({
      orderId: 10,
      amount: 50000,
      reason: 'Sản phẩm bị lỗi',
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu orderId', () => {
    const { error } = refundSchema.validate({ amount: 50000 });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Order ID là bắt buộc/);
  });

  it('trả về lỗi khi amount là số âm', () => {
    const { error } = refundSchema.validate({ orderId: 5, amount: -100 });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/lớn hơn 0/);
  });

  it('trả về lỗi khi reason vượt quá 500 ký tự', () => {
    const { error } = refundSchema.validate({
      orderId: 5,
      reason: 'A'.repeat(501),
    });
    expect(error).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/users/validators/usersValidator.js
// ════════════════════════════════════════════════════════════════════════════

describe('updateProfileSchema', () => {
  const { updateProfileSchema } = require('../modules/users/validators/usersValidator');

  it('chấp nhận object rỗng (tất cả trường đều tuỳ chọn)', () => {
    const { error } = updateProfileSchema.validate({});
    expect(error).toBeUndefined();
  });

  it('chấp nhận cập nhật chỉ firstName', () => {
    const { error } = updateProfileSchema.validate({ firstName: 'Nguyễn' });
    expect(error).toBeUndefined();
  });

  it('chấp nhận cập nhật đầy đủ thông tin', () => {
    const { error } = updateProfileSchema.validate({
      firstName: 'Nguyễn',
      lastName: 'Văn A',
      phone: '0901234567',
      avatar: 'https://example.com/avatar.jpg',
    });
    expect(error).toBeUndefined();
  });
});

describe('changePasswordSchema', () => {
  const { changePasswordSchema } = require('../modules/users/validators/usersValidator');

  it('chấp nhận dữ liệu hợp lệ khi các mật khẩu khớp nhau', () => {
    const { error } = changePasswordSchema.validate({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu currentPassword', () => {
    const { error } = changePasswordSchema.validate({
      newPassword: 'NewPass123',
      confirmPassword: 'NewPass123',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Mật khẩu hiện tại là trường bắt buộc/);
  });

  it('trả về lỗi khi newPassword quá ngắn (dưới 6 ký tự)', () => {
    const { error } = changePasswordSchema.validate({
      currentPassword: 'OldPass',
      newPassword: '12345',
      confirmPassword: '12345',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/ít nhất/);
  });

  it('trả về lỗi khi confirmPassword không khớp newPassword', () => {
    const { error } = changePasswordSchema.validate({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
      confirmPassword: 'DifferentPass',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/không khớp/);
  });

  it('trả về lỗi khi thiếu confirmPassword', () => {
    const { error } = changePasswordSchema.validate({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Xác nhận mật khẩu là trường bắt buộc/);
  });
});

describe('addressSchema', () => {
  const { addressSchema } = require('../modules/users/validators/usersValidator');

  const validAddress = {
    firstName: 'Nguyễn',
    lastName: 'Văn A',
    address1: '123 Đường Lê Lợi',
    city: 'Hồ Chí Minh',
    state: 'Hồ Chí Minh',
    zip: '700000',
    country: 'VN',
  };

  it('chấp nhận địa chỉ hợp lệ với tất cả trường bắt buộc', () => {
    const { error } = addressSchema.validate(validAddress);
    expect(error).toBeUndefined();
  });

  it('chấp nhận địa chỉ đầy đủ với tất cả trường tuỳ chọn', () => {
    const { error } = addressSchema.validate({
      ...validAddress,
      name: 'Địa chỉ nhà',
      company: 'Công ty ABC',
      address2: 'Tầng 5',
      phone: '0901234567',
      isDefault: true,
    });
    expect(error).toBeUndefined();
  });

  it('trả về lỗi khi thiếu firstName', () => {
    const { firstName, ...withoutFirst } = validAddress;
    const { error } = addressSchema.validate(withoutFirst);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Tên là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu address1', () => {
    const { address1, ...withoutAddress } = validAddress;
    const { error } = addressSchema.validate(withoutAddress);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Địa chỉ là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu city', () => {
    const { city, ...withoutCity } = validAddress;
    const { error } = addressSchema.validate(withoutCity);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Thành phố là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu zip', () => {
    const { zip, ...withoutZip } = validAddress;
    const { error } = addressSchema.validate(withoutZip);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Mã bưu điện là trường bắt buộc/);
  });

  it('trả về lỗi khi thiếu country', () => {
    const { country, ...withoutCountry } = validAddress;
    const { error } = addressSchema.validate(withoutCountry);
    expect(error).toBeDefined();
    expect(error.message).toMatch(/Quốc gia là trường bắt buộc/);
  });

  it('isDefault mặc định là false khi không được cung cấp', () => {
    const { value } = addressSchema.validate(validAddress);
    expect(value.isDefault).toBe(false);
  });
});
