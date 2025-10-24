import json
import re
from typing import List, Dict, Any, Optional
from .config import (
    client, SUBJECT, MODEL_SUMMARY, MODEL_DEFINITION, MODEL_ACCURACY,
    TEMPERATURE_DEFAULT, MAX_TOKENS_SUMMARY, MAX_TOKENS_DEFINITION,
    MAX_TOKENS_ACCURACY, MAX_TOKENS_MINI_SUMMARY
)
from .parsing import extract_term_from_block

# call the model to produce a concise definition for the detected terms
def whole_def(block: str, subject: str) -> str:
    term = extract_term_from_block(block)
    prompt = (
        f"Define the {subject} term '{term}' in one clear, academically precise sentence. "
        f"If the block provides clarifying context, incorporate it briefly.\n\nBlock:\n{block}"
    )
    resp = client.chat.completions.create(
        model=MODEL_DEFINITION,
        messages=[{"role": "user", "content": prompt}],
        temperature=TEMPERATURE_DEFAULT,
        max_tokens=MAX_TOKENS_DEFINITION,
    )
    return resp.choices[0].message.content.strip()

# call model to produce contextual summary for enumeration/concept blocks
def contextual_summarize_block(block: str, subject: str) -> str:
    prompt = f"""
You are summarizing educational notes in {subject}.
Rewrite the following section into a compact 3–4 sentence explanation.
- Keep the original meaning and examples.
- Prefer cause→effect phrasing when applicable.
- Avoid bullet points; produce a cohesive paragraph.

Section:
{block}
""".strip()
    resp = client.chat.completions.create(
        model=MODEL_SUMMARY,
        messages=[{"role": "user", "content": prompt}],
        temperature=TEMPERATURE_DEFAULT,
        max_tokens=300,
    )
    return resp.choices[0].message.content.strip()

# model call to summarize notes and extract main subject + subtopics
def summarize_notes(text: str) -> str:
    prompt = f"""Extract the main topic and 4 subtopics from the notes below. Treat wrapped lines as continuous sentences.

Main Subject: <3-4 words>
Subtopics:
- <subtopic 1>
- <subtopic 2>
- <subtopic 3>
- <subtopic 4>

Rules:
- Exactly 4 subtopics, 1–3 words each.
- No extra text.

Notes:
{text[:3000]}
"""
    resp = client.chat.completions.create(
        model=MODEL_SUMMARY,
        messages=[{"role": "user", "content": prompt}],
        temperature=TEMPERATURE_DEFAULT,
        max_tokens=MAX_TOKENS_SUMMARY,
    )
    return resp.choices[0].message.content.strip()

# use main subject as context title
def parse_main_subject(summary_text: str) -> Optional[str]:
    m = re.search(r"Main Subject:\s*(.+)", summary_text)
    return m.group(1).strip() if m else None

# prompt and model call for accuracy checking
ACCURACY_SYSTEM = (
    "You are a meticulous subject-matter fact checker. "
    "Evaluate ONLY the provided notes; do not invent claims."
)

def _accuracy_prompt(text: str, subject: str) -> str:
    return f"""
Subject: {subject}

Task:
- Read the notes below as ONE continuous excerpt (not separate sentences).
- Flag statements that are inaccurate, misleading, incomplete, or unclear.
- When possible, quote EXACTLY the problematic span (short quotes).
- Explain why in 1–2 sentences, focusing on correctness and clarity.
- If nearby context resolves an issue, do NOT flag it.
- If there are no issues, return an empty list [].

Return STRICT JSON array of objects with fields:
- "quote": short exact quote from the notes
- "issue": one of ["inaccurate","misleading","unclear","incomplete"]
- "why": brief reason (1–2 sentences)
- "suggested_fix": concise fix, preserving author’s intent if possible
- "location": "block_index:line_hint" (best-effort)

Notes:
{text}
""".strip()

# extract JSON array from model response
def ensure_json_array(text: str) -> List[Dict[str, Any]]:
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
    except Exception:
        pass
    m = re.search(r"\[\s*{.*}\s*\]", text, flags=re.S)
    if m:
        try:
            data = json.loads(m.group(0))
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return []

# rolling mini-summary for context carry-over
def mini_summary(text: str) -> str:
    prompt = f"Summarize the following excerpt in 1–2 concise sentences:\n\n{text[:1500]}"
    resp = client.chat.completions.create(
        model=MODEL_SUMMARY,
        messages=[{"role": "user", "content": prompt}],
        temperature=TEMPERATURE_DEFAULT,
        max_tokens=MAX_TOKENS_MINI_SUMMARY,
    )
    return resp.choices[0].message.content.strip()

# accuracy check with previous context, global title, and current excerpt
def accuracy_check_with_context(text: str, subject: str,
                                global_title: Optional[str] = None,
                                prior_summary: Optional[str] = None) -> List[Dict[str, Any]]:
    # build a single combined string so the model sees all context    
    ctx_parts = []
    if global_title:
        ctx_parts.append(f"Title: {global_title}")
    if prior_summary:
        ctx_parts.append(f"Previous context: {prior_summary}")
    ctx_parts.append(f"Current excerpt:\n{text}")
    final = "\n\n".join(ctx_parts)

    resp = client.chat.completions.create(
        model=MODEL_ACCURACY,
        messages=[
            {"role": "system", "content": ACCURACY_SYSTEM},
            {"role": "user", "content": _accuracy_prompt(final, SUBJECT)}
        ],
        temperature=TEMPERATURE_DEFAULT,
        max_tokens=MAX_TOKENS_ACCURACY,
    )
    return ensure_json_array(resp.choices[0].message.content.strip())
