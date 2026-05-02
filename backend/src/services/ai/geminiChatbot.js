const axios = require('axios');
const { Product, Category, sequelize } = require('../models');
const { Op } = require('sequelize');
const vectorStoreService = require('./vectorStore');

class GeminiChatbotService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = 'google/gemini-2.0-flash-001';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this.initializeChatbot();
  }

  initializeChatbot() {
    try {
      if (this.apiKey && this.apiKey !== 'demo-key') {
        console.info(
          `✅ OpenRouter AI khởi tạo thành công với model: ${this.model} `
        );
      } else {
        console.warn('⚠️  Không tìm thấy OpenRouter API key, sử dụng phản hồi dự phòng');
      }
    } catch (error) {
      console.error(
        '❌ Khởi tạo Chatbot thất bại:',
        error.message || error
      );
    }
  }

  /**
   * Xử lý tin nhắn chính với trí tuệ AI (Kiến trúc RAG)
   */
  async handleMessage(message, context = {}) {
    try {
      // Bước 0: VIẾT LẠI câu truy vấn (Sửa lỗi & Mở rộng)
      console.log(`📝 Câu truy vấn gốc: "${message}"`);
      const rewrittenQuery = await this.rewriteQuery(message);
      const searchMessage = rewrittenQuery || message;

      if (rewrittenQuery && rewrittenQuery.toLowerCase() !== message.toLowerCase()) {
        console.log(`✨ Câu truy vấn đã viết lại: "${rewrittenQuery}"`);
      }

      // Bước 1: TÌM KIẾM trong Vector Database (Retrieval)
      console.log(`🔍 Tìm kiếm trong Vector Store với: "${searchMessage}"`);
      let relevantProducts = [];
      try {
        const searchResults = await vectorStoreService.search(searchMessage, 10);
        relevantProducts = searchResults.map(res => ({
          ...res.metadata,
          score: res.score
        }));
      } catch (vectorError) {
        console.warn('⚠️ Tìm kiếm vector store thất bại, chuyển sang danh sách sản phẩm cơ bản:', vectorError.message);
        relevantProducts = await this.getAllProducts();
        relevantProducts = relevantProducts.slice(0, 10);
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`📦 Tìm thấy ${relevantProducts.length} sản phẩm liên quan qua RAG`);
      }

      // Bước 2: Dùng AI với CHỈ các sản phẩm liên quan (Augmentation & Generation)
      const aiResponse = await this.getAIResponse(
        searchMessage,
        relevantProducts,
        { ...context, originalMessage: message }
      );

      return aiResponse;
    } catch (error) {
      console.error('Lỗi chatbot:', error);
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Lấy phản hồi AI thông qua OpenRouter
   */
  async getAIResponse(userMessage, products, context) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      return this.getFallbackResponse(userMessage);
    }

    try {
      // Tạo prompt đầy đủ cho AI
      const prompt = this.createPrompt(userMessage, products, context);
      if (process.env.NODE_ENV !== 'production') {
        console.log('🤖 Đang gửi yêu cầu đến OpenRouter API (chế độ RAG)...');
      }

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Bạn là một nhân viên bán hàng chuyên nghiệp, thân thiện và am hiểu của cửa hàng chúng tôi.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey} `,
            'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:5173',
            'X-Title': 'Shopmini E-commerce Chatbot',
            'Content-Type': 'application/json'
          },
          timeout: 30000,
        }
      );

      const aiText = response.data.choices[0].message.content;

      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Đã nhận phản hồi từ OpenRouter API');
      }

      // Phân tích phản hồi AI để trích xuất gợi ý sản phẩm
      const parsedResponse = this.parseAIResponse(aiText, products, userMessage);

      return parsedResponse;
    } catch (error) {
      console.error('❌ Chi tiết lỗi OpenRouter API:', error.response?.data || error.message);

      // Dự phòng: dùng khớp từ khóa cục bộ nếu AI thất bại
      return this.simpleKeywordMatch(userMessage, products);
    }
  }

  /**
   * Viết lại/làm sạch câu truy vấn để xử lý lỗi chính tả và từ viết tắt
   */
  async rewriteQuery(message) {
    if (!this.apiKey || this.apiKey === 'demo-key') return message;

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `Bạn là trợ lý ảo hỗ trợ chuẩn hóa câu hỏi mua sắm tiếng Việt. 
                Nhiệm vụ: 
                1. Sửa lỗi chính tả.
                2. Mở rộng từ viết tắt (VD: "ip" -> "iPhone", "pm" -> "Pro Max", "đh" -> "đơn hàng", "giá bn" -> "giá bao nhiêu").
                3. Chuyển thành câu chuẩn, mạch lạc, dễ hiểu nhưng TUYỆT ĐỐI không thay đổi ý định của khách hàng.
                Nếu câu hỏi đã chuẩn, hãy giữ nguyên. 
                Trả về DUY NHẤT một chuỗi kết quả (câu chuẩn nhất), không giải thích thêm.`
            },
            {
              role: 'user',
              content: `Chuẩn hóa câu hỏi sau: "${message}"`
            }
          ],
          temperature: 0,
          max_tokens: 150
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey} `,
            'Content-Type': 'application/json'
          },
          timeout: 15000,
        }
      );

      let rewritten = response.data.choices[0].message.content.trim().replace(/^"|"$/g, '');
      
      // Làm sạch kết quả sau khi nhận
      if (rewritten.endsWith('.')) rewritten = rewritten.slice(0, -1);
      
      return rewritten;
    } catch (error) {
      console.error('❌ Lỗi khi viết lại câu truy vấn:', error.message);
      return message;
    }
  }

  /**
   * Phân loại ý định của người dùng một cách rõ ràng
   */
  async classifyIntent(message, context = {}) {
    if (!this.apiKey || this.apiKey === 'demo-key') return 'general';

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `Bạn là trợ lý ảo hỗ trợ phân loại ý định (intent) của khách hàng cho hệ thống thương mại điện tử.
                Hãy phân loại câu hỏi vào một trong các nhãn sau:
                - product_search: tìm kiếm sản phẩm, hỏi về cấu hình, thông số, so sánh sản phẩm.
                - pricing: hỏi về giá cả, khuyến mãi, giảm giá.
                - order_inquiry: hỏi về đơn hàng, tình trạng giao hàng, cách mua hàng, thanh toán.
                - policy: hỏi về chính sách bảo hành, đổi trả, vận chuyển.
                - support: cần hỗ trợ kỹ thuật, khiếu nại, gặp nhân viên.
                - general: chào hỏi, cảm ơn, khen ngợi, hoặc các câu hỏi xã giao khác.
                - off_topic: các câu hỏi không liên quan đến cửa hàng hoặc mua sắm.

                Trả về DUY NHẤT nhãn intent, không giải thích thêm.`
            },
            {
              role: 'user',
              content: `Phân loại ý định của câu sau: "${message}"`
            }
          ],
          temperature: 0,
          max_tokens: 20
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey} `,
            'Content-Type': 'application/json'
          },
          timeout: 15000,
        }
      );

      const intent = response.data.choices[0].message.content.trim().toLowerCase().replace(/[^\w]/g, '');
      return intent || 'general';
    } catch (error) {
      console.error('❌ Lỗi khi phân loại ý định:', error.message);
      return 'general';
    }
  }

  /**
   * Tạo prompt đầy đủ cho AI
   */
  createPrompt(userMessage, products, context) {
    const productList = products
      .map(
        (p) =>
          `- ${p.name} (${p.category || 'Sản phẩm'}): ${p.shortDescription || 'Mô tả đang cập nhật'} - Giá: ${p.price?.toLocaleString('vi-VN')} đ - Còn lại: ${p.stockQuantity !== undefined ? p.stockQuantity : (p.inStock ? 'Còn hàng' : 'Hết hàng')}`
      )
      .join('\n');

    return `
Nhiệm vụ của bạn là hỗ trợ khách hàng tìm kiếm sản phẩm, giải đáp thắc mắc và tư vấn bán hàng dựa trên dữ liệu thực tế.

KHẢ NĂNG CỦA BẠN:
1. Tra cứu và gợi ý sản phẩm chính xác từ danh sách được cung cấp.
2. Tư vấn sản phẩm phù hợp với nhu cầu của khách hàng.
3. Giải đáp thắc mắc về giá cả, tình trạng hàng hóa.
4. Trò chuyện tự nhiên, lịch sự như một nhân viên thực thụ.
5. Xử lý các câu hỏi ngoài lề một cách khéo léo, vui vẻ đưa câu chuyện về sản phẩm của cửa hàng.

DANH SÁCH SẢN PHẨM HIỆN CÓ(Dữ liệu thực tế):
${productList}

THÔNG TIN CỬA HÀNG:
- Chính sách: Đổi trả và bảo hành theo quy định của từng sản phẩm.
- Giao hàng: Hỗ trợ giao hàng toàn quốc.
- Hỗ trợ: Luôn sẵn sàng hỗ trợ khách hàng.

TIN NHẮN KHÁCH HÀNG: "${userMessage}"
CONTEXT: ${JSON.stringify(context)}

HƯỚNG DẪN TRẢ LỜI CỰC KỲ QUAN TRỌNG (BẮT BUỘC):
1. TRẢ LỜI BẰNG TIẾNG VIỆT.
2. QUY TẮC SO KHỚP Tên (Cực kỳ quan trọng):
   - Bản "Thường" (không hậu tố), "Pro", "Pro Max", "Plus" là các sản phẩm KHÁC NHAU HOÀN TOÀN.
   - Các đời (13, 14, 15) là các thế hệ KHÁC NHAU HOÀN TOÀN.
3. QUY TRÌNH KIỂM TRA & PHẢN HỒI:
   - Bước 1: Kiểm tra xem sản phẩm khách hỏi có tên KHỚP 100% (cả đời máy và hậu tố) với sản phẩm nào trong "DANH SÁCH SẢN PHẨM HIỆN CÓ" hay không.
   - Bước 2: 
     + Nếu KHỚP 100%: Tư vấn trực tiếp sản phẩm đó.
     + Nếu KHÔNG KHỚP 100%: Bạn PHẢI bắt đầu bằng cụm từ: "Tiếc quá, hiện tại bên mình chưa có [Tên sản phẩm khách hỏi] ạ".
     + Bước 3: Sau khi báo không có, hãy gợi ý các bản khác cùng đời (nếu có) hoặc đời mới hơn (nếu có).
4. VÍ DỤ MẪU (BẮT BUỘC HỌC THEO):
   - Khách: "có ip14 không?" | List chỉ có "iPhone 14 Pro" -> Trả lời: "Tiếc quá, bên mình hiện chưa có iPhone 14 bản thường ạ. Nhưng mình đang có sẵn iPhone 14 Pro với cấu hình mạnh hơn, bạn có muốn tham khảo không?"
   - Khách: "ai phôn 14 pro max" | List chỉ có "iPhone 15 Pro Max" -> Trả lời: "Dạ hiện tại bên mình đã hết hàng iPhone 14 Pro Max rồi ạ. Tuy nhiên mình đang có sẵn iPhone 15 Pro Max (đời mới nhất) cực kỳ hot, mình tư vấn cho bạn nhé?"
   - Khách: "ip15" | List có "15 Pro", "15 Pro Max" -> Trả lời: "Dạ bên mình hiện chưa có iPhone 15 bản thường, nhưng đang có sẵn bản 15 Pro và 15 Pro Max nè, bạn quan tâm bản nào ạ?"
5. KHÔNG TỰ BỊA: Tuyệt đối không tự ý bịa giá hoặc tên.
6. PHONG CÁCH: Thân thiện (mình/em - bạn/anh/chị).

Hãy trả lời THEO ĐÚNG ĐỊNH DẠNG JSON SAU:
{
  "response": "Câu trả lời đúng quy trình trên (dùng emoji phù hợp)",
  "matchedProducts": ["Tên chính xác mẫu sản phẩm trong danh sách (VD: 'iPhone 14 Pro')"],
  "suggestions": ["Gợi ý câu tiếp theo"],
  "intent": "product_search|pricing|policy|support|complaint|general|off_topic"
}
`;
  }

  /**
   * Phân tích phản hồi AI và khớp với sản phẩm thực tế
   */
  parseAIResponse(aiText, products, userMessage) {
    try {
      // Thử phân tích JSON trong phản hồi từ AI
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Tìm đối tượng sản phẩm thực tế dựa trên gợi ý của AI
        const matchedProducts = [];
        if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
          parsed.matchedProducts.forEach((productName) => {
            // Khớp chặt chẽ: tên sản phẩm phải rất giống hoặc bằng với tên được gợi ý
            const product = products.find((p) => {
              const pName = p.name.toLowerCase();
              const rName = productName.toLowerCase();

              // Khớp chính xác hoặc gần đúng
              if (pName === rName) return true;

              // Khớp từ khóa phiên bản chặt chẽ (Pro, Max, Plus, v.v.)
              const versionKeywords = ['pro', 'max', 'plus', 'ultra', 'mini', 'se', 'ti', 'super'];
              const rVersions = versionKeywords.filter(v => rName.includes(v));
              const pVersions = versionKeywords.filter(v => pName.includes(v));

              // Phải có cùng số lượng và giống nhau về từ khóa phiên bản
              if (rVersions.length !== pVersions.length || !rVersions.every(v => pVersions.includes(v))) {
                return false;
              }

              // Kiểm tra số phiên bản chính (ví dụ: 13, 14, 15)
              const numbersP = pName.match(/\d+/g);
              const numbersR = rName.match(/\d+/g);

              if (numbersP && numbersR) {
                // Nếu số thế hệ khác nhau thì là sản phẩm thuộc thế hệ khác
                if (numbersP[0] !== numbersR[0]) return false;
              }

              return pName.includes(rName) || rName.includes(pName);
            });

            if (product) {
              matchedProducts.push({
                id: product.id,
                name: product.name,
                price: product.price,
                compareAtPrice: product.compareAtPrice,
                thumbnail: product.thumbnail,
                inStock: product.inStock !== undefined ? product.inStock : true,
                stockQuantity: product.stockQuantity,
                rating: 4.5,
              });
            }
          });
        }

        return {
          response:
            parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
          products: matchedProducts,
          suggestions: parsed.suggestions || [
            'Xem tất cả sản phẩm',
            'Sản phẩm khuyến mãi',
            'Hỗ trợ mua hàng',
            'Liên hệ tư vấn',
          ],
          intent: parsed.intent || 'general',
        };
      }
    } catch (error) {
      console.error('Không thể phân tích phản hồi AI:', error.message || error);
    }

    // Dự phòng: dùng khớp từ khóa đơn giản
    return this.simpleKeywordMatch(userMessage, products);
  }

  /**
   * Khớp từ khóa đơn giản (dùng khi AI không khả dụng)
   */
  simpleKeywordMatch(userMessage, products) {
    const lowerMessage = userMessage.toLowerCase().trim();
    let matchedProducts = [];

    // Trích xuất từ khóa tìm kiếm từ tin nhắn người dùng
    const searchTerms = lowerMessage
      .split(' ')
      .filter((term) => term.length > 2); // Loại bỏ từ quá ngắn
    searchTerms.push(lowerMessage);

    // Duyệt qua danh sách sản phẩm để tìm kiếm
    products.forEach((product) => {
      let matchScore = 0;
      const productName = product.name?.toLowerCase() || '';
      const productDesc = product.shortDescription?.toLowerCase() || '';

      // Khớp trực tiếp
      searchTerms.forEach((term) => {
        if (productName.includes(term)) {
          matchScore += 10;
        }
        if (productDesc.includes(term)) {
          matchScore += 5;
        }
      });

      if (matchScore > 0) {
        matchedProducts.push({ ...product, matchScore });
      }
    });

    // Sắp xếp theo điểm khớp
    matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

    // Loại bỏ trùng lặp
    const uniqueProducts = matchedProducts.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p.id === product.id)
    );

    if (uniqueProducts.length > 0) {
      const topProducts = uniqueProducts.slice(0, 5);
      const productList = topProducts
        .map((p) => `• ${p.name} - ${p.price?.toLocaleString('vi-VN')} đ`)
        .join('\n');

      return {
        response: `🔍 Mình tìm thấy một số sản phẩm phù hợp với yêu cầu của bạn nè: \n\n${productList} \n\nBạn muốn xem kỹ hơn sản phẩm nào không ? `,
        products: topProducts.slice(0, 3).map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          rating: 4.5,
        })),
        suggestions: [
          'Xem chi tiết',
          'Sản phẩm khác',
          'Tư vấn thêm',
        ],
        intent: 'product_search',
      };
    }

    // Kiểm tra ý định "sản phẩm mới"
    if (
      lowerMessage.includes('sản phẩm mới') ||
      lowerMessage.includes('hàng mới') ||
      lowerMessage.includes('mới nhất') ||
      lowerMessage.includes('new')
    ) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Đã nhận diện ý định "sản phẩm mới"');
      }

      const newProducts = products.slice(0, 5); // Giả định sản phẩm đã được sắp xếp theo createdAt DESC

      const productList = newProducts
        .map((p) => `• ${p.name} - ${p.price?.toLocaleString('vi-VN')} đ`)
        .join('\n');

      return {
        response: `🌟 Đây là những sản phẩm mới nhất vừa cập bến cửa hàng mình nè: \n\n${productList} \n\nBạn ưng ý mẫu nào không ? `,
        products: newProducts.slice(0, 3).map((product) => ({
          id: product.id,
          name: product.name,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          thumbnail: product.thumbnail,
          inStock: product.inStock,
          rating: 4.5,
        })),
        suggestions: [
          'Xem chi tiết',
          'Sản phẩm khuyến mãi',
          'Tư vấn thêm',
        ],
        intent: 'product_search',
      };
    }

    return this.getFallbackResponse(userMessage);
  }

  /**
   * Lấy tất cả sản phẩm từ database (dùng khi cần dự phòng)
   */
  async getAllProducts() {
    try {
      const products = await Product.findAll({
        where: {
          status: 'active',
          inStock: true,
        },
        include: [
          {
            model: Category,
            attributes: ['name'],
            as: 'categories', // Alias phải khớp với định nghĩa trong model
          },
        ],
        attributes: [
          'id',
          'name',
          'shortDescription',
          'description',
          'price',
          'compareAtPrice',
          'thumbnail',
          'inStock',
          'searchKeywords',
          'createdAt',
        ],
        limit: 100,
        order: [['createdAt', 'DESC']],
      });

      return products.map((p) => p.toJSON());
    } catch (error) {
      console.error('Lỗi khi lấy danh sách sản phẩm:', error);
      return [];
    }
  }

  /**
   * Phản hồi dự phòng cho các tình huống khác nhau
   */
  getFallbackResponse(userMessage) {
    return {
      response:
        'Chào bạn! Mình là nhân viên hỗ trợ của cửa hàng. Mình có thể giúp gì cho bạn hôm nay? Bạn đang tìm kiếm sản phẩm nào hay cần tư vấn gì không nè? 😊',
      suggestions: [
        'Xem sản phẩm mới',
        'Sản phẩm khuyến mãi',
        'Hỗ trợ mua hàng',
        'Tư vấn sản phẩm',
      ],
      intent: 'general',
    };
  }
}

module.exports = new GeminiChatbotService();
