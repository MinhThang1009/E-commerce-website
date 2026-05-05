// Inventory DTO factory — pure function, không class.
// Service trả về model → controller mapper qua toInventoryDto trước response.

function toInventoryDto(model) {
  if (!model) return null;
  const json = typeof model.toJSON === 'function' ? model.toJSON() : model;
  return {
    id: json.id,
    // TODO: pick fields
  };
}

module.exports = { toInventoryDto };
