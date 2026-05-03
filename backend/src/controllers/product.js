const {
  Product,
  Category,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  Review,
  RecentlyViewed,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { getRedisClient } = require('../config/redis');

const CACHE_TTL_PRODUCT_LIST = 10 * 60;   // 10 phút
const CACHE_TTL_PRODUCT_DETAIL = 10 * 60; // 10 phút

// Xóa toàn bộ cache sản phẩm (list + detail theo id số và slug)
// productSlug cần thiết vì getProductById cache bằng cả id số lẫn slug
async function clearProductCache(productId, productSlug) {
  try {
    const redis = await getRedisClient();
    const listKeys = await redis.keys('products:list:*');
    const ops = listKeys.map(k => redis.del(k));
    if (productId) ops.push(redis.del(`product:detail:${productId}`));
    if (productSlug) ops.push(redis.del(`product:detail:${productSlug}`));
    await Promise.all(ops);
  } catch {}
}

// Lấy danh sách sản phẩm có phân trang
const getAllProducts = async (req, res, next) => {
  try {
    const redis = await getRedisClient();
    const listCacheKey = `products:list:${req.url}`;
    const cachedList = await redis.get(listCacheKey);
    if (cachedList) {
      return res.status(200).json(JSON.parse(cachedList));
    }

    const {
      page = 1,
      sort = 'createdAt',
      order = 'DESC',
      category,
      search,
      minPrice,
      maxPrice,
      inStock,
      featured,
      status,
      brand,
      collection,
    } = req.query;
    // Mặc định 20 sản phẩm/trang, tối đa 100 để tránh trả toàn bộ data
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Xây dựng điều kiện lọc
    const whereConditions = {};
    const includeConditions = [];

    // Lọc theo từ khóa tìm kiếm
    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { shortDescription: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
      ];
    }

    // Lọc theo khoảng giá
    if (minPrice) {
      whereConditions.basePrice = {
        ...whereConditions.basePrice,
        [Op.gte]: parseFloat(minPrice),
      };
    }

    if (maxPrice) {
      whereConditions.basePrice = {
        ...whereConditions.basePrice,
        [Op.lte]: parseFloat(maxPrice),
      };
    }

    // Lọc sản phẩm nổi bật
    if (featured !== undefined) {
      whereConditions.isFeatured = featured === 'true';
    }

    // Lọc theo trạng thái
    if (status !== undefined) {
      whereConditions.status = status;
    }

    // Lọc theo danh mục
    if (category) {
      const isNumericId = !isNaN(category) && String(category).trim() !== '';

      if (isNumericId) {
        // Lọc qua column categoryId trực tiếp (tương thích schema data_new.sql)
        whereConditions.categoryId = category;
      } else {
        // Tìm bằng slug
        const { Category } = require('../models');
        const cat = await Category.findOne({ where: { slug: category } });
        if (cat) {
          whereConditions.categoryId = cat.id;
        } else {
          whereConditions.id = -1;
        }
      }
    }
    
    // Luôn include cả 2 dạng quan hệ category để build mảng categories cho frontend
    includeConditions.push({
      association: 'category',
      required: false,
    });
    includeConditions.push({
      association: 'categories',
      through: { attributes: [] },
      required: false,
    });

    // Lọc theo thương hiệu
    if (brand) {
      const brands = Array.isArray(brand) ? brand : [brand];
      const brandIds = brands.filter(b => !isNaN(b) && String(b).trim() !== '');
      const brandSlugs = brands.filter(b => isNaN(b) || String(b).trim() === '');

      if (brandIds.length > 0) {
        whereConditions.brandId = { [Op.in]: brandIds };
      }

      if (brandSlugs.length > 0) {
        includeConditions.push({
          association: 'brand',
          where: { slug: { [Op.in]: brandSlugs } },
          required: true,
        });
      }
    } else {
      includeConditions.push({
        association: 'brand',
        required: false,
      });
    }

    // Lọc theo bộ sưu tập
    if (collection) {
      const collections = Array.isArray(collection) ? collection : [collection];
      const collectionIds = collections.filter(c => !isNaN(c) && String(c).trim() !== '');
      const collectionSlugs = collections.filter(c => isNaN(c) || String(c).trim() === '');

      if (collectionIds.length > 0) {
        // Giả định quan hệ nhiều-nhiều qua association 'collections'
        includeConditions.push({
          association: 'collections',
          where: { id: { [Op.in]: collectionIds } },
          required: true,
        });
      } else if (collectionSlugs.length > 0) {
        includeConditions.push({
          association: 'collections',
          where: { slug: { [Op.in]: collectionSlugs } },
          required: true,
        });
      }
    }

    // Include thuộc tính sản phẩm (không dùng để lọc)
    includeConditions.push({
      association: 'productAttributes',
      required: false,
    });

    // Include biến thể để tính khoảng giá
    includeConditions.push({
      association: 'variants',
      required: false,
    });
    includeConditions.push({
      association: 'productImages',
      required: false,
    });

    // Chỉ include verified reviews để tính rating — tránh spam/fake review làm lệch điểm
    includeConditions.push({
      association: 'reviews',
      required: false,
      where: { isVerified: true },
    });

    // Xử lý sort: price_asc/price_desc map sang basePrice column
    let orderClause;
    if (sort === 'price_asc') {
      orderClause = [['basePrice', 'ASC']];
    } else if (sort === 'price_desc') {
      orderClause = [['basePrice', 'DESC']];
    } else {
      orderClause = [[sort, order]];
    }

    // Truy vấn danh sách sản phẩm
    const { count, rows: productsRaw } = await Product.findAndCountAll({
      where: whereConditions,
      include: includeConditions,
      distinct: true,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: orderClause,
    });

    // Xử lý kết quả, thêm thông tin đánh giá
    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();
      productJson.price = productJson.basePrice;

      // Map category → categories nếu cần
      if (!productJson.categories) productJson.categories = [];
      if (productJson.category && !productJson.categories.some(c => c.id === productJson.category.id)) {
        productJson.categories.push(productJson.category);
      }

      // Map productImages → images cho frontend tương thích
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isThumbnail: img.isThumbnail,
          displayOrder: img.displayOrder,
          variantId: img.variantId,
          color: img.color,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }

      // Tính điểm đánh giá trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1)
        );
        ratings.count = productJson.reviews.length;
      }

      // Dùng giá biến thể nếu có, ngược lại dùng giá sản phẩm
      let displayPrice = parseFloat(productJson.basePrice) || 0;
      let compareAtPrice = parseFloat(productJson.compareAtPrice) || null;

      if (productJson.variants && productJson.variants.length > 0) {
        // Sắp xếp biến thể theo giá tăng dần để lấy giá thấp nhất
        const sortedVariants = productJson.variants.sort(
          (a, b) => parseFloat(a.price) - parseFloat(b.price)
        );
        displayPrice = parseFloat(sortedVariants[0].price) || displayPrice;
      }

      // Thêm ratings vào response, bỏ chi tiết reviews
      delete productJson.reviews;

      return {
        ...productJson,
        price: displayPrice,
        compareAtPrice,
        ratings,
      };
    });

    const listPayload = {
      status: 'success',
      data: products,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    };
    await redis.setEx(listCacheKey, CACHE_TTL_PRODUCT_LIST, JSON.stringify(listPayload));
    res.status(200).json(listPayload);
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm theo ID
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { skuId } = req.query;

    // Cache chỉ cho request không có variant params (phổ biến nhất)
    const isBaseRequest = !skuId && !req.query.color && !req.query['Màu sắc'];
    const detailCacheKey = isBaseRequest ? `product:detail:${id}` : null;

    if (detailCacheKey) {
      const redis = await getRedisClient();
      const cachedDetail = await redis.get(detailCacheKey);
      if (cachedDetail) {
        // Parse một lần duy nhất — dùng lại cho cả recently-viewed và response
        const cachedData = JSON.parse(cachedDetail);
        if (req.user) {
          // Lấy productId từ cache payload thay vì parseInt(id) — id có thể là slug
          const cachedProductId = cachedData?.data?.id;
          if (cachedProductId) {
            // fire-and-forget: ghi lịch sử xem không ảnh hưởng response, lỗi bỏ qua
            RecentlyViewed.upsert({ userId: req.user.id, productId: cachedProductId, viewedAt: new Date() }).catch(() => {});
          }
        }
        return res.status(200).json(cachedData);
      }
    }

    let product = await Product.findByPk(id, {
      include: [
        {
          association: 'category',
        },
        {
          association: 'productAttributes',
          order: [['sortOrder', 'ASC'], ['id', 'ASC']],
        },
        {
          association: 'variants',
          required: false,
          order: [['id', 'ASC']],
        },
        {
          association: 'productImages',
          required: false,
        },
        {
          association: 'productSpecifications',
        },
        {
          association: 'reviews',
          include: [
            {
              association: 'user',
              attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
          ],
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          required: false,
        },
      ],
    });

    // Tìm theo slug nếu không tìm thấy theo ID
    if (!product) {
      product = await Product.findOne({
        where: { slug: id },
        include: [
          {
            association: 'category',
          },
          {
            association: 'productAttributes',
            order: [['sortOrder', 'ASC'], ['id', 'ASC']],
          },
          {
            association: 'variants',
            required: false,
            order: [['id', 'ASC']],
          },
          {
            association: 'productImages',
            required: false,
          },
          {
            association: 'productSpecifications',
          },
          {
            association: 'reviews',
            include: [
              {
                association: 'user',
                attributes: ['id', 'firstName', 'lastName', 'avatar'],
              },
            ],
          },
          {
            association: 'warrantyPackages',
            through: {
              attributes: ['isDefault'],
              as: 'productWarranty',
            },
            required: false,
          },
        ],
      });
    }

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Xử lý sản phẩm, thêm tính toán đánh giá
    const productJson = product.toJSON();
    // Map productImages â†’ images cho frontend tÆ°Æ¡ng thÃ­ch
    if (productJson.productImages && productJson.productImages.length > 0) {
      productJson.images = productJson.productImages.map(img => ({
        id: img.id,
        url: img.imageUrl,
        alt: img.altText,
        isThumbnail: img.isThumbnail,
        displayOrder: img.displayOrder,
        variantId: img.variantId,
        color: img.color,
      }));
      const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
      productJson.thumbnail = primaryImg.imageUrl;
    } else {
      productJson.images = [];
      productJson.thumbnail = null;
    }

    // Tính điểm đánh giá trung bình — chỉ đếm verified reviews để tránh spam
    const ratings = {
      average: 0,
      count: 0,
      totalCount: productJson.reviews ? productJson.reviews.length : 0,
    };

    if (productJson.reviews && productJson.reviews.length > 0) {
      const verifiedReviews = productJson.reviews.filter(r => r.isVerified);
      if (verifiedReviews.length > 0) {
        const totalRating = verifiedReviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        ratings.average = parseFloat(
          (totalRating / verifiedReviews.length).toFixed(1)
        );
        ratings.count = verifiedReviews.length;
      }
    }

    // Xử lý sản phẩm có biến thể
    let responseData = {
      ...productJson,
      ratings,
    };

    if (
      productJson.variants && productJson.variants.length > 0 &&
      productJson.variants &&
      productJson.variants.length > 0
    ) {
      // Tìm biến thể được chọn
      let selectedVariant = null;
      const queryColor = (req.query.color || req.query['Màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();

      if (skuId) {
        selectedVariant = productJson.variants.find((v) => String(v.id) === String(skuId));
      }
      
      // Nếu không có skuId nhưng có query color, tìm variant đầu tiên khớp màu để lấy thông tin hiển thị
      if (!selectedVariant && queryColor) {
        selectedVariant = productJson.variants.find((v) => {
          const vAttrs = v.attributes || {};
          const vColor = (vAttrs.color || vAttrs['Màu sắc'] || vAttrs['màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();
          return vColor === queryColor;
        });
      }

      if (!selectedVariant) {
        selectedVariant = productJson.variants.find((v) => v.isDefault === true || v.isDefault === 1 || v.is_default === true || v.is_default === 1) || productJson.variants[0];
      }

      if (selectedVariant) {
        const attrs = selectedVariant.attributes || {};
        let variantColor = (attrs.color || attrs['Màu sắc'] || attrs['màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();
        
        // Nếu đang lọc theo color query, ưu tiên dùng color đó
        if (!skuId && queryColor) {
           variantColor = queryColor;
        }

        logger.info(`>>> [HTTP] getProductById: id=${id}, skuId=${skuId}, queryColor=${queryColor}, effectiveColor=${variantColor}`);

        // Lấy list ảnh
        let variantImages = (productJson.images || []);
        
        // 1. Nếu có selectedVariant cụ thể (từ skuId), ưu tiên lọc theo variantId
        if (skuId && selectedVariant) {
          const variantMatchedImages = variantImages.filter((img) => img.variantId === selectedVariant.id);
          if (variantMatchedImages.length > 0) {
            variantImages = variantMatchedImages;
          } else if (variantColor) {
            variantImages = variantImages.filter(img =>
              img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor
            );
          }
        } else if (variantColor) {
          // 2. Nếu không có skuId hoặc lọc theo color, dùng màu sắc để lọc ảnh
          const colorMatchedImages = variantImages.filter(img =>
            img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor
          );
          if (colorMatchedImages.length > 0) {
            variantImages = colorMatchedImages;
          }
        }

        const variantName = selectedVariant.variantName || selectedVariant.displayName;
        const mainName = productJson.name;
        const modelName = productJson.model || mainName.replace(/^(Laptop|Điện thoại|Máy tính bảng|Đồng hồ|Tai nghe|Loa|Phụ kiện)\s+/i, '');
        
        const fullName = (variantName.toLowerCase().includes(mainName.toLowerCase()) || variantName.toLowerCase().includes(modelName.toLowerCase()))
          ? variantName 
          : `${mainName} - ${variantName}`;

        responseData = {
          ...productJson,
          ratings,
          isVariantProduct: true,
          name: fullName,
          price: selectedVariant.price || productJson.basePrice,
          compareAtPrice: selectedVariant.compareAtPrice || productJson.compareAtPrice,
          stockQuantity: selectedVariant.stockQuantity,
          sku: selectedVariant.sku,
          images: variantImages.length > 0 ? variantImages : productJson.images,
          thumbnail: variantImages.length > 0 ? variantImages[0].url : productJson.thumbnail,
          currentVariant: {
            ...selectedVariant,
            ...attrs,
            name: variantName,
            fullName: fullName,
            images: variantImages.length > 0 ? variantImages : productJson.images,
            thumbnail: variantImages.length > 0 ? variantImages[0].url : productJson.thumbnail,
            price: selectedVariant.price || productJson.basePrice,
            compareAtPrice: selectedVariant.compareAtPrice || productJson.compareAtPrice,
          },
          availableVariants: productJson.variants.map((v) => ({
            ...v,
            name: v.variantName || v.displayName,
            price: v.price || productJson.basePrice,
            compareAtPrice: v.compareAtPrice || productJson.compareAtPrice,
          })),
          specifications: {
            ...productJson.specifications,
            ...selectedVariant.attributes,
          },
        };
      }
    }

    // Ghi nhận lịch sử xem sản phẩm nếu user đã đăng nhập
    if (req.user) {
      try {
        await RecentlyViewed.upsert({
          userId: req.user.id,
          productId: product.id,
          viewedAt: new Date(),
        });
      } catch (err) {
        logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      }
    }

    const detailPayload = { status: 'success', data: responseData };
    if (detailCacheKey) {
      const redis = await getRedisClient();
      await redis.setEx(detailCacheKey, CACHE_TTL_PRODUCT_DETAIL, JSON.stringify(detailPayload));
    }

    return res.status(200).json(detailPayload);
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm theo slug
const getProductBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { skuId } = req.query;
    logger.info(`>>> [HTTP] getProductBySlug: slug=${slug}, skuId=${skuId}`);
    logger.info(`>>> [HTTP] getProductBySlug: slug=${slug}, skuId=${skuId}`);

    const product = await Product.findOne({
      where: { slug },
      include: [
        { association: 'category' },
        { association: 'reviews', include: [{ association: 'user' }] },
        { association: 'productImages' },
        { association: 'variants', order: [['id', 'ASC']] },
      ],
    });

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    const productJson = product.toJSON();
    if (productJson.productImages && productJson.productImages.length > 0) {
      productJson.images = productJson.productImages.map(img => ({
        id: img.id,
        url: img.imageUrl,
        alt: img.altText,
        isThumbnail: img.isThumbnail,
        displayOrder: img.displayOrder,
        variantId: img.variantId,
        color: img.color,
      }));
      const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
      productJson.thumbnail = primaryImg.imageUrl;
    } else {
      productJson.images = [];
      productJson.thumbnail = null;
    }

    const ratings = { average: 0, count: 0 };
    if (productJson.reviews && productJson.reviews.length > 0) {
      const totalRating = productJson.reviews.reduce((sum, review) => sum + review.rating, 0);
      ratings.average = parseFloat((totalRating / productJson.reviews.length).toFixed(1));
      ratings.count = productJson.reviews.length;
    }

    let responseData = {
      ...productJson,
      ratings,
      price: productJson.basePrice,
      compareAtPrice: productJson.compareAtPrice,
    };

    if (productJson.variants && productJson.variants.length > 0) {
      // Tìm biến thể được chọn
      let selectedVariant = null;
      const queryColor = (req.query.color || req.query['Màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();

      if (skuId) {
        selectedVariant = productJson.variants.find((v) => String(v.id) === String(skuId));
      }
      
      // Nếu không có skuId nhưng có query color, tìm variant đầu tiên khớp màu để lấy thông tin hiển thị
      if (!selectedVariant && queryColor) {
        selectedVariant = productJson.variants.find((v) => {
          const vAttrs = v.attributes || {};
          const vColor = (vAttrs.color || vAttrs['Màu sắc'] || vAttrs['màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();
          return vColor === queryColor;
        });
      }

      if (!selectedVariant) {
        selectedVariant = productJson.variants.find((v) => v.isDefault === true || v.isDefault === 1 || v.is_default === true || v.is_default === 1) || productJson.variants[0];
      }

      if (selectedVariant) {
        const attrs = selectedVariant.attributes || {};
        let variantColor = (attrs.color || attrs['Màu sắc'] || attrs['màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();
        
        // Nếu đang lọc theo color query, ưu tiên dùng color đó
        if (!skuId && queryColor) {
           variantColor = queryColor;
        }

        logger.info(`>>> [HTTP] getProductBySlug: slug=${slug}, skuId=${skuId}, queryColor=${queryColor}, effectiveColor=${variantColor}`);

        // Lấy list ảnh
        let variantImages = (productJson.images || []);
        
        if (skuId && selectedVariant) {
          const variantMatchedImages = variantImages.filter((img) => img.variantId === selectedVariant.id);
          if (variantMatchedImages.length > 0) {
            variantImages = variantMatchedImages;
          } else if (variantColor) {
            variantImages = variantImages.filter(img =>
              img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor
            );
          }
        } else if (variantColor) {
          const colorMatchedImages = variantImages.filter(img =>
            img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor
          );
          if (colorMatchedImages.length > 0) {
            variantImages = colorMatchedImages;
          }
        }

        logger.info(`[Filter Result] Total: ${productJson.images.length} -> Filtered: ${variantImages.length}`);

        const variantName = selectedVariant.variantName || selectedVariant.displayName;
        const mainName = productJson.name;
        const modelName = productJson.model || mainName.replace(/^(Laptop|Điện thoại|Máy tính bảng|Đồng hồ|Tai nghe|Loa|Phụ kiện)\s+/i, '');
        
        const fullName = (variantName.toLowerCase().includes(mainName.toLowerCase()) || variantName.toLowerCase().includes(modelName.toLowerCase()))
          ? variantName 
          : `${mainName} - ${variantName}`;

        responseData = {
          ...productJson,
          ratings,
          isVariantProduct: true,
          name: fullName,
          price: selectedVariant.price || productJson.basePrice,
          compareAtPrice: selectedVariant.compareAtPrice || productJson.compareAtPrice,
          stockQuantity: selectedVariant.stockQuantity,
          sku: selectedVariant.sku,
          images: variantImages.length > 0 ? variantImages : productJson.images,
          thumbnail: variantImages.length > 0 ? variantImages[0].url : productJson.thumbnail,
          currentVariant: {
            ...selectedVariant,
            ...attrs,
            name: variantName,
            fullName: fullName,
            images: variantImages.length > 0 ? variantImages : productJson.images,
            thumbnail: variantImages.length > 0 ? variantImages[0].url : productJson.thumbnail,
            price: selectedVariant.price || productJson.basePrice,
            compareAtPrice: selectedVariant.compareAtPrice || productJson.compareAtPrice,
          },
          availableVariants: productJson.variants.map((v) => ({
            ...v,
            name: v.variantName || v.displayName,
            price: v.price || productJson.basePrice,
            compareAtPrice: v.compareAtPrice || productJson.compareAtPrice,
          })),
          specifications: {
            ...productJson.specifications,
            ...selectedVariant.attributes,
          },
        };
      }
    }

    // Ghi nhận lịch sử xem sản phẩm nếu user đã đăng nhập
    if (req.user) {
      try {
        await RecentlyViewed.upsert({
          userId: req.user.id,
          productId: product.id,
          viewedAt: new Date(),
        });
      } catch (err) {
        logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      }
    }

    return res.status(200).json({
      status: 'success',
      data: responseData,
    });
  } catch (error) {
    next(error);
  }
};

// Tạo sản phẩm mới
const createProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      name,
      baseName,
      description,
      shortDescription,
      price,
      compareAtPrice,
      images,
      thumbnail,
      categoryIds,
      inStock,
      stockQuantity,
      isFeatured: featured,
      tags,
      seoTitle,
      seoDescription,
      seoKeywords,
      specifications,
      parentAttributes,
      attributes,
      variants,
      warrantyPackageIds,
    } = req.body;

    // Kiểm tra xem có phải sản phẩm có biến thể không
    const isVariantProduct = variants && variants.length > 0;

    // Tạo sản phẩm mới
    const product = await Product.create(
      {
        name,
        baseName: baseName || name,
        description,
        shortDescription,
        basePrice: isVariantProduct ? 0 : price, // Đặt về 0 nếu sản phẩm có biến thể
        compareAtPrice: isVariantProduct ? null : compareAtPrice,
        images: images || [],
        thumbnail,
        // inStock đã bỏ - quản lý qua variants (luôn là true với sản phẩm có biến thể)
        stockQuantity: isVariantProduct ? 0 : stockQuantity, // Đặt về 0 nếu sản phẩm có biến thể
        isFeatured: featured,
        tags: tags || [],
        seoTitle,
        seoDescription,
        seoKeywords: seoKeywords || [],
        isVariantProduct,
        specifications: specifications || {},
      },
      { transaction }
    );

    // Liên kết danh mục
    if (categoryIds && categoryIds.length > 0) {
      const categories = await Category.findAll({
        where: { id: { [Op.in]: categoryIds } },
      });

      if (categories.length !== categoryIds.length) {
        throw new AppError('Một hoặc nhiều danh mục không tồn tại', 400);
      }

      await product.setCategories(categories, { transaction });
    }

    // Thêm thông số kỹ thuật
    if (specifications && specifications.length > 0) {
      const productSpecifications = specifications.map((spec, index) => ({
        productId: product.id,
        name: spec.name,
        value: spec.value,
        category: spec.category || 'General',
        sortOrder: index,
      }));

      await ProductSpecification.bulkCreate(productSpecifications, {
        transaction,
      });
    }

    // Thêm thuộc tính gốc
    if (parentAttributes && parentAttributes.length > 0) {
      const productParentAttributes = parentAttributes.map((attr, index) => ({
        productId: product.id,
        name: attr.name,
        type: attr.type,
        values: attr.values,
        required: attr.required,
        sortOrder: index,
      }));

      await ProductAttribute.bulkCreate(productParentAttributes, {
        transaction,
      });
    }

    // Thêm thuộc tính cũ (tương thích ngược)
    if (attributes && attributes.length > 0) {
      const productAttributes = attributes.map((attr) => ({
        ...attr,
        productId: product.id,
      }));

      await ProductAttribute.bulkCreate(productAttributes, { transaction });
    }

    // Thêm biến thể sản phẩm
    if (variants && variants.length > 0) {
      const productVariants = variants.map((variant, index) => ({
        productId: product.id,
        sku: variant.sku || `${product.id}-VAR-${index + 1}`,
        name: variant.name || variant.variantName || variant.displayName,
        price: parseFloat(variant.price) || 0,
        compareAtPrice: variant.compareAtPrice
          ? parseFloat(variant.compareAtPrice)
          : null,
        stockQuantity: parseInt(variant.stockQuantity || variant.stock) || 0,
        isDefault: variant.isDefault || index === 0, // Biến thể đầu tiên là mặc định
        isAvailable: variant.isAvailable !== false,
        attributes: variant.attributes || {},
        attributeValues: variant.attributeValues || {},
        specifications: variant.specifications || {},
        images: variant.images || [],
        displayName: variant.displayName || variant.name || variant.variantName,
        sortOrder: variant.sortOrder || index,
      }));

      await ProductVariant.bulkCreate(productVariants, { transaction });
    }

    // Liên kết gói bảo hành
    if (warrantyPackageIds && warrantyPackageIds.length > 0) {
      const { WarrantyPackage } = require('../models');
      const warranties = await WarrantyPackage.findAll({
        where: { id: { [Op.in]: warrantyPackageIds } },
      });

      if (warranties.length !== warrantyPackageIds.length) {
        throw new AppError('Một hoặc nhiều gói bảo hành không tồn tại', 400);
      }

      await product.setWarrantyPackages(warranties, { transaction });
    }

    await transaction.commit();

    // Lấy sản phẩm đầy đủ với các quan hệ
    const createdProduct = await Product.findByPk(product.id, {
      include: [
        {
          association: 'category',
        },
        {
          association: 'productAttributes',
        },
        {
          association: 'variants',
        },
        {
          association: 'productImages',
          required: false,
        },
        {
          association: 'productSpecifications',
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          required: false,
        },
      ],
    });

    await clearProductCache(null);

    res.status(201).json({
      status: 'success',
      data: createdProduct,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Cập nhật sản phẩm
const updateProduct = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const {
      name,
      description,
      shortDescription,
      price,
      compareAtPrice,
      images,
      thumbnail,
      categoryIds,
      inStock,
      stockQuantity,
      isFeatured: featured,
      tags,
      seoTitle,
      seoDescription,
      seoKeywords,
      attributes,
      variants,
      warrantyPackageIds,
    } = req.body;

    // Log thông tin request body
    logger.info('Cập nhật sản phẩm - request body:', {
      compareAtPrice,
      hasCompareAtPrice: req.body.hasOwnProperty('compareAtPrice'),
      // Lưu ý: comparePrice không phải field hợp lệ trong Product model
    });

    // Tìm sản phẩm
    const product = await Product.findByPk(id);
    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }
    // Lưu slug trước khi update vì slug có thể thay đổi sau khi save
    const originalSlug = product.slug;

    // Cập nhật sản phẩm - chỉ cập nhật các trường có trong request
    const updateData = {};

    // Chỉ cập nhật các trường có trong request body
    if (req.body.hasOwnProperty('name')) updateData.name = name;
    if (req.body.hasOwnProperty('description'))
      updateData.description = description;
    if (req.body.hasOwnProperty('shortDescription'))
      updateData.shortDescription = shortDescription;
    if (req.body.hasOwnProperty('price')) updateData.price = price;
    if (req.body.hasOwnProperty('compareAtPrice'))
      updateData.compareAtPrice = compareAtPrice;
    // Không cập nhật comparePrice vì field này không tồn tại trong Product model
    if (req.body.hasOwnProperty('images')) updateData.images = images;
    if (req.body.hasOwnProperty('thumbnail')) updateData.thumbnail = thumbnail;
    if (req.body.hasOwnProperty('inStock')) updateData.inStock = inStock;
    if (req.body.hasOwnProperty('stockQuantity'))
      updateData.stockQuantity = stockQuantity;
    if (req.body.hasOwnProperty('featured')) updateData.isFeatured = featured;
    if (req.body.hasOwnProperty('tags'))
      updateData.tags = tags;
    if (req.body.hasOwnProperty('seoTitle')) updateData.seoTitle = seoTitle;
    if (req.body.hasOwnProperty('seoDescription'))
      updateData.seoDescription = seoDescription;
    if (req.body.hasOwnProperty('seoKeywords'))
      updateData.seoKeywords = seoKeywords;

    // Cập nhật sản phẩm với dữ liệu mới
    await product.update(updateData, { transaction });

    // Cập nhật danh mục - chỉ khi categoryIds được gửi trong request
    if (req.body.hasOwnProperty('categoryIds') && categoryIds) {
      const categories = await Category.findAll({
        where: { id: { [Op.in]: categoryIds } },
      });

      if (categories.length !== categoryIds.length) {
        throw new AppError('Một hoặc nhiều danh mục không tồn tại', 400);
      }

      await product.setCategories(categories, { transaction });
    }

    // Cập nhật thuộc tính - chỉ khi attributes được gửi trong request
    if (req.body.hasOwnProperty('attributes')) {
      // Xóa thuộc tính cũ
      await ProductAttribute.destroy({
        where: { productId: id },
        transaction,
      });

      // Tạo thuộc tính mới
      if (attributes && attributes.length > 0) {
        const productAttributes = attributes.map((attr) => ({
          ...attr,
          productId: id,
        }));

        await ProductAttribute.bulkCreate(productAttributes, { transaction });
      }
    }

    // Cập nhật biến thể - chỉ khi variants được gửi trong request
    if (req.body.hasOwnProperty('variants')) {
      // Xóa biến thể cũ
      await ProductVariant.destroy({
        where: { productId: id },
        transaction,
      });

      // Tạo biến thể mới
      if (variants && variants.length > 0) {
        const productVariants = variants.map((variant) => ({
          ...variant,
          productId: id,
        }));

        await ProductVariant.bulkCreate(productVariants, { transaction });
      }
    }

    // Cập nhật gói bảo hành - chỉ khi warrantyPackageIds được gửi trong request
    if (req.body.hasOwnProperty('warrantyPackageIds')) {
      logger.info('Xử lý gói bảo hành:', warrantyPackageIds);

      if (warrantyPackageIds && warrantyPackageIds.length > 0) {
        // Kiểm tra gói bảo hành tồn tại
        const { WarrantyPackage } = require('../models');
        const warranties = await WarrantyPackage.findAll({
          where: { id: { [Op.in]: warrantyPackageIds } },
        });

        logger.info(
          'âœ… Found warranties:',
          warranties.map((w) => ({ id: w.id, name: w.name }))
        );
        logger.info('Tổng gói bảo hành - yêu cầu:', warrantyPackageIds.length, '| tìm thấy:', warranties.length);

        if (warranties.length !== warrantyPackageIds.length) {
          logger.info('Số lượng gói bảo hành không khớp!');
        throw new AppError('Một hoặc nhiều gói bảo hành không tồn tại', 400);
        }

        await product.setWarrantyPackages(warranties, { transaction });
        logger.info('Cập nhật gói bảo hành thành công');
      } else {
        // Xóa toàn bộ gói bảo hành nếu nhận được mảng rỗng
        logger.info('Xóa toàn bộ gói bảo hành');
        await product.setWarrantyPackages([], { transaction });
      }
    } else {
      logger.info('Không có warrantyPackageIds trong request, bỏ qua cập nhật gói bảo hành');
    }

    await transaction.commit();

    // Lấy sản phẩm đã cập nhật với các quan hệ
    const updatedProduct = await Product.findByPk(id, {
      include: [
        {
          association: 'category',
        },
        {
          association: 'productAttributes',
        },
        {
          association: 'variants',
        },
        {
          association: 'productImages',
          required: false,
        },
        {
          association: 'warrantyPackages',
          through: {
            attributes: ['isDefault'],
            as: 'productWarranty',
          },
          required: false,
        },
      ],
    });

    await clearProductCache(id, originalSlug);

    res.status(200).json({
      status: 'success',
      data: updatedProduct,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Xóa sản phẩm
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);
    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lưu slug trước khi destroy vì instance vẫn còn trong memory sau destroy
    const productSlug = product.slug;

    // Xóa sản phẩm
    await product.destroy();
    await clearProductCache(id, productSlug);

    res.status(200).json({
      status: 'success',
      message: 'Xóa sản phẩm thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách sản phẩm nổi bật
const getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const productsRaw = await Product.findAll({
      where: { isFeatured: true },
      include: [
        {
          association: 'category',
          required: false,
        },
        {
          association: 'brand',
          required: false,
        },
        {
          association: 'reviews',
          required: false,
        },
        {
          association: 'variants',
          required: false,
        },
        {
          association: 'productImages',
          required: false,
        },
      ],
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    // Xử lý kết quả, thêm thông tin đánh giá
    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();
      productJson.price = productJson.basePrice;
      // Map productImages → images cho frontend tương thích
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isThumbnail: img.isThumbnail,
          displayOrder: img.displayOrder,
          variantId: img.variantId,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }

      // Tính điểm đánh giá trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1)
        );
        ratings.count = productJson.reviews.length;
      }

      // Dùng giá biến thể nếu có, ngược lại dùng giá sản phẩm
      let displayPrice = parseFloat(productJson.basePrice) || 0;
      let compareAtPrice = parseFloat(productJson.compareAtPrice) || null;

      if (productJson.variants && productJson.variants.length > 0) {
        // Sắp xếp biến thể theo giá tăng dần để lấy giá thấp nhất
        const sortedVariants = productJson.variants.sort(
          (a, b) => parseFloat(a.price) - parseFloat(b.price)
        );
        displayPrice = parseFloat(sortedVariants[0].price) || displayPrice;
      }

      // Thêm ratings vào response, bỏ chi tiết reviews
      delete productJson.reviews;

      return {
        ...productJson,
        price: displayPrice,
        compareAtPrice,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm liên quan
const getRelatedProducts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    // Tìm sản phẩm
    const product = await Product.findByPk(id, {
      include: [
        {
          association: 'category',
        },
      ],
    });

    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lấy danh sách category ID
    const categoryIds = product.categoryId ? [product.categoryId] : [];

    let relatedProductsRaw = [];

    // Nếu sản phẩm có danh mục, tìm sản phẩm liên quan theo danh mục
    if (categoryIds.length > 0) {
      relatedProductsRaw = await Product.findAll({
        include: [
          { association: 'category' },
          { association: 'reviews' },
          { association: 'productImages' },
          { association: 'variants' },
        ],
        where: {
          id: { [Op.ne]: id }, // Loại trừ sản phẩm hiện tại
        },
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
      });
    }

    // Nếu không tìm thấy sản phẩm liên quan theo danh mục hoặc sản phẩm không có danh mục
    // Trả về các sản phẩm mới nhất hoặc sản phẩm nổi bật
    if (relatedProductsRaw.length === 0) {
      logger.info(
        `Không tìm thấy sản phẩm liên quan cho sản phẩm ${id}. Trả về sản phẩm gần đây thay thế.`
      );

      relatedProductsRaw = await Product.findAll({
        include: [
          {
            association: 'reviews',
          },
        ],
        where: {
          id: { [Op.ne]: id }, // Loại trừ sản phẩm hiện tại
          status: 'active',
        },
        limit: parseInt(limit),
        order: [
          ['isFeatured', 'DESC'], // Ưu tiên sản phẩm nổi bật
          ['createdAt', 'DESC'], // Sau đó là sản phẩm mới nhất
        ],
      });
    }

    // Xử lý kết quả, thêm thông tin đánh giá
    const relatedProducts = relatedProductsRaw.map((product) => {
      const productJson = product.toJSON();
      // Map productImages → images cho frontend tương thích
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isThumbnail: img.isThumbnail,
          displayOrder: img.displayOrder,
          variantId: img.variantId,
          color: img.color,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }

      // Tính điểm đánh giá trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1)
        );
        ratings.count = productJson.reviews.length;
      }

      // Thêm ratings vào response, bỏ chi tiết reviews
      delete productJson.reviews;

      return {
        ...productJson,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: relatedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// Tìm kiếm sản phẩm
const searchProducts = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      throw new AppError('Từ khóa tìm kiếm là bắt buộc', 400);
    }

    const { count, rows: productsRaw } = await Product.findAndCountAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
          { shortDescription: { [Op.like]: `%${q}%` } },
          // { tags: { [Op.contains]: [q] } },
          { tags: { [Op.like]: `%${q}%` } },
        ],
      },
      include: [
        {
          association: 'category',
        },
        {
          association: 'productImages',
          required: false,
        }
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();
      productJson.price = productJson.basePrice;
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id, url: img.imageUrl, alt: img.altText, isThumbnail: img.isThumbnail, displayOrder: img.displayOrder, variantId: img.variantId, color: img.color,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }
      delete productJson.productImages;
      return productJson;
    });

    res.status(200).json({
      status: 'success',
      data: products,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm mới nhất
const getNewArrivals = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query;

    const productsRaw = await Product.findAll({
      include: [
        { association: 'category' },
        { association: 'reviews' },
        { association: 'productImages' },
        { association: 'variants' },
      ],
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    // Xử lý kết quả, thêm thông tin đánh giá
    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();
      productJson.price = productJson.basePrice;
      // Map productImages → images cho frontend tương thích
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isThumbnail: img.isThumbnail,
          displayOrder: img.displayOrder,
          variantId: img.variantId,
          color: img.color,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }

      // Tính điểm đánh giá trung bình
      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1)
        );
        ratings.count = productJson.reviews.length;
      }

      // Thêm ratings vào response, bỏ chi tiết reviews
      delete productJson.reviews;

      return {
        ...productJson,
        ratings,
      };
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm bán chạy
const getBestSellers = async (req, res, next) => {
  try {
    const { limit = 10, period = 'month' } = req.query;

    // Tính khoảng thời gian theo chu kỳ
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Lấy sản phẩm bán chạy dựa trên order items
    const bestSellers = await sequelize.query(
      `
      SELECT
        p.id,
        p.name,
        p.slug,
        p.base_price as price,
        p.compare_at_price,
        p.is_featured as isFeatured,
        COUNT(oi.productId) as sales_count,
        SUM(oi.quantity) as units_sold
      FROM products p
      JOIN order_items oi ON p.id = oi.productId
      JOIN orders o ON oi.orderId = o.id
      WHERE o.status != 'cancelled'
      AND o.createdAt >= :startDate
      GROUP BY p.id
      ORDER BY units_sold DESC
      LIMIT :limit
      `,
      {
        replacements: { startDate, limit: parseInt(limit) },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Nếu không có sản phẩm bán chạy, trả về sản phẩm mới nhất
    if (bestSellers.length === 0) {
      return await getNewArrivals(req, res, next);
    }

    // Lấy danh sách ID sản phẩm
    const productIds = bestSellers.map((product) => product.id);
    const safeProductIds = productIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    // Lấy thông tin đầy đủ sản phẩm
    const productsRaw = await Product.findAll({
      where: { id: { [Op.in]: safeProductIds } },
      include: [
        { association: 'category' },
        { association: 'productImages' },
        { association: 'variants' },
      ],
      order: [
        [
          sequelize.literal(
            `CASE ${safeProductIds
              .map((id, index) => `WHEN id = ${id} THEN ${index}`)
              .join(' ')} END`
          ),
        ],
      ],
    });

    const products = productsRaw.map((product) => {
      const productJson = product.toJSON();
      productJson.price = productJson.basePrice;
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id, url: img.imageUrl, alt: img.altText, isThumbnail: img.isThumbnail, displayOrder: img.displayOrder, variantId: img.variantId,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }
      delete productJson.productImages;
      return productJson;
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm đang khuyến mãi
const getDeals = async (req, res, next) => {
  try {
    const parsedLimit = Math.min(parseInt(req.query.limit) || 12, 100);
    const parsedMinDiscount = parseFloat(req.query.minDiscount) || 5;
    const sort = req.query.sort || 'discount_desc';

    // Xác định ORDER BY trước khi truy vấn
    let orderClause;
    if (sort === 'price_asc') {
      orderClause = [['basePrice', 'ASC']];
    } else if (sort === 'price_desc') {
      orderClause = [['basePrice', 'DESC']];
    } else {
      // discount_desc: sort theo % giảm giá cao nhất trước
      // Sequelize không có built-in expression sort — dùng literal để tính trực tiếp trong ORDER BY
      orderClause = [[sequelize.literal('(compare_at_price - base_price) / compare_at_price'), 'DESC']];
    }

    // Lọc và sắp xếp tại DB — không load toàn bộ bảng vào memory
    const products = await Product.findAll({
      where: {
        compareAtPrice: { [Op.ne]: null },
        [Op.and]: [
          // discountPercentage là computed field — không có column thật nên phải dùng literal
          // parsedMinDiscount đã được parseFloat trước → không có SQL injection
          sequelize.where(
            sequelize.literal('(compare_at_price - base_price) / compare_at_price * 100'),
            { [Op.gte]: parsedMinDiscount }
          ),
        ],
      },
      include: [
        { association: 'category', required: false, attributes: ['id', 'name', 'slug'] },
        { association: 'reviews', required: false, where: { isVerified: true }, attributes: ['rating'] },
        { association: 'productImages', required: false, attributes: ['id', 'imageUrl', 'altText', 'isThumbnail', 'displayOrder', 'variantId'] },
        { association: 'variants', required: false, attributes: ['id', 'price', 'stockQuantity', 'sku', 'color', 'size'] },
      ],
      order: orderClause,
      limit: parsedLimit,
    });

    const data = products.map((product) => {
      const compareAtPrice = parseFloat(product.compareAtPrice);
      const basePrice = parseFloat(product.basePrice);
      const discountPercentage = ((compareAtPrice - basePrice) / compareAtPrice) * 100;

      const ratings = { average: 0, count: 0 };
      if (product.reviews && product.reviews.length > 0) {
        const totalRating = product.reviews.reduce((sum, r) => sum + r.rating, 0);
        ratings.average = parseFloat((totalRating / product.reviews.length).toFixed(1));
        ratings.count = product.reviews.length;
      }

      const productJson = product.toJSON();
      productJson.price = basePrice;
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id, url: img.imageUrl, alt: img.altText, isThumbnail: img.isThumbnail,
          displayOrder: img.displayOrder, variantId: img.variantId,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }
      delete productJson.productImages;
      delete productJson.reviews;

      return { ...productJson, discountPercentage, ratings };
    });

    res.status(200).json({
      status: 'success',
      data,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy biến thể sản phẩm
const getProductVariants = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);
    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lấy danh sách biến thể
    const variants = await ProductVariant.findAll({
      where: { productId: id },
    });

    res.status(200).json({
      status: 'success',
      data: {
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy tổng hợp đánh giá sản phẩm
const getProductReviewsSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm sản phẩm
    const product = await Product.findByPk(id);
    if (!product) {
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    // Lấy danh sách đánh giá
    const reviews = await Review.findAll({
      where: { productId: id },
      attributes: ['rating'],
    });

    // Tính tổng hợp đánh giá
    const count = reviews.length;
    const average =
      count > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / count
        : 0;

    // Tính phân bố điểm đánh giá
    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      distribution[review.rating]++;
    });

    res.status(200).json({
      status: 'success',
      data: {
        average,
        count,
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy bộ lọc sản phẩm
const getProductFilters = async (req, res, next) => {
  try {
    const { categoryId } = req.query;

    logger.info('Lấy bộ lọc sản phẩm với categoryId:', categoryId);

    // Xây dựng điều kiện lọc
    const whereCondition = {};
    const includeCondition = [];

    if (categoryId) {
      // Kiểm tra xem có phải là ID số hợp lệ không
      const isNumericId = !isNaN(categoryId) && String(categoryId).trim() !== '';

      if (isNumericId) {
        includeCondition.push({
          association: 'category',
          where: { id: categoryId },
          required: false, // Đặt required: false để tránh lỗi khi không tìm thấy danh mục
        });
      } else {
        // Nếu không phải ID số, tìm theo slug
        const category = await Category.findOne({
          where: { slug: categoryId },
        });
        if (category) {
          includeCondition.push({
            association: 'category',
            where: { id: category.id },
            required: false,
          });
        }
      }
    }

    // Lấy khoảng giá
    const priceRange = await Product.findAll({
      attributes: [
        [sequelize.fn('MIN', sequelize.col('base_price')), 'min'],
        [sequelize.fn('MAX', sequelize.col('base_price')), 'max'],
      ],
      where: whereCondition,
      include: includeCondition,
      raw: true,
    });

    // Lấy category ID thực tế nếu có
    let actualCategoryId = null;
    if (categoryId) {
      const isStrictInt = /^\d+$/.test(String(categoryId).trim());
      const isSlug = /^[a-z0-9-]+$/.test(String(categoryId).trim());
      if (!isStrictInt && !isSlug) {
        throw new AppError('categoryId không hợp lệ', 400);
      }
      if (isStrictInt) {
        actualCategoryId = parseInt(categoryId, 10);
      } else {
        const category = await Category.findOne({
          where: { slug: categoryId },
        });
        if (category) {
          actualCategoryId = category.id;
        }
      }
    }

    // Xây dựng điều kiện lọc sản phẩm theo danh mục
    let productFilter = {};
    if (actualCategoryId) {
      productFilter = {
        productId: {
          [Op.in]: sequelize.literal(
            `(SELECT product_id FROM product_categories WHERE category_id = ${actualCategoryId})`
          ),
        },
      };
    }

    // Lấy danh sách thương hiệu
    const brands = await ProductAttribute.findAll({
      attributes: ['values'],
      where: {
        name: 'brand',
        ...(actualCategoryId ? productFilter : {}),
      },
      limit: 500,
      raw: true,
    });

    // Lấy danh sách màu sắc
    const colors = await ProductAttribute.findAll({
      attributes: ['values'],
      where: {
        name: 'color',
        ...(actualCategoryId ? productFilter : {}),
      },
      limit: 500,
      raw: true,
    });

    // Lấy danh sách kích thước
    const sizes = await ProductAttribute.findAll({
      attributes: ['values'],
      where: {
        name: 'size',
        ...(actualCategoryId ? productFilter : {}),
      },
      limit: 500,
      raw: true,
    });

    // Lấy các thuộc tính khác
    const otherAttributes = await ProductAttribute.findAll({
      attributes: ['name', 'values'],
      where: {
        name: { [Op.notIn]: ['brand', 'color', 'size'] },
        ...(actualCategoryId ? productFilter : {}),
      },
      group: ['name', 'values'],
      limit: 500,
      raw: true,
    });

    // Xử lý dữ liệu trả về
    const uniqueBrands = new Set();
    brands.forEach((brand) => {
      if (brand.values && Array.isArray(brand.values)) {
        brand.values.forEach((value) => uniqueBrands.add(value));
      }
    });

    const uniqueColors = new Set();
    colors.forEach((color) => {
      if (color.values && Array.isArray(color.values)) {
        color.values.forEach((value) => uniqueColors.add(value));
      }
    });

    const uniqueSizes = new Set();
    sizes.forEach((size) => {
      if (size.values && Array.isArray(size.values)) {
        size.values.forEach((value) => uniqueSizes.add(value));
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        priceRange: {
          min: parseFloat(priceRange[0]?.min || 0),
          max: parseFloat(priceRange[0]?.max || 0),
        },
        brands: Array.from(uniqueBrands),
        colors: Array.from(uniqueColors),
        sizes: Array.from(uniqueSizes),
        attributes: otherAttributes.map((attr) => ({
          name: attr.name,
          values: attr.values || [],
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm đã xem gần đây
const getRecentlyViewed = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const recentlyViewed = await RecentlyViewed.findAll({
      where: { userId },
      limit: parseInt(limit),
      order: [['viewedAt', 'DESC']],
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'slug', ['base_price', 'price'], ['compare_at_price', 'compareAtPrice']],
          include: [
            {
              association: 'reviews',
            },
            {
              association: 'productImages',
              required: false,
            }
          ],
        },
      ],
    });

    // Xử lý kết quả, thêm thông tin đánh giá
    const products = recentlyViewed.map((rv) => {
      const product = rv.Product;
      const productJson = product.toJSON();
      // Map productImages → images cho frontend tương thích
      if (productJson.productImages && productJson.productImages.length > 0) {
        productJson.images = productJson.productImages.map(img => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isThumbnail: img.isThumbnail,
          displayOrder: img.displayOrder,
          variantId: img.variantId,
        }));
        const primaryImg = productJson.productImages.find(img => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = primaryImg.imageUrl;
      } else {
        productJson.images = [];
        productJson.thumbnail = null;
      }
      delete productJson.productImages;

      const ratings = {
        average: 0,
        count: 0,
      };

      if (productJson.reviews && productJson.reviews.length > 0) {
        const totalRating = productJson.reviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        ratings.average = parseFloat(
          (totalRating / productJson.reviews.length).toFixed(1)
        );
        ratings.count = productJson.reviews.length;
      }

      delete productJson.reviews;

      return {
        ...productJson,
        ratings,
        viewedAt: rv.viewedAt,
      };
    });

    res.status(200).json({
      status: 'success',
      data: products,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductBySlug,
  getRecentlyViewed,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getRelatedProducts,
  searchProducts,
  getNewArrivals,
  getBestSellers,
  getDeals,
  getProductVariants,
  getProductReviewsSummary,
  getProductFilters,
};
