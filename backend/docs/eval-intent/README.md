# Kết quả eval intent classifier — regex vs embedding pipeline

Log các vòng calibrate khi nâng cấp intent classification 2 tầng (2026-06-10).
Sinh bởi `node scripts/eval-intent-classifier.js` trên bộ 173 labeled queries
(`scripts/eval-intent-dataset.json`). Số liệu dùng cho chương đánh giá luận văn.

| Run | File | Cấu hình | Kết quả |
|---|---|---|---|
| 1 | `run1-jina-gate-pass.txt` | mean toàn bộ examples, threshold 0.55/0.6 | GATE PASS hình thức nhưng pipeline ≈ regex (embedding ít fire) |
| 2 | (không lưu) | như run 1 | Số liệu NHIỄU — Jina timeout giữa run → query embed bằng e5 trong khi example cache là vector Jina (2 model không so sánh được) |
| 3 | `run3-topk-gate-fail.txt` | top-3 mean + examples mở rộng | Tổng 68% vs 65%; product_search THUA regex (60% vs 66%) do 3 câu example pricing gán nhãn sai ranh giới budget-browse → GATE FAIL |
| 4 | `run4-final-gate-pass.txt` | sửa ranh giới examples pricing↔product_search | Tổng 71% vs 65%, GATE PASS |
| 5 | (bảng trong run cuối) | + threshold calibrate: pricing 0.45 / PS 0.55 / còn lại 0.5 | **Tổng 73% vs 65%; pricing 92%, order_inquiry 48→80%, off_topic 17→35% — cấu hình chốt** |

Bài học ghi lại:
- Vector của 2 embedding model khác nhau KHÔNG so sánh được — cache/eval phải
  nhất quán provider (salt theo provider trong cache).
- `mean` toàn bộ examples pha loãng nhóm catch-all (off_topic) → dùng top-k mean.
- Nhãn ranh giới pricing (hỏi giá SP cụ thể) vs product_search (browse theo budget)
  phải nhất quán giữa INTENT_EXAMPLES và dataset.
