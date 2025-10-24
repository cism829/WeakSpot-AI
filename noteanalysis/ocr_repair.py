import json
import re
from typing import List, Dict, Any, Optional, Tuple
from .config import (
    nlp, client, SUBJECT, MODEL_OCR_REPAIR, MAX_TOKENS_OCR_REPAIR,
    BANNED_LOW_VALUE, MEANINGFUL_MIN_ALPHAS
)

def has_ocr_gap(text: str) -> bool:
    return ("(?)" in text) or ("..." in text)

def sentence_spans(text: str):
    doc = nlp(text)
    out = []
    for s in doc.sents:
        st, en = s.start_char, s.end_char
        chunk = text[st:en]
        if chunk.strip():
            out.append((st, en, chunk))
    return out

def get_sentence_context(spans: List[Tuple[int,int,str]], idx: int) -> Dict[str, str]:
    prev_text = spans[idx-1][2] if idx-1 >= 0 else ""
    curr_text = spans[idx][2]
    next_text = spans[idx+1][2] if idx+1 < len(spans) else ""
    return {"prev": prev_text, "curr": curr_text, "next": next_text}

def _is_meaningful(repl: str) -> bool:
    if not repl or repl.strip() == "":
        return False
    if not any(ch.isalpha() for ch in repl):
        return False
    alpha_count = sum(1 for ch in repl if ch.isalpha())
    if alpha_count < MEANINGFUL_MIN_ALPHAS:
        return False
    if repl.strip().lower() in BANNED_LOW_VALUE:
        return False
    return True

def _validate_fills(fills: List[Dict[str, Any]]) -> bool:
    if not isinstance(fills, list):
        return False
    for f in fills:
        placeholder = f.get("placeholder", "")
        replacement = f.get("replacement", "")
        if placeholder not in {"(?)", "..."}:
            return False
        if not _is_meaningful(replacement):
            return False
    return True

def ocr_repair_one_sentence_with_context(context: Dict[str,str], subject: str) -> Optional[Dict[str, Any]]:
    SYSTEM = (
        "You repair OCR'd academic notes. Replace ONLY the placeholders '(?)' or '...'. "
        "Preserve all other text exactly (casing, punctuation, spacing). "
        "Return fills ONLY for placeholders that actually appear in the current sentence. "
        "Use the *current sentence* and its immediate context to infer the missing word(s). "
        "Preserve all other text exactly (casing, punctuation, spacing). "
        "Do not replace with punctuation or vague words like 'unknown' unless the context clearly states that meaning. "
        "Prefer clear, contextually meaningful phrases."
    )

    prompt = f"""
Subject: {subject}

Context:
Previous sentence: {context['prev'] or '<none>'}
Current sentence:  {context['curr']}
Next sentence:     {context['next'] or '<none>'}

Strict requirements:
- Replace ONLY '(?)' or '...' with meaningful word(s), not punctuation.
- Each replacement must include letters (not punctuation-only), and be the most likely completion of the current sentence.
- Do NOT rephrase text outside the placeholders; keep all other words identical.
- If you cannot infer a gap confidently, give best effort and note it in confidence score.

Return STRICT JSON:
{{
  "repaired": "<current sentence with replacements>",
  "fills": [
    {{"placeholder":"(?)","replacement":"<words>","confidence":0.0}},
    {{"placeholder":"...","replacement":"<words>","confidence":0.0}}
  ]
}}
""".strip()

    resp = client.chat.completions.create(
        model=MODEL_OCR_REPAIR,
        messages=[{"role":"system","content":SYSTEM},{"role":"user","content":prompt}],
        temperature=0,
        max_tokens=MAX_TOKENS_OCR_REPAIR,
    )
    content = resp.choices[0].message.content.strip()

    data = None
    try:
        data = json.loads(content)
    except Exception:
        m = re.search(r"\{.*\}", content, flags=re.S)
        if m:
            try:
                data = json.loads(m.group(0))
            except Exception:
                pass
    if not isinstance(data, dict) or "repaired" not in data or "fills" not in data:
        return None

    fills = data.get("fills", [])
    if fills and not _validate_fills(fills):
        return None
    return data

def repair_ocr_gaps(full_text: str, subject: str) -> Tuple[str, List[Dict[str, Any]]]:
    spans = sentence_spans(full_text)
    repaired_text = full_text
    offset_shift = 0
    log: List[Dict[str, Any]] = []

    for idx, (st, en, sent) in enumerate(spans):
        if not has_ocr_gap(sent):
            continue

        ctx = get_sentence_context(spans, idx)
        result = ocr_repair_one_sentence_with_context(ctx, subject)
        if result is None:
            strict_ctx = {
                "prev": ctx["prev"],
                "curr": ctx["curr"].replace("...", "(ellipsis)").replace("(?)", "(gap)"),
                "next": ctx["next"]
            }
            result = ocr_repair_one_sentence_with_context(strict_ctx, subject)

        if not result or not isinstance(result.get("fills"), list):
            continue

        repaired_sent = result.get("repaired", sent)
        fills = result["fills"]

        original_sub = repaired_text[st + offset_shift : en + offset_shift]
        temp_sub = original_sub
        for f in fills:
            ph = f.get("placeholder", "")
            repl = f.get("replacement", "")
            if ph in temp_sub and _is_meaningful(repl):
                insert = repl
                match = re.search(re.escape(ph), temp_sub)
                if match:
                    pos = match.start()
                    if pos > 0 and temp_sub[pos - 1].isalnum():
                        insert = " " + repl
                temp_sub = temp_sub.replace(ph, insert, 1)

        repaired_text = (
            repaired_text[: st + offset_shift] + temp_sub + repaired_text[en + offset_shift :]
        )
        offset_shift += len(temp_sub) - len(original_sub)

        log.append({
            "sentence_original": sent,
            "sentence_repaired": temp_sub,
            "fills": fills,
            "start_char": st,
            "end_char": en
        })

    return repaired_text, log
