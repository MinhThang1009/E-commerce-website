// Ai DTO factory — pure function, không class.
// Service trả về model → controller mapper qua toAiDto trước response.

function toAiDto(model) {
  if (!model) return null;
  const json = typeof model.toJSON === 'function' ? model.toJSON() : model;
  return {
    id: json.id,
    // TODO: pick fields
  };
}

module.exports = { toAiDto };
