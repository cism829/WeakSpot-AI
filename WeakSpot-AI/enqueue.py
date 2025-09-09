# enqueue.py
import argparse
import os
from pathlib import Path
from datetime import timedelta
from rq import Queue
from redis import Redis

def parse_args():
    p = argparse.ArgumentParser("Enqueue one OCR job per sample subfolder.")
    p.add_argument(
        "-i", "--input-dir",
        default=r"C:\Users\trevo\OneDrive\Desktop\490\notes\lines_out",
        help="Folder containing sample subfolders (sample1, sample2, ...)."
    )
    p.add_argument(
        "-o", "--output-dir",
        default=r"C:\Users\trevo\OneDrive\Desktop\490\ocr_out",
        help="Where worker should write per-sample .txt files."
    )
    p.add_argument(
        "--exts",
        nargs="+",
        default=[".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".webp"],
        help="Image file extensions to include."
    )
    p.add_argument(
        "--redis-url",
        default="redis://127.0.0.1:6380/0",
        help="Redis URL for RQ (use redis://, not rediss:// for your setup)."
    )
    p.add_argument(
        "--queue",
        default="ocr",
        help="RQ queue name."
    )
    p.add_argument(
        "--overwrite",
        action="store_true",
        help="If set, worker will overwrite existing .txt outputs."
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be enqueued without sending jobs."
    )
    p.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print extra diagnostic info."
    )
    return p.parse_args()

def main():
    args = parse_args()

    # Basic diagnostics
    print(f"[info] cwd: {os.getcwd()}")
    print(f"[info] input-dir: {args.input_dir}")
    print(f"[info] output-dir: {args.output_dir}")
    print(f"[info] redis-url: {args.redis_url}")
    print(f"[info] queue: {args.queue}")
    print(f"[info] overwrite: {args.overwrite}")
    print(f"[info] dry-run: {args.dry_run}")
    print(f"[info] verbose: {args.verbose}")

    input_dir  = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    exts = [e.lower() if e.startswith(".") else f".{e.lower()}" for e in args.exts]

    if not input_dir.exists():
        raise SystemExit(f"[error] Input directory does not exist: {input_dir}")

    # Connect to Redis and sanity-check with PING
    try:
        redis_conn = Redis.from_url(args.redis_url)
        pong = redis_conn.ping()
        print(f"[info] redis PING: {pong}")
    except Exception as e:
        raise SystemExit(f"[error] Could not connect to Redis at {args.redis_url}: {e}")

    q = Queue(args.queue, connection=redis_conn, default_timeout=60*60)  # 1h per job

    # Discover immediate subfolders
    sample_dirs = sorted([p for p in input_dir.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    print(f"[info] found {len(sample_dirs)} subfolder(s) under {input_dir}")
    if args.verbose:
        for p in sample_dirs:
            print(f"  - {p.name}")

    if not sample_dirs:
        raise SystemExit("[error] No subfolders found to enqueue. (Expected e.g., sample1, sample2, ...)")

    enq_count = 0
    for sample_dir in sample_dirs:
        safe_name = sample_dir.name.replace(":", "-")
        job_id = f"folder-ocr--{safe_name}"

        if args.dry_run:
            print(f"[dry-run] would enqueue: {sample_dir.name} -> job_id={job_id}")
            enq_count += 1
            continue

        job = q.enqueue(
            "workers.folder_worker.process_sample_folder",
            str(sample_dir),
            str(output_dir),
            exts,
            args.overwrite,
            job_id=job_id,
            result_ttl=int(timedelta(days=3).total_seconds()),
            failure_ttl=int(timedelta(days=7).total_seconds()),
            ttl=int(timedelta(hours=2).total_seconds()),
            retry=None
        )
        print(f"[enqueued] {sample_dir.name} -> job_id={job.id}")
        enq_count += 1

    print(f"[ok] Enqueued {enq_count} job(s) to queue '{args.queue}'")

if __name__ == "__main__":
    main()
