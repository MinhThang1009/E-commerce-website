const axios = require('axios');
const { Product, Category, Brand, sequelize } = require('../../models');
const { Op } = require('sequelize');
const vectorStoreService = require('./vectorStore');

class GeminiChatbotService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = 'google/gemini-2.0-flash-001';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
    this._brandsCache = null;
    this._categoriesCache = null;
    this._catalogCacheExpiry = 0;
    this.initializeChatbot();
  }

  // Load brands và categories từ DB, cache 5 phút
  async _ensureCatalogCache() {
    if (this._brandsCache && Date.now() < this._catalogCacheExpiry) return;
    const [brands, categories] = await Promise.all([
      Brand.findAll({ attributes: ['name'], raw: true }),
      Category.findAll({ attributes: ['name'], raw: true }),
    ]);
    this._brandsCache = brands.map(b => b.name);
    this._categoriesCache = categories.map(c => c.name);
    this._catalogCacheExpiry = Date.now() + 5 * 60 * 1000;
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
      await this._ensureCatalogCache();
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
              content: 'Bạn là nhân viên tư vấn của TechStore — cửa hàng công nghệ chuyên điện thoại, máy tính bảng và laptop. Bạn am hiểu sâu về thông số kỹ thuật, chip, RAM, màn hình, pin của các thiết bị. Tư vấn trung thực dựa trên nhu cầu thực tế. Chỉ giới thiệu sản phẩm có trong danh sách được cung cấp, không bịa thêm.'
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
            'X-Title': 'TechStore Chatbot',
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
                2. Mở rộng từ viết tắt phổ biến trong ngành công nghệ Việt Nam:
                   - Điện thoại: "ip" -> "iPhone", "pm" -> "Pro Max", "ip17" -> "iPhone 17", "ss" -> "Samsung", "xl" -> "Xiaomi", "rm" -> "Redmi", "op" -> "OPPO", "rl" -> "realme"
                   - Máy tính bảng: "mtb" -> "máy tính bảng", "tab" -> "máy tính bảng", "pad" -> "máy tính bảng"
                   - Laptop: "lap" -> "laptop", "mb" -> "MacBook", "mac" -> "MacBook", "vivo" -> "Asus Vivobook", "del" -> "Dell Inspiron", "len" -> "Lenovo IdeaPad"
                   - Cấu hình: "i5/i7/i3" -> giữ nguyên, "r5/r7" -> "AMD Ryzen 5/7", "rtx" -> giữ nguyên, "ssd" -> "ổ cứng SSD"
                   - Chung: "đh" -> "đơn hàng", "giá bn" -> "giá bao nhiêu", "sp" -> "sản phẩm", "bh" -> "bảo hành"
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

THÔNG TIN CỬA HÀNG (TechStore):
- Danh mục: ${(this._categoriesCache || []).join(', ')} — Thương hiệu: ${(this._brandsCache || []).join(', ')}
- Bảo hành: 12 tháng chính hãng, hỗ trợ bảo hành tại trung tâm
- Giao hàng: Miễn phí toàn quốc, giao nhanh nội thành
- Đổi trả: 30 ngày nếu lỗi từ nhà sản xuất
- Hỗ trợ kỹ thuật: Tư vấn cấu hình, so sánh sản phẩm, hỗ trợ sau mua hàng

TIN NHẮN KHÁCH HÀNG: "${userMessage}"
CONTEXT: ${JSON.stringify(context)}

HƯỚNG DẪN TRẢ LỜI CỰC KỲ QUAN TRỌNG (BẮT BUỘC):
1. TRẢ LỜI BẰNG TIẾNG VIỆT.
2. QUY TẮC SO KHỚP SẢN PHẨM (áp dụng cho mọi danh mục):
   A. ĐIỆN THOẠI: Thương hiệu + Dòng sản phẩm + Hậu tố phiên bản là 3 yếu tố phân biệt.
      - Bản thường, Pro, Pro Max, Plus, Ultra, e, Lite là các sản phẩm KHÁC NHAU HOÀN TOÀN.
      - Số thế hệ/đời (13, 14, 15, 16, 17…) là các thế hệ KHÁC NHAU HOÀN TOÀN.
      - Cùng tên dòng nhưng khác đuôi (VD: A37 vs A57) → KHÁC NHAU.
   B. MÁY TÍNH BẢNG: Thương hiệu + Model + Loại kết nối là 3 yếu tố phân biệt.
      - WiFi, 4G, 5G cùng model → KHÁC NHAU (giá và tính năng kết nối khác).
      - Bản thường vs Pro cùng dòng → KHÁC NHAU.
   C. LAPTOP: Thương hiệu + Tên model + Cấu hình chip là 3 yếu tố phân biệt.
      - Cùng tên model nhưng khác chip (i3/i5/i7, R5/R7, Ultra 5/Ultra 7, M3/M4/M5) → KHÁC NHAU.
      - Laptop gaming (có card đồ họa rời RTX/RX) khác laptop văn phòng (đồ họa tích hợp).
   → Quy tắc này áp dụng cho bất kỳ danh mục sản phẩm nào trong danh sách, kể cả khi có danh mục mới.
3. QUY TRÌNH KIỂM TRA & PHẢN HỒI:
   - Bước 1: Xác định nhóm sản phẩm (điện thoại / tablet / laptop).
   - Bước 2: Kiểm tra xem sản phẩm khách hỏi có KHỚP với sản phẩm trong "DANH SÁCH SẢN PHẨM HIỆN CÓ" hay không.
   - Bước 3:
     + Nếu KHỚP: Tư vấn trực tiếp sản phẩm đó (nêu điểm nổi bật, giá, tình trạng hàng).
     + Nếu KHÔNG KHỚP: Bắt đầu bằng "Tiếc quá, hiện tại bên mình chưa có [tên sản phẩm] ạ", sau đó gợi ý sản phẩm gần nhất cùng thương hiệu hoặc cùng tầm giá.
     + Nếu khách hỏi chung chung (VD: "laptop tầm 15 triệu"): Gợi ý 2-3 sản phẩm phù hợp từ danh sách với lý do rõ ràng.
4. VÍ DỤ MẪU (BẮT BUỘC HỌC THEO):
   ĐIỆN THOẠI:
   - "ip17" | List có "iPhone 17", "iPhone 17 Pro", "iPhone 17 Pro Max", "iPhone 17e" -> "Bên mình đang có đủ dòng iPhone 17 nè: iPhone 17 thường, 17e, 17 Pro và 17 Pro Max. Bạn đang cân nhắc bản nào ạ?"
   - "ss a57" | List chỉ có "Samsung Galaxy A57" -> Tư vấn trực tiếp Samsung Galaxy A57.
   - "oppo find x7" | List chỉ có "OPPO Find X8 Pro" -> "Tiếc quá, bên mình chưa có Find X7 ạ. Nhưng mình đang có OPPO Find X8 Pro — đời mới nhất, cấu hình vượt trội hơn, bạn muốn xem không?"
   MÁY TÍNH BẢNG:
   - "ipad wifi" | List có "iPad A16 WiFi" và "iPad A16 5G" -> Tư vấn iPad A16 WiFi, hỏi thêm có cần dùng SIM 5G không để gợi ý thêm bản 5G.
   - "samsung tab s11" | List có 3 bản S11 -> "Dòng Samsung Galaxy Tab S11 bên mình có 3 bản: WiFi, 5G và Ultra 5G. Bạn ưu tiên dùng ở nhà hay mang đi nhiều ạ?"
   LAPTOP:
   - "macbook" | List có 3 MacBook -> "TechStore đang có 3 mẫu MacBook: Air 13 inch M4, Air 15 inch M4 và Pro 14 inch M5. Bạn cần dùng cho công việc gì để mình tư vấn phù hợp ạ?"
   - "laptop gaming tầm 20 triệu" | List có Acer Gaming Nitro V -> Gợi ý Acer Gaming Nitro V (có RTX), nêu cấu hình và giá.
   - "dell i5" | List có 2 Dell i5 (3520 và 3530) -> "Dell Inspiron i5 bên mình có 2 mẫu: Inspiron 15 3520 và 3530, khác nhau ở chip thế hệ. Bạn cần dùng cho văn phòng hay học tập ạ?"
5. KHÔNG TỰ BỊA: Tuyệt đối không bịa tên, giá, cấu hình hay thông tin sản phẩm ngoài danh sách.
6. PHONG CÁCH: Thân thiện, chuyên nghiệp (mình/em - bạn/anh/chị). Khi tư vấn laptop/tablet nên hỏi thêm nhu cầu sử dụng để gợi ý chính xác.

Hãy trả lời THEO ĐÚNG ĐỊNH DẠNG JSON SAU:
{
  "response": "Câu trả lời đúng quy trình trên (dùng emoji phù hợp)",
  "matchedProducts": ["Tên chính xác sản phẩm trong danh sách (VD: 'Điện thoại iPhone 17 Pro')"],
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
