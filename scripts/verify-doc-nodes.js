export const meta = {
  name: 'verify-doc-nodes',
  description: 'Template MAX-STRICT: kiểm từng node/element 1 doc vs code. Discovery (chống bỏ sót) + N-of-M quorum (M agent độc lập vote, giảm lỗi single-agent) + grep-verify evidence (chống bịa quote) + tier độc lập + strict optional. Chạy kèm verify-doc-evidence.py để fact-check TẤT ĐỊNH.',
  whenToUse: 'Verify per-node/element 1 file doc (node graph, sequence diagram, pipeline flow, bảng mapping) khớp codebase, với quorum + bằng chứng grep-verified.',
  phases: [
    { title: 'Discovery' },
    { title: 'Quorum check' },
    { title: 'Independent re-verify' },
    { title: 'Evidence audit' },
    { title: 'Consolidate' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────
// KIẾN TRÚC MAX-STRICT (2 giai đoạn):
//   GĐ1 — Workflow này (LLM): phán đoán ngữ nghĩa + thu thập {sourceRef, codeEvidence}.
//          Tầng chống gian lận: Discovery(#1) · Quorum N-of-M · Re-verify · Evidence-audit(agent).
//   GĐ2 — Orchestrator chạy `scripts/verify-doc-evidence.py --results <json> [--doc --marker --code --symbol]`
//          → FACT-CHECK TẤT ĐỊNH (Bash, có fs): grep evidence thật / completeness / omission.
//          Đây là tầng "Bash xác nhận" thay cho "agent nói" — strict cao nhất khả thi.
//
// USAGE:
//   Workflow({ name:'verify-doc-nodes', args:{
//     docPath, docSection?, sourceNote, gotchas?,
//     quorum: 3,        // M agent độc lập vote mỗi element (mặc định 1)
//     strict: true,     // Tier-2 re-verify TẤT CẢ (mặc định chỉ flagged+sample)
//     batches:[{id, items, hint}]
//   }})
//   → lưu result JSON → python scripts/verify-doc-evidence.py --results r.json --root <repo> \
//        --doc <doc> --marker '<regex>' --code <files...> --symbol '<regex>'
// ─────────────────────────────────────────────────────────────────────────

const cfg = args || {}
const docPath = cfg.docPath || ''
const docSection = cfg.docSection || '(toàn file)'
const sourceNote = cfg.sourceNote || '(chưa cung cấp sourceNote — agent tự tìm code)'
const gotchas = cfg.gotchas ? `GROUND-TRUTH/GOTCHAS: ${cfg.gotchas}` : ''
const strict = cfg.strict === true
const quorum = Math.max(1, Math.min(5, Number(cfg.quorum) || 1))
const batches = Array.isArray(cfg.batches) ? cfg.batches : []

if (!docPath || batches.length === 0) {
  log('⚠️ Thiếu args. Cần: { docPath, batches:[{id,items,hint}], sourceNote?, quorum?, strict?, docSection?, gotchas? }.')
  return { error: 'missing-args' }
}

const ELEM_SCHEMA = {
  type: 'object', required: ['unit', 'elements', 'elementsChecked'],
  properties: {
    unit: { type: 'string' },
    elementsChecked: { type: 'number' },
    elements: {
      type: 'array',
      items: {
        type: 'object',
        required: ['element', 'docClaim', 'codeEvidence', 'sourceRef', 'verdict'],
        properties: {
          element: { type: 'string' },
          docClaim: { type: 'string' },
          codeEvidence: { type: 'string', description: 'Trích nguyên văn — verify-doc-evidence.py sẽ grep lại' },
          sourceRef: { type: 'string', description: 'BẮT BUỘC file:line (để grep tất định)' },
          anchorCorrect: { type: 'boolean' },
          descriptionMatch: { type: 'boolean' },
          orderNote: { type: 'string' },
          verdict: { type: 'string', enum: ['MATCH', 'MISMATCH', 'PARTIAL'] },
          note: { type: 'string' },
        },
      },
    },
  },
}
const VERIFY_SCHEMA = {
  type: 'object', required: ['rechecked'],
  properties: {
    rechecked: {
      type: 'array',
      items: {
        type: 'object', required: ['element', 'tier1Verdict', 'confirmedVerdict', 'reason'],
        properties: {
          element: { type: 'string' }, tier1Verdict: { type: 'string' },
          confirmedVerdict: { type: 'string', enum: ['MATCH', 'MISMATCH', 'PARTIAL'] }, reason: { type: 'string' },
        },
      },
    },
  },
}
const AUDIT_SCHEMA = {
  type: 'object', required: ['audits'],
  properties: {
    audits: {
      type: 'array',
      items: {
        type: 'object', required: ['element', 'evidenceFound'],
        properties: { element: { type: 'string' }, evidenceFound: { type: 'boolean' }, note: { type: 'string' } },
      },
    },
  },
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// ── Phase 0: Discovery ──
phase('Discovery')
log(`Discovery: liệt kê toàn bộ element trong ${docPath} (${docSection})`)
const discovery = await agent(
  `Đọc ${docPath} (vùng: ${docSection}). Liệt kê CANONICAL list MỌI node/element/step id — KHÔNG bỏ sót, KHÔNG thêm. Trả allElements + count.`,
  { label: 'discovery', phase: 'Discovery', schema: { type: 'object', required: ['allElements', 'count'], properties: { allElements: { type: 'array', items: { type: 'string' } }, count: { type: 'number' } } } }
).catch(() => ({ allElements: [], count: 0 }))

// ── reconcile N-of-M: gom verdict theo element, majority vote ──
function reconcile(judges) {
  const byEl = {}
  for (const j of judges.filter(Boolean)) {
    for (const e of (j.elements || [])) {
      const k = norm(e.element)
      if (!k) continue
      ;(byEl[k] = byEl[k] || []).push(e)
    }
  }
  const merged = []
  for (const k of Object.keys(byEl)) {
    const variants = byEl[k]
    const counts = {}
    variants.forEach((v) => { counts[v.verdict] = (counts[v.verdict] || 0) + 1 })
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1])
    const [topVerdict, agree] = ranked[0]
    const total = variants.length
    // đại diện: bản có verdict majority + có sourceRef/evidence tốt nhất
    const rep = variants.filter((v) => v.verdict === topVerdict).sort((a, b) => (b.codeEvidence || '').length - (a.codeEvidence || '').length)[0]
    merged.push({
      ...rep,
      verdict: topVerdict,
      quorum: `${agree}/${total}`,
      consensus: agree > total / 2,                 // majority thật sự (2/3, 3/5...)
      disagreement: agree < total ? variants.map((v) => v.verdict).join('|') : '',
    })
  }
  return merged
}

// ── Phase 1+2: Quorum check + re-verify (per batch) ──
function checkBatch(b) {
  const checkPrompt =
    `TIER-1. Verify TỪNG element vs CODE THẬT. Mỗi element: (1) đọc ${docPath} lấy doc claim; (2) Read code; ` +
    `(3) TRÍCH NGUYÊN VĂN code (codeEvidence) + GHI sourceRef=file:line CHÍNH XÁC (sẽ bị grep tất định — đừng bịa); ` +
    `(4) phán anchorCorrect/descriptionMatch/orderNote/verdict. Trả elementsChecked = đúng số element được giao.\n\n` +
    `BATCH ${b.id} — element: ${b.items}\nGợi ý: ${b.hint || '(tự tìm)'}\n${sourceNote}\n${gotchas}`
  return pipeline(
    [b],
    // M agent độc lập (quorum) → reconcile majority
    async (x) => {
      const judges = await parallel(
        Array.from({ length: quorum }, (_, i) => () =>
          agent(checkPrompt, { label: `check:${x.id}:j${i + 1}`, phase: 'Quorum check', schema: ELEM_SCHEMA })
        )
      )
      const valid = judges.filter(Boolean)
      if (valid.length === 0) return { unit: x.id, elements: [], _null: true }
      return { unit: x.id, elements: quorum > 1 ? reconcile(valid) : (valid[0].elements || []) }
    },
    // Tier-2 độc lập: flagged + 2 sample, hoặc TẤT CẢ nếu strict; luôn re-check element có disagreement
    (r, x) => {
      if (!r || r._null) return r || { unit: x.id, elements: [] }
      const els = r.elements || []
      const toRe = strict
        ? els
        : [...els.filter((e) => e.verdict !== 'MATCH' || e.disagreement), ...els.filter((e) => e.verdict === 'MATCH' && !e.disagreement).slice(0, 2)]
      if (toRe.length === 0) return { ...r, _recheck: { rechecked: [] } }
      return agent(
        `TIER-2 VERIFIER ĐỘC LẬP. Tự Read code, re-check ${strict ? 'TẤT CẢ' : 'các'} element dưới, KHÔNG tin tier-1.\n\n` +
        `${JSON.stringify(toRe.map((e) => ({ element: e.element, tier1Verdict: e.verdict, quorum: e.quorum, sourceRef: e.sourceRef, codeEvidence: e.codeEvidence })), null, 2)}\n\n${sourceNote}\n${gotchas}`,
        { label: `reverify:${x.id}`, phase: 'Independent re-verify', schema: VERIFY_SCHEMA }
      ).then((rv) => ({ ...r, _recheck: rv }))
    }
  ).then((a) => a[0])
}

phase('Quorum check')
log(`Check ${batches.length} batch · quorum=${quorum} agent/element${strict ? ' · STRICT (re-verify toàn bộ)' : ''}`)
const results = await parallel(batches.map((b) => () => checkBatch(b)))

// ── Phase 3: Evidence audit (agent grep — first pass; verify-doc-evidence.py là authoritative) ──
phase('Evidence audit')
function auditBatch(r) {
  const items = (r.elements || []).filter((e) => e.codeEvidence && e.sourceRef).map((e) => ({ element: e.element, sourceRef: e.sourceRef, codeEvidence: e.codeEvidence }))
  if (!items.length) return { unit: r.unit, audits: [] }
  return agent(
    `EVIDENCE AUDITOR. Mỗi cặp: Grep/Read MỞ file sourceRef, kiểm codeEvidence có TỒN TẠI nguyên văn không (cho phép khác whitespace). evidenceFound=false nếu KHÔNG (nghi bịa). Grep thật, không đoán.\n\n${JSON.stringify(items, null, 2)}`,
    { label: `audit:${r.unit}`, phase: 'Evidence audit', schema: AUDIT_SCHEMA }
  ).then((a) => ({ unit: r.unit, audits: a.audits || [] })).catch(() => ({ unit: r.unit, audits: [] }))
}
const audits = await parallel(results.filter(Boolean).map((r) => () => auditBatch(r)))

// ── Phase 4: Consolidate ──
phase('Consolidate')
const auditMap = {}
for (const a of audits.filter(Boolean)) for (const x of (a.audits || [])) auditMap[norm(x.element)] = x
const all = []
for (const r of results.filter(Boolean)) {
  const rc = (r._recheck && r._recheck.rechecked) || []
  for (const e of (r.elements || [])) {
    const m = rc.find((x) => norm(x.element) === norm(e.element))
    const au = auditMap[norm(e.element)]
    all.push({
      unit: r.unit, element: e.element, verdict: e.verdict,
      quorum: e.quorum || `1/1`, consensus: e.consensus !== false, disagreement: e.disagreement || '',
      independentVerdict: m ? m.confirmedVerdict : (strict ? '(missing)' : '(not rechecked)'),
      evidenceFound: au ? au.evidenceFound : '(not audited)',
      sourceRef: e.sourceRef || '', codeEvidence: e.codeEvidence || '', note: e.note || '',
    })
  }
}
const checkedKeys = all.map((e) => norm(e.element))
const missed = (discovery.allElements || []).filter((d) => { const dn = norm(d); return dn && !checkedKeys.some((k) => k.includes(dn) || dn.includes(k)) })
const badVerdict = all.filter((e) => e.verdict !== 'MATCH' || (e.independentVerdict !== 'MATCH' && !String(e.independentVerdict).startsWith('(')))
const fabricated = all.filter((e) => e.evidenceFound === false)
const noConsensus = all.filter((e) => e.consensus === false)

log(`Element: ${all.length}/disc ${discovery.count || '?'} · bỏ sót ${missed.length} · mismatch ${badVerdict.length} · quote nghi bịa ${fabricated.length} · không đồng thuận quorum ${noConsensus.length}`)

return {
  docPath, quorum, strict,
  discoveryCount: discovery.count || (discovery.allElements || []).length,
  totalElementsChecked: all.length,
  fullyClean: missed.length === 0 && badVerdict.length === 0 && fabricated.length === 0 && noConsensus.length === 0,
  missedElements: missed,
  mismatchesOrPartial: badVerdict,
  fabricatedEvidence: fabricated,
  quorumDisagreements: noConsensus,
  perElement: all,
  _next: 'Lưu JSON này → chạy: python scripts/verify-doc-evidence.py --results <file> --root <repo> [--doc --marker --code --symbol] để fact-check TẤT ĐỊNH.',
}
