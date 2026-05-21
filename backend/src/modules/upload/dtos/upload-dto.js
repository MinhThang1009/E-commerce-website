/**
 * @file uploadDto.js
 * @layer DTO
 * @module upload
 * @description Data transfer objects cho upload
 */
// Upload DTO — service đã build {filename, originalName, url, size, type}.
// Pass-through.
function toUploadFileDto(file) {
  return file ?? null;
}
module.exports = { toUploadFileDto };
