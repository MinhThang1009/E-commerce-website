// IInventoryRepository — interface inventory data access.

class IInventoryRepository {
  async findProductById(_id) { throw new Error('not implemented'); }
  async findVariantByIdAndProductId(_variantId, _productId) { throw new Error('not implemented'); }
  async sumVariantStockByProductId(_productId) { throw new Error('not implemented'); }
  async saveStockable(_stockable) { throw new Error('not implemented'); }
  async createInventoryLog(_payload) { throw new Error('not implemented'); }
  async findInventoryLogs(_options) { throw new Error('not implemented'); }
}

module.exports = IInventoryRepository;
