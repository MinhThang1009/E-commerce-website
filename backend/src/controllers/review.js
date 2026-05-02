const {
  Review,
  Product,
  User,
  Order,
  OrderItem,
  ReviewFeedback,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');

// Tạo đánh giá mới
const createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment, images } = req.body;
    const userId = req.user.id;

    // Kiểm tra sản phẩm có tồn tại không
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    // Kiểm tra người dùng đã mua sản phẩm chưa
    const hasPurchased = await Order.findOne({
      where: {
        userId,
        status: 'delivered', // Chỉ đơn hàng đã giao mới được đánh giá
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          where: { productId },
          required: true,
        },
      ],
    });

    if (!hasPurchased) {
      throw new AppError('Bạn cần mua sản phẩm trước khi đánh giá', 403);
    }

    // Kiểm tra người dùng đã đánh giá sản phẩm này chưa
    const existingReview = await Review.findOne({
      where: { userId, productId },
    });

    let review;
    if (existingReview) {
      await existingReview.update({
        rating,
        title,
        content: comment,
        images: images || [],
        isVerified: true,
      });
      review = existingReview;
    } else {
      review = await Review.create({
        productId,
        userId,
        rating,
        title,
        content: comment,
        images: images || [],
        isVerified: true,
      });
    }

    // Lấy đánh giá kèm thông tin người dùng
    const createdReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
        },
      ],
    });

    // Cập nhật rating sản phẩm
    const productReviews = await Review.findAll({
      where: { productId },
      attributes: ['rating'],
    });

    const avgRating = productReviews.length > 0
      ? productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length
      : 0;

    await product.update({
      rating: avgRating,
      reviewCount: productReviews.length,
    });

    res.status(201).json({
      status: 'success',
      data: createdReview,
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật đánh giá
const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;
    const userId = req.user.id;

    // Tìm đánh giá
    const review = await Review.findOne({
      where: { id, userId },
    });

    if (!review) {
      throw new AppError('Không tìm thấy đánh giá', 404);
    }

    // Cập nhật đánh giá
    await review.update({
      rating: rating !== undefined ? rating : review.rating,
      title: title !== undefined ? title : review.title,
      content: comment !== undefined ? comment : review.content,
      images: images !== undefined ? images : review.images,
      isVerified: true,
    });

    // Lấy đánh giá đã cập nhật kèm thông tin người dùng
    const updatedReview = await Review.findByPk(review.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
        },
      ],
    });

    // Cập nhật rating sản phẩm
    const productReviews = await Review.findAll({
      where: { productId: review.productId },
      attributes: ['rating'],
    });

    const avgRating = productReviews.length > 0
      ? productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length
      : 0;

    await Product.update(
      {
        rating: avgRating,
      },
      { where: { id: review.productId } }
    );

    res.status(200).json({
      status: 'success',
      data: updatedReview,
    });
  } catch (error) {
    next(error);
  }
};

// Xóa đánh giá
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm đánh giá
    const review = await Review.findOne({
      where: { id, userId },
    });

    if (!review) {
      throw new AppError('Không tìm thấy đánh giá', 404);
    }

    const productId = review.productId;

    // Xóa đánh giá
    await review.destroy();

    // Cập nhật rating sản phẩm
    const productReviews = await Review.findAll({
      where: { productId },
      attributes: ['rating'],
    });

    if (productReviews.length > 0) {
      const avgRating =
        productReviews.reduce((sum, review) => sum + review.rating, 0) /
        productReviews.length;

      await Product.update(
        {
          rating: avgRating,
          reviewCount: productReviews.length,
        },
        { where: { id: productId } }
      );
    } else {
      await Product.update(
        {
          rating: 0,
          reviewCount: 0,
        },
        { where: { id: productId } }
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Xóa đánh giá thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Lấy đánh giá của sản phẩm
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const {
      page = 1,
      limit = 10,
      sort = 'newest',
      rating,
      verified,
      withImages,
    } = req.query;

    // Ánh xạ tùy chọn sắp xếp sang cột database thực tế
    const sortMapping = {
      newest: ['createdAt', 'DESC'],
      oldest: ['createdAt', 'ASC'],
      highest_rating: ['rating', 'DESC'],
      lowest_rating: ['rating', 'ASC'],
      most_helpful: ['likes', 'DESC'],
    };

    const [sortColumn, sortOrder] = sortMapping[sort] || ['createdAt', 'DESC'];

    // Kiểm tra sản phẩm có tồn tại không
    const product = await Product.findByPk(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    // Xây dựng điều kiện lọc
    const whereClause = { productId };

    if (rating) {
      whereClause.rating = parseInt(rating);
    }

    if (verified !== undefined) {
      whereClause.isVerified = verified === 'true';
    }

    // Lấy danh sách đánh giá
    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
        },
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sortColumn, sortOrder]],
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy đánh giá của người dùng
const getUserReviews = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    // Lấy danh sách đánh giá
    const { count, rows: reviews } = await Review.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Product,
          attributes: ['id', 'name', 'slug', 'thumbnail'],
        },
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Lấy tất cả đánh giá
const getAllReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, verified } = req.query;

    const whereConditions = {};
    if (verified !== undefined) {
      whereConditions.isVerified = verified === 'true';
    }

    // Lấy danh sách đánh giá
    const { count, rows: reviews } = await Review.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
        {
          model: Product,
          attributes: ['id', 'name', 'slug'],
        },
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        reviews,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Xác nhận đánh giá
const verifyReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isVerified } = req.body;

    // Tìm đánh giá
    const review = await Review.findByPk(id);
    if (!review) {
      throw new AppError('Không tìm thấy đánh giá', 404);
    }

    // Cập nhật đánh giá
    await review.update({ isVerified });

    res.status(200).json({
      status: 'success',
      message: isVerified
        ? 'Đánh giá đã được xác nhận'
        : 'Đánh giá đã bị từ chối',
      data: {
        id: review.id,
        isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Đánh dấu đánh giá là hữu ích hoặc không hữu ích
const markReviewHelpful = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { helpful } = req.body;
    const userId = req.user.id;

    // Tìm đánh giá
    const review = await Review.findByPk(id);
    if (!review) {
      throw new AppError('Không tìm thấy đánh giá', 404);
    }

    // Kiểm tra người dùng không tự vote cho đánh giá của mình
    if (review.userId === userId) {
      throw new AppError('Bạn không thể đánh giá đánh giá của chính mình', 400);
    }

    // Tìm feedback đã có của người dùng cho đánh giá này
    const reviewFeedback = await ReviewFeedback.findOne({
      where: { reviewId: id, userId },
    });

    if (reviewFeedback) {
      // Cập nhật feedback đã có
      if (reviewFeedback.isHelpful !== helpful) {
        // Cập nhật số lượt like/dislike
        if (helpful) {
          // Chuyển từ dislike sang like
          await review.increment('likes');
          await review.decrement('dislikes');
        } else {
          // Chuyển từ like sang dislike
          await review.decrement('likes');
          await review.increment('dislikes');
        }

        // Cập nhật feedback
        await reviewFeedback.update({ isHelpful: helpful });
      }
    } else {
      // Tạo feedback mới
      await ReviewFeedback.create({
        reviewId: id,
        userId,
        isHelpful: helpful,
      });

      // Cập nhật số lượt like/dislike
      if (helpful) {
        await review.increment('likes');
      } else {
        await review.increment('dislikes');
      }
    }

    // Lấy đánh giá sau khi cập nhật
    const updatedReview = await Review.findByPk(id);

    res.status(200).json({
      status: 'success',
      message: helpful
        ? 'Đã đánh dấu đánh giá là hữu ích'
        : 'Đã đánh dấu đánh giá là không hữu ích',
      data: {
        id: updatedReview.id,
        likes: updatedReview.likes,
        dislikes: updatedReview.dislikes,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  updateReview,
  deleteReview,
  getProductReviews,
  getUserReviews,
  getAllReviews,
  verifyReview,
  markReviewHelpful,
};
