const { WarrantyPackage, ProductWarranty, Product } = require('../models');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const { t } = require('../utils/i18n');

// Lấy danh sách tất cả gói bảo hành
exports.getAllWarrantyPackages = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    const { count, rows } = await WarrantyPackage.findAndCountAll({
      where: whereClause,
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
      offset: parseInt(offset),
      limit: parseInt(limit),
    });

    res.json({
      status: 'success',
      data: {
        warrantyPackages: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Lỗi khi lấy danh sách gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: t('warranty.serverError', req.locale),
    });
  }
};

// Lấy gói bảo hành theo ID sản phẩm
exports.getWarrantyPackagesByProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    // Kiểm tra sản phẩm có tồn tại không
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy sản phẩm',
      });
    }

    // Lấy danh sách gói bảo hành của sản phẩm này
    const productWarranties = await ProductWarranty.findAll({
      where: { productId },
      include: [
        {
          model: WarrantyPackage,
          as: 'warrantyPackage',
          where: { isActive: true },
        },
      ],
      order: [
        [{ model: WarrantyPackage, as: 'warrantyPackage' }, 'sortOrder', 'ASC'],
        [{ model: WarrantyPackage, as: 'warrantyPackage' }, 'price', 'ASC'],
      ],
    });

    // Trích xuất danh sách gói bảo hành kèm thông tin mặc định
    const warrantyPackages = productWarranties.map((pw) => ({
      ...pw.warrantyPackage.toJSON(),
      isDefault: pw.isDefault,
    }));

    res.json({
      status: 'success',
      data: {
        warrantyPackages,
        productId,
      },
    });
  } catch (error) {
    logger.error('Lỗi khi lấy gói bảo hành theo sản phẩm:', error);
    res.status(500).json({
      status: 'error',
      message: t('warranty.serverError', req.locale),
    });
  }
};

// Lấy gói bảo hành theo ID
exports.getWarrantyPackageById = async (req, res) => {
  try {
    const { id } = req.params;

    const warrantyPackage = await WarrantyPackage.findByPk(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy gói bảo hành',
      });
    }

    res.json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    logger.error('Lỗi khi lấy gói bảo hành theo ID:', error);
    res.status(500).json({
      status: 'error',
      message: t('warranty.serverError', req.locale),
    });
  }
};

// Tạo gói bảo hành mới
exports.createWarrantyPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array(),
      });
    }

    const {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive = true,
      sortOrder = 0,
    } = req.body;

    const warrantyPackage = await WarrantyPackage.create({
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    });

    res.status(201).json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    logger.error('Lỗi khi tạo gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: t('warranty.serverError', req.locale),
    });
  }
};

// Cập nhật gói bảo hành
exports.updateWarrantyPackage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Dữ liệu không hợp lệ',
        errors: errors.array(),
      });
    }

    const { id } = req.params;
    const {
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    } = req.body;

    const warrantyPackage = await WarrantyPackage.findByPk(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy gói bảo hành',
      });
    }

    await warrantyPackage.update({
      name,
      description,
      durationMonths,
      price,
      terms,
      coverage,
      isActive,
      sortOrder,
    });

    res.json({
      status: 'success',
      data: warrantyPackage,
    });
  } catch (error) {
    logger.error('Lỗi khi cập nhật gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: t('warranty.serverError', req.locale),
    });
  }
};

// Xóa gói bảo hành
exports.deleteWarrantyPackage = async (req, res) => {
  try {
    const { id } = req.params;

    const warrantyPackage = await WarrantyPackage.findByPk(id);

    if (!warrantyPackage) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy gói bảo hành',
      });
    }

    // Kiểm tra gói bảo hành có đang được sử dụng không
    const isUsed = await ProductWarranty.findOne({
      where: { warrantyPackageId: id },
    });

    if (isUsed) {
      return res.status(400).json({
        status: 'error',
        message:
          'Không thể xóa gói bảo hành đang được sử dụng bởi sản phẩm',
      });
    }

    await warrantyPackage.destroy();

    res.json({
      status: 'success',
      message: 'Xóa gói bảo hành thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi xóa gói bảo hành:', error);
    res.status(500).json({
      status: 'error',
      message: t('warranty.serverError', req.locale),
    });
  }
};
