import os
import sys
import argparse
from pathlib import Path

from dotenv import load_dotenv
import psycopg2


#read db connection from env, use defaults if missing
def get_db_conn():
    return psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=int(os.getenv("PGPORT", "5432")),
        dbname=os.getenv("PGDATABASE", "weak_spot"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", "password")
    )

#check for existing user, create for now before combining systems
def get_or_create_user(conn, username: str) -> int:
    with conn.cursor() as cur:
        cur.execute('SELECT user_id FROM "user" WHERE username=%s;', (username,))
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            'INSERT INTO "user"(username, first_name, last_name, password, email, role) '
            'VALUES (%s, %s, %s, %s, %s, %s) RETURNING user_id;',
            (username, username, "", "<hashed_pw_here>", f"{username}@example.com", "student")
        )
        (user_id,) = cur.fetchone()
        conn.commit()
        return user_id

def insert_note(conn, *, user_id: int, text: str, subject: str, status: str = "new"):

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO notes (user_id, og_text, status, subject)
            VALUES (%s, %s, %s, %s)
            RETURNING note_id;
            """,
            (user_id, text, status, subject)
        )
        (note_id,) = cur.fetchone()
        conn.commit()
        return note_id



def main():
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Import .txt OCR pages into PostgreSQL notes table."
    )
    parser.add_argument(
        "--dir",
        default=os.getenv("OCR_OUT_DIR", r"C:\Users\trevo\OneDrive\Desktop\490\ocr_out"),
        help="Folder containing .txt files (one page per file)."
    )
    parser.add_argument(
        "--username",
        default=os.getenv("NOTES_DEFAULT_USER", "trevor"),
        help="Username to own the notes (will be created if missing)."
    )
    parser.add_argument(
        "--subject",
        default=os.getenv("NOTES_DEFAULT_SUBJECT", "General"),
        help="Subject to store for each note page."
    )
    parser.add_argument(
        "--skip-empty",
        action="store_true",
        help="Skip files whose content is empty/whitespace."
    )

    args = parser.parse_args()
    txt_dir = Path(args.dir)

    if not txt_dir.exists():
        print(f"ERROR: directory not found: {txt_dir}")
        sys.exit(1)

    txt_files = sorted([p for p in txt_dir.glob("*.txt") if p.is_file()])
    if not txt_files:
        print(f"No .txt files found in: {txt_dir}")
        sys.exit(0)

    #connect once
    #iterate files, insert one DB row per file
    conn = get_db_conn()
    try:
        user_id = get_or_create_user(conn, args.username)
        print(f"Using user '{args.username}' (user_id={user_id}).")
        print(f"Importing {len(txt_files)} file(s) from {txt_dir} into notes…")

        ok, fail = 0, 0
        for i, path in enumerate(txt_files, 1):
            try:
                text = path.read_text(encoding="utf-8", errors="replace").strip("\ufeff")
                if args.skip_empty and (text.strip() == ""):
                    print(f"[{i}/{len(txt_files)}] SKIP (empty) -> {path.name}")
                    continue

                note_id = insert_note(
                    conn,
                    user_id=user_id,
                    text=text,
                    subject=args.subject,
                    status="new",
                )
                print(f"[{i}/{len(txt_files)}] OK   -> {path.name} (note_id={note_id})")
                ok += 1
            except Exception as e:
                print(f"[{i}/{len(txt_files)}] FAIL -> {path.name}: {e}")
                fail += 1

        print(f"Done. Inserted: {ok}, Failed: {fail}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
