const { Collection, Product, ProductCollection } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');

// Get all collections
const getAllCollections = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const collections = await Collection.findAll({
      where,
      order: [['name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      data: collections,
    });
  } catch (error) {
    next(error);
  }
};

// Get collection by slug
const getCollectionBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const collection = await Collection.findOne({
      where: { slug },
    });

    if (!collection) {
      throw new AppError('Không tìm thấy bộ sưu tập', 404);
    }

    res.status(200).json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    next(error);
  }
};

// Create collection (Admin)
const createCollection = async (req, res, next) => {
  try {
    const { name, description, thumbnail, isActive, productIds } = req.body;
    const collection = await Collection.create({
      name,
      description,
      thumbnail,
      isActive,
    });

    if (productIds && productIds.length > 0) {
      const productCollections = productIds.map((productId) => ({
        productId,
        collectionId: collection.id,
      }));
      await ProductCollection.bulkCreate(productCollections);
    }

    res.status(201).json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    next(error);
  }
};

// Update collection (Admin)
const updateCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, thumbnail, isActive, productIds } = req.body;
    const collection = await Collection.findByPk(id);

    if (!collection) {
      throw new AppError('Không tìm thấy bộ sưu tập', 404);
    }

    await collection.update({ name, description, thumbnail, isActive });

    if (productIds !== undefined) {
      // Clear existing products
      await ProductCollection.destroy({ where: { collectionId: id } });
      
      // Add new products
      if (productIds.length > 0) {
        const productCollections = productIds.map((productId) => ({
          productId,
          collectionId: id,
        }));
        await ProductCollection.bulkCreate(productCollections);
      }
    }

    res.status(200).json({
      status: 'success',
      data: collection,
    });
  } catch (error) {
    next(error);
  }
};

// Delete collection (Admin)
const deleteCollection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const collection = await Collection.findByPk(id);

    if (!collection) {
      throw new AppError('Không tìm thấy bộ sưu tập', 404);
    }

    await ProductCollection.destroy({ where: { collectionId: id } });
    await collection.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Xóa bộ sưu tập thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Get products by collection
const getProductsByCollection = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 10, sort = 'createdAt', order = 'DESC' } = req.query;

    const collection = await Collection.findOne({ where: { slug } });
    if (!collection) {
      throw new AppError('Không tìm thấy bộ sưu tập', 404);
    }

    const { count, rows: products } = await Product.findAndCountAll({
      include: [
        {
          association: 'collections',
          where: { id: collection.id },
          through: { attributes: [] },
        },
      ],
      where: { status: 'active' },
      distinct: true,
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
  getAllCollections,
  getCollectionBySlug,
  createCollection,
  updateCollection,
  deleteCollection,
  getProductsByCollection,
};
