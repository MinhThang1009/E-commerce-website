const { News, User } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

exports.getAllNews = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isPublished, category } = req.query;
    const offset = (page - 1) * limit;
    
    const where = {};
    if (search) {
      where.title = { [Op.like]: `%${search}%` };
    }
    if (isPublished !== undefined) {
      where.isPublished = isPublished === 'true';
    }
    if (category && category !== 'Tất cả') {
      where.category = category;
    }

    const { count, rows } = await News.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatar', 'email'],
        },
      ],
    });

    res.json({
      status: 'success',
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      news: rows,
    });
  } catch (error) {
    logger.error('Lỗi lấy danh sách tin tức:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};

exports.getNewsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const news = await News.findOne({
      where: { slug },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'avatar'],
        },
      ],
    });

    if (!news) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
    }

    await news.increment('viewCount');

    res.json({ status: 'success', news });
  } catch (error) {
    logger.error('Lỗi lấy tin tức theo slug:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};

exports.getRelatedNews = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // 1. Lấy tin tức hiện tại để xác định danh mục và ID
    const currentNews = await News.findOne({ 
      where: { slug },
      attributes: ['id', 'category'] 
    });

    if (!currentNews) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
    }

    // 2. Tìm tin tức liên quan
    let relatedNews = await News.findAll({
      where: {
        category: currentNews.category,
        id: { [Op.ne]: currentNews.id }, // Loại trừ tin tức hiện tại
        isPublished: true
      },
      limit: 3,
      order: [['createdAt', 'DESC']], // Hoặc dùng sequelize.random() để lấy ngẫu nhiên
      attributes: ['id', 'title', 'slug', 'thumbnail', 'category', 'createdAt', 'viewCount'],
    });

    // 3. Dự phòng: nếu không đủ tin liên quan, bổ sung bằng tin mới nhất
    if (relatedNews.length < 3) {
      const needed = 3 - relatedNews.length;
      const existingIds = [currentNews.id, ...relatedNews.map(n => n.id)];
      
      const moreNews = await News.findAll({
        where: {
          id: { [Op.notIn]: existingIds },
          isPublished: true
        },
        limit: needed,
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'title', 'slug', 'thumbnail', 'category', 'createdAt', 'viewCount'],
      });
      
      relatedNews = [...relatedNews, ...moreNews];
    }

    res.json({ status: 'success', news: relatedNews });
  } catch (error) {
    logger.error('Lỗi lấy tin tức liên quan:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const { id } = req.params;
    const news = await News.findByPk(id, {
        include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
          ],
    });

    if (!news) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
    }

    res.json({ status: 'success', news });
  } catch (error) {
    logger.error('Lỗi lấy tin tức theo id:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};

exports.createNews = async (req, res) => {
  try {
    const { title, slug, content, thumbnail, description, isPublished, category, tags } = req.body;
    
    // Kiểm tra slug đã tồn tại chưa
    const existing = await News.findOne({ where: { slug } });
    if (existing) {
      return res.status(400).json({ status: 'error', message: 'Slug đã tồn tại' });
    }

    const news = await News.create({
      title,
      slug,
      content,
      thumbnail,
      description,
      category: category || 'Tin tức',
      tags,
      isPublished: isPublished === undefined ? true : isPublished,
      userId: req.user.id, // Giả định auth middleware đã gán req.user
    });

    res.status(201).json({ status: 'success', news });
  } catch (error) {
    logger.error('Lỗi tạo tin tức:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};

exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, thumbnail, description, isPublished, category, tags } = req.body;

    const news = await News.findByPk(id);
    if (!news) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
    }

    // Kiểm tra tính duy nhất của slug nếu có thay đổi
    if (slug && slug !== news.slug) {
       const existing = await News.findOne({ where: { slug } });
       if (existing) {
         return res.status(400).json({ status: 'error', message: 'Slug đã tồn tại' });
       }
    }

    await news.update({
      title,
      slug,
      content,
      thumbnail,
      description,
      category,
      tags,
      isPublished,
    });

    res.json({ status: 'success', news });
  } catch (error) {
    logger.error('Lỗi cập nhật tin tức:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;
    const news = await News.findByPk(id);
    
    if (!news) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy tin tức' });
    }

    await news.destroy();

    res.json({ status: 'success', message: 'Tin tức đã được xóa thành công' });
  } catch (error) {
    logger.error('Lỗi xóa tin tức:', error);
    res.status(500).json({ status: 'error', message: 'Lỗi máy chủ' });
  }
};
