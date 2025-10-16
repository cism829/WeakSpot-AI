#   python ocr_eval.py --refs comp --hyps ocr_out        
from pathlib import Path
import argparse
from typing import List, Tuple
from jiwer import Compose, ToLowerCase, RemoveMultipleSpaces, Strip, RemovePunctuation

def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")

def normalization_pipeline(remove_punct: bool):
    steps = [ToLowerCase(), RemoveMultipleSpaces(), Strip()]
    if remove_punct:
        steps.append(RemovePunctuation())
    return Compose(steps)

def tokenize(s: str) -> List[str]:
    # after normalization whitespace split is enough for wer
    return s.split()

    # compute levenshtein distance with backtrace to count subs, dels, ins
def edit_counts(ref_tokens: List[str], hyp_tokens: List[str]) -> Tuple[int, int, int, int]:

    # distance = subs + dels + ins


    n, m = len(ref_tokens), len(hyp_tokens)
    dp = [[0]*(m+1) for _ in range(n+1)]
    for i in range(1, n+1):
        dp[i][0] = i
    for j in range(1, m+1):
        dp[0][j] = j

    for i in range(1, n+1):
        r = ref_tokens[i-1]
        for j in range(1, m+1):
            h = hyp_tokens[j-1]
            cost = 0 if r == h else 1
            dp[i][j] = min(
                dp[i-1][j] + 1,        # deletion
                dp[i][j-1] + 1,        # insertion
                dp[i-1][j-1] + cost    # substitution or match
            )

    # Backtrace to count ops
    i, j = n, m
    subs = dels = ins = 0
    while i > 0 or j > 0:
        if i > 0 and dp[i][j] == dp[i-1][j] + 1:
            dels += 1
            i -= 1
        elif j > 0 and dp[i][j] == dp[i][j-1] + 1:
            ins += 1
            j -= 1
        else:
            # diagonal
            if i > 0 and j > 0 and ref_tokens[i-1] != hyp_tokens[j-1]:
                subs += 1
            i -= 1
            j -= 1

    return subs, dels, ins, dp[n][m]

def evaluate_folder(ref_dir: Path, hyp_dir: Path, keep_punct: bool) -> None:
    ref_files = {p.stem: p for p in ref_dir.glob("*.txt")}
    hyp_files = {p.stem: p for p in hyp_dir.glob("*.txt")}
    keys = sorted(set(ref_files) & set(hyp_files))
    if not keys:
        print("No matching basenames between refs/ and ocr_out/.")
        return

    normalizer = normalization_pipeline(remove_punct=not keep_punct)

    rows = []  # (name, wer, ref_len, subs, dels, ins)
    total_ref_words = total_subs = total_dels = total_ins = 0

    for k in keys:
        ref = normalizer(read_text(ref_files[k]))
        hyp = normalizer(read_text(hyp_files[k]))
        ref_toks = tokenize(ref)
        hyp_toks = tokenize(hyp)

        subs, dels, ins, dist = edit_counts(ref_toks, hyp_toks)
        ref_len = max(1, len(ref_toks))  # avoid div-by-zero
        page_wer = dist / ref_len

        rows.append((k, page_wer, len(ref_toks), subs, dels, ins))
        total_ref_words += len(ref_toks)
        total_subs += subs
        total_dels += dels
        total_ins += ins

    macro_wer = sum(r[1] for r in rows) / len(rows)
    micro_wer = (total_subs + total_dels + total_ins) / max(1, total_ref_words)

    print(f"Files evaluated: {len(rows)}")
    print(f"MACRO WER: {macro_wer:.3f}")
    print(f"MICRO WER: {micro_wer:.3f}")
    print(f"Totals (over all files): subs={total_subs}, dels={total_dels}, ins={total_ins}, ref_words={total_ref_words}")
    print()
    print("10 Worst pages by WER:")
    for k, page_wer, ref_len, subs, dels, ins in sorted(rows, key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {k}: WER={page_wer:.3f} (ref_words={ref_len}, S={subs}, D={dels}, I={ins})")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="evaluation of OCR via word error rate")
    ap.add_argument("--refs", default="refs", help="Folder of gold transcripts")
    ap.add_argument("--hyps", default="ocr_out", help="Folder of OCR outputs")
    ap.add_argument("--keep-punct", action="store_true",
                    help="Keep punctuation when computing WER (removed by default).")
    args = ap.parse_args()
    evaluate_folder(Path(args.refs), Path(args.hyps), keep_punct=args.keep_punct)
