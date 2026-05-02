const { Brand, Product, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');

// Lấy tất cả thương hiệu
const getAllBrands = async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const where = {};

    // Lọc thương hiệu theo danh mục (dùng categoryId trực tiếp từ products)
    if (categoryId) {
      // Tìm categoryId: có thể là số (ID) hoặc slug
      const isNumericId = !isNaN(categoryId) && String(categoryId).trim() !== '';
      let catId = categoryId;

      if (!isNumericId) {
        // Nếu là slug, tìm category ID
        const { Category } = require('../models');
        const cat = await Category.findOne({ where: { slug: categoryId } });
        catId = cat ? cat.id : -1;
      }

      // Lấy brand IDs từ products thuộc category
      const products = await Product.findAll({
        where: { categoryId: catId },
        attributes: [[sequelize.fn('DISTINCT', sequelize.col('brand_id')), 'brandId']],
        raw: true,
      });

      const brandIds = products.map((p) => p.brandId).filter((id) => !!id);
      where.id = { [Op.in]: brandIds };
    }

    const brands = await Brand.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      data: brands,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy thương hiệu theo slug
const getBrandBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const brand = await Brand.findOne({
      where: { slug },
    });

    if (!brand) {
      throw new AppError('Không tìm thấy thương hiệu', 404);
    }

    res.status(200).json({
      status: 'success',
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

// Tạo thương hiệu (Admin)
const createBrand = async (req, res, next) => {
  try {
    const { name, logoUrl } = req.body;
    const brand = await Brand.create({
      name,
      logoUrl,
    });

    res.status(201).json({
      status: 'success',
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật thương hiệu (Admin)
const updateBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findByPk(id);

    if (!brand) {
      throw new AppError('Không tìm thấy thương hiệu', 404);
    }

    await brand.update(req.body);

    res.status(200).json({
      status: 'success',
      data: brand,
    });
  } catch (error) {
    next(error);
  }
};

// Xóa thương hiệu (Admin)
const deleteBrand = async (req, res, next) => {
  try {
    const { id } = req.params;
    const brand = await Brand.findByPk(id);

    if (!brand) {
      throw new AppError('Không tìm thấy thương hiệu', 404);
    }

    // Kiểm tra brand có sản phẩm không
    const productCount = await Product.count({ where: { brandId: id } });
    if (productCount > 0) {
      throw new AppError('Không thể xóa thương hiệu đang có sản phẩm', 400);
    }

    await brand.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Xóa thương hiệu thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Lấy sản phẩm theo thương hiệu
const getProductsByBrand = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;

    const brand = await Brand.findOne({ where: { slug } });
    if (!brand) {
      throw new AppError('Không tìm thấy thương hiệu', 404);
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: { brandId: brand.id },
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sort, order]],
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        products,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBrands,
  getBrandBySlug,
  createBrand,
  updateBrand,
  deleteBrand,
  getProductsByBrand,
};
