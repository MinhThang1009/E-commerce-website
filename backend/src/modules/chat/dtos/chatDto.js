// Chat DTO factory — pure function, không class.
// Service trả về model → controller mapper qua toChatDto trước response.

function toChatDto(model) {
  if (!model) return null;
  const json = typeof model.toJSON === 'function' ? model.toJSON() : model;
  return {
    id: json.id,
    // TODO: pick fields
  };
}

module.exports = { toChatDto };
