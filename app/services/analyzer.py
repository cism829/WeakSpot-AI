from __future__ import annotations
from typing import List, Dict, Any, Optional
from openai import OpenAI
from app.core.config import settings
from .parser import to_blocks_with_sentences, sliding_windows

DEFAULT_SUBJECT = getattr(settings, "SUBJECT", None)
MODEL_SUMMARY   = "gpt-4o-mini"
MODEL_DEF       = "gpt-4o-mini"
MODEL_FLAGS     = "gpt-4o-mini"
MAX_TOK_SUMMARY = getattr(settings, "MAX_TOKENS_SUMMARY", 300)
MAX_TOK_DEF     = getattr(settings, "MAX_TOKENS_DEFINITION", 120)
MAX_TOK_FLAGS   = getattr(settings, "MAX_TOKENS_ACCURACY", 320)

_client = OpenAI(api_key=settings.OPENAI_API_KEY)
def detect_subject(text: str) -> str:

    r = _client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You classify academic notes."},
            {"role": "user", "content": "What is the main academic subject of the following note?\n\n" + text[:1500] + "\n\nReturn a one- or two-word subject (e.g., physics, biology, algebra)."}
        ],
        temperature=0,
        max_tokens=10
    )
    return r.choices[0].message.content.strip().lower()

def summarize_whole(text: str, subject: str) -> str:
    sys = f"You are an expert {subject} tutor. Summarize the student's note concisely."
    r = _client.chat.completions.create(
        model=MODEL_SUMMARY,
        messages=[{"role":"system","content":sys},{"role":"user","content":text[:6000]}],
        temperature=0.2, max_tokens=MAX_TOK_SUMMARY
    )
    return (r.choices[0].message.content or "").strip()

def summarize_block(block_text: str, subject: str) -> str:
    sys = f"You are an expert {subject} tutor. Summarize this block in 1–2 sentences."
    r = _client.chat.completions.create(
        model=MODEL_SUMMARY,
        messages=[{"role":"system","content":sys},{"role":"user","content":block_text[:4000]}],
        temperature=0.2, max_tokens=120
    )
    return (r.choices[0].message.content or "").strip()

def maybe_definition(block_text: str, subject: str) -> Optional[str]:
    first = block_text.strip().split("\n", 1)[0]
    if (":" in first and len(first.split(":")[0].split()) <= 8) or len(first.split()) <= 8:
        prompt = f"Define the {subject} term '{first.strip(':').strip()}' in one precise sentence. Use the block if helpful.\n\nBlock:\n{block_text}"
        r = _client.chat.completions.create(
            model=MODEL_DEF,
            messages=[{"role":"system","content":"You write concise academic definitions."},
                      {"role":"user","content":prompt[:4000]}],
            temperature=0.2, max_tokens=MAX_TOK_DEF
        )
        return (r.choices[0].message.content or "").strip()
    return None

def window_flags(window_text: str, subject: str) -> List[Dict[str, Any]]:
    sys = "You review notes for factual issues, missing steps, or clarity problems. Return a strict JSON array."
    user = f"Subject: {subject}\n\nReview the following excerpt and return a JSON array of flags. Keys: quote, issue, why, suggested_fix, location.\n\nExcerpt:\n{window_text}"
    r = _client.chat.completions.create(
        model=MODEL_FLAGS,
        messages=[{"role":"system","content":sys},{"role":"user","content":user[:6000]}],
        temperature=0.2, max_tokens=MAX_TOK_FLAGS
    )
    raw = (r.choices[0].message.content or "").strip()
    import json, re
    try:
        return json.loads(raw)
    except Exception:
        m = re.search(r"\[.*\]", raw, flags=re.S)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return []
        return []

def analyze_note_text(full_text: str, subject: Optional[str] = None) -> Dict[str, Any]:

    if not subject:
        try:
            subject = detect_subject(full_text)
        except Exception:
            subject = DEFAULT_SUBJECT or "general"

    blocks = to_blocks_with_sentences(full_text or "")
    # Whole-note summary
    whole_summary = summarize_whole("\n\n".join(b["text"] for b in blocks), subject)

    # Per-block enrich
    enriched: List[Dict[str, Any]] = []
    for b in blocks:
        item = {"type": b["type"], "text": b["text"], "sentences": b["sentences"]}
        item["summary"] = summarize_block(b["text"], subject)
        d = maybe_definition(b["text"], subject)
        if d:
            item["definition"] = d
        enriched.append(item)

    # windows for flags (one-block overlap)
    windows = sliding_windows([b["text"] for b in blocks], max_chars=2800, overlap_blocks=1)
    all_flags = []
    for w in windows:
        all_flags.extend(window_flags(w, subject))

    # De-dup flags by (quote, issue, suggested_fix)
    merged: List[Dict[str, Any]] = []
    seen = set()
    for f in all_flags:
        key = (f.get("quote",""), f.get("issue",""), f.get("suggested_fix",""))
        if key not in seen:
            merged.append(f)
            seen.add(key)

    return {
        "subject": subject,
        "summary": whole_summary,
        "blocks": enriched,
        "flags": merged,
        "meta": {"num_blocks": len(blocks), "num_windows": len(windows)}
    }
