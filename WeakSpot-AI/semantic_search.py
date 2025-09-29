import os
import argparse
from dotenv import load_dotenv
import psycopg2
from openai import OpenAI

EMBED_MODEL = os.getenv("EMBED_MODEL", "text-embedding-3-small")

def db():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "weak_spot"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "password"),
    )

def main():
    load_dotenv()

    ap = argparse.ArgumentParser(description="Semantic search over note_chunks (best chunk per note).")
    ap.add_argument("query", help="Search phrase")
    ap.add_argument("--k", type=int, default=10, help="Max number of parent notes to return")
    ap.add_argument("--threshold", type=float, default=0.7, help="Max cosine distance (lower = closer)")
    args = ap.parse_args()

    client = OpenAI()
    qemb = client.embeddings.create(model=EMBED_MODEL, input=args.query).data[0].embedding

    conn = db()
    try:
        # score all chunks, pick the best chunk per note_id, then filter & sort.
        sql = """
            WITH scored AS (
                SELECT
                    c.note_id,
                    c.chunk_index,
                    c.text,
                    (c.embedding <=> %s::vector) AS distance
                FROM note_chunks c
                WHERE c.embedding IS NOT NULL
            ),
            ranked AS (
                SELECT
                    note_id,
                    chunk_index,
                    text,
                    distance,
                    ROW_NUMBER() OVER (PARTITION BY note_id ORDER BY distance ASC) AS rn
                FROM scored
            )
            SELECT
                note_id,
                chunk_index,
                text,
                distance
            FROM ranked
            WHERE rn = 1            -- keep only the best chunk per note
              AND distance <= %s    -- apply threshold
            ORDER BY distance ASC
            LIMIT %s;               -- cap how many parent notes we return
        """

        with conn.cursor() as cur:
            cur.execute(sql, (qemb, args.threshold, args.k))
            rows = cur.fetchall()

        if not rows:
            print(f'No results for "{args.query}" under distance {args.threshold}')
            return

        print(f'Top {len(rows)} matches for "{args.query}" (threshold={args.threshold}):')
        for i, (note_id, chunk_index, text, dist) in enumerate(rows, 1):
            preview = (text or "").replace("\n", " ")[:120]
            print(f"{i:2d}. note_id={note_id}  chunk_index={chunk_index}  dist={dist:.4f}")
            print(f"    {preview}")

    finally:
        conn.close()

if __name__ == "__main__":
    main()
