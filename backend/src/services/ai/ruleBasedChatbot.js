const { Product, Category, Brand, Order, OrderItem, User } = require('../../models');
const { Op } = require('sequelize');
const logger = require('../../utils/logger');

// Alias tĩnh cho các từ viết tắt/tên thay thế — chỉ cần cập nhật khi thêm LOẠI sản phẩm hoàn toàn mới
// Tên danh mục (key) phải khớp chính xác với tên trong DB (lowercase)
const CATEGORY_ALIASES = {
  'điện thoại': ['phone', 'smartphone', 'mobile', 'dt', 'dtdd'],
  'tablet': ['máy tính bảng', 'tab', 'pad', 'mtb', 'ipad'],
  'laptop': ['máy tính xách tay', 'lap', 'notebook', 'macbook'],
};

class ChatbotService {
  constructor() {
    this._brandsCache = null;
    this._categoriesCache = null;
    this._cacheExpiry = 0;
  }

  // Load brands và categories từ DB, cache 5 phút
  // Tự động nhận tất cả thương hiệu/danh mục mới khi chúng được thêm vào DB
  async _ensureCatalogCache() {
    if (this._brandsCache && Date.now() < this._cacheExpiry) return;
    const [brands, categories] = await Promise.all([
      Brand.findAll({ attributes: ['name'], raw: true }),
      Category.findAll({ attributes: ['name'], raw: true }),
    ]);
    this._brandsCache = brands.map(b => b.name.toLowerCase());
    this._categoriesCache = categories.map(c => c.name);
    this._cacheExpiry = Date.now() + 5 * 60 * 1000;
  }
  /**
   * Phân tích ý định của người dùng từ tin nhắn
   */
  async analyzeIntent(message) {
    await this._ensureCatalogCache();
    const lowerMessage = message.toLowerCase();

    // Ý định tìm kiếm sản phẩm
    if (
      this.matchesPatterns(lowerMessage, [
        'tìm',
        'kiếm',
        'search',
        'mua',
        'cần',
        'muốn',
        'có',
        'bán',
        'shop',
        'store',
        'sản phẩm',
      ])
    ) {
      return {
        type: 'product_search',
        confidence: 0.8,
        params: this.extractSearchParams(message),
      };
    }

    // Ý định yêu cầu gợi ý sản phẩm
    if (
      this.matchesPatterns(lowerMessage, [
        'gợi ý',
        'đề xuất',
        'recommend',
        'tư vấn',
        'nên mua',
        'phù hợp',
        'hot',
        'trend',
        'bán chạy',
        'mới',
      ])
    ) {
      return {
        type: 'product_recommendation',
        confidence: 0.9,
        params: { type: 'general' },
      };
    }

    // Ý định hỏi về giá/khuyến mãi
    if (
      this.matchesPatterns(lowerMessage, [
        'giá',
        'bao nhiêu',
        'cost',
        'price',
        'tiền',
        'rẻ',
        'đắt',
        'sale',
        'giảm giá',
        'khuyến mãi',
      ])
    ) {
      return {
        type: 'sales_pitch',
        confidence: 0.9,
        params: { focus: 'pricing' },
      };
    }

    // Ý định hỏi về đơn hàng
    if (
      this.matchesPatterns(lowerMessage, [
        'đơn hàng',
        'order',
        'mua hàng',
        'thanh toán',
        'ship',
        'giao hàng',
        'delivery',
      ])
    ) {
      return {
        type: 'order_inquiry',
        confidence: 0.7,
        params: {},
      };
    }

    // Ý định yêu cầu hỗ trợ
    if (
      this.matchesPatterns(lowerMessage, [
        'hỗ trợ',
        'help',
        'support',
        'lỗi',
        'problem',
        'đổi trả',
        'return',
        'refund',
        'bảo hành',
      ])
    ) {
      return {
        type: 'support',
        confidence: 0.8,
        params: {},
      };
    }

    return {
      type: 'general',
      confidence: 0.5,
      params: {},
    };
  }

  /**
   * Trích xuất tham số tìm kiếm từ ngôn ngữ tự nhiên
   */
  extractSearchParams(message) {
    const lowerMessage = message.toLowerCase();
    const params = {};

    // Trích xuất danh mục — tên từ DB (cache) + alias tĩnh
    // Thêm thương hiệu/danh mục vào DB là đủ; chỉ cần cập nhật CATEGORY_ALIASES khi thêm loại hàng hoàn toàn mới
    const categories = this._categoriesCache || [];
    for (const catName of categories) {
      const key = catName.toLowerCase();
      if (lowerMessage.includes(key)) { params.category = catName; break; }
      const aliases = CATEGORY_ALIASES[key] || [];
      if (aliases.some(alias => lowerMessage.includes(alias))) { params.category = catName; break; }
    }

    // Chỉ match số kèm đơn vị tiền tệ — tránh "iphone 14" bị extract "14" thành giá
    const pricePattern = /(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|triệu|tr|đồng|vnd|vnđ|000)\b/gi;
    const priceMatches = lowerMessage.match(pricePattern);
    if (priceMatches) {
      const prices = priceMatches.map((p) => {
        const num = parseFloat(p.replace(/[.,]/g, ''));
        if (/triệu|tr/i.test(p)) return num * 1000000;
        if (/nghìn|k/i.test(p)) return num * 1000;
        if (/000/.test(p)) return num;
        return num;
      });

      if (lowerMessage.includes('dưới') || lowerMessage.includes('under') || lowerMessage.includes('tối đa')) {
        params.maxPrice = Math.max(...prices);
      } else if (lowerMessage.includes('trên') || lowerMessage.includes('over') || lowerMessage.includes('từ')) {
        params.minPrice = Math.min(...prices);
      }
    }

    // Trích xuất màu sắc
    const colors = ['đỏ', 'xanh', 'đen', 'trắng', 'vàng', 'hồng', 'nâu', 'xám'];
    for (const color of colors) {
      if (lowerMessage.includes(color)) {
        params.color = color;
        break;
      }
    }

    // Trích xuất thương hiệu — dynamic từ DB (cache), tự nhận thương hiệu mới
    const brands = this._brandsCache || [];
    for (const brand of brands) {
      if (lowerMessage.includes(brand)) {
        params.brand = brand;
        break;
      }
    }

    // Trích xuất từ khóa tổng quát
    params.keyword = message;

    return params;
  }

  /**
   * Lấy thông tin hồ sơ người dùng để cá nhân hóa
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        include: [
          {
            model: Order,
            as: 'orders',
            include: [
              {
                model: OrderItem,
                as: 'items',
                include: [
                  {
                    model: Product,
                  },
                ],
              },
            ],
            limit: 10,
            order: [['createdAt', 'DESC']],
          },
        ],
      });

      if (!user) return null;

      // Tính toán sở thích của người dùng
      const purchaseHistory = [];
      const categoryPreferences = {};
      const priceRange = { min: Infinity, max: 0 };

      user.orders?.forEach((order) => {
        order.items?.forEach((item) => {
          if (item.Product) {
            purchaseHistory.push(item.Product);

            // Theo dõi sở thích danh mục
            item.Product.categories?.forEach((cat) => {
              categoryPreferences[cat.name] =
                (categoryPreferences[cat.name] || 0) + 1;
            });

            // Theo dõi khoảng giá — dùng basePrice (product.price không tồn tại)
            if (item.Product.basePrice < priceRange.min)
              priceRange.min = item.Product.basePrice;
            if (item.Product.basePrice > priceRange.max)
              priceRange.max = item.Product.basePrice;
          }
        });
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        purchaseHistory,
        categoryPreferences,
        priceRange: priceRange.min === Infinity ? null : priceRange,
        orderCount: user.orders?.length || 0,
        isVip: (user.orders?.length || 0) >= 5,
      };
    } catch (error) {
      logger.error('Lỗi lấy hồ sơ người dùng:', error);
      return null;
    }
  }

  /**
   * Lấy danh sách gợi ý sản phẩm được cá nhân hóa
   */
  async getPersonalizedRecommendations(userId, params = {}) {
    try {
      const { type = 'personal', limit = 5 } = params;
      let products = [];

      if (type === 'personal' && userId) {
        // Lấy hồ sơ người dùng để cá nhân hóa
        const userProfile = await this.getUserProfile(userId);

        if (userProfile?.categoryPreferences) {
          // Lấy sản phẩm từ các danh mục yêu thích của người dùng
          const preferredCategories = Object.keys(
            userProfile.categoryPreferences
          );

          products = await Product.findAll({
            where: {
              status: 'active',
              stockQuantity: { [Op.gt]: 0 },
            },
            include: [
              {
                model: Category,
                as: 'categories',
                where: {
                  name: { [Op.in]: preferredCategories },
                },
                through: { attributes: [] },
              },
            ],
            limit: limit * 2, // Lấy nhiều hơn để lọc sau
            order: [['createdAt', 'DESC']],
          });

          // Loại bỏ các sản phẩm người dùng đã mua
          const purchasedProductIds = userProfile.purchaseHistory.map(
            (p) => p.id
          );
          products = products.filter(
            (p) => !purchasedProductIds.includes(p.id)
          );
        }
      }

      // Dự phòng: lấy sản phẩm nổi bật/trending
      if (products.length < limit) {
        const fallbackProducts = await Product.findAll({
          where: {
            status: 'active',
            stockQuantity: { [Op.gt]: 0 },
            [Op.or]: [
              { isFeatured: true },
              { compareAtPrice: { [Op.gt]: 0 } }, // Sản phẩm đang giảm giá
            ],
          },
          limit: limit - products.length,
          order: [
            ['isFeatured', 'DESC'],
            ['createdAt', 'DESC'],
          ],
        });

        products = [...products, ...fallbackProducts];
      }

      // Định dạng sản phẩm để trả về cho frontend
      return products.slice(0, limit).map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        thumbnail: product.thumbnail,
        inStock: product.stockQuantity > 0,
        rating: null,
        discount: product.compareAtPrice
          ? Math.round(
              ((product.compareAtPrice - product.basePrice) /
                product.compareAtPrice) *
                100
            )
          : 0,
      }));
    } catch (error) {
      logger.error('Lỗi lấy gợi ý sản phẩm:', error);
      return [];
    }
  }

  /**
   * Tạo nội dung tư vấn bán hàng
   */
  async generateSalesPitch({
    userProfile,
    message,
    bestDeals,
    trendingProducts,
    context,
  }) {
    try {
      const templates = this.getSalesPitchTemplates();
      const pitchType = this.selectPitchType(userProfile, message, context);

      let pitch = templates[pitchType];
      let products = [];

      switch (pitchType) {
        case 'urgency':
          products = bestDeals.slice(0, 3);
          pitch = pitch.replace('{discount}', products[0]?.discount || '50%');
          break;

        case 'personal':
          products = await this.getPersonalizedRecommendations(
            userProfile?.id,
            { limit: 3 }
          );
          pitch = pitch.replace('{name}', userProfile?.name || 'bạn');
          break;

        case 'social_proof':
          products = trendingProducts.slice(0, 3);
          break;

        case 'value':
          products = bestDeals.slice(0, 3);
          const totalSavings = products.reduce(
            (sum, p) => sum + (p.compareAtPrice - p.basePrice),
            0
          );
          pitch = pitch.replace('{savings}', this.formatPrice(totalSavings));
          break;

        default:
          products = [
            ...bestDeals.slice(0, 2),
            ...trendingProducts.slice(0, 1),
          ];
      }

      return {
        text: pitch,
        products,
        type: pitchType,
      };
    } catch (error) {
      logger.error('Lỗi tạo nội dung tư vấn bán hàng:', error);
      return {
        text: '🌟 Chúng tôi có nhiều sản phẩm tuyệt vời đang được khuyến mãi! Bạn có muốn xem không?',
        products: bestDeals.slice(0, 3),
        type: 'fallback',
      };
    }
  }

  /**
   * Tìm cơ hội bán hàng trong hội thoại thông thường
   */
  async findSalesOpportunity(message, userProfile) {
    const lowerMessage = message.toLowerCase();

    // Các từ khóa cho thấy cơ hội bán hàng tiềm năng
    const salesKeywords = [
      'chán',
      'buồn',
      'stress',
      'mệt',
      'cuối tuần',
      'weekend',
      'rảnh',
      'shopping',
      'mua sắm',
      'tiền',
      'sinh nhật',
      'party',
      'date',
      'work',
      'công việc',
      'interview',
    ];

    const opportunity = salesKeywords.find((keyword) =>
      lowerMessage.includes(keyword)
    );

    if (opportunity) {
      return {
        found: true,
        intent: {
          type: 'sales_pitch',
          confidence: 0.7,
          params: { trigger: opportunity },
        },
      };
    }

    return { found: false };
  }

  /**
   * Theo dõi hội thoại phục vụ phân tích
   */
  async trackConversation(data) {
    try {
      // Trong triển khai thực tế, dữ liệu này sẽ được lưu vào bảng theo dõi hội thoại
      logger.debug('Tracking conversation', {
        userId: data.userId,
        intent: data.intent,
        products: data.products?.length || 0,
        timestamp: data.timestamp,
        // Không log message — có thể chứa thông tin cá nhân
      });

      // Có thể lưu vào model ChatbotConversation
    } catch (error) {
      logger.error('Lỗi theo dõi hội thoại chatbot:', error);
    }
  }

  /**
   * Theo dõi sự kiện analytics
   */
  async trackAnalytics(data) {
    try {
      // Trong triển khai thực tế, dữ liệu này sẽ được lưu vào bảng analytics
      logger.debug('Tracking analytics', { eventType: data?.eventType, userId: data?.userId });

      // Có thể lưu vào model ChatbotAnalytics
    } catch (error) {
      logger.error('Lỗi theo dõi analytics chatbot:', error);
    }
  }

  // Các phương thức hỗ trợ
  matchesPatterns(text, patterns) {
    return patterns.some((pattern) => text.includes(pattern));
  }

  getSalesPitchTemplates() {
    return {
      urgency:
        '⏰ CẢNH BÁO: Chỉ còn vài giờ để nhận ưu đãi {discount}! Đừng bỏ lỡ cơ hội này nhé! 🔥',
      personal:
        'Chào {name}! 😊 Dựa trên sở thích của bạn, tôi có một vài sản phẩm tuyệt vời muốn giới thiệu!',
      social_proof:
        '🌟 Những sản phẩm này đang được rất nhiều khách hàng yêu thích và mua! Bạn cũng thử xem nhé!',
      value:
        '💎 Cơ hội tuyệt vời! Bạn có thể tiết kiệm tới {savings} với các deal hôm nay!',
      scarcity:
        '⚡ Chỉ còn số lượng có hạn! Nhiều khách hàng đang quan tâm đến những sản phẩm này!',
      seasonal:
        '🎉 Ưu đãi đặc biệt mùa này! Đây là thời điểm tốt nhất để shopping đấy!',
    };
  }

  selectPitchType(userProfile, message, context) {
    const lowerMessage = message.toLowerCase();

    if (userProfile?.isVip) return 'personal';
    if (lowerMessage.includes('giá') || lowerMessage.includes('rẻ'))
      return 'value';
    if (lowerMessage.includes('hot') || lowerMessage.includes('trend'))
      return 'social_proof';
    if (context.timeOfDay === 'evening') return 'urgency';

    // Chọn ngẫu nhiên để đa dạng nội dung tư vấn
    const types = ['urgency', 'social_proof', 'value', 'scarcity'];
    return types[Math.floor(Math.random() * types.length)];
  }

  formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }
}

module.exports = new ChatbotService();
