const IInventoryRepository = require('./IInventoryRepository');

class SequelizeInventoryRepository extends IInventoryRepository {
  constructor({ Product, ProductVariant, InventoryLog, User }) {
    super();
    this.Product = Product;
    this.ProductVariant = ProductVariant;
    this.InventoryLog = InventoryLog;
    this.User = User;
  }

  async findProductById(id) {
    return this.Product.findByPk(id);
  }

  async findVariantByIdAndProductId(variantId, productId) {
    return this.ProductVariant.findOne({ where: { id: variantId, productId } });
  }

  async sumVariantStockByProductId(productId) {
    return this.ProductVariant.sum('stockQuantity', { where: { productId } });
  }

  async saveStockable(stockable) {
    return stockable.save();
  }

  async createInventoryLog(payload) {
    return this.InventoryLog.create(payload);
  }

  async findInventoryLogs({ where = {}, limit, offset } = {}) {
    return this.InventoryLog.findAndCountAll({
      where,
      limit, offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: this.Product, attributes: ['id', 'name', 'slug'], required: false },
        { model: this.ProductVariant, attributes: ['id', 'sku'], required: false },
        { model: this.User, attributes: ['id', 'firstName', 'lastName'], required: false, as: 'creator' },
      ],
    });
  }
}

module.exports = SequelizeInventoryRepository;
