const { News, User } = require('../models');
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
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      news: rows,
    });
  } catch (error) {
    console.error('Get all news error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
      return res.status(404).json({ success: false, message: 'News not found' });
    }

    await news.increment('viewCount');

    res.json({ success: true, news });
  } catch (error) {
    console.error('Get news by slug error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getRelatedNews = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // 1. Get current news to find its category and ID
    const currentNews = await News.findOne({ 
      where: { slug },
      attributes: ['id', 'category'] 
    });

    if (!currentNews) {
      return res.status(404).json({ success: false, message: 'News not found' });
    }

    // 2. Find related news
    let relatedNews = await News.findAll({
      where: {
        category: currentNews.category,
        id: { [Op.ne]: currentNews.id }, // Exclude current news
        isPublished: true
      },
      limit: 3,
      order: [['createdAt', 'DESC']], // Or sequelize.random() for variety
      attributes: ['id', 'title', 'slug', 'thumbnail', 'category', 'createdAt', 'viewCount'],
    });

    // 3. Fallback: If not enough related news, fill with latest news
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

    res.json({ success: true, news: relatedNews });
  } catch (error) {
    console.error('Get related news error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
      return res.status(404).json({ success: false, message: 'News not found' });
    }

    res.json({ success: true, news });
  } catch (error) {
    console.error('Get news by id error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.createNews = async (req, res) => {
  try {
    const { title, slug, content, thumbnail, description, isPublished, category, tags } = req.body;
    
    // Check if slug exists
    const existing = await News.findOne({ where: { slug } });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Slug already exists' });
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
      userId: req.user.id, // Assumes auth middleware populates req.user
    });

    res.status(201).json({ success: true, news });
  } catch (error) {
    console.error('Create news error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.updateNews = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, thumbnail, description, isPublished, category, tags } = req.body;

    const news = await News.findByPk(id);
    if (!news) {
      return res.status(404).json({ success: false, message: 'News not found' });
    }

    // Check slug uniqueness if changed
    if (slug && slug !== news.slug) {
       const existing = await News.findOne({ where: { slug } });
       if (existing) {
         return res.status(400).json({ success: false, message: 'Slug already exists' });
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

    res.json({ success: true, news });
  } catch (error) {
    console.error('Update news error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const { id } = req.params;
    const news = await News.findByPk(id);
    
    if (!news) {
      return res.status(404).json({ success: false, message: 'News not found' });
    }

    await news.destroy();

    res.json({ success: true, message: 'News deleted successfully' });
  } catch (error) {
    console.error('Delete news error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
