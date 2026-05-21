/**
 * @file contentDto.js
 * @layer DTO
 * @module content
 * @description Data transfer objects cho content
 */
// Content DTO — 5 sub-domain trả raw model. Pass-through cho phép Express
// serialize qua toJSON() tự động.
function toBannerDto(banner) {
  return banner ?? null;
}
function toNewsDto(news) {
  return news ?? null;
}
function toCampaignDto(campaign) {
  return campaign ?? null;
}
function toFeedbackDto(feedback) {
  return feedback ?? null;
}

module.exports = { toBannerDto, toNewsDto, toCampaignDto, toFeedbackDto };
