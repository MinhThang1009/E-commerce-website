/**
 * @file cartService.js
 * @layer Service
 * @module cart
 * @description Business logic layer cho cart
 */
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('@shared/errors');

// Cart Service — business logic giỏ hàng (guest qua sessionId cookie + user
// qua userId). KHÔNG import Sequelize/Model trực tiếp.
//
// Service chia 2 nhóm method:
//   - Use case API: getCart/addToCart/updateCartItem/...
//   - Helper nội bộ: resolveCart(req-like ctx) để 4 use case khác không lặp
//
// Service trả về plain object — controller serialize bằng DTO.
class CartService {
  constructor({ cartRepository, eventBus, logger }) {
    this.cartRepository = cartRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // ---------- Helpers ----------

  // Build response data y hệt controller cũ — items kèm Product/Variant/
  // warrantyPackages, totalItems, subtotal.
  async _buildCartResponse(cart) {
    const cartItems = await this.cartRepository.findCartItemsWithDetails(cart.id);

    const items = await Promise.all(
      cartItems.map(async (item) => {
        const itemData = item.toJSON();

        if (itemData.Product) {
          const p = itemData.Product;
          // Stock thực nằm ở variant level — tính tổng stock từ tất cả variants
          const variantStock = (p.variants || []).reduce((s, v) => s + (v.stockQuantity || 0), 0);
          p.stockQuantity = variantStock || (p.defaultVariant ? p.defaultVariant.stockQuantity : 0);
          p.inStock =
            variantStock > 0 || (p.defaultVariant ? p.defaultVariant.stockQuantity > 0 : false);

          if (p.productImages && p.productImages.length > 0) {
            // Ưu tiên ảnh theo variantId, fallback về thumbnail chính
            const variantImg = itemData.variantId
              ? p.productImages.find(
                  (img) =>
                    img.variant_id === itemData.variantId || img.variantId === itemData.variantId,
                )
              : null;
            const primaryImg =
              variantImg ||
              p.productImages.find(
                (img) => img.isThumbnail === true || img.is_thumbnail === true,
              ) ||
              p.productImages[0];
            p.thumbnail = primaryImg.imageUrl;
          } else {
            p.thumbnail = p.thumbnail || null;
          }

          // Ưu tiên giá từ defaultVariant (variant product có base_price=0)
          const variantPrice = p.defaultVariant?.price ? parseFloat(p.defaultVariant.price) : null;
          const minVariantPrice =
            variantPrice ||
            (() => {
              const prices = (p.variants || []).map((v) => parseFloat(v.price)).filter(Boolean);
              return prices.length ? Math.min(...prices) : null;
            })();
          p.price = minVariantPrice || parseFloat(p.basePrice) || 0;
          delete p.productImages;
          delete p.defaultVariant;
          delete p.variants;
        }

        if (itemData.warrantyPackageIds && itemData.warrantyPackageIds.length > 0) {
          const warranties = await this.cartRepository.findActiveWarrantyPackagesByIds(
            itemData.warrantyPackageIds,
          );
          itemData.warrantyPackages = warranties.map((w) => ({
            id: w.id,
            name: w.name,
            price: w.price,
            durationMonths: w.durationMonths,
          }));
        } else {
          itemData.warrantyPackages = [];
        }

        return itemData;
      }),
    );

    const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => {
      let price;
      if (item.ProductVariant) {
        price = item.ProductVariant.price;
      } else if (item.Product) {
        price = item.Product.basePrice;
      } else {
        price = 0;
      }

      const warrantyPrice = item.warrantyPackages.reduce((s, w) => s + parseFloat(w.price), 0);

      return sum + price * item.quantity + warrantyPrice * item.quantity;
    }, 0);

    return { id: cart.id, items, totalItems, subtotal };
  }

  // Stock check helper — variant ưu tiên, fallback về defaultVariant của
  // product. Throw nếu vượt stock.
  _assertStock({ product, variant, quantity }) {
    const baseStockQuantity = product.defaultVariant ? product.defaultVariant.stockQuantity : 0;
    if (variant) {
      if (variant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (baseStockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }
  }

  // ---------- Use cases ----------

  // Lấy giỏ hàng. User → tự động merge guest cart nếu cookie sessionId tồn tại.
  // Guest → tạo cart bằng sessionId. Không có sessionId → trả empty cart.
  async getCart({ user, cookieSessionId }) {
    let cart;

    if (user) {
      cart = await this.cartRepository.findOrCreateActiveCartByUserId(user.id);

      if (cookieSessionId) {
        const guestCart = await this.cartRepository.findActiveCartBySessionId(cookieSessionId);
        if (guestCart) {
          const guestItems = await this.cartRepository.findCartItemsByCartId(guestCart.id);
          if (guestItems.length > 0) {
            this.logger.info(
              `Đang gộp giỏ hàng khách ${guestCart.id} vào giỏ hàng người dùng ${cart.id}`,
            );
            for (const guestItem of guestItems) {
              const existing = await this.cartRepository.findCartItemMatching({
                cartId: cart.id,
                productId: guestItem.productId,
                variantId: guestItem.variantId,
              });
              if (existing) {
                existing.quantity = existing.quantity + guestItem.quantity;
                await this.cartRepository.saveCartItem(existing);
                await this.cartRepository.deleteCartItem(guestItem);
              } else {
                guestItem.cartId = cart.id;
                await this.cartRepository.saveCartItem(guestItem);
              }
            }
            guestCart.status = 'merged';
            await this.cartRepository.saveCart(guestCart);
          }
        }
      }
    } else {
      if (!cookieSessionId) {
        return { data: { id: null, items: [], totalItems: 0, subtotal: 0 } };
      }
      cart = await this.cartRepository.findOrCreateActiveCartBySessionId(cookieSessionId);
    }

    const data = await this._buildCartResponse(cart);
    return { data };
  }

  // Đếm số lượng item trong giỏ
  async getCartCount({ user, cookieSessionId }) {
    let cart;
    if (user) {
      cart = await this.cartRepository.findActiveCartByUserId(user.id);
    } else {
      if (!cookieSessionId) return { count: 0 };
      cart = await this.cartRepository.findActiveCartBySessionId(cookieSessionId);
    }

    if (!cart) return { count: 0 };

    const count = await this.cartRepository.sumCartItemQuantity(cart.id);
    return { count: count || 0 };
  }

  // Thêm sản phẩm vào giỏ. Tạo cart nếu chưa có. Guest → cấp sessionId mới
  // qua callback setSessionCookie để controller set cookie response.
  async addToCart({ user, cookieSessionId, body, setSessionCookie }) {
    const { productId, variantId, quantity = 1, warrantyPackageIds = [] } = body;

    const product = await this.cartRepository.findProductById(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    const baseStockQuantity = product.defaultVariant ? product.defaultVariant.stockQuantity : 0;
    const baseInStock = baseStockQuantity > 0;

    if (!baseInStock && !variantId) {
      throw new AppError('Sản phẩm đã hết hàng', 400);
    }

    let variant = null;
    if (variantId) {
      variant = await this.cartRepository.findVariantByIdAndProductId(variantId, productId);
      if (!variant) {
        throw new AppError('Biến thể sản phẩm không tồn tại', 404);
      }
    }
    this._assertStock({ product, variant, quantity });

    let validWarrantyPackageIds = [];
    if (warrantyPackageIds && warrantyPackageIds.length > 0) {
      const warranties =
        await this.cartRepository.findActiveWarrantyPackagesByIds(warrantyPackageIds);
      if (warranties.length !== warrantyPackageIds.length) {
        throw new AppError('Một hoặc nhiều gói bảo hành không hợp lệ', 400);
      }
      validWarrantyPackageIds = warranties.map((w) => w.id);
    }

    let nextSessionId = cookieSessionId;

    await this.cartRepository.runInTransaction(async (transaction) => {
      let cart;
      if (user) {
        cart = await this.cartRepository.findOrCreateActiveCartByUserId(user.id, { transaction });
      } else {
        if (!nextSessionId) {
          nextSessionId = uuidv4();
          if (typeof setSessionCookie === 'function') {
            setSessionCookie(nextSessionId);
          }
        }
        cart = await this.cartRepository.findOrCreateActiveCartBySessionId(nextSessionId, {
          transaction,
        });
      }

      const existing = await this.cartRepository.findCartItemMatching(
        {
          cartId: cart.id,
          productId,
          variantId: variantId || null,
          warrantyPackageIds: validWarrantyPackageIds,
        },
        { transaction },
      );

      if (existing) {
        const newQuantity = existing.quantity + quantity;
        this._assertStock({ product, variant, quantity: newQuantity });
        existing.quantity = newQuantity;
        await this.cartRepository.saveCartItem(existing, { transaction });
      } else {
        await this.cartRepository.createCartItem(
          {
            cartId: cart.id,
            productId,
            variantId: variantId || null,
            quantity,
            unitPrice: variant ? variant.price : product.basePrice,
            warrantyPackageIds: validWarrantyPackageIds,
          },
          { transaction },
        );
      }
    });

    return this.getCart({ user, cookieSessionId: nextSessionId });
  }

  // Cập nhật quantity item — kiểm tra ownership + stock.
  async updateCartItem({ user, cookieSessionId, itemId, quantity }) {
    const cartItem = await this.cartRepository.findCartItemByIdWithCartAndStock(itemId);
    if (!cartItem) {
      throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);
    }

    this._assertOwnership(cartItem, user, cookieSessionId);

    const baseStockQuantity = cartItem.Product.defaultVariant
      ? cartItem.Product.defaultVariant.stockQuantity
      : 0;
    if (cartItem.ProductVariant) {
      if (cartItem.ProductVariant.stockQuantity < quantity) {
        throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
      }
    } else if (baseStockQuantity < quantity) {
      throw new AppError('Số lượng vượt quá số lượng tồn kho', 400);
    }

    cartItem.quantity = quantity;
    await this.cartRepository.saveCartItem(cartItem);

    return this.getCart({ user, cookieSessionId });
  }

  async removeCartItem({ user, cookieSessionId, itemId }) {
    const cartItem = await this.cartRepository.findCartItemByIdWithCartAndStock(itemId);
    if (!cartItem) {
      throw new AppError('Không tìm thấy sản phẩm trong giỏ hàng', 404);
    }

    this._assertOwnership(cartItem, user, cookieSessionId);
    await this.cartRepository.deleteCartItem(cartItem);

    return this.getCart({ user, cookieSessionId });
  }

  async clearCart({ user, cookieSessionId }) {
    let cart;
    if (user) {
      cart = await this.cartRepository.findActiveCartByUserId(user.id);
    } else {
      if (!cookieSessionId) {
        return { message: 'cart.alreadyEmpty' };
      }
      cart = await this.cartRepository.findActiveCartBySessionId(cookieSessionId);
    }

    if (!cart) return { message: 'cart.alreadyEmpty' };

    await this.cartRepository.clearCartItems(cart.id);

    return {
      message: 'cart.cleared',
      data: { id: cart.id, items: [], totalItems: 0, subtotal: 0 },
    };
  }

  // Đồng bộ cart từ local storage (FE → BE). Chỉ user đã login.
  async syncCart({ user, cookieSessionId, items }) {
    if (!user) {
      throw new AppError('Bạn cần đăng nhập để đồng bộ giỏ hàng', 401);
    }

    await this.cartRepository.runInTransaction(async (transaction) => {
      const cart = await this.cartRepository.findOrCreateActiveCartByUserId(user.id, {
        transaction,
      });
      await this.cartRepository.clearCartItems(cart.id, { transaction });

      for (const item of items) {
        const { productId, variantId, quantity } = item;
        const product = await this.cartRepository.findProductById(productId);
        const baseStockQuantity =
          product && product.defaultVariant ? product.defaultVariant.stockQuantity : 0;

        if (!product || (baseStockQuantity <= 0 && !variantId)) continue;

        if (variantId) {
          const variant = await this.cartRepository.findVariantByIdAndProductId(
            variantId,
            productId,
          );
          if (!variant) continue;

          const actualQuantity = Math.min(quantity, variant.stockQuantity);
          if (actualQuantity > 0) {
            await this.cartRepository.createCartItem(
              {
                cartId: cart.id,
                productId,
                variantId,
                quantity: actualQuantity,
                unitPrice: variant.price,
              },
              { transaction },
            );
          }
        } else {
          const actualQuantity = Math.min(quantity, baseStockQuantity);
          if (actualQuantity > 0) {
            await this.cartRepository.createCartItem(
              {
                cartId: cart.id,
                productId,
                quantity: actualQuantity,
                unitPrice: product.basePrice || 0,
              },
              { transaction },
            );
          }
        }
      }
    });

    return this.getCart({ user, cookieSessionId });
  }

  // Gộp guest cart vào user cart sau khi login. Refresh giá để tránh stale.
  async mergeCart({ user, cookieSessionId, clearSessionCookie }) {
    if (!user) {
      throw new AppError('Bạn cần đăng nhập để thực hiện chức năng này', 401);
    }

    if (!cookieSessionId) {
      return this.getCart({ user, cookieSessionId });
    }

    const sessionCart = await this.cartRepository.findActiveCartBySessionId(cookieSessionId);
    if (!sessionCart) {
      return this.getCart({ user, cookieSessionId });
    }

    await this.cartRepository.runInTransaction(async (transaction) => {
      const userCart = await this.cartRepository.findOrCreateActiveCartByUserId(user.id, {
        transaction,
      });
      const sessionItems = await this.cartRepository.findCartItemsForMerge(sessionCart.id, {
        transaction,
      });

      for (const sessionItem of sessionItems) {
        const existingUserItem = await this.cartRepository.findCartItemMatching(
          {
            cartId: userCart.id,
            productId: sessionItem.productId,
            variantId: sessionItem.variantId || null,
          },
          { transaction },
        );

        const currentPrice = sessionItem.ProductVariant
          ? parseFloat(sessionItem.ProductVariant.price)
          : parseFloat(sessionItem.Product.basePrice);

        if (existingUserItem) {
          const newQuantity = existingUserItem.quantity + sessionItem.quantity;
          const baseStockQuantity = sessionItem.Product.defaultVariant
            ? sessionItem.Product.defaultVariant.stockQuantity
            : 0;
          const maxStock = sessionItem.ProductVariant
            ? sessionItem.ProductVariant.stockQuantity
            : baseStockQuantity;
          const finalQuantity = Math.min(newQuantity, maxStock);

          existingUserItem.quantity = finalQuantity;
          existingUserItem.price = currentPrice;
          await this.cartRepository.saveCartItem(existingUserItem, { transaction });
          await this.cartRepository.deleteCartItem(sessionItem, { transaction });
        } else {
          sessionItem.cartId = userCart.id;
          sessionItem.price = currentPrice;
          await this.cartRepository.saveCartItem(sessionItem, { transaction });
        }
      }

      sessionCart.status = 'merged';
      await this.cartRepository.saveCart(sessionCart, { transaction });
    });

    if (typeof clearSessionCookie === 'function') {
      clearSessionCookie();
    }

    return this.getCart({ user, cookieSessionId: null });
  }

  // Validate cart — phát hiện thay đổi giá, hết hàng, quantity vượt stock.
  async validateCart({ user, cookieSessionId }) {
    let cart;
    if (user) {
      cart = await this.cartRepository.findActiveCartByUserId(user.id);
    } else {
      if (!cookieSessionId) return { hasIssues: false, items: [] };
      cart = await this.cartRepository.findActiveCartBySessionId(cookieSessionId);
    }

    if (!cart) return { hasIssues: false, items: [] };

    const cartItems = await this.cartRepository.findCartItemsForValidation(cart.id);

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

      const currentPrice = item.ProductVariant
        ? item.ProductVariant.price
        : (item.Product?.basePrice ?? 0);
      const baseStockQuantity = item.Product.defaultVariant
        ? item.Product.defaultVariant.stockQuantity
        : 0;
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
        name: item.ProductVariant
          ? `${item.Product.name} - ${item.ProductVariant.name}`
          : item.Product.name,
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

    return { hasIssues: validatedItems.some((i) => i.hasIssue), items: validatedItems };
  }

  // ---------- Internal ----------

  _assertOwnership(cartItem, user, cookieSessionId) {
    if (user) {
      if (cartItem.Cart.userId !== user.id) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    } else {
      if (!cookieSessionId || cartItem.Cart.sessionId !== cookieSessionId) {
        throw new AppError('Bạn không có quyền truy cập giỏ hàng này', 403);
      }
    }
  }
}

module.exports = CartService;
