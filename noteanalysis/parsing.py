import re
from typing import List, Optional
import spacy.tokens
from .config import nlp, HEADING_MAX_TOKENS, TARGET_BLOCK_CHARS, LIST_LINE, RULE_HEADING

# split string using spaCy into sentences
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
    return "\n".join(merged).strip()

# pack sentences into blocks of target_chars length
# blocking is a compromise between context and model input limits
# seperate sentences lose context, sending large chunks risks exceeding token limits
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

# within a paragraph, create text blocks using spaCy analysis
# focused on headings and sentence boundaries to remove the need for bullet points
def parse_blocks_spacy(raw: str) -> List[str]:
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return []
    
    # paragraph-aware via blank lines
    # ocr preserves structure of the original document
    # if the original doc had blank lines, use their structure as paragraphs
    if doc_has_blank_lines(raw):
        raw_blocks = [b for b in raw.split("\n\n") if b.strip()]
        out_blocks: List[str] = []
        for b in raw_blocks:
            cleaned = merge_soft_wraps_keep_paragraphs(b)
            if cleaned:
                out_blocks.append(cleaned)
        return out_blocks

    # if no blank lines, spaCy sentence analysis
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

# check if a block seems to need a definition added
def looks_like_term_block(block: str) -> bool:
    doc = nlp(block)
    sents = [s for s in doc.sents if s.text.strip()]
    if not sents:
        return False
    
    # check first sentence, then overall structure
    # if the block contains multiple sentences with verbs, likely not a term block
    # long explanatory blocks with a short first line are excluded here
    first = sents[0].text.strip()
    if len(sents) > 1 and any(tok.pos_ == "VERB" for tok in doc):
        return False
    
    if ":" in first or len(first.split()) <= 3:
        return True
    
    if len(sents) == 1 and is_heading_like_sent(first):  # type: ignore[arg-type]
        return True
    
    return False

# extracts term to define, takes first non-empty sentence
def extract_term_from_block(block: str) -> str:
    doc = nlp(block)
    for s in doc.sents:
        head = s.text.strip()
        if head:
            return re.sub(r"\s+", " ", head)
    return block.splitlines()[0].strip()

# detect if a block is a bullet list type section
# checking line patterns (ie many short lines, low verb density)
# OCR does not always use consistent bullet characters or indentation
# checking multiple heuristics to determine if this is an enumeration block is more robust
def is_enumeration_block(block: str) -> bool:

    lines = [ln for ln in block.splitlines() if ln.strip()]
    if len(lines) < 2:
        return False
    
    bulletish = sum(1 for ln in lines if LIST_LINE.match(ln))
    if bulletish >= 2:
        return True
    
    # check for many short lines
    # need to be relatively strict to avoid false positives
    short_lines = sum(1 for ln in lines if len(ln.strip()) <= 75)
    if short_lines >= max(3, len(lines) // 2):
        return True
    
    # use spaCy to check for low verb density overall
    doc = nlp(block)
    sents = [s for s in doc.sents if s.text.strip()]
    if sents:
        verbs = sum(1 for s in sents for tok in s if tok.pos_ in ("VERB", "AUX"))
        if verbs <= max(1, len(sents) // 3):
            return True
        
    return False

# checking for "Rule X:" headings to split blocks
def split_by_rule_headings(text: str) -> List[str]:
    lines = text.splitlines(keepends=True)
    blocks: List[str] = []
    cur: List[str] = []

    def flush():
        if cur:
            blocks.append("".join(cur).strip())
            cur.clear()

    saw_rule = False
    for ln in lines:
        if RULE_HEADING.match(ln):
            saw_rule = True
            flush()
            cur.append(ln)
        else:
            cur.append(ln)
    flush()
    
    # pass through original text if no rule headings found
    if not saw_rule:
        return [text.strip()] if text.strip() else []
    return [b for b in blocks if b]

# heuristic to check if block looks like it needs a definition
def looks_like_definition_block(block: str) -> bool:
    doc = nlp(block)
    sents = [s for s in doc.sents if s.text.strip()]
    if not sents:
        return False
    if not is_heading_like_sent(sents[0]):
        return False
    if len(sents) > 2:
        return False
    if len(sents) == 2:
        verb_count = sum(1 for tok in sents[1] if tok.pos_ in ("VERB","AUX"))
        if verb_count >= 2:
            return False
    return True

# helper to detect rule blocks
def is_rule_block(block: str) -> bool:
    for ln in block.splitlines():
        if ln.strip():
            return bool(RULE_HEADING.match(ln))
    return False

# classifies block as one of four categories:
# definition: short term like block to be defined
# enumeration: list-like block to be summarized
# concept: heading-like block with explanation to be summarized
# generic: none of the above, pass-through
def classify_block(block: str) -> str:

    if is_enumeration_block(block):
        return "enumeration"
    
    if is_rule_block(block):
        return "concept"
    
    # if sentences look like heading, check definition heuristics
    # send to definition or concept accordingly    
    doc = nlp(block)
    
    sents = [s for s in doc.sents if s.text.strip()]
    if sents and is_heading_like_sent(sents[0]):
        if looks_like_definition_block(block):
    
            return "definition"
    
        return "concept"
    
    return "generic"
