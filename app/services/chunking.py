import re
from typing import List, Optional
from sqlalchemy.orm import Session
from openai import OpenAI
from app.models.note import Note
from app.models.note_chunks import NoteChunk

# detection for bulleted lists (dash/star/dot bullets)
BULLET_RE = re.compile(r"^\s*(?:[-*•]\s+|\d+\.\s+)", re.MULTILINE)

def _wrap_by_words(s: str, max_chars: int, overlap: int) -> List[str]:
    words = s.strip().split()
    if not words:
        return []
    out, buf = [], ""
    for w in words:
        candidate = (buf + " " + w).strip() if buf else w
        if len(candidate) <= max_chars:
            buf = candidate
        else:
            if buf:
                out.append(buf)
                tail = buf[-overlap:] if overlap else ""
                buf = (tail + " " + w).strip() if tail else w
            else:
                out.append(w[:max_chars])
                buf = w[max_chars - overlap:] if overlap else ""
    if buf:
        out.append(buf)
    return out

def _wrap_by_chars(s: str, max_chars: int, overlap: int) -> List[str]:
    s = s.strip()
    if len(s) <= max_chars:
        return [s]
    parts = re.split(r"(?<=[\.\!\?])\s+", s)
    if len(parts) == 1:
        return _wrap_by_words(s, max_chars, overlap)

    out, buf = [], ""
    for seg in parts:
        if len(buf) + (1 if buf else 0) + len(seg) <= max_chars:
            buf = f"{buf} {seg}".strip() if buf else seg
        else:
            if buf:
                out.append(buf)
                if overlap and len(buf) > overlap:
                    buf = (buf[-overlap:] + " " + seg).strip()
                else:
                    buf = seg
            else:
                out.append(seg[:max_chars])
                buf = seg[max_chars - overlap:] if overlap else seg[max_chars:]
    if buf:
        out.append(buf.strip())

    final = []
    for c in out:
        if len(c) <= max_chars:
            final.append(c)
        else:
            final.extend(_wrap_by_words(c, max_chars, overlap))
    return final

def split_into_chunks(text: str, max_chars: int = 800, overlap: int = 80) -> List[str]:
    text = (text or "").strip()
    if not text:
        return []
    paras = re.split(r"\n\s*\n+", text)
    if len(paras) == 1 and "\n" in text:
        lines = [ln.strip() for ln in text.splitlines()]
        grouped = []
        for i in range(0, len(lines), 4):
            grp = " ".join([ln for ln in lines[i:i+4] if ln])
            if grp:
                grouped.append(grp)
        if grouped:
            paras = grouped

    chunks = []
    for p in paras:
        p = p.strip()
        if not p:
            continue
        if BULLET_RE.search(p):
            items = [
                s.strip()
                for s in re.split(r"(?m)^(?=\s*(?:[-*•]\s+|\d+\.\s+))", p)
                if s.strip()
            ]
            for it in items:
                chunks.extend(_wrap_by_chars(it, max_chars, overlap))
        else:
            chunks.extend(_wrap_by_chars(p, max_chars, overlap))

    out = []
    for c in chunks:
        c = re.sub(r"[ \t]+\n", "\n", c).strip()
        if c:
            out.append(c)
    return out

def embed_texts(client: Optional[OpenAI], texts: List[str], model: str) -> List[Optional[list]]:
    """Return embeddings for each text (or None if client is None)."""
    if not client:
        return [None for _ in texts]
    # Batch to reduce round-trips; OpenAI supports list input.
    resp = client.embeddings.create(model=model, input=texts)
    return [d.embedding for d in resp.data]

def chunk_and_store(
    db: Session,
    note: Note,
    client: Optional[OpenAI],
    embed_model: str = "text-embedding-3-small",
    max_chars: int = 800,
    overlap: int = 80,
) -> int:
    """Split note.og_text into chunks, embed (if client), and upsert NoteChunk rows.
       Returns number of chunks written.
    """
    chunks = split_into_chunks(note.og_text or "", max_chars=max_chars, overlap=overlap)
    # wipe existing
    db.query(NoteChunk).filter(NoteChunk.note_id == note.note_id).delete()
    if not chunks:
        db.flush()
        return 0
    embeddings = embed_texts(client, chunks, embed_model)
    for idx, (text, emb) in enumerate(zip(chunks, embeddings)):
        db.add(NoteChunk(note_id=note.note_id, chunk_index=idx, text=text, embedding=emb))
    db.flush()
    return len(chunks)
