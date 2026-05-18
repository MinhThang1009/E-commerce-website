/**
 * @file catalogDto.js
 * @layer DTO
 * @module catalog
 * @description Data transfer objects cho catalog
 */
// Catalog DTO — service đã shape data, pass-through cho controller.
function toCategoryDto(c) { return c ?? null; }
function toBrandDto(b) { return b ?? null; }
function toCollectionDto(c) { return c ?? null; }
function toProductDto(p) { return p ?? null; }

module.exports = { toCategoryDto, toBrandDto, toCollectionDto, toProductDto };
