/**
 * @file adminProductService.js
 * @layer Service
 * @module admin
 * @description CRUD products, stock management, clone cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const sequelize = adminRepository.getSequelize();
const Op = adminRepository.getOp();
const Sequelize = adminRepository.getSequelizeFns();
const {
  Product,
  ProductImage,
  ProductSpecification,
  ProductVariant,
  ProductAttribute,
  ProductCategory,
  Category,
  CartItem,
  InventoryLog,
} = adminRepository.getModels();

const logger = require('@utils/logger');
const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
} = require('@utils/product-helpers');
const vectorStoreService = require('@services/vector-store/vector-store');

function deepParseJSON(val) {
  let parsed = val;
  let maxAttempts = 5;
  try {
    while (typeof parsed === 'string' && maxAttempts-- > 0) {
      parsed = JSON.parse(parsed);
    }
    if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
      return parsed;
    }
  } catch (_) {
    // không parse được → trả về object rỗng
  }
  return {};
}

const getProductById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await adminRepository.findProductById(id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'productAttributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
      {
        model: ProductImage,
        as: 'productImages',
        required: false,
      },
    ],
  });

  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  const productJson = product.toJSON();

  if (productJson.attributes && Array.isArray(productJson.attributes)) {
    productJson.attributes = productJson.attributes.map((attr) => ({
      ...attr,
      values: Array.isArray(attr.values) ? attr.values : [],
    }));
  }

  if (productJson.variants && Array.isArray(productJson.variants)) {
    productJson.variants = productJson.variants.map((v) => ({
      ...v,
      attributes: deepParseJSON(v.attributes),
    }));
  }

  res.status(200).json({
    status: 'success',
    data: { product: productJson },
  });
});

const createProduct = catchAsync(async (req, res) => {
  logger.info('Dữ liệu request tạo sản phẩm:', JSON.stringify(req.body, null, 2));
  const {
    name,
    baseName,
    description,
    shortDescription,
    basePrice: basePriceField,
    price: priceField,
    comparePrice,
    stock,
    sku,
    status = 'active',
    images,
    stockQuantity = 0,
    featured = false,
    seoTitle,
    seoDescription,
    seoKeywords = [],
    categoryIds = [],
    attributes = [],
    variants = [],
    condition = 'new',
    specifications = {},
    faqs = [],
  } = req.body;

  const price = basePriceField !== undefined ? basePriceField : priceField;

  const uniqueSku = sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const product = await adminRepository.createProductFull({
    name,
    baseName: baseName || name,
    description,
    shortDescription: shortDescription || description,
    basePrice: price,
    compareAtPrice: null,
    stockQuantity: stock || stockQuantity || 0,
    status,
    isFeatured: featured,
    seoTitle: seoTitle || name,
    seoDescription: seoDescription || description,
    seoKeywords: seoKeywords || [],
    condition,
    specifications: specifications || [],
    faqs: faqs || [],
  });

  logger.info('comparePrice từ request:', comparePrice);
  if (comparePrice !== undefined) {
    await sequelize.query('UPDATE products SET compare_at_price = :comparePrice WHERE id = :id', {
      replacements: {
        comparePrice: comparePrice,
        id: product.id,
      },
      type: sequelize.QueryTypes.UPDATE,
    });

    product.compareAtPrice = comparePrice;
  }

  if (categoryIds && categoryIds.length > 0) {
    try {
      const categoryPromises = categoryIds.map(async (catId) => {
        let category = await adminRepository.findCategoryById(catId).catch(() => null);

        if (!category && /^\d+$/.test(catId)) {
          category = await adminRepository.createCategory({
            name: `Category ${catId}`,
            slug: `category-${catId}`,
            description: `Category được tạo tự động từ ID ${catId}`,
            isActive: true,
          });
        }

        return category ? category.id : null;
      });

      const validCategoryIds = (await Promise.all(categoryPromises)).filter((id) => id !== null);

      if (validCategoryIds.length > 0) {
        await product.setCategories(validCategoryIds);
      }
    } catch (error) {
      logger.error('Lỗi khi xử lý categories:', error);
    }
  }

  if (attributes && attributes.length > 0) {
    try {
      logger.info('Đang xử lý attributes:', attributes);
      const attributePromises = attributes.map(async (attr) => {
        let attrValues = [];
        if (typeof attr.value === 'string') {
          attrValues = attr.value
            .split(',')
            .map((v) => v.trim())
            .filter((v) => v);
        } else if (Array.isArray(attr.value)) {
          attrValues = attr.value;
        } else if (attr.value) {
          attrValues = [String(attr.value)];
        }

        logger.info(`Tạo attribute: ${attr.name} với values:`, attrValues);

        return await adminRepository.createProductAttribute({
          productId: product.id,
          name: attr.name,
          values: attrValues.length > 0 ? attrValues : ['Default'],
        });
      });
      await Promise.all(attributePromises);
    } catch (error) {
      logger.error('Lỗi khi tạo attributes:', error);
      throw error;
    }
  }

  let createdVariants = [];
  if (variants && variants.length > 0) {
    try {
      logger.info('Đang xử lý variants:', variants);

      const productAttributes = await adminRepository.findProductAttributes({
        productId: product.id,
      });

      const variantPromises = variants.map(async (variant) => {
        const variantAttributes =
          variant.attributes &&
          typeof variant.attributes === 'object' &&
          !Array.isArray(variant.attributes)
            ? variant.attributes
            : {};

        logger.info(`Đang xử lý variant: ${variant.name}`, {
          price: variant.price,
          stock: variant.stock,
          sku: variant.sku,
          attributes: variantAttributes,
        });

        const variantSku = variant.sku || generateVariantSku(uniqueSku, variantAttributes);

        logger.info(`Tạo variant với SKU: ${variantSku}`);

        const displayName =
          variant.displayName ||
          (variantAttributes && Object.values(variantAttributes).length > 0
            ? Object.values(variantAttributes).join(' - ')
            : variant.name);

        return await adminRepository.createProductVariant({
          productId: product.id,
          variantName: variant.name || variant.variantName || displayName || variantSku,
          sku: variantSku,
          attributes: variantAttributes,
          price: parseFloat(variant.price) || 0,
          stockQuantity: parseInt(variant.stock) || 0,
          images: variant.images || [],
          displayName,
          sortOrder: variant.sortOrder || 0,
          isDefault: variant.isDefault || false,
          isAvailable: variant.isAvailable !== false,
        });
      });

      createdVariants = await Promise.all(variantPromises);

      const totalStock = calculateTotalStock(createdVariants);
      await adminRepository.updateProductWhere({ stockQuantity: totalStock }, { id: product.id });
    } catch (error) {
      logger.error('Lỗi khi tạo variants:', error);
      throw error;
    }
  }

  if (images && Array.isArray(images) && images.length > 0) {
    try {
      const imageData = images.map((img, index) => {
        if (typeof img === 'string') {
          return {
            productId: product.id,
            imageUrl: img,
            isThumbnail: index === 0,
            color: null,
            variantId: null,
          };
        }
        return {
          productId: product.id,
          imageUrl: img.url || img.imageUrl,
          isThumbnail: img.isThumbnail || index === 0,
          color: img.color || null,
          variantId: img.variantId || null,
        };
      });
      await adminRepository.bulkCreateProductImages(imageData);
      logger.info(`Đã tạo ${images.length} ảnh cho sản phẩm ${product.id}`);
    } catch (error) {
      logger.error('Lỗi khi tạo ảnh:', error);
    }
  }

  if (specifications && Array.isArray(specifications) && specifications.length > 0) {
    try {
      const specificationData = specifications.map((spec, index) => ({
        productId: product.id,
        name: spec.name,
        value: spec.value,
        category: spec.category || 'General',
        sortOrder: spec.sortOrder || index,
      }));

      await adminRepository.bulkCreateProductSpecs(specificationData);
      logger.info(`Đã tạo ${specifications.length} thông số kỹ thuật cho sản phẩm ${product.id}`);
    } catch (error) {
      logger.error('Lỗi khi tạo specifications:', error);
    }
  }

  const productWithRelations = await adminRepository.findProductById(product.id, {
    include: [
      {
        model: Category,
        as: 'categories',
        through: { attributes: [] },
      },
      {
        model: ProductAttribute,
        as: 'productAttributes',
      },
      {
        model: ProductVariant,
        as: 'variants',
      },
      {
        model: ProductImage,
        as: 'productImages',
        attributes: ['imageUrl', 'isThumbnail'],
        required: false,
      },
      {
        model: ProductSpecification,
        as: 'productSpecifications',
      },
    ],
  });

  try {
    const { enrichProductData } = require('@utils/product-helpers');
    await vectorStoreService.loadPromise;
    if (productWithRelations.status === 'active') {
      await vectorStoreService.upsertProduct(enrichProductData(productWithRelations.toJSON()));
      await vectorStoreService.save();
    }
  } catch (syncErr) {
    logger.error('Lỗi đồng bộ vector store sau khi tạo sản phẩm:', syncErr.message);
  }

  res.status(201).json({
    status: 'success',
    data: { product: productWithRelations },
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    baseName,
    description,
    shortDescription,
    price,
    compareAtPrice,
    comparePrice,
    images,
    stockQuantity,
    sku,
    status,
    isFeatured: featured,
    seoTitle,
    seoDescription,
    seoKeywords,
    categoryIds,
    attributes = [],
    variants = [],
    specifications = [],
    faqs = [],
    condition,
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const product = await adminRepository.findProductById(id, { transaction });
    if (!product) {
      await transaction.rollback();
      throw new AppError('Không tìm thấy sản phẩm', 404);
    }

    const changes = {};
    if (name && name !== product.name) changes.name = { from: product.name, to: name };
    if (price && price !== product.basePrice)
      changes.price = { from: product.basePrice, to: price };

    const updateData = {};
    if (req.body.hasOwnProperty('name')) updateData.name = name;
    if (req.body.hasOwnProperty('baseName')) updateData.baseName = req.body.baseName || name;
    if (req.body.hasOwnProperty('description')) updateData.description = description;
    if (req.body.hasOwnProperty('shortDescription')) updateData.shortDescription = shortDescription;
    if (req.body.hasOwnProperty('price')) updateData.basePrice = parseFloat(price?.toString()) || 0;
    if (req.body.hasOwnProperty('stockQuantity'))
      updateData.stockQuantity = parseInt(stockQuantity?.toString()) || 0;
    if (req.body.hasOwnProperty('status')) updateData.status = status;
    if (req.body.hasOwnProperty('featured')) updateData.isFeatured = featured;
    if (req.body.hasOwnProperty('condition')) updateData.condition = condition;
    if (req.body.hasOwnProperty('seoTitle')) updateData.seoTitle = seoTitle;
    if (req.body.hasOwnProperty('seoDescription')) updateData.seoDescription = seoDescription;
    if (req.body.hasOwnProperty('seoKeywords')) updateData.seoKeywords = seoKeywords;
    if (req.body.hasOwnProperty('faqs')) updateData.faqs = faqs;

    await product.update(updateData, { transaction });

    if (req.body.hasOwnProperty('images') && Array.isArray(images)) {
      await adminRepository.destroyProductImages({ productId: id }, { transaction });

      if (images.length > 0) {
        const imageData = images.map((img, index) => {
          if (typeof img === 'string') {
            return {
              productId: id,
              imageUrl: img,
              isThumbnail: index === 0,
              color: null,
              variantId: null,
            };
          }
          return {
            productId: id,
            imageUrl: img.url || img.imageUrl,
            isThumbnail: img.isThumbnail || index === 0,
            color: img.color || null,
            variantId: img.variantId || null,
          };
        });
        await adminRepository.bulkCreateProductImages(imageData, { transaction });
      }
      changes.imageCount = images.length;
    }

    const priceToCompare = req.body.hasOwnProperty('compareAtPrice')
      ? compareAtPrice
      : req.body.hasOwnProperty('comparePrice')
        ? comparePrice
        : null;

    if (req.body.hasOwnProperty('compareAtPrice') || req.body.hasOwnProperty('comparePrice')) {
      await sequelize.query(
        'UPDATE products SET compare_at_price = :compareAtPrice WHERE id = :id',
        {
          replacements: {
            compareAtPrice: priceToCompare === '' ? null : priceToCompare,
            id: id,
          },
          type: sequelize.QueryTypes.UPDATE,
          transaction,
        },
      );
    }

    if (req.body.hasOwnProperty('categoryIds') && Array.isArray(categoryIds)) {
      const categories = await adminRepository.findCategories({
        where: { id: categoryIds },
        transaction,
      });
      await product.setCategories(categories, { transaction });
      changes.categories = categoryIds;
    }

    if (req.body.hasOwnProperty('attributes') && Array.isArray(attributes)) {
      const currentAttributes = await adminRepository.findProductAttributes(
        { productId: id },
        { transaction },
      );
      const currentAttrMap = currentAttributes.reduce((map, attr) => {
        map[attr.name] = attr;
        return map;
      }, {});

      const newAttrNames = new Set(attributes.map((a) => a.name));

      for (const attr of currentAttributes) {
        if (!newAttrNames.has(attr.name)) {
          await attr.destroy({ transaction });
        }
      }

      const attributePromises = attributes.map(async (attr) => {
        let attrValues = [];
        if (typeof attr.value === 'string') {
          attrValues = attr.value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        } else if (Array.isArray(attr.value)) {
          attrValues = attr.value;
        } else if (Array.isArray(attr.values)) {
          attrValues = attr.values;
        } else if (attr.value) {
          attrValues = [String(attr.value)];
        }

        const normalizedValues = attrValues.length > 0 ? attrValues : ['Default'];

        if (currentAttrMap[attr.name]) {
          return await currentAttrMap[attr.name].update(
            {
              values: normalizedValues,
              type: attr.type || currentAttrMap[attr.name].type || 'custom',
              required:
                attr.required !== undefined ? attr.required : currentAttrMap[attr.name].required,
            },
            { transaction },
          );
        } else {
          return await adminRepository.createProductAttribute(
            {
              productId: id,
              name: attr.name,
              values: normalizedValues,
              type: attr.type || 'custom',
              required: attr.required || false,
            },
            { transaction },
          );
        }
      });
      await Promise.all(attributePromises);
      changes.attributes = attributes.length;
    }

    if (req.body.hasOwnProperty('variants') && Array.isArray(variants)) {
      const currentVariants = await adminRepository.findProductVariants(
        { productId: id },
        { transaction },
      );
      const currentVarMap = currentVariants.reduce((map, v) => {
        map[v.id] = v;
        return map;
      }, {});

      const incomingVarIds = new Set(
        variants.filter((v) => v.id && !String(v.id).startsWith('var-')).map((v) => v.id),
      );

      for (const variant of currentVariants) {
        if (!incomingVarIds.has(variant.id)) {
          await variant.destroy({ transaction });
        }
      }

      const finalVariants = [];
      const variantPromises = variants.map(async (variant, index) => {
        const rawAttrs = variant.attributes || variant.attributeValues;
        const variantAttributes =
          rawAttrs && typeof rawAttrs === 'object' && !Array.isArray(rawAttrs) ? rawAttrs : {};

        const variantSku = variant.sku || generateVariantSku(sku || 'PROD', variantAttributes);

        const derivedName =
          variant.name ||
          variant.variantName ||
          Object.values(variantAttributes).join(' - ') ||
          variantSku;
        const variantData = {
          variantName: derivedName,
          sku: variantSku,
          attributes: variantAttributes,
          attributeValues: variantAttributes,
          price: parseFloat(variant.price?.toString()) || 0,
          stockQuantity: parseInt((variant.stock || variant.stockQuantity || 0).toString()) || 0,
          images: variant.images || [],
          isDefault: variant.isDefault || (index === 0 && !variants.some((v) => v.isDefault)),
          isAvailable: variant.isAvailable !== false,
          compareAtPrice: variant.compareAtPrice || null,
          displayName: variant.displayName || derivedName,
        };

        if (variant.id && currentVarMap[variant.id]) {
          const updated = await currentVarMap[variant.id].update(variantData, { transaction });
          finalVariants.push(updated);
          return updated;
        } else {
          const created = await adminRepository.createProductVariant(
            {
              ...variantData,
              productId: id,
              id: variant.id && !String(variant.id).startsWith('var-') ? variant.id : undefined,
            },
            { transaction },
          );
          finalVariants.push(created);
          return created;
        }
      });

      await Promise.all(variantPromises);
      changes.variants = variants.length;

      for (let i = 0; i < variants.length; i++) {
        const variantInput = variants[i];
        const savedVariant = finalVariants[i];
        if (
          !savedVariant ||
          !Array.isArray(variantInput.images) ||
          variantInput.images.length === 0
        )
          continue;

        await adminRepository.destroyProductImages(
          { productId: id, variantId: savedVariant.id },
          { transaction },
        );

        const variantImageData = variantInput.images
          .filter((url) => url && typeof url === 'string')
          .map((url, idx) => ({
            productId: id,
            variantId: savedVariant.id,
            imageUrl: url,
            isThumbnail: idx === 0,
            color: null,
          }));
        if (variantImageData.length > 0) {
          await adminRepository.bulkCreateProductImages(variantImageData, { transaction });
        }
      }

      const totalStock = calculateTotalStock(finalVariants);
      const minVariantPrice =
        finalVariants.length > 0
          ? Math.min(...finalVariants.map((v) => parseFloat(v.price) || 0).filter((p) => p > 0))
          : null;
      const stockUpdate = { stockQuantity: totalStock };
      if (minVariantPrice !== null && minVariantPrice > 0) stockUpdate.basePrice = minVariantPrice;
      await adminRepository.updateProductWhere(stockUpdate, { id }, { transaction });
    } else if (req.body.hasOwnProperty('stockQuantity')) {
      await adminRepository.updateProductWhere(
        { stockQuantity: parseInt(stockQuantity?.toString()) || 0 },
        { id },
        { transaction },
      );
    }

    if (req.body.hasOwnProperty('specifications') && Array.isArray(specifications)) {
      const currentSpecs = await adminRepository.findProductSpecs(
        { productId: id },
        { transaction },
      );
      const currentSpecMap = currentSpecs.reduce((map, spec) => {
        map[spec.name] = spec;
        return map;
      }, {});

      const incomingSpecNames = new Set(specifications.map((s) => s.name));

      for (const spec of currentSpecs) {
        if (!incomingSpecNames.has(spec.name)) {
          await spec.destroy({ transaction });
        }
      }

      const specPromises = specifications.map(async (spec, index) => {
        const specData = {
          name: spec.name,
          value: spec.value,
          valueEn: spec.valueEn || null,
          category: spec.category || 'General',
          sortOrder: spec.sortOrder || index,
        };

        if (currentSpecMap[spec.name]) {
          return await currentSpecMap[spec.name].update(specData, { transaction });
        } else {
          return await ProductSpecification.create(
            {
              ...specData,
              productId: id,
            },
            { transaction },
          );
        }
      });
      const savedSpecs = await Promise.all(specPromises);
      changes.specifications = specifications.length;

      const specsNeedTranslation = savedSpecs.filter((s) => !s.valueEn && s.value);
      if (specsNeedTranslation.length > 0) {
        setImmediate(async () => {
          try {
            const { translateBatch } = require('@modules/ai/services/translate/translate-service');
            const translated = await translateBatch(specsNeedTranslation.map((s) => s.value));
            await Promise.all(
              specsNeedTranslation.map((s, i) => s.update({ valueEn: translated[i] || null })),
            );
            logger.info(
              `[Translate] Đã dịch ${specsNeedTranslation.length} specs cho product ${id}`,
            );
          } catch (err) {
            logger.warn(`[Translate] Lỗi auto-translate specs product ${id}:`, err.message);
          }
        });
      }
    }

    await transaction.commit();

    const finalProduct = await adminRepository.findProductById(id, {
      include: [
        { model: Category, as: 'categories', through: { attributes: [] } },
        { model: ProductAttribute, as: 'productAttributes' },
        { model: ProductVariant, as: 'variants' },
        {
          model: ProductImage,
          as: 'productImages',
          attributes: ['imageUrl', 'isThumbnail'],
          required: false,
        },
        { model: ProductSpecification, as: 'productSpecifications' },
      ],
    });

    try {
      const { enrichProductData } = require('@utils/product-helpers');
      await vectorStoreService.loadPromise;
      if (finalProduct && finalProduct.status === 'active') {
        await vectorStoreService.upsertProduct(enrichProductData(finalProduct.toJSON()));
      } else if (finalProduct) {
        vectorStoreService.items = vectorStoreService.items.filter(
          (item) => item.metadata.id !== finalProduct.id,
        );
      }
      await vectorStoreService.save();
    } catch (syncErr) {
      logger.error('Lỗi đồng bộ vector store sau khi cập nhật sản phẩm:', syncErr.message);
    }

    res.status(200).json({
      status: 'success',
      data: { product: finalProduct },
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    logger.error('Lỗi khi cập nhật sản phẩm:', error);
    throw error;
  }
});

const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  const product = await adminRepository.findProductById(id);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  const transaction = await sequelize.transaction();

  try {
    await adminRepository.destroyCartItems({ productId: id }, { transaction });
    await adminRepository.destroyWishlists({ productId: id }, { transaction });
    await adminRepository.destroyProductAttributes({ productId: id }, { transaction });
    await adminRepository.destroyProductVariants({ productId: id }, { transaction });
    await adminRepository.destroyProductCategories({ productId: id }, { transaction });
    await product.destroy({ transaction });
    await transaction.commit();

    res.status(200).json({
      status: 'success',
      message: 'Xóa sản phẩm thành công',
    });
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

const getAllProducts = catchAsync(async (req, res) => {
  const {
    page = 1,
    search = '',
    category = '',
    status = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    priceMin,
    priceMax,
    stockMin,
    stockMax,
  } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (search) {
    whereClause[Op.or] = [
      { nameVi: { [Op.like]: `%${search}%` } },
      { nameEn: { [Op.like]: `%${search}%` } },
      { shortDescriptionVi: { [Op.like]: `%${search}%` } },
    ];
  }

  if (status) {
    whereClause.status = status;
  }

  if (priceMin) {
    whereClause.basePrice = {
      ...whereClause.basePrice,
      [Op.gte]: parseFloat(priceMin),
    };
  }
  if (priceMax) {
    whereClause.basePrice = {
      ...whereClause.basePrice,
      [Op.lte]: parseFloat(priceMax),
    };
  }

  if (stockMin) {
    whereClause.stockQuantity = {
      ...whereClause.stockQuantity,
      [Op.gte]: parseInt(stockMin),
    };
  }
  if (stockMax) {
    whereClause.stockQuantity = {
      ...whereClause.stockQuantity,
      [Op.lte]: parseInt(stockMax),
    };
  }

  const includeClause = [
    {
      model: Category,
      as: 'category',
    },
    {
      model: Category,
      as: 'categories',
      through: { attributes: [] },
    },
    {
      model: ProductVariant,
      as: 'variants',
      required: false,
    },
    {
      model: ProductAttribute,
      as: 'productAttributes',
      required: false,
    },
    {
      model: ProductSpecification,
      as: 'productSpecifications',
      required: false,
    },
    {
      model: ProductImage,
      as: 'productImages',
      attributes: ['imageUrl', 'color', 'isThumbnail'],
      required: false,
    },
  ];

  if (category) {
    includeClause[1].where = { id: category };
    includeClause[1].required = true;
  }

  logger.info('[ADMIN] Đang lấy danh sách sản phẩm...');
  try {
    const { count, rows: products } = await adminRepository.findProducts({
      where: whereClause,
      include: includeClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        sortBy === 'stockQuantity' || sortBy === 'stock'
          ? [
              Sequelize.literal(
                '(SELECT COALESCE(SUM(pv.stock_quantity), 0) FROM product_variants pv WHERE pv.product_id = `Product`.`id` AND pv.deleted_at IS NULL)',
              ),
              sortOrder.toUpperCase(),
            ]
          : [
              sortBy === 'price' ? 'basePrice' : sortBy === 'name' ? 'nameVi' : sortBy,
              sortOrder.toUpperCase(),
            ],
      ],
      distinct: true,
    });
    logger.info('[ADMIN] Lấy sản phẩm xong:', products.length);

    const transformedProducts = products.map((p) => {
      const product = p.toJSON();

      product.images = product.productImages?.map((img) => img.imageUrl) || [];
      product.price = product.basePrice;

      if (!product.categories) product.categories = [];
      if (product.category) {
        if (!product.categories.some((cat) => cat.id === product.category.id)) {
          product.categories.push(product.category);
        }
      }

      if (product.variants && product.variants.length > 0) {
        product.stockQuantity = product.variants.reduce(
          (sum, v) => sum + (v.stockQuantity || 0),
          0,
        );
      }

      return product;
    });

    res.status(200).json({
      status: 'success',
      data: {
        products: transformedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: parseInt(limit),
        },
      },
    });
  } catch (err) {
    logger.error('[ADMIN] LỖI khi lấy danh sách sản phẩm:', err.message);
    throw err;
  }
});

const updateProductStock = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { stockQuantity, variantId } = req.body;

  const qty = parseInt(stockQuantity, 10);
  if (isNaN(qty) || qty < 0) {
    throw new AppError('Số lượng tồn kho phải là số nguyên không âm', 400);
  }

  const product = await adminRepository.findProductById(id);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

  if (variantId) {
    const variant = await adminRepository.findProductVariantById(variantId, id);
    if (!variant) throw new AppError('Không tìm thấy biến thể', 404);
    await variant.update({ stockQuantity: qty });
    const total = (await adminRepository.sumProductVariantStock(id)) || 0;
    await product.update({ stockQuantity: total });
  } else {
    await product.update({ stockQuantity: qty });
  }

  res.status(200).json({
    status: 'success',
    data: { id: product.id, stockQuantity: qty },
  });
});

const cloneProduct = catchAsync(async (req, res) => {
  const { id } = req.params;

  const originalProduct = await adminRepository.findProductById(id, {
    include: [
      { model: Category, as: 'categories' },
      { model: ProductAttribute, as: 'productAttributes' },
      { model: ProductVariant, as: 'variants' },
      { model: ProductSpecification, as: 'productSpecifications' },
    ],
  });

  if (!originalProduct) {
    throw new AppError('Không tìm thấy sản phẩm gốc', 404);
  }

  let newName = originalProduct.name;
  let count = 1;
  let exists = true;
  while (exists) {
    const testName = `${originalProduct.name} (${count})`;
    const existing = await adminRepository.findProductOne({ nameVi: testName });
    if (!existing) {
      newName = testName;
      exists = false;
    } else {
      count++;
    }
  }

  const newSku = `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const transaction = await sequelize.transaction();

  try {
    const productData = originalProduct.get({ plain: true });
    delete productData.id;
    delete productData.createdAt;
    delete productData.updatedAt;
    delete productData.slug;
    delete productData.categories;
    // Xóa các association eager-loaded khỏi payload create (giữ lại cột JSON `attributes` của product).
    delete productData.productAttributes;
    delete productData.variants;
    delete productData.productSpecifications;
    productData.name = newName;
    productData.sku = newSku;
    productData.status = 'draft';

    const newProduct = await adminRepository.createProductFull(productData, { transaction });

    if (originalProduct.categories && originalProduct.categories.length > 0) {
      const categoryLinks = originalProduct.categories.map((cat) => ({
        productId: newProduct.id,
        categoryId: cat.id,
      }));
      await ProductCategory.bulkCreate(categoryLinks, { transaction });
    }

    if (originalProduct.productAttributes && originalProduct.productAttributes.length > 0) {
      const attributeData = originalProduct.productAttributes.map((attr) => {
        const data = attr.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        return { ...data, productId: newProduct.id };
      });
      await adminRepository.bulkCreateProductAttributes(attributeData, { transaction });
    }

    if (originalProduct.variants && originalProduct.variants.length > 0) {
      const variantData = originalProduct.variants.map((variant) => {
        const data = variant.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        const suffix = data.sku.includes('-')
          ? data.sku.split('-').pop()
          : Math.floor(Math.random() * 1000);
        data.sku = `${newSku}-${suffix}`;
        return { ...data, productId: newProduct.id };
      });
      await adminRepository.bulkCreateProductVariants(variantData, { transaction });
    }

    if (originalProduct.productSpecifications && originalProduct.productSpecifications.length > 0) {
      const specData = originalProduct.productSpecifications.map((spec) => {
        const data = spec.get({ plain: true });
        delete data.id;
        delete data.createdAt;
        delete data.updatedAt;
        return { ...data, productId: newProduct.id };
      });
      await adminRepository.bulkCreateProductSpecs(specData, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      status: 'success',
      data: { product: newProduct },
    });
  } catch (error) {
    await transaction.rollback();
    logger.error('Lỗi trong cloneProduct:', error);
    throw error;
  }
});

const toggleProductStatus = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const product = await adminRepository.findProductById(id);
  if (!product) {
    throw new AppError('Không tìm thấy sản phẩm', 404);
  }

  const validStatuses = ['active', 'inactive', 'draft'];
  if (status && !validStatuses.includes(status)) {
    throw new AppError('Trạng thái không hợp lệ', 400);
  }

  const newStatus = status || (product.status === 'active' ? 'inactive' : 'active');

  await product.update({ status: newStatus });

  res.status(200).json({
    status: 'success',
    data: { product },
  });
});

const restockProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { variantId, quantity, note } = req.body;
  const qty = parseInt(quantity, 10);

  if (!qty || qty <= 0) {
    throw new AppError('Số lượng nhập phải là số nguyên dương', 400);
  }

  const product = await adminRepository.findProductById(productId);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

  let prevStock, newStock;

  if (variantId) {
    const variant = await adminRepository.findProductVariantById(variantId, productId);
    if (!variant) throw new AppError('Không tìm thấy biến thể', 404);

    prevStock = variant.stockQuantity;
    newStock = prevStock + qty;
    await variant.update({ stockQuantity: newStock, isAvailable: true });

    const total = (await adminRepository.sumProductVariantStock(productId)) || 0;
    await product.update({ stockQuantity: total || 0 });
  } else {
    prevStock = product.stockQuantity;
    newStock = prevStock + qty;
    await product.update({ stockQuantity: newStock });
  }

  const log = await adminRepository.createInventoryLog({
    productId: parseInt(productId, 10),
    variantId: variantId ? parseInt(variantId, 10) : null,
    changeType: 'restock',
    changeAmount: qty,
    previousStock: prevStock,
    newStock,
    note: note || null,
    createdBy: req.user.id,
  });

  try {
    const { enrichProductData } = require('@utils/product-helpers');
    await vectorStoreService.loadPromise;
    const productForIndex = await adminRepository.findProductById(productId, {
      include: [
        { model: Category, as: 'categories', through: { attributes: [] } },
        { model: ProductVariant, as: 'variants', attributes: ['stockQuantity'] },
        {
          model: ProductImage,
          as: 'productImages',
          attributes: ['imageUrl', 'isThumbnail'],
          required: false,
        },
      ],
    });
    if (productForIndex && productForIndex.status === 'active') {
      await vectorStoreService.upsertProduct(enrichProductData(productForIndex.toJSON()));
      await vectorStoreService.save();
    }
  } catch (syncErr) {
    logger.error('Lỗi đồng bộ vector store sau khi nhập hàng:', syncErr.message);
  }

  res.status(200).json({
    data: {
      productId: parseInt(productId, 10),
      variantId: variantId || null,
      previousStock: prevStock,
      newStock,
      quantity: qty,
      log,
    },
  });
});

module.exports = {
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProducts,
  updateProductStock,
  cloneProduct,
  toggleProductStatus,
  restockProduct,
};
