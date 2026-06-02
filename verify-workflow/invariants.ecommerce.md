# invariants.ecommerce.md — ORACLE NGHIỆP VỤ (GATE-A)

> ✅ **DUYỆT 2026-06-03 (human):** toàn bộ 21 invariant đã `[x]` — hợp lệ làm oracle tầng 0/GATE-B. INV-ORD-5/8 phản ánh quyết định Option 2 (repay pending-online, cancelled terminal).

> ⚠️ **ĐÂY LÀ DRAFT do agent seed từ code + CLAUDE.md gotchas — KHÔNG phải oracle hợp lệ cho tới khi HUMAN DUYỆT.**
> Lý do: invariant rút từ code chỉ cho biết *"code ĐANG làm gì"*, **không** phải *"nghiệp vụ NÊN làm gì"*. Nếu agent tự coi đây là chân lý = đúng lỗ hổng O1 (vòng tự-tham-chiếu).
> **Việc của bạn (human):** với mỗi dòng, sửa cột THEN cho đúng *nghiệp vụ mong muốn* rồi đánh `[x]` cột Duyệt. Dòng chưa duyệt → tầng 0 KHÔNG được dùng làm tiêu chí.
> Format assert-able: `WHEN <input/điều kiện> THEN <outcome PHẢI đo được>`. Test tầng 0 = so **outcome RAW chạy code** vs cột THEN này.

---

## I. Stock / tồn kho

| ID | WHEN | THEN (outcome PHẢI) | Nguồn DRAFT | Duyệt |
|---|---|---|---|---|
| INV-STK-1 | Hủy đơn ở trạng thái `pending` hoặc `processing` | `stock += quantity` của từng item (hoàn kho), trong transaction | F1/F2; orders-service cancelOrder L504 | [x] |
| INV-STK-2 | Hủy đơn `cancelPendingOrdersByUser` (đặt đơn mới) | stock cũ được hoàn trước khi trừ stock đơn mới | F1; repo L212 | [x] |
| INV-STK-3 | Staff hủy đơn ĐÃ `delivered` | **TỪ CHỐI** (lỗi 400), KHÔNG đổi stock | admin-order-service L266 | [x] |
| INV-STK-4 | Tạo đơn (decrement stock) | LUÔN trong transaction + `SELECT FOR UPDATE` (lockVariant/lockProduct) | CLAUDE.md gotcha; orders-service createOrder | [x] |
| INV-STK-5 | 2 request tạo đơn đồng thời cùng variant tồn kho thấp | KHÔNG oversell (tổng trừ ≤ stock ban đầu) | gotcha SELECT FOR UPDATE | [x] |

## II. Trạng thái đơn (order.status)

| ID | WHEN | THEN | Nguồn DRAFT | Duyệt |
|---|---|---|---|---|
| INV-ORD-1 | Tạo đơn mới | `status = 'pending'`, `paymentStatus = 'pending'` | createOrder L306 | [x] |
| INV-ORD-2 | Thanh toán online (MoMo/VNPay) thành công (IPN/return verify) | `status = 'processing'` + `paymentStatus = 'paid'` | payment-service L162/236/285 | [x] |
| INV-ORD-3 | `confirmReceived` khi `status ∈ {shipped, processing}` | `status = 'delivered'` | orders-service L657, `_canConfirmReceived` | [x] |
| INV-ORD-4 | `confirmReceived` khi đã `delivered` | **TỪ CHỐI** (lỗi 422) | gotcha confirmReceived | [x] |
| INV-ORD-5 | `repayOrder` khi `status='pending'` && `paymentStatus≠'paid'` && `paymentMethod≠'cod'` | `paymentStatus='pending'` (failed→pending), **`status` KHÔNG đổi**, trả `paymentUrl`, KHÔNG động tồn kho. `cancelled`/COD/đã-paid → **TỪ CHỐI 422** | orders-service `_canRepay` L21, repayOrder L628 | [x] |
| INV-ORD-6 | Hủy đơn (cancelOrder) | chỉ cho phép `status ∈ {pending, processing}` (`_canCancel`) | orders-service L504 | [x] |
| INV-ORD-7 | COD + `status → delivered` | `paymentStatus = 'paid'` tự động | orders-service L585/657 | [x] |
| INV-ORD-8 | Đơn `cancelled` | **TERMINAL** — không transition ra; không repay (đã hoàn kho, repay = leak); mua lại → đặt đơn mới | orders-service `_canRepay`/`_canCancel` | [x] |

## III. Tiền / tổng đơn

| ID | WHEN | THEN | Nguồn DRAFT | Duyệt |
|---|---|---|---|---|
| INV-MON-1 | Tính tổng đơn | `order.total = Σ(line subtotal) - discount + shippingCost` | orders-service createOrder | [x] |
| INV-MON-2 | `subtotal >= SHIPPING_FREE_THRESHOLD` | `shippingCost = 0` (server enforce, KHÔNG tin FE) | F3; estimateShipping | [x] |
| INV-MON-3 | `subtotal < ngưỡng free` | `shippingCost ≥ 0` (clamp), giữ giá FE theo km | F3 | [x] |

## IV. Mã giảm giá (discount.usedCount)

| ID | WHEN | THEN | Nguồn DRAFT | Duyệt |
|---|---|---|---|---|
| INV-DSC-1 | Áp discount + payment manual (cod/bank_transfer/installment) | `usedCount += 1` ngay trong `createOrder` transaction | CLAUDE.md gotcha | [x] |
| INV-DSC-2 | Áp discount + payment online (momo/vnpay) | `usedCount += 1` SAU IPN/return success (payment-service), KHÔNG tại apply | CLAUDE.md gotcha | [x] |
| INV-DSC-3 | Bất biến (mong muốn) | `discount.usedCount == COUNT(đơn dùng code này, không tính đơn cancelled trước pay)` | DRAFT — ⚠️ P3 over-redemption = accepted risk, human xác nhận | [x] |

## V. Payment

| ID | WHEN | THEN | Nguồn DRAFT | Duyệt |
|---|---|---|---|---|
| INV-PAY-1 | VNPay return/IPN | mark paid CHỈ KHI verify checksum + **amount khớp** + chưa paid | P1 fix; payment-service handleVnPayReturn | [x] |
| INV-PAY-2 | Refund | `paymentStatus='refunded'`; (hiện KHÔNG đổi order.status/restore stock — P5 business decision) | payment-service L333 | [x] |

---

> **Khi duyệt xong:** đánh dấu `[x]` từng dòng. Tầng 0 (GATE-B) sẽ kiểm: integration test có assert **đúng cột THEN này** không (assert OUTCOME, không phải "method được gọi"). RAW lệch THEN đã duyệt → human phân xử *code-sai hay invariant-sai*.
> **Residual risk (FRAMEWORK §10.1):** nếu cột THEN bạn duyệt SAI nghiệp vụ thật → cả pipeline verify-đúng theo tiêu chí sai. Không lớp nào dưới human bắt được.
