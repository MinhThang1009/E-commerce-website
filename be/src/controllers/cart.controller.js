const {
  Cart,
  CartItem,
  Product,
  ProductVariant,
  WarrantyPackage,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { v4: uuidv4 } = require('uuid');

// Get cart
const getCart = async (req, res, next) => {
  try {
    let cart;

    const { sessionId: cookieSessionId } = req.cookies;

    if (req.user) {
      // Logged in user - get or create cart
      [cart] = await Cart.findOrCreate({
        where: {
          userId: req.user.id,
          status: 'active',
        },
        defaults: {
          userId: req.user.id,
        },
      });

      // Merge guest cart if session ID exists
      if (cookieSessionId) {
        const guestCart = await Cart.findOne({
          where: {
            sessionId: cookieSessionId,
            status: 'active',
            userId: null,
          },
          include: [{ model: CartItem, as: 'items' }],
        });

        if (guestCart && guestCart.items.length > 0) {
          console.log(`Merging guest cart ${guestCart.id} into user cart ${cart.id}`);
          for (const guestItem of guestCart.items) {
            // Check if item already exists in user cart
            const existingItem = await CartItem.findOne({
              where: {
                cartId: cart.id,
                productId: guestItem.productId,
                variantId: guestItem.variantId,
              },
            });

            if (existingItem) {
              await existingItem.update({
                quantity: existingItem.quantity + guestItem.quantity,
              });
              await guestItem.destroy();
            } else {
              await guestItem.update({ cartId: cart.id });
            }
          }
          // Mark guest cart as merged or delete it
          await guestCart.update({ status: 'merged' });
        }
      }
    } else {
      // Guest user - get or create cart by session ID
      if (!cookieSessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            id: null,
            items: [],
            totalItems: 0,
            subtotal: 0,
          },
        });
      }

      [cart] = await Cart.findOrCreate({
        where: {
          sessionId: cookieSessionId,
          status: 'active',
        },
        defaults: {
          sessionId: cookieSessionId,
        },
      });
    }

    // Get cart items with product details
    const cartItems = await CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        {
          model: Product,
          attributes: [
            'id',
            'name',
            'slug',
            'basePrice'
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
        {
          model: ProductVariant,
          attributes: ['id', ['variant_name', 'name'], 'price', 'stockQuantity', 'attributes'],
        },
      ],
    });

    // Get warranty packages for cart items that have them
    const cartItemsWithWarranties = await Promise.all(
      cartItems.map(async (item) => {
        const itemData = item.toJSON();
        
        // Cập nhật thông tin Product tương thích API
        if (itemData.Product) {
          const p = itemData.Product;
          p.stockQuantity = p.defaultVariant ? p.defaultVariant.stockQuantity : 0;
          p.inStock = p.stockQuantity > 0;
          
          if (p.productImages && p.productImages.length > 0) {
              // Ưu tiên chọn ảnh theo variantId nếu có, nếu không thì chọn ảnh thumbnail chính (isThumbnail)
              const variantImg = itemData.variantId ? p.productImages.find(img => img.variant_id === itemData.variantId || img.variantId === itemData.variantId) : null;
              const primaryImg = variantImg || p.productImages.find(img => img.isThumbnail === true || img.is_thumbnail === true) || p.productImages[0];
              p.thumbnail = primaryImg.imageUrl;
          } else {
             p.thumbnail = p.thumbnail || null;
          }
          
          // Ensure price exists for calculation later
          p.price = p.basePrice;

          delete p.productImages;
          delete p.defaultVariant;
        }

        if (
          itemData.warrantyPackageIds &&
          itemData.warrantyPackageIds.length > 0
        ) {
          const warranties = await WarrantyPackage.findAll({
            where: {
              id: itemData.warrantyPackageIds,
              isActive: true,
            },
            attributes: ['id', 'name', 'price', 'durationMonths'],
          });
          itemData.warrantyPackages = warranties;
        } else {
          itemData.warrantyPackages = [];
        }
        return itemData;
      })
    );

    // Calculate totals
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItemsWithWarranties.reduce((sum, item) => {
      const price = item.ProductVariant
        ? item.ProductVariant.price
        : (item.Product ? item.Product.basePrice : 0);

      // Calculate warranty price
      const warrantyPrice = item.warrantyPackages
        ? item.warrantyPackages.reduce(
            (warrantySum, warranty) => warrantySum + parseFloat(warranty.price),
            0
          )
        : 0;

      return sum + price * item.quantity + warrantyPrice * item.quantity;
    }, 0);

    res.status(200).json({
      status: 'success',
      data: {
        id: cart.id,
        items: cartItemsWithWarranties,
        totalItems,
        subtotal,
      },
    });
  } catch (error) {
    console.error('[ERROR] getCart fail:', error);
    try {
      const fs = require('fs');
      const path = require('path');
      const errorLogPath = path.join(__dirname, '../../error_cart.log');
      fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] Cart Error: ${error.message}\nStack: ${error.stack}\n\n`);
    } catch (logError) {
      console.error('Failed to write to error log file:', logError);
    }
    next(error);
  }
};

// Add item to cart
const addToCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      productId,
      variantId,
      quantity = 1,
      warrantyPackageIds = [],
    } = req.body;

    // Validate product
    const product = await Product.findByPk(productId, {
      include: [{ association: 'defaultVariant' }]
    });
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    const baseStockQuantity = product.defaultVariant ? product.defaultVariant.stockQuantity : 0;
    const baseInStock = baseStockQuantity > 0;

    if (!baseInStock && !variantId) {
      throw new AppError('Sản phẩm đã hết hàng', 400);
    }

    // Validate variant if provided
    let variant = null;
    if (variantId) {
      variant = await ProductVariant.findOne({
        where: { id: variantId, productId },
      });

      if (!variant) {
        throw new AppError('Biến thể sản phẩm không tồn tại', 404);
      }

      if (variant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (baseStockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    // Validate warranty packages if provided
    let validWarrantyPackageIds = [];
    if (warrantyPackageIds && warrantyPackageIds.length > 0) {
      const warranties = await WarrantyPackage.findAll({
        where: {
          id: warrantyPackageIds,
          isActive: true,
        },
      });

      if (warranties.length !== warrantyPackageIds.length) {
        throw new AppError('Một hoặc nhiều gói bảo hành không hợp lệ', 400);
      }

      validWarrantyPackageIds = warranties.map((w) => w.id);
    }

    // Get or create cart
    let cart;

    if (req.user) {
      // Logged in user
      [cart] = await Cart.findOrCreate({
        where: {
          userId: req.user.id,
          status: 'active',
        },
        defaults: {
          userId: req.user.id,
        },
        transaction,
      });

      // Note: Cart merging is now handled by dedicated /merge endpoint
      // when user logs in, not during addToCart to avoid duplicates
    } else {
      // Guest user
      let { sessionId } = req.cookies;

      if (!sessionId) {
        sessionId = uuidv4();
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          sameSite: 'strict',
        });
      }

      [cart] = await Cart.findOrCreate({
        where: {
          sessionId,
          status: 'active',
        },
        defaults: {
          sessionId,
        },
        transaction,
      });
    }

    // Check if item already exists in cart (including same warranty packages)
    let cartItem = await CartItem.findOne({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        warrantyPackageIds: validWarrantyPackageIds,
      },
      transaction,
    });

    if (cartItem) {
      // Update quantity
      const newQuantity = cartItem.quantity + quantity;

      // Check stock
      if (variantId) {
        if (variant.stockQuantity < newQuantity) {
          throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
        }
      } else if (baseStockQuantity < newQuantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }

      await cartItem.update({ quantity: newQuantity }, { transaction });
    } else {
      // Create new cart item
      cartItem = await CartItem.create(
        {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
          price: variantId ? variant.price : product.basePrice,
          warrantyPackageIds: validWarrantyPackageIds,
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Update cart item
const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Find cart item
    const cartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Cart,
          attributes: ['id', 'userId', 'sessionId'],
        },
        {
          model: Product,
          attributes: ['id'],
          include: [{ association: 'defaultVariant', attributes: ['stockQuantity'] }]
        },
        {
          model: ProductVariant,
          attributes: ['id', 'stockQuantity'],
        },
      ],
    });

    if (!cartItem) {
      throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);
    }

    // Check cart ownership
    if (req.user) {
      if (cartItem.Cart.userId !== req.user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.Cart.sessionId !== sessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }

    // Check stock
    const baseStockQuantity = cartItem.Product.defaultVariant ? cartItem.Product.defaultVariant.stockQuantity : 0;
    
    if (cartItem.ProductVariant) {
      if (cartItem.ProductVariant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (baseStockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    // Update quantity
    await cartItem.update({ quantity });

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
const removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find cart item
    const cartItem = await CartItem.findByPk(id, {
      include: [
        {
          model: Cart,
          attributes: ['id', 'userId', 'sessionId'],
        },
      ],
    });

    if (!cartItem) {
      throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);
    }

    // Check cart ownership
    if (req.user) {
      if (cartItem.Cart.userId !== req.user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId || cartItem.Cart.sessionId !== sessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }

    // Delete cart item
    await cartItem.destroy();

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Clear cart
const clearCart = async (req, res, next) => {
  try {
    let cartId;

    if (req.user) {
      // Logged in user
      const cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });

      if (!cart) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      cartId = cart.id;
    } else {
      // Guest user
      const { sessionId } = req.cookies;

      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      const cart = await Cart.findOne({
        where: {
          sessionId,
          status: 'active',
        },
      });

      if (!cart) {
        return res.status(200).json({
          status: 'success',
          message: 'Giỏ hàng đã trống',
        });
      }

      cartId = cart.id;
    }

    // Delete all cart items
    await CartItem.destroy({
      where: { cartId },
    });

    res.status(200).json({
      status: 'success',
      message: 'Đã xóa tất cả sản phẩm trong giỏ hàng',
      data: {
        id: cartId,
        items: [],
        totalItems: 0,
        subtotal: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get cart count
const getCartCount = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      // Logged in user
      cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });
    } else {
      // Guest user
      const { sessionId } = req.cookies;

      if (!sessionId) {
        return res.status(200).json({
          status: 'success',
          data: {
            count: 0,
          },
        });
      }

      cart = await Cart.findOne({
        where: {
          sessionId,
          status: 'active',
        },
      });
    }

    if (!cart) {
      return res.status(200).json({
        status: 'success',
        data: {
          count: 0,
        },
      });
    }

    // Count items
    const count = await CartItem.sum('quantity', {
      where: { cartId: cart.id },
    });

    res.status(200).json({
      status: 'success',
      data: {
        count: count || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Sync cart from local storage to server
const syncCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { items } = req.body;

    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để đồng bộ giỏ hàng', 401);
    }

    // Get or create user cart
    const [cart] = await Cart.findOrCreate({
      where: {
        userId: req.user.id,
        status: 'active',
      },
      defaults: {
        userId: req.user.id,
      },
      transaction,
    });

    // Clear current cart
    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction,
    });

    // Add items from request
    for (const item of items) {
      const { productId, variantId, quantity } = item;

      // Validate product
      const product = await Product.findByPk(productId, { include: [{ association: 'defaultVariant' }] });
      const baseStockQuantity = product && product.defaultVariant ? product.defaultVariant.stockQuantity : 0;
      
      if (!product || (baseStockQuantity <= 0 && !variantId)) {
        continue; // Skip invalid products
      }

      // Validate variant if provided
      if (variantId) {
        const variant = await ProductVariant.findOne({
          where: { id: variantId, productId },
        });

        if (!variant) {
          continue; // Skip invalid variants
        }

        // Check stock and add to cart
        const actualQuantity = Math.min(quantity, variant.stockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create(
            {
              cartId: cart.id,
              productId,
              variantId,
              quantity: actualQuantity,
              price: variant.price,
            },
            { transaction }
          );
        }
      } else {
        // Check stock and add to cart
        const actualQuantity = Math.min(quantity, baseStockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create(
            {
              cartId: cart.id,
              productId,
              quantity: actualQuantity,
              price: product.basePrice || 0,
            },
            { transaction }
          );
        }
      }
    }

    await transaction.commit();

    // Return updated cart
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Merge guest cart with user cart (called when user logs in)
const mergeCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);
    }

    const { sessionId } = req.cookies;
    if (!sessionId) {
      // No session cart to merge, just return user cart
      return getCart(req, res, next);
    }

    // Find session cart
    const sessionCart = await Cart.findOne({
      where: {
        sessionId,
        status: 'active',
      },
    });

    if (!sessionCart) {
      // No session cart to merge, just return user cart
      return getCart(req, res, next);
    }

    // Get or create user cart
    const [userCart] = await Cart.findOrCreate({
      where: {
        userId: req.user.id,
        status: 'active',
      },
      defaults: {
        userId: req.user.id,
      },
      transaction,
    });

    // Get session cart items
    const sessionItems = await CartItem.findAll({
      where: { cartId: sessionCart.id },
      include: [
        {
          model: Product,
          attributes: ['id'],
          include: [{ association: 'defaultVariant', attributes: ['stockQuantity'] }]
        },
        {
          model: ProductVariant,
          attributes: ['id', 'stockQuantity'],
        },
      ],
      transaction,
    });

    // Merge each session item with user cart
    for (const sessionItem of sessionItems) {
      // Check if item already exists in user cart
      const existingUserItem = await CartItem.findOne({
        where: {
          cartId: userCart.id,
          productId: sessionItem.productId,
          variantId: sessionItem.variantId || null,
        },
        transaction,
      });

      if (existingUserItem) {
        // Merge quantities
        const newQuantity = existingUserItem.quantity + sessionItem.quantity;
        const baseStockQuantity = sessionItem.Product.defaultVariant ? sessionItem.Product.defaultVariant.stockQuantity : 0;
        const maxStock = sessionItem.ProductVariant
          ? sessionItem.ProductVariant.stockQuantity
          : baseStockQuantity;

        const finalQuantity = Math.min(newQuantity, maxStock);

        await existingUserItem.update(
          { quantity: finalQuantity },
          { transaction }
        );

        // Delete the session item after merging
        await sessionItem.destroy({ transaction });
      } else {
        // Move item to user cart
        await sessionItem.update({ cartId: userCart.id }, { transaction });
      }
    }

    // Mark session cart as merged
    await sessionCart.update({ status: 'merged' }, { transaction });

    await transaction.commit();

    // Clear session cookie to prevent duplicate merging
    res.clearCookie('sessionId');

    // Return updated user cart
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Validate cart items (check stock and price changes)
const validateCart = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      cart = await Cart.findOne({ where: { userId: req.user.id, status: 'active' } });
    } else {
      const { sessionId } = req.cookies;
      if (!sessionId) {
        return res.status(200).json({ status: 'success', data: { hasIssues: false, items: [] } });
      }
      cart = await Cart.findOne({ where: { sessionId, status: 'active' } });
    }

    if (!cart) {
      return res.status(200).json({ status: 'success', data: { hasIssues: false, items: [] } });
    }

    const cartItems = await CartItem.findAll({
      where: { cartId: cart.id },
      include: [
        { 
          model: Product, 
          attributes: ['id', 'name', ['basePrice', 'price']],
          include: [{ association: 'defaultVariant', attributes: ['stockQuantity'] }]
        },
        { model: ProductVariant, attributes: ['id', ['variant_name', 'name'], 'price', 'stockQuantity'] },
      ],
    });

    const validatedItems = cartItems.map((item) => {
      if (!item.Product) {
        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          name: 'Sản phẩm không còn tồn tại',
          hasIssue: true,
          outOfStock: true,
        };
      }
      
      const currentPrice = item.ProductVariant ? item.ProductVariant.price : item.Product.price;
      const baseStockQuantity = item.Product.defaultVariant ? item.Product.defaultVariant.stockQuantity : 0;
      const currentStock = item.ProductVariant
        ? item.ProductVariant.stockQuantity
        : baseStockQuantity;
      const isInStock = currentStock > 0;
      const priceChanged = parseFloat(currentPrice) !== parseFloat(item.price);
      const outOfStock = !isInStock;
      const quantityExceedsStock = isInStock && item.quantity > currentStock;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        name: item.ProductVariant ? `${item.Product.name} - ${item.ProductVariant.name}` : item.Product.name,
        savedPrice: parseFloat(item.price),
        currentPrice: parseFloat(currentPrice),
        quantity: item.quantity,
        maxStock: currentStock,
        priceChanged,
        outOfStock,
        quantityExceedsStock,
        hasIssue: priceChanged || outOfStock || quantityExceedsStock,
      };
    });

    const hasIssues = validatedItems.some((i) => i.hasIssue);

    res.status(200).json({
      status: 'success',
      data: { hasIssues, items: validatedItems },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCart,
  getCartCount,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  mergeCart,
  validateCart,
};
