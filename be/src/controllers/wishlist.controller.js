const { Wishlist, Product } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Get user wishlist
const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const wishlistItems = await Wishlist.findAll({
      where: { userId },
      include: [
        {
          model: Product,
          attributes: [
            'id',
            'name',
            'slug',
            ['base_price', 'price'],
            ['compare_at_price', 'compareAtPrice']
          ],
          include: [
            {
              association: 'productImages',
              required: false,
            },
            {
              association: 'defaultVariant',
              required: false,
            }
          ]
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    const mappedProducts = wishlistItems.map((item) => {
      const p = item.Product.toJSON();
      
      // Stock checking logic
      p.stockQuantity = p.defaultVariant ? p.defaultVariant.stockQuantity : 0;
      p.inStock = p.stockQuantity > 0;
      
      // Image mapping logic
      if (p.productImages && p.productImages.length > 0) {
        p.images = p.productImages.map(img => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isPrimary: img.isPrimary
        }));
        const primaryImg = p.productImages.find(img => img.isPrimary) || p.productImages[0];
        p.thumbnail = primaryImg.imageUrl;
      } else {
        p.images = [];
        p.thumbnail = null;
      }
      delete p.productImages;
      delete p.defaultVariant;
      
      return p;
    });

    res.status(200).json({
      status: 'success',
      data: mappedProducts,
    });
  } catch (error) {
    next(error);
  }
};

// Add product to wishlist
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body;
    const userId = req.user.id;

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    // Check if product is already in wishlist
    const existingItem = await Wishlist.findOne({
      where: { userId, productId },
    });

    if (existingItem) {
      return res.status(200).json({
        status: 'success',
        message: 'Sản phẩm đã có trong danh sách yêu thích',
      });
    }

    // Add to wishlist
    await Wishlist.create({
      userId,
      productId,
    });

    res.status(201).json({
      status: 'success',
      message: 'Đã thêm sản phẩm vào danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

// Remove product from wishlist
const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Check if product is in wishlist
    const wishlistItem = await Wishlist.findOne({
      where: { userId, productId },
    });

    if (!wishlistItem) {
      throw new AppError('Sản phẩm không có trong danh sách yêu thích', 404);
    }

    // Remove from wishlist
    await wishlistItem.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa sản phẩm khỏi danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

// Check if product is in wishlist
const checkWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const userId = req.user.id;

    // Check if product is in wishlist
    const wishlistItem = await Wishlist.findOne({
      where: { userId, productId },
    });

    res.status(200).json({
      status: 'success',
      data: {
        inWishlist: !!wishlistItem,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Clear wishlist
const clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Delete all wishlist items
    await Wishlist.destroy({
      where: { userId },
    });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa tất cả sản phẩm trong danh sách yêu thích',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlist,
  clearWishlist,
};
