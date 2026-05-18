/**
 * @file searchHistoryRepository.js
 * @layer Repository
 * @module searchHistory
 * @description Data access layer cho searchHistory
 */
const { SearchHistory } = require('@models');
const { Op } = require('sequelize');

const findDuplicate = ({ keyword, userId, sessionId, since }) => {
  const where = { keyword, createdAt: { [Op.gte]: since } };
  if (userId) where.userId = userId;
  else if (sessionId) where.sessionId = sessionId;
  return SearchHistory.findOne({ where });
};

const create = ({ userId, keyword, resultsCount, sessionId }) =>
  SearchHistory.create({ userId, keyword, resultsCount, sessionId });

const findByUser = ({ userId, limit }) =>
  SearchHistory.findAll({
    where: { userId },
    limit,
    order: [['createdAt', 'DESC']],
  });

const findOneByUserAndId = ({ id, userId }) =>
  SearchHistory.findOne({ where: { id, userId } });

const destroyByUser = ({ userId }) =>
  SearchHistory.destroy({ where: { userId } });

module.exports = { findDuplicate, create, findByUser, findOneByUserAndId, destroyByUser };
