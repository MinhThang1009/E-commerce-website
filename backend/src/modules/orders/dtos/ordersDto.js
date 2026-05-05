// Orders DTO — service trả Sequelize instance kèm includes; pass-through cho
// controller, JSON.stringify dùng toJSON() tự động.
function toOrderDto(order) { return order ?? null; }
module.exports = { toOrderDto };
