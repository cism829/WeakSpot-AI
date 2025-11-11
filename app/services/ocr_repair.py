import json, re
from typing import List, Dict, Any, Optional
from openai import OpenAI
from app.core.config import settings

MODEL_OCR_REPAIR = "gpt-4o-mini"
MAX_TOKENS_OCR_REPAIR = getattr(settings, "MAX_TOKENS_OCR_REPAIR", 260)
SUBJECT = getattr(settings, "SUBJECT", None)  

def has_ocr_gap(text: str) -> bool:
    return ("(?)" in text) or ("..." in text)

_SENT_SPLIT = re.compile(r"(?<=[\\.!\\?\\:;])\\s+")

def sentences(text: str) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    parts = _SENT_SPLIT.split(text)
    out, buf = [], ""
    for p in parts:
        if len(p) < 8 and buf:
            buf += " " + p
        else:
            if buf:
                out.append(buf.strip())
            buf = p
    if buf:
        out.append(buf.strip())
    return out

SYSTEM = (
    "You repair OCR'd academic notes. Replace ONLY the placeholders '(?)' or '...'. "
    "Preserve all other text exactly (casing, punctuation, spacing). "
    "Return fills ONLY for placeholders that actually appear in the current sentence. "
    "Use the *current sentence* and its immediate context to infer the missing word(s). "
    "Preserve all other text exactly (casing, punctuation, spacing). "
    "Do not replace with punctuation or vague words like 'unknown' unless the context clearly states that meaning. "
    "Prefer clear, contextually meaningful phrases."
)

def _user_prompt(context: Dict[str, Optional[str]], subject: Optional[str]) -> str:
    return f"""
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
"""


def suggest_repair_for_text(text: str, subject: Optional[str] = None) -> Dict[str, Any]:
    sents = sentences(text)
    if not any(has_ocr_gap(s) for s in sents):
        return {
            "suggested_text": text,                 
            "log": [{"info": "no_gaps_detected"}],  
        }

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    repaired_sents: List[str] = []
    log: List[Dict[str, Any]] = []

    for i, s in enumerate(sents):
        if not has_ocr_gap(s):
            repaired_sents.append(s)
            continue

        ctx = {
            "prev": sents[i-1] if i > 0 else None,
            "curr": s,
            "next": sents[i+1] if i+1 < len(sents) else None,
        }
        prompt = _user_prompt(ctx, subject or SUBJECT)

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
                    data = None
        if not isinstance(data, dict):
            data = {"repaired": s.replace("(?)","").replace("...",""), "fills": []}

        repaired = data.get("repaired") or s
        repaired_sents.append(repaired)
        log.append({
            "sentence_original": s,
            "sentence_repaired": repaired,
            "fills": data.get("fills", []),
        })

    return {"suggested_text": " ".join(repaired_sents), "log": log}
