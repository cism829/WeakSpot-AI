from __future__ import annotations
import re
from typing import List, Dict, Any
from .nlp_runtime import load_nlp

BULLET_RE = re.compile(r"^\s*(?:[-*•·]\s+|\d+[.)]\s+)", re.M)                 # bullets / numbered
PURE_BULLET_BLOCK_RE = re.compile(r"^(?:\s*(?:[-*•·]|\d+[.)])\s+.+\n?)+$", re.M)
HEADING_LINE_RE = re.compile(r"^[A-Z0-9][A-Z0-9 \-:]{2,60}$")                 # ALL CAPS short headings
DEF_LINE_RE = re.compile(r"^\s*([A-Z][A-Za-z0-9 \-\(\)]{1,60})\s*[:\-]\s+.+$")# Term: definition
INLINE_LATEX_RE = re.compile(r"(\$[^$]+\$|\\\((?:.|\n)+?\\\)|\\\[(?:.|\n)+?\\\])")

def soft_unwrap_keep_paragraphs(text: str) -> str:
    """
    Collapse single line wraps inside paragraphs while preserving blank-line paragraph breaks.
    """
    text = (text or "").replace("\r\n", "\n").strip()
    if not text:
        return ""
    paras = re.split(r"\n\s*\n+", text)
    cleaned: List[str] = []
    for p in paras:
        lines = [ln.strip() for ln in p.splitlines() if ln.strip()]
        cleaned.append(" ".join(lines))
    return "\n\n".join(cleaned)

def split_paragraphs(text: str) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    return [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]

def spacy_sentences(paragraph: str) -> List[str]:

    nlp = load_nlp()
    if not nlp:
        # fallback: naive split on punctuation + space
        return re.split(r"(?<=[\.\!\?\:;])\s+", paragraph.strip())
    doc = nlp(paragraph) 
    sents = [s.text.strip() for s in doc.sents]
    # Join micro-fragments (very short) to next sentence 
    out: List[str] = []
    buf = ""
    for s in sents:
        if len(s) < 8:
            buf = (buf + " " + s).strip() if buf else s
        else:
            if buf:
                out.append(buf)
                buf = ""
            out.append(s)
    if buf:
        out.append(buf)
    return [s for s in out if s]

# block classification
def _looks_like_heading(block: str) -> bool:
    single_line = block.strip().replace("—", "-")
    if "\n" in single_line:
        return False
    if HEADING_LINE_RE.match(single_line):
        return True
    if len(single_line) <= 48 and single_line.endswith(":"):
        return True
    return False

def _looks_like_pure_bullet_block(block: str) -> bool:
    if PURE_BULLET_BLOCK_RE.match(block + ("\n" if not block.endswith("\n") else "")):
        return True
    return False

def _looks_like_definition(block: str) -> bool:
    # “Term: …” at the first line OR short noun phrase then a dash
    first = block.strip().split("\n", 1)[0]
    return bool(DEF_LINE_RE.match(first))


def classify_block(block: str) -> str:
    if _looks_like_heading(block):
        return "heading"
    if _looks_like_pure_bullet_block(block):
        return "list"
    if _looks_like_definition(block):
        return "definition"
    return "paragraph"

def to_blocks_with_sentences(text: str) -> List[Dict[str, Any]]:
    """
    Full parse to blocks -> sentences, keeping spaCy splitting and your classification.
    """
    cleaned = soft_unwrap_keep_paragraphs(text)
    paras = split_paragraphs(cleaned)
    blocks: List[Dict[str, Any]] = []
    for p in paras:
        btype = classify_block(p)
        sents = spacy_sentences(p)
        blocks.append({"type": btype, "text": p, "sentences": sents})
    return blocks

def sliding_windows(blocks: List[str], max_chars: int = 2800, overlap_blocks: int = 1) -> List[str]:
    windows: List[str] = []
    cur: List[str] = []
    cur_len = 0
    for b in blocks:
        bl = len(b) + 2
        if cur and cur_len + bl > max_chars:
            windows.append("\n\n".join(cur))
            cur = cur[-overlap_blocks:] if overlap_blocks > 0 else []
            cur_len = sum(len(x) for x in cur) + 2 * len(cur)
        cur.append(b)
        cur_len += bl
    if cur:
        windows.append("\n\n".join(cur))
    return windows
