// Result wrapper — Either-style (success/failure) cho service trả về
// kết quả expected (vd validate biz rule fail) thay vì throw exception.
// Optional pattern; throw vẫn dùng cho lỗi unexpected (DB down, ...).
//
// Usage:
//   const Result = require('shared/result');
//   if (!user.canCancel()) return Result.fail('ORDER_NOT_CANCELLABLE');
//   return Result.ok(updated);

const Result = {
  ok(value) {
    return { ok: true, value, error: null };
  },
  fail(error, details) {
    return { ok: false, value: null, error, details: details || null };
  },
  isOk(r) {
    return !!r && r.ok === true;
  },
  isFail(r) {
    return !!r && r.ok === false;
  },
};

module.exports = Result;
