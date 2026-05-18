/**
 * @file unitOfWork.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: unitOfWork
 */
const sequelize = require('@config/sequelize');

// Unit of Work — wrap business operation trong DB transaction.
// Service gọi runInTransaction(async (tx) => {...}) thay vì sequelize.transaction
// trực tiếp để dễ swap implementation (vd test với mock tx).
//
// Hỗ trợ nested call: nếu đã trong transaction (parent passed in), chỉ reuse parent
// chứ KHÔNG mở SAVEPOINT mới (giảm complexity, đủ cho thesis scope).
async function runInTransaction(work, options = {}) {
  if (options.transaction) {
    // Parent transaction đã có → reuse, không open mới
    return work(options.transaction);
  }
  return sequelize.transaction(async (tx) => work(tx));
}

// SELECT FOR UPDATE helper — dùng trong inventory deduct stock (Rule 12 plan.md).
// Lock row trong scope của transaction hiện tại để chống race condition.
async function lockRow(model, where, transaction) {
  if (!transaction) {
    throw new Error('lockRow: transaction bắt buộc — phải gọi trong runInTransaction');
  }
  return model.findOne({
    where,
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

module.exports = {
  runInTransaction,
  lockRow,
};
