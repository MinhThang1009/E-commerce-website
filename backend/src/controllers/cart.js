const {
  Cart,
  CartItem,
  Product,
  ProductVariant,
  WarrantyPackage,
  sequelize,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Lấy giỏ hàng
const getCart = async (req, res, next) => {
  try {
    let cart;

    const { sessionId: cookieSessionId } = req.cookies;

    if (req.user) {
      // Người dùng đã đăng nhập - lấy hoặc tạo giỏ hàng
      [cart] = await Cart.findOrCreate({
        where: {
          userId: req.user.id,
          status: 'active',
        },
        defaults: {
          userId: req.user.id,
        },
      });

      // Gộp giỏ hàng khách nếu tồn tại session ID
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
          logger.info(`Đang gộp giỏ hàng khách ${guestCart.id} vào giỏ hàng người dùng ${cart.id}`);
          for (const guestItem of guestCart.items) {
            // Kiểm tra sản phẩm đã có trong giỏ hàng người dùng chưa
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
          // Đánh dấu giỏ hàng khách là đã gộp hoặc xóa đi
          await guestCart.update({ status: 'merged' });
        }
      }
    } else {
      // Khách vãng lai - lấy hoặc tạo giỏ hàng theo session ID
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

    // Lấy các mục giỏ hàng kèm thông tin sản phẩm
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

    // Lấy gói bảo hành cho các mục giỏ hàng có đăng ký
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
          
          // Đảm bảo trường price tồn tại để tính toán sau
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

    // Tính tổng giỏ hàng
    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cartItemsWithWarranties.reduce((sum, item) => {
      const price = item.ProductVariant
        ? item.ProductVariant.price
        : (item.Product ? item.Product.basePrice : 0);

      // Tính giá bảo hành
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
    logger.error('[LỖI] getCart thất bại:', error);
    next(error);
  }
};

// Thêm sản phẩm vào giỏ hàng
const addToCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      productId,
      variantId,
      quantity = 1,
      warrantyPackageIds = [],
    } = req.body;

    // Kiểm tra sản phẩm
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

    // Kiểm tra variant nếu được cung cấp
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

    // Kiểm tra gói bảo hành nếu được cung cấp
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

    // Lấy hoặc tạo giỏ hàng mới
    let cart;

    if (req.user) {
      // Người dùng đã đăng nhập
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

      // Lưu ý: Việc gộp giỏ hàng hiện được xử lý bởi endpoint /merge riêng
      // khi người dùng đăng nhập, không thực hiện trong addToCart để tránh trùng lặp
    } else {
      // Khách vãng lai
      let { sessionId } = req.cookies;

      if (!sessionId) {
        sessionId = uuidv4();
        res.cookie('sessionId', sessionId, {
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
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

    // Kiểm tra sản phẩm đã có trong giỏ hàng chưa (kể cả gói bảo hành giống nhau)
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
      // Cập nhật số lượng
      const newQuantity = cartItem.quantity + quantity;

      // Kiểm tra tồn kho
      if (variantId) {
        if (variant.stockQuantity < newQuantity) {
          throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
        }
      } else if (baseStockQuantity < newQuantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }

      await cartItem.update({ quantity: newQuantity }, { transaction });
    } else {
      // Tạo mục giỏ hàng mới
      cartItem = await CartItem.create(
        {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          quantity,
          unitPrice: variantId ? variant.price : product.basePrice,
          warrantyPackageIds: validWarrantyPackageIds,
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Cập nhật số lượng sản phẩm trong giỏ
const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Tìm mục giỏ hàng
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

    // Kiểm tra quyền sở hữu giỏ hàng
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

    // Kiểm tra tồn kho
    const baseStockQuantity = cartItem.Product.defaultVariant ? cartItem.Product.defaultVariant.stockQuantity : 0;

    if (cartItem.ProductVariant) {
      if (cartItem.ProductVariant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (baseStockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    // Cập nhật số lượng
    await cartItem.update({ quantity });

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Xóa sản phẩm khỏi giỏ hàng
const removeCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Tìm mục giỏ hàng
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

    // Kiểm tra quyền sở hữu giỏ hàng
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

    // Xóa mục giỏ hàng
    await cartItem.destroy();

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    next(error);
  }
};

// Xóa toàn bộ giỏ hàng
const clearCart = async (req, res, next) => {
  try {
    let cartId;

    if (req.user) {
      // Người dùng đã đăng nhập
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
      // Khách vãng lai
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

    // Xóa tất cả mục giỏ hàng
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

// Lấy số lượng sản phẩm trong giỏ
const getCartCount = async (req, res, next) => {
  try {
    let cart;

    if (req.user) {
      // Người dùng đã đăng nhập
      cart = await Cart.findOne({
        where: {
          userId: req.user.id,
          status: 'active',
        },
      });
    } else {
      // Khách vãng lai
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

    // Đếm tổng số lượng sản phẩm
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

// Đồng bộ giỏ hàng từ local storage lên server
const syncCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { items } = req.body;

    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để đồng bộ giỏ hàng', 401);
    }

    // Lấy hoặc tạo giỏ hàng người dùng
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

    // Xóa giỏ hàng hiện tại
    await CartItem.destroy({
      where: { cartId: cart.id },
      transaction,
    });

    // Thêm các sản phẩm từ request
    for (const item of items) {
      const { productId, variantId, quantity } = item;

      // Kiểm tra sản phẩm
      const product = await Product.findByPk(productId, { include: [{ association: 'defaultVariant' }] });
      const baseStockQuantity = product && product.defaultVariant ? product.defaultVariant.stockQuantity : 0;

      if (!product || (baseStockQuantity <= 0 && !variantId)) {
        continue; // Bỏ qua sản phẩm không hợp lệ
      }

      // Kiểm tra variant nếu được cung cấp
      if (variantId) {
        const variant = await ProductVariant.findOne({
          where: { id: variantId, productId },
        });

        if (!variant) {
          continue; // Bỏ qua variant không hợp lệ
        }

        // Kiểm tra tồn kho và thêm vào giỏ
        const actualQuantity = Math.min(quantity, variant.stockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create(
            {
              cartId: cart.id,
              productId,
              variantId,
              quantity: actualQuantity,
              unitPrice: variant.price,
            },
            { transaction }
          );
        }
      } else {
        // Kiểm tra tồn kho và thêm vào giỏ
        const actualQuantity = Math.min(quantity, baseStockQuantity);
        if (actualQuantity > 0) {
          await CartItem.create(
            {
              cartId: cart.id,
              productId,
              quantity: actualQuantity,
              unitPrice: product.basePrice || 0,
            },
            { transaction }
          );
        }
      }
    }

    await transaction.commit();

    // Trả về giỏ hàng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Gộp giỏ hàng khách vào giỏ hàng người dùng (gọi khi đăng nhập)
const mergeCart = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    if (!req.user) {
      throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);
    }

    const { sessionId } = req.cookies;
    if (!sessionId) {
      // Không có giỏ hàng session để gộp, trả về giỏ hàng người dùng
      return getCart(req, res, next);
    }

    // Tìm giỏ hàng session
    const sessionCart = await Cart.findOne({
      where: {
        sessionId,
        status: 'active',
      },
    });

    if (!sessionCart) {
      // Không có giỏ hàng session để gộp, trả về giỏ hàng người dùng
      return getCart(req, res, next);
    }

    // Lấy hoặc tạo giỏ hàng người dùng
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

    // Lấy các mục giỏ hàng session
    const sessionItems = await CartItem.findAll({
      where: { cartId: sessionCart.id },
      include: [
        {
          model: Product,
          attributes: ['id', 'basePrice'],
          include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity', 'price'] }]
        },
        {
          model: ProductVariant,
          attributes: ['id', 'stockQuantity', 'price'],
        },
      ],
      transaction,
    });

    // Gộp từng mục session vào giỏ hàng người dùng
    for (const sessionItem of sessionItems) {
      // Kiểm tra sản phẩm đã có trong giỏ người dùng chưa
      const existingUserItem = await CartItem.findOne({
        where: {
          cartId: userCart.id,
          productId: sessionItem.productId,
          variantId: sessionItem.variantId || null,
        },
        transaction,
      });

      // Lấy giá hiện tại từ variant hoặc product (tránh stale price)
      const currentPrice = sessionItem.ProductVariant
        ? parseFloat(sessionItem.ProductVariant.price)
        : parseFloat(sessionItem.Product.basePrice);

      if (existingUserItem) {
        // Gộp số lượng
        const newQuantity = existingUserItem.quantity + sessionItem.quantity;
        const baseStockQuantity = sessionItem.Product.defaultVariant ? sessionItem.Product.defaultVariant.stockQuantity : 0;
        const maxStock = sessionItem.ProductVariant
          ? sessionItem.ProductVariant.stockQuantity
          : baseStockQuantity;

        const finalQuantity = Math.min(newQuantity, maxStock);

        await existingUserItem.update(
          { quantity: finalQuantity, price: currentPrice },
          { transaction }
        );

        // Xóa mục session sau khi gộp xong
        await sessionItem.destroy({ transaction });
      } else {
        // Chuyển mục sang giỏ hàng người dùng, refresh giá
        await sessionItem.update({ cartId: userCart.id, price: currentPrice }, { transaction });
      }
    }

    // Đánh dấu giỏ hàng session là đã gộp
    await sessionCart.update({ status: 'merged' }, { transaction });

    await transaction.commit();

    // Xóa cookie session để tránh gộp trùng lặp
    res.clearCookie('sessionId');

    // Trả về giỏ hàng người dùng đã cập nhật
    return getCart(req, res, next);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Kiểm tra hợp lệ các mục giỏ hàng (kiểm tra tồn kho và thay đổi giá)
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
          attributes: ['id', 'name', 'basePrice'],
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
      
      const currentPrice = item.ProductVariant ? item.ProductVariant.price : item.Product.basePrice;
      const baseStockQuantity = item.Product.defaultVariant ? item.Product.defaultVariant.stockQuantity : 0;
      const currentStock = item.ProductVariant
        ? item.ProductVariant.stockQuantity
        : baseStockQuantity;
      const isInStock = currentStock > 0;
      const priceChanged = parseFloat(currentPrice) !== parseFloat(item.unitPrice);
      const outOfStock = !isInStock;
      const quantityExceedsStock = isInStock && item.quantity > currentStock;

      return {
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        name: item.ProductVariant ? `${item.Product.name} - ${item.ProductVariant.name}` : item.Product.name,
        savedPrice: parseFloat(item.unitPrice),
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
