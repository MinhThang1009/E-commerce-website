/**
 * @file SequelizeWishlistRepository.js
 * @layer Repository
 * @module wishlist
 * @description Data access layer cho wishlist
 */
const { col } = require('sequelize');
const IWishlistRepository = require('./IWishlistRepository');

// Sequelize impl của IWishlistRepository — duy nhất layer truy cập Wishlist/
// Product model trong wishlist module.
class SequelizeWishlistRepository extends IWishlistRepository {
  constructor({ Wishlist, Product }) {
    super();
    if (!Wishlist) throw new Error('SequelizeWishlistRepository: Wishlist model bắt buộc');
    if (!Product) throw new Error('SequelizeWishlistRepository: Product model bắt buộc');
    this.Wishlist = Wishlist;
    this.Product = Product;
  }

  async findByUserIdWithProducts(userId) {
    return this.Wishlist.findAll({
      where: { userId },
      include: [
        {
          model: this.Product,
          attributes: ['id', 'name', 'slug', [col('base_price'), 'price'], 'compareAtPrice'],
          include: [
            { association: 'productImages', required: false },
            { association: 'defaultVariant', required: false },
            // Include tất cả variants để tính tổng stock (stock thực ở variant level)
            { association: 'variants', attributes: ['stockQuantity'], required: false },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async findItem(userId, productId) {
    return this.Wishlist.findOne({ where: { userId, productId } });
  }

  async createItem(payload) {
    return this.Wishlist.create(payload);
  }

  async deleteItem(item) {
    return item.destroy();
  }

  async clearByUserId(userId) {
    return this.Wishlist.destroy({ where: { userId } });
  }

  async findProductById(id) {
    return this.Product.findByPk(id);
  }
}

module.exports = SequelizeWishlistRepository;
