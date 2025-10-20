# noteAnalyzeV2.py
# python -m spacy download en_core_web_sm
# need to add functionality for user to review and accept/edit ocr repair before analysis

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import spacy
from openai import OpenAI


from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY is not set in environment.")

client = OpenAI(api_key=OPENAI_API_KEY)

nlp = spacy.load("en_core_web_sm")

# ----------------------- cfg -----------------------
SUBJECT = "computer science"

INPUT_TXT = Path("example_notes/example2.txt")
OUTPUT_REPAIRED = Path("ai_results/presentation_example2.txt")
OUTPUT_FLAGS_TXT = Path("ai_results/presentation_suggestions2.txt")
OUTPUT_FLAGS_JSON = Path("ai_results/presentation_suggestions2.json")
OUTPUT_OCR_REPAIRS_JSON = Path("ai_results/ocr_repairs2.json")

MODEL_SUMMARY = "gpt-4o-mini"
MODEL_DEFINITION = "gpt-4o-mini"
MODEL_ACCURACY = "gpt-4o"   # 4o for stricter checking
MODEL_OCR_REPAIR = "gpt-4o-mini"

TEMPERATURE_DEFAULT = 0
MAX_TOKENS_SUMMARY = 200
MAX_TOKENS_DEFINITION = 180
MAX_TOKENS_ACCURACY = 800
MAX_TOKENS_MINI_SUMMARY = 80

WINDOW_MAX_CHARS = 2800
WINDOW_OVERLAP_BLOCKS = 1
TARGET_BLOCK_CHARS = 600
HEADING_MAX_TOKENS = 8  # <= this many tokens and no verb = heading-like


def read_text_file(path: Path) -> str:
    with path.open("r", encoding="utf-8") as f:
        return f.read()
    
#----------------------- ocr repair segment -----------------------
GAP_REGEX = re.compile(r"(\(\?\)|\.\.\.)")

MODEL_OCR_REPAIR = "gpt-4o-mini"
MAX_TOKENS_OCR_REPAIR = 260
BANNED_LOW_VALUE = {"unknown"}
MEANINGFUL_MIN_ALPHAS = 3

# only send if ocr'd text contains ... or (?)
def has_ocr_gap(text: str) -> bool:
    return GAP_REGEX.search(text) is not None

# list of (start, end, text) for each sentence; spaCy-based.
# using character offsets to preserve original spacing/newlines
def sentence_spans(text: str):
    doc = nlp(text)
    out = []
    for s in doc.sents:
        st, en = s.start_char, s.end_char
        chunk = text[st:en]
        if chunk.strip():
            out.append((st, en, chunk))
    return out

# context dict with prev, curr, next sentences - increases accuracy for gap filling
def get_sentence_context(spans: List[Tuple[int,int,str]], idx: int) -> Dict[str, str]:
    prev_text = spans[idx-1][2] if idx-1 >= 0 else ""
    curr_text = spans[idx][2]
    next_text = spans[idx+1][2] if idx+1 < len(spans) else ""
    return {"prev": prev_text, "curr": curr_text, "next": next_text}

# reject replacements that are empty, punctuation-only, too short, or low-value
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

# each fill must have valid placeholder and meaningful replacement
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

# returns repaired sentence and fill log
def ocr_repair_one_sentence_with_context(context: Dict[str,str], subject: str) -> Optional[Dict[str, Any]]:

    SYSTEM = (
        "You repair OCR'd academic notes. Replace ONLY the placeholders '(?)' or '...'. "
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
- If you cannot infer a gap confidently, leave that placeholder unchanged.

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

# apply repairs only to sentences that contain '(?)' or '...'; use context; validate & retry once
def repair_ocr_gaps(full_text: str, subject: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Repairs only sentences containing '(?)' or '...'; uses context;
    preserves ALL original whitespace and newlines exactly.
    """
    spans = sentence_spans(full_text)
    repaired_text = full_text  # we'll edit in place using offsets
    offset_shift = 0           # cumulative offset shift (if replacements differ in length)
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

        # get the repaired substring from model
        repaired_sent = result.get("repaired", sent)
        fills = result["fills"]

        # apply replacements *only* at the placeholder positions inside the original substring.
        # replacements made sequentially to preserve newlines and leave other characters untouched.
        original_sub = full_text[st + offset_shift : en + offset_shift]
        temp_sub = original_sub
        for f in fills:
            ph = f.get("placeholder", "")
            repl = f.get("replacement", "")
            if ph in temp_sub and _is_meaningful(repl):
                temp_sub = temp_sub.replace(ph, repl, 1)

        # replace that slice in the repaired_text
        repaired_text = (
            repaired_text[: st + offset_shift] + temp_sub + repaired_text[en + offset_shift :]
        )

        # adjust offset for any length difference (usually small)
        offset_shift += len(temp_sub) - len(original_sub)

        log.append({
            "sentence_original": sent,
            "sentence_repaired": temp_sub,
            "fills": fills,
            "start_char": st,
            "end_char": en
        })

    return repaired_text, log


#----------------------- note analysis segment -----------------------
# split string using spacy into sentences
def sentence_texts(text: str) -> List[str]:
    doc = nlp(text.strip())
    return [s.text.strip() for s in doc.sents if s.text.strip()]

# if a sentence is short with no verbs, consider it heading-like
def is_heading_like_sent(sent: spacy.tokens.Span) -> bool:
    if len(sent) == 0:
        return False
    if len(sent) > HEADING_MAX_TOKENS:
        return False
    return not any(tok.pos_ in ("VERB", "AUX") for tok in sent)


# check for explicit newline breaks for paragraphs
def doc_has_blank_lines(raw: str) -> bool:
    return "\n\n" in raw

# within a paragraph, merge soft wraps (single newlines) into spaces for context flow
def merge_soft_wraps_keep_paragraphs(raw_block: str) -> str:
    lines = [ln.strip() for ln in raw_block.split("\n")]
    merged: List[str] = []
    cur = []
    for ln in lines:
        if not ln:
            if cur:
                merged.append(" ".join(cur).strip())
                cur = []
        else:
            cur.append(ln)
    if cur:
        merged.append(" ".join(cur).strip())
    # rejoin with a single newline to keep intentional internal paragraph breaks
    return "\n".join(merged).strip()


# within a paragraph, create text blocks using spaCy analysis
# focused on headings and sentence boundaries to remove the need for bullet points
def parse_blocks_spacy(raw: str) -> List[str]:
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return []

    # paragraph-aware via blank lines
    if doc_has_blank_lines(raw):
        raw_blocks = [b for b in raw.split("\n\n") if b.strip()]
        out_blocks: List[str] = []
        for b in raw_blocks:
            cleaned = merge_soft_wraps_keep_paragraphs(b)
            if cleaned:
                out_blocks.append(cleaned)
        return out_blocks

    # if no blank lines, use sentence & POS cues
    doc = nlp(raw)
    sents = [s for s in doc.sents if s.text.strip()]
    if not sents:
        return [raw]

    # grouping based on header-like chunks of text
    has_heading = any(is_heading_like_sent(s) for s in sents)
    if has_heading:
        blocks: List[str] = []
        cur: List[str] = []
        for s in sents:
            if is_heading_like_sent(s):
                # new block starts
                if cur:
                    blocks.append(" ".join(cur).strip())
                cur = [s.text.strip()]
            else:
                if not cur:
                    cur = [s.text.strip()]
                else:
                    cur.append(s.text.strip())
        if cur:
            blocks.append(" ".join(cur).strip())
        return [b for b in blocks if b]

    # last fallback, sentence-length chunking
    return group_sentences_into_blocks([s.text.strip() for s in sents], target_chars=TARGET_BLOCK_CHARS)


# pack sentences into blocks of target_chars length
def group_sentences_into_blocks(sents: List[str], target_chars: int = TARGET_BLOCK_CHARS) -> List[str]:
    blocks: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for s in sents:
        s_len = len(s) + 1
        if cur and cur_len + s_len > target_chars:
            blocks.append(" ".join(cur).strip())
            cur, cur_len = [], 0
        cur.append(s)
        cur_len += s_len
    if cur:
        blocks.append(" ".join(cur).strip())
    return blocks

# blocks are term/definition candidates if:
# first sentence is heading-like (short, no verb)
# block has few sentences - likely a short label
def looks_like_term_block(block: str) -> bool:
    """
    A block is a term/definition candidate if:
      - First sentence is heading-like (short, no VERB/AUX), and
      - Block has few sentences (<= 2) → likely a short label plus fragment/incomplete intro.
    """
    doc = nlp(block)
    sents = [s for s in doc.sents if s.text.strip()]
    if not sents:
        return False
    first = sents[0]
    if is_heading_like_sent(first) and len(sents) <= 2:
        return True
    # very short line with no verbs: treat as term
    if len(sents) == 1 and is_heading_like_sent(first):
        return True
    return False


# extracts term to define, takes first non-empty sentence
def extract_term_from_block(block: str) -> str:
    doc = nlp(block)
    for s in doc.sents:
        head = s.text.strip()
        if head:
            # collapse whitespace
            return re.sub(r"\s+", " ", head)
    return block.splitlines()[0].strip()


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

# append a generated definition to skeletal blockss
def repair_blocks(blocks: List[str]) -> List[str]:
    repaired: List[str] = []
    for b in blocks:
        if looks_like_term_block(b):
            definition = whole_def(b, SUBJECT)
            repaired.append(b + " " + definition)
        else:
            repaired.append(b)
    return repaired

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


# packs blocks into windows with overlap for context carry-over
def sliding_windows(blocks: List[str], max_chars: int = WINDOW_MAX_CHARS,
                    overlap_blocks: int = WINDOW_OVERLAP_BLOCKS) -> List[str]:
    windows: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for b in blocks:
        b_len = len(b) + 2
        if cur and cur_len + b_len > max_chars:
            windows.append("\n\n".join(cur))
            cur = cur[-overlap_blocks:] if overlap_blocks > 0 else []
            cur_len = sum(len(x) for x in cur) + 2 * len(cur)
        cur.append(b)
        cur_len += b_len
    if cur:
        windows.append("\n\n".join(cur))
    return windows

# each window produces a list of flags; merge and remove duplicates
def merge_flags(all_flags: List[List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
    seen = set()
    merged: List[Dict[str, Any]] = []
    for arr in all_flags:
        for item in arr:
            key = (item.get("quote", ""), item.get("issue", ""), item.get("suggested_fix", ""))
            if key not in seen:
                merged.append(item)
                seen.add(key)
    return merged

# format flags into readable text
def render_flags_text(flags: List[Dict[str, Any]]) -> str:
    if not flags:
        return "Inaccuracy Flags:\nNone found."
    lines = ["Inaccuracy Flags:"]
    for i, f in enumerate(flags, 1):
        quote = f.get("quote", "").strip()
        issue = f.get("issue", "").strip()
        why = f.get("why", "").strip()
        fix = f.get("suggested_fix", "").strip()
        loc = f.get("location", "").strip()
        lines.append(f"{i}. Quote: {quote!r}")
        lines.append(f"   Issue: {issue}")
        lines.append(f"   Why: {why}")
        lines.append(f"   Suggested fix: {fix}")
        if loc:
            lines.append(f"   Location: {loc}")
        lines.append("")
    return "\n".join(lines)


def main():
    
    original_text = read_text_file(INPUT_TXT)

    # 1) OCR gap repair
    repaired_text, ocr_log = repair_ocr_gaps(original_text, SUBJECT)
    if ocr_log:
        OUTPUT_OCR_REPAIRS_JSON.parent.mkdir(parents=True, exist_ok=True)
        with OUTPUT_OCR_REPAIRS_JSON.open("w", encoding="utf-8") as jf:
            json.dump(ocr_log, jf, ensure_ascii=False, indent=2)
    # proceed with repaired text
    original_text = repaired_text

    # 2) spaCy-driven parsing into blocks 
    blocks = parse_blocks_spacy(original_text)

    # 3) Repair definition-like blocks (spaCy heading heuristic)
    repaired_blocks = repair_blocks(blocks)

    # 4) Sliding windows for accuracy checking
    windows = sliding_windows(repaired_blocks, max_chars=WINDOW_MAX_CHARS, overlap_blocks=WINDOW_OVERLAP_BLOCKS)

    # 5) Global summary & title
    global_summary = summarize_notes("\n\n".join(repaired_blocks))
    main_subject = parse_main_subject(global_summary) or SUBJECT

    # 6) Accuracy checks with context carry-over
    all_windows_flags: List[List[Dict[str, Any]]] = []
    prev_context_summary: Optional[str] = None

    for w in windows:
        flags = accuracy_check_with_context(
            text=w,
            subject=SUBJECT,
            global_title=main_subject,
            prior_summary=prev_context_summary
        )
        all_windows_flags.append(flags)
        prev_context_summary = mini_summary(w)

    # 7) Merge & dedup flags
    merged_flags = merge_flags(all_windows_flags)

    # 8) Write outputs
    OUTPUT_REPAIRED.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_REPAIRED.open("w", encoding="utf-8") as f:
        for blk in repaired_blocks:
            f.write(blk + "\n\n")
        f.write("Summary\n")
        f.write(global_summary.strip() + "\n")

    OUTPUT_FLAGS_TXT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_FLAGS_TXT.open("w", encoding="utf-8") as f:
        f.write(render_flags_text(merged_flags))

    with OUTPUT_FLAGS_JSON.open("w", encoding="utf-8") as jf:
        json.dump(merged_flags, jf, ensure_ascii=False, indent=2)

    print("Done.")
    print(f"- Repaired notes: {OUTPUT_REPAIRED}")
    print(f"- Suggestions (txt): {OUTPUT_FLAGS_TXT}")
    print(f"- Suggestions (json): {OUTPUT_FLAGS_JSON}")


if __name__ == "__main__":
    main()
