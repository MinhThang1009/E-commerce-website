// Payment DTO — service đã shape data, pass-through.
function toPaymentIntentDto(intent) { return intent ?? null; }
function toRefundDto(refund) { return refund ?? null; }

module.exports = { toPaymentIntentDto, toRefundDto };
