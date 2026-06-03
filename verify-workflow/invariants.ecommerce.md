# invariants.ecommerce.md — ORACLE NGHIỆP VỤ (GATE-A)

> ✅ **DUYỆT 2026-06-03 (human):** toàn bộ 25 invariant đã `[x]` — hợp lệ làm oracle tầng 0/GATE-B. INV-ORD-5/8 phản ánh quyết định Option 2 (repay pending-online, cancelled terminal).
> 🔄 **BỔ SUNG 2026-06-03 (GATE-B sau audit ma trận cancel×stock×status — F9-F13):** INV-STK-6/7, INV-PAY-3/4. Quyết định human: (a) hủy `shipped` KHÔNG hoàn kho; (b) refund đơn chưa-giao hoàn kho + cancel.

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
| INV-STK-3 | Staff/admin hủy đơn ĐÃ `delivered` — **MỌI path** (`orders-service.updateOrderStatus` + admin `updateOrderStatus`/`adminCancelOrder`) | **TỪ CHỐI** (lỗi 400), KHÔNG đổi stock | admin-order-service L225/271; F8/F13 (orders-service còn sót) | [x] |
| INV-STK-4 | Tạo đơn (decrement stock) | LUÔN trong transaction + `SELECT FOR UPDATE` (lockVariant/lockProduct) | CLAUDE.md gotcha; orders-service createOrder | [x] |
| INV-STK-5 | 2 request tạo đơn đồng thời cùng variant tồn kho thấp | KHÔNG oversell (tổng trừ ≤ stock ban đầu) | gotcha SELECT FOR UPDATE | [x] |
| INV-STK-6 | Hủy đơn ở trạng thái `shipped` (MỌI path) | **KHÔNG hoàn kho** (hàng đã rời kho, như `delivered`); return/RMA xử riêng | GATE-B 2026-06-03; F9 (admin đang hoàn → tồn ảo) | [x] |
| INV-STK-7 | Mọi thao tác hoàn kho (cancel/refund, mọi actor) | atomic `increment` + đọc Order có `SELECT FOR UPDATE` (chống double-restore/lost-update) | GATE-B 2026-06-03; E (admin read-modify-write phi atomic) | [x] |

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
| INV-PAY-2 | Refund | `paymentStatus='refunded'` (xem INV-PAY-4 cho hành vi kho/status — ĐÃ cập nhật GATE-B, thay quyết định P5 cũ) | payment-service L333 | [x] |
| INV-PAY-3 | Payment success (IPN/return — MoMo/VNPay) khi `order.status === 'cancelled'` | **KHÔNG** mark paid, **KHÔNG** hồi sinh đơn (giữ `cancelled`, không trừ lại kho); `logger.warn` để xử refund thủ công (đã thu tiền). Enforce INV-ORD-8 | GATE-B 2026-06-03; C (payment không check order.status → oversell) | [x] |
| INV-PAY-4 | Refund (chỉ VNPay) theo `order.status`: `∈ {pending,processing}` (CHƯA giao — hàng còn trong kho) | hoàn kho + set `order.status='cancelled'` + `paymentStatus='refunded'`, trong transaction + `SELECT FOR UPDATE`; `shipped`/`delivered` (hàng ĐÃ rời kho) → CHỈ `paymentStatus='refunded'`, KHÔNG hoàn kho (nhất quán INV-STK-6: hàng đã đi không hoàn) | GATE-B 2026-06-03; H (refund không hoàn kho → tồn thiếu ảo). shipped reconcile với A/INV-STK-6 | [x] |

---

> **Khi duyệt xong:** đánh dấu `[x]` từng dòng. Tầng 0 (GATE-B) sẽ kiểm: integration test có assert **đúng cột THEN này** không (assert OUTCOME, không phải "method được gọi"). RAW lệch THEN đã duyệt → human phân xử *code-sai hay invariant-sai*.
> **Residual risk (FRAMEWORK §10.1):** nếu cột THEN bạn duyệt SAI nghiệp vụ thật → cả pipeline verify-đúng theo tiêu chí sai. Không lớp nào dưới human bắt được.
