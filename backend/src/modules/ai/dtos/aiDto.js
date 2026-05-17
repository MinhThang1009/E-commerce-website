// AI DTO factory — pure function, không class.
// Service trả về model → controller mapper qua toAIDto trước response.

function toAIDto(model) {
  if (!model) return null;
  const json = typeof model.toJSON === 'function' ? model.toJSON() : model;
  return {
    id: json.id,
    // TODO: pick fields
  };
}

module.exports = { toAIDto };
