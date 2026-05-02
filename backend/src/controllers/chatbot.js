const {
  Product,
  Category,
  Order,
  OrderItem,
  User,
  Cart,
  CartItem,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const chatbotService = require('../services/ai/chatbot');
const geminiChatbotService = require('../services/ai/geminiChatbot');


class ChatbotController {
  /**
   * Xử lý tin nhắn từ người dùng với AI
   */
  async handleMessage(req, res) {
    try {
      const { message, userId, sessionId, context = {} } = req.body;
      logger.info('Nhận tin nhắn chatbot:', { message, userId, sessionId });

      if (!message?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Tin nhắn không được để trống',
        });
      }

      // Sử dụng Gemini AI để tạo phản hồi thông minh
      const response = await geminiChatbotService.handleMessage(message, {
        userId,
        sessionId,
        ...context,
      });

      res.json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      logger.error('Lỗi chatbot:', error);
      logger.error('Stack lỗi:', error.stack);
      res.status(500).json({
        status: 'error',
        message: 'Xử lý tin nhắn thất bại',
        data: {
          response:
            'Xin lỗi, tôi đang gặp một chút vấn đề. Vui lòng thử lại sau ít phút nhé! 😅',
          suggestions: ['Xem sản phẩm hot', 'Tìm khuyến mãi', 'Liên hệ hỗ trợ'],
        },
      });
    }
  }

  /**
   * Xử lý yêu cầu tìm kiếm sản phẩm
   */
  async handleProductSearch(message, intent, userProfile, context) {
    try {
      // Trích xuất tham số tìm kiếm từ ngôn ngữ tự nhiên
      const searchParams = chatbotService.extractSearchParams(message);

      // Lấy sản phẩm từ database
      const products = await this.searchProducts(searchParams);

      // Tạo phản hồi AI
      const aiResponse = await this.generateAIResponse(
        `Tìm sản phẩm: ${message}`,
        { products, userProfile, searchParams }
      );

      // Tạo danh sách gợi ý sản phẩm
      const productCards = products.slice(0, 5).map((product) => ({
        id: product.id,
        name: product.name,
        price: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        thumbnail: product.thumbnail,
        inStock: product.inStock,
        rating: product.rating || 4.5,
        discount: product.compareAtPrice
          ? Math.round(
              ((product.compareAtPrice - product.basePrice) /
                product.compareAtPrice) *
                100
            )
          : 0,
      }));

      return {
        response: aiResponse,
        products: productCards,
        suggestions: [
          'Xem thêm sản phẩm tương tự',
          'So sánh giá',
          'Xem khuyến mãi',
          'Thêm vào giỏ hàng',
        ],
        actions:
          products.length > 0
            ? [
                {
                  type: 'view_products',
                  label: `Xem tất cả ${products.length} sản phẩm`,
                  url: `/products?search=${encodeURIComponent(message)}`,
                },
              ]
            : [],
      };
    } catch (error) {
      logger.error('Lỗi tìm kiếm sản phẩm:', error);
      throw error;
    }
  }

  /**
   * Xử lý yêu cầu gợi ý sản phẩm
   */
  async handleProductRecommendation(message, intent, userProfile, context) {
    try {
      const recommendations =
        await chatbotService.getPersonalizedRecommendations(
          userProfile?.id,
          intent.params
        );

      const aiResponse = await this.generateAIResponse(
        `Gợi ý sản phẩm: ${message}`,
        { recommendations, userProfile }
      );

      return {
        response: aiResponse,
        products: recommendations,
        suggestions: [
          'Xem chi tiết sản phẩm',
          'So sánh các sản phẩm',
          'Tìm sản phẩm tương tự',
          'Thêm vào giỏ hàng',
        ],
      };
    } catch (error) {
      logger.error('Lỗi gợi ý sản phẩm:', error);
      throw error;
    }
  }

  /**
   * Xử lý kịch bản tư vấn bán hàng
   */
  async handleSalesPitch(message, intent, userProfile, context) {
    try {
      // Lấy các ưu đãi tốt nhất và sản phẩm đang xu hướng
      const bestDeals = await this.getBestDeals();
      const trendingProducts = await this.getTrendingProducts();

      // Cá nhân hóa nội dung tư vấn dựa trên hồ sơ người dùng
      const personalizedPitch = await chatbotService.generateSalesPitch({
        userProfile,
        message,
        bestDeals,
        trendingProducts,
        context,
      });

      return {
        response: personalizedPitch.text,
        products: personalizedPitch.products,
        suggestions: [
          '💳 Mua ngay - Ưu đãi có hạn!',
          '🛒 Thêm vào giỏ hàng',
          '💝 Xem thêm khuyến mãi',
          '📱 Liên hệ tư vấn',
        ],
        actions: [
          {
            type: 'urgent_deals',
            label: '🔥 Ưu đai sắp hết hạn - Mua ngay!',
            url: '/deals',
          },
          {
            type: 'bestsellers',
            label: '⭐ Sản phẩm bán chạy nhất',
            url: '/bestsellers',
          },
        ],
      };
    } catch (error) {
      logger.error('Lỗi xử lý tư vấn bán hàng:', error);
      throw error;
    }
  }

  /**
   * Xử lý yêu cầu tra cứu đơn hàng
   */
  async handleOrderInquiry(message, intent, userProfile, context) {
    try {
      const aiResponse = await this.generateAIResponse(
        `Hỗ trợ đơn hàng: ${message}`,
        { userProfile }
      );

      return {
        response: aiResponse,
        suggestions: [
          'Kiểm tra trạng thái đơn hàng',
          'Thông tin giao hàng',
          'Hủy đơn hàng',
          'Liên hệ hỗ trợ',
        ],
      };
    } catch (error) {
      logger.error('Lỗi tra cứu đơn hàng:', error);
      throw error;
    }
  }

  /**
   * Xử lý yêu cầu hỗ trợ khách hàng
   */
  async handleSupport(message, intent, userProfile, context) {
    try {
      const aiResponse = await this.generateAIResponse(
        `Hỗ trợ khách hàng: ${message}`,
        { userProfile }
      );

      return {
        response: aiResponse,
        suggestions: [
          'Chính sách đổi trả',
          'Hướng dẫn mua hàng',
          'Thông tin bảo hành',
          'Liên hệ hotline',
        ],
      };
    } catch (error) {
      logger.error('Lỗi hỗ trợ khách hàng:', error);
      throw error;
    }
  }

  /**
   * Xử lý hội thoại chung
   */
  async handleGeneral(message, intent, userProfile, context) {
    try {
      // Luôn cố gắng dẫn dắt cuộc trò chuyện hướng đến bán hàng
      const salesOpportunity = await chatbotService.findSalesOpportunity(
        message,
        userProfile
      );

      let response;
      if (salesOpportunity.found) {
        response = await this.handleSalesPitch(
          message,
          salesOpportunity.intent,
          userProfile,
          context
        );
      } else {
        const aiResponse = await this.generateAIResponse(message, {
          userProfile,
        });
        response = {
          response: aiResponse,
          suggestions: [
            'Tìm sản phẩm hot 🔥',
            'Xem khuyến mãi 🎉',
            'Sản phẩm bán chạy ⭐',
            'Hỗ trợ mua hàng 💬',
          ],
        };
      }

      return response;
    } catch (error) {
      logger.error('Lỗi xử lý hội thoại chung:', error);
      throw error;
    }
  }

  /**
   * Tìm kiếm sản phẩm bằng AI
   */
  async aiProductSearch(req, res) {
    try {
      const { query, userId, limit = 10 } = req.body;

      if (!query?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Từ khóa tìm kiếm không được để trống',
        });
      }

      const searchParams = chatbotService.extractSearchParams(query);
      const products = await this.searchProducts({ ...searchParams, limit });

      res.json({
        status: 'success',
        data: {
          query,
          results: products,
          total: products.length,
        },
      });
    } catch (error) {
      logger.error('Lỗi tìm kiếm sản phẩm bằng AI:', error);
      res.status(500).json({
        status: 'error',
        message: 'Tìm kiếm thất bại',
      });
    }
  }

  /**
   * Lấy danh sách gợi ý sản phẩm cá nhân hóa
   */
  async getRecommendations(req, res) {
    try {
      const { userId, limit = 5, type = 'personal' } = req.query;

      const recommendations =
        await chatbotService.getPersonalizedRecommendations(userId, {
          type,
          limit: parseInt(limit),
        });

      res.json({
        status: 'success',
        data: {
          recommendations,
          type,
        },
      });
    } catch (error) {
      logger.error('Lỗi lấy gợi ý sản phẩm:', error);
      res.status(500).json({
        status: 'error',
        message: 'Lấy gợi ý sản phẩm thất bại',
      });
    }
  }

  /**
   * Ghi nhận dữ liệu phân tích chatbot
   */
  async trackAnalytics(req, res) {
    try {
      const { event, userId, sessionId, productId, value, metadata } = req.body;

      await chatbotService.trackAnalytics({
        event,
        userId,
        sessionId,
        productId,
        value,
        metadata,
        timestamp: new Date(),
      });

      res.json({
        status: 'success',
        message: 'Ghi nhận dữ liệu phân tích thành công',
      });
    } catch (error) {
      logger.error('Lỗi ghi nhận dữ liệu phân tích:', error);
      res.status(500).json({
        status: 'error',
        message: 'Ghi nhận dữ liệu phân tích thất bại',
      });
    }
  }

  /**
   * Thêm sản phẩm vào giỏ hàng qua chatbot
   */
  async addToCart(req, res) {
    try {
      const { productId, variantId, quantity = 1, sessionId } = req.body;
      const userId = req.user.id;

      // Lấy hoặc tạo mới giỏ hàng
      let cart = await Cart.findOne({ where: { userId } });
      if (!cart) {
        cart = await Cart.create({ userId });
      }

      // Thêm sản phẩm vào giỏ hàng
      const cartItem = await CartItem.create({
        cartId: cart.id,
        productId,
        variantId,
        quantity,
      });

      // Ghi nhận sự kiện phân tích
      await chatbotService.trackAnalytics({
        event: 'product_added_to_cart',
        userId,
        sessionId,
        productId,
        metadata: { quantity, source: 'chatbot' },
        timestamp: new Date(),
      });

      res.json({
        status: 'success',
        message: 'Thêm sản phẩm vào giỏ hàng thành công',
        data: { cartItem },
      });
    } catch (error) {
      logger.error('Lỗi thêm sản phẩm vào giỏ hàng:', error);
      res.status(500).json({
        status: 'error',
        message: 'Thêm sản phẩm vào giỏ hàng thất bại',
      });
    }
  }

  // Các phương thức hỗ trợ
  async searchProducts(searchParams) {
    const where = {
      status: 'active',
      inStock: true,
    };

    // Thêm điều kiện tìm kiếm
    if (searchParams.keyword) {
      // Bảng ánh xạ từ khóa tiếng Việt sang tiếng Anh
      const keywordMapping = {
        giày: ['shoes', 'shoe', 'sneaker', 'nike', 'adidas'],
        'giày thể thao': [
          'shoes',
          'sneaker',
          'running shoes',
          'nike',
          'adidas',
        ],
        'thể thao': ['sport', 'sports', 'running', 'nike', 'adidas'],
        áo: ['shirt', 'tshirt', 't-shirt'],
        'áo thun': ['tshirt', 't-shirt', 'shirt'],
        quần: ['pants', 'jeans', 'trousers'],
        túi: ['bag', 'backpack'],
        balo: ['backpack', 'bag'],
        'phụ kiện': ['accessories', 'accessory'],
        'đồng hồ': ['watch', 'watches'],
        kính: ['glasses', 'sunglasses'],
        mũ: ['hat', 'cap'],
      };

      const originalKeyword = searchParams.keyword.toLowerCase();
      let searchTerms = [originalKeyword];

      // Bổ sung các từ khóa tiếng Anh tương ứng nếu tìm thấy từ khóa tiếng Việt
      Object.keys(keywordMapping).forEach((viKeyword) => {
        if (originalKeyword.includes(viKeyword)) {
          searchTerms = [...searchTerms, ...keywordMapping[viKeyword]];
        }
      });

      // Tạo điều kiện tìm kiếm cho tất cả các từ khóa
      const searchConditions = [];
      searchTerms.forEach((term) => {
        searchConditions.push(
          { name: { [Op.like]: `%${term}%` } },
          { description: { [Op.like]: `%${term}%` } }
        );
      });

      where[Op.or] = searchConditions;
    }

    if (searchParams.minPrice) {
      where.basePrice = { [Op.gte]: searchParams.minPrice };
    }
    if (searchParams.maxPrice) {
      where.basePrice = { ...where.basePrice, [Op.lte]: searchParams.maxPrice };
    }

    if (searchParams.category) {
      // Thêm logic lọc theo danh mục
    }

    const products = await Product.findAll({
      where,
      include: [
        {
          model: Category,
          as: 'categories',
          through: { attributes: [] },
        },
      ],
      limit: searchParams.limit || 20,
      order: [['createdAt', 'DESC']],
    });

    return products;
  }

  async getBestDeals() {
    return await Product.findAll({
      where: {
        status: 'active',
        inStock: true,
        compareAtPrice: { [Op.gt]: 0 },
      },
      order: [
        [
          // Sắp xếp theo phần trăm giảm giá
          sequelize.literal(
            '((compare_at_price - base_price) / compare_at_price) DESC'
          ),
        ],
      ],
      limit: 10,
    });
  }

  async getTrendingProducts() {
    // Có thể dựa trên tần suất đặt hàng, lượt xem, v.v.
    return await Product.findAll({
      where: {
        status: 'active',
        inStock: true,
        featured: true,
      },
      limit: 10,
      order: [['createdAt', 'DESC']],
    });
  }

  async generateAIResponse(prompt, context = {}) {
    try {
      // Sử dụng service đã được tái cấu trúc, hiện dùng OpenRouter
      const products = context.products || [];
      const aiResponse = await geminiChatbotService.getAIResponse(prompt, products, context);

      // Nếu kết quả trả về là object (từ parseAIResponse của service),
      // chỉ lấy phần text cho phương thức hỗ trợ này
      return typeof aiResponse === 'object' ? aiResponse.response : aiResponse;
    } catch (error) {
      logger.error('Lỗi tạo phản hồi AI:', error.message || error);
      return this.getTemplateResponse(prompt, context);
    }
  }

  getTemplateResponse(prompt, context) {
    const templates = [
      'Tôi hiểu bạn đang tìm kiếm sản phẩm phù hợp! 😊 Để giúp bạn tốt nhất, hãy cho tôi biết thêm chi tiết về sở thích của bạn nhé.',
      'Chào bạn! 👋 Shopmini có rất nhiều sản phẩm tuyệt vời. Bạn quan tâm đến loại sản phẩm nào nhất?',
      'Cảm ơn bạn đã quan tâm! 🌟 Tôi sẽ giúp bạn tìm những sản phẩm tốt nhất với giá ưu đãi.',
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Xử lý tin nhắn đơn giản (dùng để kiểm thử)
   */
  async handleSimpleMessage(req, res) {
    try {
      const { message, userId, sessionId, context = {} } = req.body;
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Nhận tin nhắn đơn giản:', { message, userId, sessionId });
      }

      if (!message?.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'Tin nhắn không được để trống',
        });
      }

      // Phản hồi đơn giản
      const response = {
        response: `Chào bạn! Bạn vừa nói: "${message}". Tôi là trợ lý AI của Shopmini! 😊`,
        suggestions: [
          'Tìm sản phẩm hot 🔥',
          'Xem khuyến mãi 🎉',
          'Sản phẩm bán chạy ⭐',
          'Hỗ trợ mua hàng 💬',
        ],
      };

      res.json({
        status: 'success',
        data: response,
      });
    } catch (error) {
      logger.error('Lỗi xử lý tin nhắn đơn giản:', error.message || error);
      res.status(500).json({
        status: 'error',
        message: 'Xử lý tin nhắn đơn giản thất bại',
      });
    }
  }
}

module.exports = ChatbotController;
