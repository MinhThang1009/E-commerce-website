#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
Deterministic companion cho workflow `verify-doc-nodes` — KIẾN TRÚC MAX-STRICT.

Workflow (LLM, trong sandbox) lo PHÁN ĐOÁN NGỮ NGHĨA (mô tả có khớp hành vi không).
Script này (chạy NGOÀI sandbox, có filesystem) lo FACT-CHECK TẤT ĐỊNH 3 thứ mà
agent có thể gian lận — biến từ "agent nói" thành "Bash xác nhận":

  #1 evidence-grep : mỗi codeEvidence có TỒN TẠI nguyên văn trong file sourceRef không
                     → chống cheat "bịa quote".
  #2 completeness  : mọi node marker trong doc đã được check chưa (set-diff)
                     → chống cheat "bỏ sót node".
  #3 omission      : mọi symbol trong code có xuất hiện trong doc chưa
                     → bắt OMISSION (doc quên 1 bước — thứ per-node check không thấy).

USAGE:
  # #1 — bắt buộc cần file kết quả workflow (mảng {element, sourceRef, codeEvidence})
  python verify-doc-evidence.py --results wf-result.json

  # #2 — completeness: trích marker từ doc, so với element đã check
  python verify-doc-evidence.py --results wf.json --doc DIAGRAMS.md \
        --marker '^### (N[0-9a-zA-Z-]+|EC[0-9a-z]+)'

  # #3 — omission: trích symbol từ code, check có trong doc text
  python verify-doc-evidence.py --results wf.json --doc D.md \
        --code src/a.js src/b.js --symbol '(?:function|const|async) (\w+)'

Exit code: 0 nếu sạch cả 3, 1 nếu có phát hiện (dùng được trong CI/pipeline gate).
"""

import json, re, sys, argparse, os

# Windows stdout mặc định cp1252 → emoji/tiếng Việt vỡ. Ép utf-8.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip().lower()


def read_file(path):
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, LookupError):
            continue
        except FileNotFoundError:
            return None
    return None


def check_evidence(results, root):
    """#1: mỗi codeEvidence phải tồn tại nguyên văn trong sourceRef file."""
    fabricated = []
    cache = {}
    for e in results:
        el = e.get("element") or e.get("nodeId") or "(?)"
        ev = (e.get("codeEvidence") or "").strip()
        ref = (e.get("sourceRef") or "").strip()
        if not ev:
            fabricated.append((el, ref, "no-codeEvidence"))
            continue
        if not ref:
            fabricated.append((el, ref, "no-sourceRef (không grep được)"))
            continue
        path = ref.split(":")[0].strip().replace("\\", "/")
        cand = path if os.path.isabs(path) else os.path.join(root, path)
        if cand not in cache:
            cache[cand] = read_file(cand)
        content = cache[cand]
        if content is None:
            fabricated.append((el, ref, "file-not-found"))
            continue
        nev, ncon = norm(ev), norm(content)
        found = nev in ncon
        if not found and len(nev) > 30:
            # fallback: khớp 1 đoạn lõi đặc trưng (40 ký tự đầu sau normalize)
            found = nev[:40] in ncon
        if not found:
            fabricated.append((el, ref, "EVIDENCE KHÔNG TỒN TẠI trong file → nghi bịa"))
    return fabricated


def check_completeness(results, doc_path, marker_re, root):
    """#2: mọi marker trong doc phải nằm trong tập element đã check."""
    content = read_file(
        doc_path if os.path.isabs(doc_path) else os.path.join(root, doc_path)
    )
    if content is None:
        return None, "doc-not-found"
    rx = re.compile(marker_re, re.MULTILINE)
    markers = []
    for m in rx.finditer(content):
        markers.append(m.group(1) if m.groups() else m.group(0))
    checked = [norm(e.get("element") or e.get("nodeId") or "") for e in results]
    missed = []
    for mk in markers:
        nm = norm(mk)
        if not any(nm in c or c in nm for c in checked if c):
            missed.append(mk)
    return missed, None


def check_omission(results, doc_path, code_files, symbol_re, root):
    """#3: mọi symbol trong code phải xuất hiện trong doc (bắt doc quên bước)."""
    doc = read_file(
        doc_path if os.path.isabs(doc_path) else os.path.join(root, doc_path)
    )
    if doc is None:
        return None, "doc-not-found"
    ndoc = norm(doc)
    rx = re.compile(symbol_re)
    omitted = []
    seen = set()
    for cf in code_files:
        content = read_file(cf if os.path.isabs(cf) else os.path.join(root, cf))
        if content is None:
            omitted.append((cf, "code-file-not-found"))
            continue
        for m in rx.finditer(content):
            sym = m.group(1) if m.groups() else m.group(0)
            if sym in seen:
                continue
            seen.add(sym)
            if norm(sym) not in ndoc:
                omitted.append((cf, sym))
    return omitted, None


def main():
    ap = argparse.ArgumentParser(
        description="Deterministic verifier cho verify-doc-nodes"
    )
    ap.add_argument(
        "--results",
        required=True,
        help="JSON workflow (mảng element hoặc {perElement|perNode:[...]})",
    )
    ap.add_argument("--root", default=".", help="Thư mục gốc resolve path tương đối")
    ap.add_argument("--doc", help="Doc cho #2/#3")
    ap.add_argument(
        "--marker", help="Regex trích node marker từ doc (#2). Group 1 = id."
    )
    ap.add_argument("--code", nargs="*", default=[], help="Code files cho #3")
    ap.add_argument("--symbol", help="Regex trích symbol từ code (#3). Group 1 = tên.")
    args = ap.parse_args()

    raw = read_file(args.results)
    if raw is None:
        print(f"❌ Không đọc được {args.results}")
        sys.exit(2)
    data = json.loads(raw)
    # chấp nhận: list trực tiếp, hoặc {perElement|perNode|elements:[...]}, hoặc {result:{...}}
    if (
        isinstance(data, dict)
        and "result" in data
        and isinstance(data["result"], (dict, str))
    ):
        data = (
            json.loads(data["result"])
            if isinstance(data["result"], str)
            else data["result"]
        )
    if isinstance(data, dict):
        for k in ("perElement", "perNode", "elements", "nodes"):
            if isinstance(data.get(k), list):
                data = data[k]
                break
    if not isinstance(data, list):
        print("❌ Không tìm thấy mảng element trong results JSON")
        sys.exit(2)

    print(f"📋 Deterministic verify — {len(data)} element\n")
    problems = 0

    fab = check_evidence(data, args.root)
    print(
        f"#1 EVIDENCE-GREP: {len(data) - len(fab)}/{len(data)} quote xác nhận TỒN TẠI"
    )
    for el, ref, why in fab:
        print(f"   🔴 [{el}] {ref} — {why}")
    problems += len(fab)

    if args.doc and args.marker:
        missed, err = check_completeness(data, args.doc, args.marker, args.root)
        if err:
            print(f"\n#2 COMPLETENESS: ⚠️ {err}")
        else:
            print(f"\n#2 COMPLETENESS: {len(missed)} marker trong doc CHƯA được check")
            for mk in missed:
                print(f"   🔴 bỏ sót: {mk}")
            problems += len(missed)

    if args.doc and args.code and args.symbol:
        omit, err = check_omission(data, args.doc, args.code, args.symbol, args.root)
        if err:
            print(f"\n#3 OMISSION: ⚠️ {err}")
        else:
            print(f"\n#3 OMISSION: {len(omit)} symbol code KHÔNG xuất hiện trong doc")
            for cf, sym in omit:
                print(f"   🟠 {cf}: {sym}")
            problems += len(omit)

    print(
        f"\n{'✅ SẠCH cả 3 tầng' if problems == 0 else f'❌ {problems} phát hiện cần review'}"
    )
    sys.exit(0 if problems == 0 else 1)


if __name__ == "__main__":
    main()
