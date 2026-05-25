# Checklist trước khi ship feature

## Chạy kiểm tra tự động

```bash
npm run check-docs     # kiểm tra hằng số trong docs khớp với source
npm run test:fast      # đảm bảo không có regression
```

## Checklist thủ công

### Mọi feature

- [ ] `npm run check-docs` pass (0 stale)
- [ ] `npm run test:fast` pass

### Nếu thay đổi hằng số / config

- [ ] `MAX_MESSAGE_LENGTH`, `MAX_HISTORY_TURNS`, `MAX_SESSIONS`, `LLM_*` — `check-docs` sẽ bắt nếu lệch
- [ ] `.env.example` đã update nếu thêm/đổi env var

### Nếu thêm / đổi API endpoint

- [ ] Bảng endpoints trong `src/modules/<module>/CLAUDE.md` đã update
- [ ] Bảng endpoints trong `src/modules/ai/CLAUDE.md` đã update (nếu là AI module)

### Nếu thay đổi logic AI pipeline

- [ ] `RAG_CHATBOT_PIPELINE.md` §2.2 mô tả đúng bước xử lý mới
- [ ] `RAG_CHATBOT_PIPELINE.md` §5 Pipeline Components Coverage đã update
- [ ] `src/modules/ai/services/chatbot/CLAUDE.md` đã reflect thay đổi

### Nếu thêm method / class mới

- [ ] CLAUDE.md của module liên quan đã ghi nhận
- [ ] Docstring JSDoc trong file source đã viết

### Nếu thêm dependency

- [ ] `package.json` lock file đã commit
- [ ] CLAUDE.md của module ghi rõ dependency mới và lý do

---

**Câu hỏi nhanh khi không chắc:**
> "Nếu một người mới đọc CLAUDE.md của module này, họ có hiểu đúng behavior hiện tại không?"
