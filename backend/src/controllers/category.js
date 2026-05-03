const { Category, Product, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const CACHE_TTL_CATEGORIES = 30 * 60; // 30 phút

// Lấy tất cả danh mục
const getAllCategories = async (req, res, next) => {
  try {
    const redis = await getRedisClient();
    const cacheKey = 'categories:all';
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(JSON.parse(cached));
    }

    const categories = await Category.findAll({
      order: [['name', 'ASC']],
    });

    // Đếm sản phẩm theo category_id trực tiếp trên bảng products
    const categoryCounts = await sequelize.query(
      `SELECT category_id, COUNT(*) as product_count FROM products WHERE category_id IS NOT NULL GROUP BY category_id`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const countMap = {};
    categoryCounts.forEach((item) => {
      countMap[item.category_id] = parseInt(item.product_count);
    });

    const categoriesWithCount = categories.map((category) => {
      const categoryData = category.toJSON();
      categoryData.productCount = countMap[category.id] || 0;
      return categoryData;
    });

    const payload = { status: 'success', data: categoriesWithCount };
    await redis.setEx(cacheKey, CACHE_TTL_CATEGORIES, JSON.stringify(payload));

    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

// Lấy cây danh mục
const getCategoryTree = async (req, res, next) => {
  try {
    const allCategories = await Category.findAll({
      order: [['name', 'ASC']],
    });

    // Trả về danh sách phẳng (không có parent/children vì model mới không có parentId)
    res.status(200).json({
      status: 'success',
      data: allCategories,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh mục theo ID
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await Category.findByPk(id);

    if (!category) {
      throw new AppError('Không tìm thấy danh mục', 404);
    }

    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh mục theo slug
const getCategoryBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const isNumericId = !isNaN(slug) && String(slug).trim() !== '';

    const category = await Category.findOne({
      where: {
        [Op.or]: [
          { slug },
          isNumericId ? { id: slug } : null,
        ].filter(Boolean),
      },
    });

    if (!category) {
      throw new AppError('Không tìm thấy danh mục', 404);
    }

    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Tạo danh mục mới
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    const category = await Category.create({
      name,
      description,
    });

    try {
      const redis = await getRedisClient();
      await redis.del('categories:all');
    } catch (err) {
      // Cache invalidation failure không nên block write thành công — chỉ log warning
      logger.warn('Xóa cache categories:all thất bại sau createCategory:', err.message);
    }

    res.status(201).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật danh mục
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = await Category.findByPk(id);
    if (!category) {
      throw new AppError('Không tìm thấy danh mục', 404);
    }

    await category.update({
      name: name !== undefined ? name : category.name,
      description: description !== undefined ? description : category.description,
    });

    try {
      const redis = await getRedisClient();
      await redis.del('categories:all');
    } catch (err) {
      // Cache invalidation failure không nên block write thành công — chỉ log warning
      logger.warn('Xóa cache categories:all thất bại sau updateCategory:', err.message);
    }

    res.status(200).json({
      status: 'success',
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

// Xóa danh mục
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      throw new AppError('Không tìm thấy danh mục', 404);
    }

    // Kiểm tra danh mục có sản phẩm không
    const productCount = await Product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      throw new AppError('Không thể xóa danh mục có sản phẩm', 400);
    }

    await category.destroy();

    try {
      const redis = await getRedisClient();
      await redis.del('categories:all');
    } catch (err) {
      // Cache invalidation failure không nên block write thành công — chỉ log warning
      logger.warn('Xóa cache categories:all thất bại sau deleteCategory:', err.message);
    }

    res.status(200).json({
      status: 'success',
      message: 'Xóa danh mục thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm theo danh mục
const getProductsByCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'DESC',
      status = 'active',
    } = req.query;

    let category = await Category.findByPk(id);
    if (!category) {
      // Tìm bằng slug nếu findByPk thất bại
      category = await Category.findOne({ where: { slug: id } });
    }

    if (!category) {
      throw new AppError('Không tìm thấy danh mục', 404);
    }

    // Xây dựng điều kiện where
    const where = { categoryId: category.id };
    if (status) {
      where.status = status;
    }

    // Lấy sản phẩm trực tiếp qua categoryId với đầy đủ thông tin
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        {
          association: 'brand',
          attributes: ['id', 'name', 'slug', 'logoUrl'],
        },
        {
          association: 'productAttributes',
        },
        {
          association: 'variants',
        },
        {
          association: 'productImages',
        },
        {
          association: 'reviews',
        },
      ],
      distinct: true,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sort, order]],
    });

    // Ánh xạ thumbnail, ảnh và xử lý giá
    const productsWithImages = products.map((product) => {
      const productJson = product.toJSON();

      if (productJson.productImages) {
        productJson.images = productJson.productImages.map((img) => ({
          id: img.id,
          url: img.imageUrl,
          isThumbnail: img.isThumbnail,
          color: img.color,
        }));

        const thumbnailImg = productJson.productImages.find((img) => img.isThumbnail) || productJson.productImages[0];
        productJson.thumbnail = thumbnailImg ? thumbnailImg.imageUrl : null;
      }

      // Xử lý giá từ variant (tránh giá = 0 khi đã có variant)
      if (productJson.variants && productJson.variants.length > 0) {
        const defaultVariant = productJson.variants.find(v => v.isDefault === true || v.isDefault === 1) || productJson.variants[0];
        productJson.price = defaultVariant?.price || productJson.basePrice;
        productJson.compareAtPrice = defaultVariant?.compareAtPrice || productJson.compareAtPrice;
      } else {
        productJson.price = productJson.basePrice;
      }

      return productJson;
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        products: productsWithImages,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh mục nổi bật
const getFeaturedCategories = async (req, res, next) => {
  try {
    // Lấy tất cả danh mục có sản phẩm
    const categories = await Category.findAll({
      order: [['name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategory,
  getFeaturedCategories,
};
