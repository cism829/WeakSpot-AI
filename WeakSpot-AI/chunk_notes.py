# builds chunks and embeddings
import os, re, argparse
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# still run if no openai, skip embedding
USE_OPENAI = True
try:
    from openai import OpenAI
except Exception:
    USE_OPENAI = False

EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")  # 1536 dims

def db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "weak_spot"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "password"),
    )

# detection for bulleted lists (dash/star/dot bullets)
BULLET_RE = re.compile(r"^\s*(?:[-*•]\s+|\d+\.\s+)", re.MULTILINE)

# last resort hard wrap by words
def _wrap_by_words(s: str, max_chars: int, overlap: int):
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
                # overlap = tail of previous chunk approx by chars
                tail = buf[-overlap:] if overlap else ""
                buf = (tail + " " + w).strip() if tail else w
            else:
                # extremely long word: hard-cut
                out.append(w[:max_chars])
                buf = w[max_chars - overlap:] if overlap else ""
    if buf:
        out.append(buf)
    return out

# if text is short enough, return as single chunk
# split by sentences if possible
# if no punctuation, fallback to word-based wrapping
def _wrap_by_chars(s: str, max_chars: int, overlap: int):
    s = s.strip()
    if len(s) <= max_chars:
        return [s]
    # sentence split
    parts = re.split(r"(?<=[\.\!\?])\s+", s)

    # words fallback
    if len(parts) == 1:
        return _wrap_by_words(s, max_chars, overlap)

    out, buf = [], ""
    for seg in parts:
        if len(buf) + (1 if buf else 0) + len(seg) <= max_chars:
            buf = f"{buf} {seg}".strip() if buf else seg
        else:
            if buf:
                out.append(buf)
                # add overlap for context
                if overlap and len(buf) > overlap:
                    buf = (buf[-overlap:] + " " + seg).strip()
                else:
                    buf = seg
            else:
                # single sentence longer than max: hard cut the head, keep tail for overlap
                out.append(seg[:max_chars])
                buf = seg[max_chars - overlap:] if overlap else seg[max_chars:]
    if buf:
        out.append(buf.strip())

    # if any chunk is still too long, hard-wrap by words
    final = []
    for c in out:
        if len(c) <= max_chars:
            final.append(c)
        else:
            final.extend(_wrap_by_words(c, max_chars, overlap))
    return final

def split_into_chunks(text: str, max_chars: int = 800, overlap: int = 80):
    """
    Robust splitter:
      1) Split on blank lines (paragraphs).
      2) If a paragraph is long, wrap by sentences; fallback to word-based wrapping.
      3) If the whole note has no blank lines, group every 4 lines into a paragraph.
    """
    text = (text or "").strip()
    if not text:
        return []

    # split into paragraphs by blank lines
    paras = re.split(r"\n\s*\n+", text)

    # if everything is one big block but there are single newlines,
    # group lines into fixed-size paragraphs of 4 lines each
    if len(paras) == 1 and "\n" in text:
        lines = [ln.strip() for ln in text.splitlines()]
        # group every 4 lines into one paragraph
        grouped = []
        for i in range(0, len(lines), 4):
            # join the next 4 lines with spaces
            grp = " ".join([ln for ln in lines[i:i+4] if ln])
            if grp:
                grouped.append(grp)
        # if grouping produced something, use it as paragraphs
        if grouped:
            paras = grouped

    chunks = []
    for p in paras:
        p = p.strip()
        if not p:
            continue

        # if looks like a bulleted list, split per bullet (keeps markers)
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

    # cleanup stray whitespace
    out = []
    for c in chunks:
        c = re.sub(r"[ \t]+\n", "\n", c).strip()
        if c:
            out.append(c)
    return out

def main():
    load_dotenv()
    ap = argparse.ArgumentParser(description="Chunk notes into note_chunks (and embed).")
    ap.add_argument("--max-chars", type=int, default=800, help="Max characters per chunk")
    ap.add_argument("--overlap", type=int, default=80, help="Character overlap between chunks")
    ap.add_argument("--only-missing", action="store_true", help="Only chunk notes that have no chunks yet")
    args = ap.parse_args()

    client = OpenAI() if USE_OPENAI else None
    conn = db()
    try:
        with conn.cursor() as cur:
            if args.only_missing:
                cur.execute("""
                    SELECT n.note_id, n.og_text
                    FROM notes n
                    LEFT JOIN note_chunks c ON c.note_id = n.note_id
                    WHERE c.note_id IS NULL
                    ORDER BY n.note_id;
                """)
            else:
                cur.execute("""
                    SELECT note_id, og_text
                    FROM notes
                    ORDER BY note_id;
                """)
            notes = cur.fetchall()

        print(f"Chunking {len(notes)} notes...")
        total_chunks = 0
        for note_id, og_text in notes:
            chunks = split_into_chunks(og_text, max_chars=args.max_chars, overlap=args.overlap)
            if not chunks:
                continue

            # clear existing chunks for this note before inserting
            with conn.cursor() as cur:
                cur.execute("DELETE FROM note_chunks WHERE note_id=%s;", (note_id,))

            # insert chunks and embeddings
            for idx, ch in enumerate(chunks):
                emb = None
                if client:
                    emb = client.embeddings.create(model=EMBED_MODEL, input=ch).data[0].embedding
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO note_chunks (note_id, chunk_index, text, embedding)
                        VALUES (%s, %s, %s, %s);
                    """, (note_id, idx, ch, emb))
            total_chunks += len(chunks)

        conn.commit()
        print(f"Done. Inserted {total_chunks} chunks.")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
